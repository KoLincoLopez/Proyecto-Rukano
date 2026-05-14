from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
from core.firebase_config import db
from google.cloud import firestore # Para transacciones de concurrencia

router = APIRouter()

# --- MODELO DE DATOS PARA LA RESERVA ---
class ReservaCita(BaseModel):
    idServicio: str
    idCliente: str
    fecha: str  # Formato "YYYY-MM-DD"
    hora: str   # Formato "HH:MM"
    # Aquí es donde el cliente envía el formulario ya respondido
    respuestas_formulario: dict 

# --- ENDPOINT: RESERVAR CON VALIDACIÓN DE FORMULARIO ---
@router.post("/reservar")
async def reservar_cita(datos: ReservaCita):
    try:
        servicio_ref = db.collection("servicios").document(datos.idServicio)
        servicio_doc = servicio_ref.get()

        if not servicio_doc.exists:
            raise HTTPException(status_code=404, detail="El servicio no existe")
        
        datos_servicio = servicio_doc.to_dict()
        esquema = datos_servicio.get("esquema_formulario", [])

        # --- CORRECCIÓN DE VALIDACIÓN (RF 3) ---
        # Convertimos todo a string para evitar errores de tipo int vs str
        respuestas_str = {str(k): v for k, v in datos.respuestas_formulario.items()}

        for pregunta in esquema:
            p_id = str(pregunta["id_pregunta"]) # Forzamos a string
            if pregunta.get("obligatorio") and p_id not in respuestas_str:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Falta pregunta obligatoria: {pregunta.get('pregunta')}"
                )

        # --- TRANSACCIÓN (RF 4) ---
        @firestore.transactional
        def ejecutar_reserva(transaction):
            id_cita = str(uuid.uuid4())
            ahora = datetime.now(timezone.utc)

            # Usamos .get con valores por defecto para evitar Error 500
            cita_data = {
                "idCita": id_cita,
                "idServicio": datos.idServicio,
                "idCliente": datos.idCliente,
                "idTecnico": datos_servicio.get("idTecnico", "N/A"),
                "tituloServicio": datos_servicio.get("nombre", "Servicio sin nombre"),
                "fecha": datos.fecha,
                "hora": datos.hora,
                "respuestas_formulario": respuestas_str,
                "estado": "pagada",
                "pagoRetenido": True,
                "createdAt": ahora
            }

            transaction.set(db.collection("citas").document(id_cita), cita_data)
            return id_cita

        transaction = db.transaction()
        id_final = ejecutar_reserva(transaction)

        return {"status": "success", "idCita": id_final}

    except HTTPException as he:
        raise he
    except Exception as e:
        # Esto te dirá el error real en la terminal (ej. falta un import)
        print(f"ERROR CRÍTICO: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
"""
Ejemplo de payload para reservar una cita con el formulario respondido:
{
  "idServicio": "f1d0abce-82cf-4943-85c7-c67eae9a57c0",
  "idCliente": "1",
  "fecha": "string",
  "hora": "string",
  "respuestas_formulario": {
    "1": "Si",
    "2": "Calefón Junkers modelo 2022"
  }
}
"""

# --- OBTENER CITAS DEL TÉCNICO (AGUDA VIRTUAL) ---
@router.get("/agenda/{tecnico_id}")
async def obtener_agenda(tecnico_id: str):
    # RF 4: El técnico puede visualizar sus compromisos de forma ordenada [8]
    docs = db.collection("citas").where("idTecnico", "==", tecnico_id).stream()
    agenda = [doc.to_dict() for doc in docs]
    return sorted(agenda, key=lambda x: (x['fecha'], x['hora']))
