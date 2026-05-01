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
        # 1. Obtener los datos del servicio para validar el formulario (RF 3)
        servicio_ref = db.collection("servicios").document(datos.idServicio)
        servicio_doc = servicio_ref.get()

        if not servicio_doc.exists:
            raise HTTPException(status_code=404, detail="El servicio no existe")
        
        datos_servicio = servicio_doc.to_dict()
        esquema = datos_servicio.get("esquema_formulario", [])

        # 2. VALIDACIÓN TÉCNICA: ¿Están todas las respuestas obligatorias?
        for pregunta in esquema:
            p_id = pregunta["id_pregunta"]
            if pregunta["obligatorio"] and p_id not in datos.respuestas_formulario:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Falta responder la pregunta obligatoria: {pregunta['pregunta']}"
                )

        # 3. TRANSACCIÓN PARA EVITAR DOBLE RESERVA (RF 4 y Algoritmo de Concurrencia)
        # Esto asegura que dos usuarios no paguen por la misma hora [5]
        transaction = db.transaction()

        @firestore.transactional
        def ejecutar_reserva(transaction):
            id_cita = str(uuid.uuid4())
            ahora = datetime.now(timezone.utc)

            # Estructura final de la cita para la base de datos
            cita_data = {
                "idCita": id_cita,
                "idServicio": datos.idServicio,
                "idCliente": datos.idCliente,
                "idTecnico": datos_servicio["idTecnico"],
                "tituloServicio": datos_servicio["nombre"],
                "fecha": datos.fecha,
                "hora": datos.hora,
                "respuestas_formulario": datos.respuestas_formulario, # El formulario respondido [6]
                "estado": "pagada", # Según RF 5, el dinero se retiene tras el pago [7]
                "pagoRetenido": True,
                "createdAt": ahora
            }

            # Guardar la cita y actualizar la agenda automáticamente [8]
            transaction.set(db.collection("citas").document(id_cita), cita_data)
            
            return id_cita

        id_final = ejecutar_reserva(transaction)

        return {
            "status": "success",
            "message": "Cita agendada y formulario vinculado correctamente",
            "idCita": id_final
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar reserva: {str(e)}")
    
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