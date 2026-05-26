from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
from core.firebase_config import db
from google.cloud import firestore # Para transacciones de concurrencia
from google.cloud.firestore import FieldFilter
import pytz # Para manejo de zonas horarias en el cron job de actualización de estados

router = APIRouter()

# --- MODELO DE DATOS PARA LA RESERVA ---
class ReservaCita(BaseModel):
    idServicio: str
    idCliente: str
    fecha: str  # Formato "YYYY-MM-DD"
    hora: str   # Formato "HH:MM"
    # Aquí es donde el cliente envía el formulario ya respondido
    respuestas_formulario: dict 

# ---MODELO DE DATOS PARA ACTUALIZAR ESTADO DE CITA (RESERVADA/CANCELADA)---
class ActualizarEstadoCita(BaseModel):
    idTecnico: str
    nuevo_estado: str  # Solo permitiremos "reservada" o "cancelada"

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
                "estado": "pendiente",
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
    # RF 4: El técnico puede visualizar sus compromisos de forma ordenada
    docs = db.collection("citas").where(filter=FieldFilter("idTecnico", "==", tecnico_id)).stream()
    agenda = [doc.to_dict() for doc in docs]
    return sorted(agenda, key=lambda x: (x['fecha'], x['hora']))

# ── NUEVO: horas ocupadas por técnico y fecha (para el calendario del frontend) ──
@router.get("/horas_ocupadas/{tecnico_id}/{fecha}")
async def obtener_horas_ocupadas(tecnico_id: str, fecha: str):
    """
    Devuelve las horas ya reservadas para un técnico en una fecha específica.
    El frontend usa esto para deshabilitar esos slots en el selector de horario.
    Formato fecha esperado: YYYY-MM-DD
    """
    try:
        docs = (
            db.collection("citas")
            .where(filter=FieldFilter("idTecnico", "==", tecnico_id))
            .where(filter=FieldFilter("fecha", "==", fecha))
            .stream()
        )
        horas_ocupadas = [doc.to_dict().get("hora") for doc in docs]
        horas_ocupadas = [h for h in horas_ocupadas if h]  # filtramos None
        return {"status": "success", "fecha": fecha, "horas_ocupadas": horas_ocupadas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar agenda: {str(e)}")

@router.get("/agenda/cliente/{cliente_id}")
async def obtener_citas_cliente(cliente_id: str):
    # Devuelve las citas asociadas a un cliente (idCliente)
    docs = db.collection("citas").where(filter=FieldFilter("idCliente", "==", cliente_id)).stream()
    citas = [doc.to_dict() for doc in docs]
    return sorted(citas, key=lambda x: (x['fecha'], x['hora']))

# --- ENDPOINT: CAMBIAR ESTADO DE LA CITA (DE PENDIENTE A RESERVADA/CANCELADA) ---
@router.patch("/{id_cita}/estado")
async def cambiar_estado_cita(id_cita: str, payload: ActualizarEstadoCita):
    try:
        # 1. Validar que el nuevo estado sea estrictamente uno de los permitidos
        estados_permitidos = ["reservada", "cancelada", "pago_realizado"]
        if payload.nuevo_estado not in estados_permitidos:
            raise HTTPException(
                status_code=400, 
                detail="El estado proporcionado no es válido. Debe ser 'reservada' o 'cancelada'."
            )

        cita_ref = db.collection("citas").document(id_cita)

        # 2. Usar transacción para garantizar una lectura/escritura atómica
        @firestore.transactional
        def procesar_cambio_estado(transaction, ref):
            snapshot = ref.get(transaction=transaction)

            if not snapshot.exists:
                raise HTTPException(status_code=404, detail="La cita no existe en la base de datos.")

            cita_data = snapshot.to_dict()

            # 3. Validar que el técnico que pide el cambio sea el dueño de la cita
            if cita_data.get("idTecnico") != payload.idTecnico:
                raise HTTPException(
                    status_code=403, 
                    detail="No tienes permisos para modificar esta cita porque pertenece a otro técnico."
                )

            # 4. REGLA DE NEGOCIO: Solo se puede cambiar si el estado actual es "pendiente" o "reservada"
            estado_actual = cita_data.get("estado", "").lower()
            if estado_actual == "pendiente" and payload.nuevo_estado == "pago_realizado":
                raise HTTPException(
                    status_code=400,
                    detail="Operación rechazada: La cita debe estar 'reservada' antes de poder pagar."
                )
            if estado_actual not in ("pendiente", "reservada"):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Operación rechazada: La cita ya no está en un estado modificable (Estado actual: '{estado_actual}')."
                )
            if estado_actual == "reservada" and payload.nuevo_estado not in ("cancelada", "pago_realizado"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Operación rechazada: Desde 'reservada' solo se puede cancelar o pagar."
                )

            # 5. Ejecutar la actualización
            transaction.update(ref, {
                "estado": payload.nuevo_estado,
                "modificadoEn": datetime.now(timezone.utc)
            })

            return payload.nuevo_estado

        transaction = db.transaction()
        nuevo_estado_aplicado = procesar_cambio_estado(transaction, cita_ref)

        return {
            "status": "success", 
            "message": f"El estado de la cita se actualizó correctamente a '{nuevo_estado_aplicado}'.",
            "idCita": id_cita
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERROR AL ACTUALIZAR ESTADO DE CITA: {str(e)}")
        raise HTTPException(status_code=500, detail="Ocurrió un error interno al intentar actualizar la cita.")
    
# --- ENDPOINT CRON: ACTUALIZACIÓN AUTOMÁTICA DE ESTADOS POR FECHA ---
@router.post("/cron/verificar-fechas-citas")
async def verificar_y_actualizar_citas():
    """
    Este endpoint está diseñado para ejecutarse de forma automática (ej. cada noche a las 00:00, aunque de momento lo lanzaremos manualmente de forma silencionsa).
    Revisa las citas cuya fecha ya llegó o expiró y ajusta sus estados:
    - 'pendiente' -> 'cancelada'
    - 'reservada' -> 'pendiente_pago'
    """
    try:
        # 1. Obtener la fecha de hoy en la zona horaria correcta (ej: America/Santiago)
        # Esto evita que por desfase de UTC se cancelen citas antes de tiempo.
        zona_horaria = pytz.timezone("America/Santiago")
        hoy_str = datetime.now(zona_horaria).strftime("%Y-%m-%d")

        batch = db.batch()
        contador_actualizaciones = 0

        # --- CASO 1: Citas 'pendiente' que llegaron al día de la cita -> 'cancelada' ---
        citas_pendientes_query = (
            db.collection("citas")
            .where(filter=FieldFilter("estado", "==", "pendiente"))
            .where(filter=FieldFilter("fecha", "<=", hoy_str)) # "<=" por si alguna del pasado quedó colgada
            .stream()
        )

        for doc in citas_pendientes_query:
            doc_ref = db.collection("citas").document(doc.id)
            batch.update(doc_ref, {
                "estado": "cancelada",
                "motivo_sistema": "Cancelación automática por falta de confirmación al llegar la fecha límite.",
                "updatedAt": datetime.utcnow()
            })
            contador_actualizaciones += 1

        # --- CASO 2: Citas 'reservada' que llegaron al día de la cita -> 'pendiente_pago' ---
        citas_reservadas_query = (
            db.collection("citas")
            .where(filter=FieldFilter("estado", "==", "reservada"))
            .where(filter=FieldFilter("fecha", "<=", hoy_str))
            .stream()
        )

        for doc in citas_reservadas_query:
            doc_ref = db.collection("citas").document(doc.id)
            batch.update(doc_ref, {
                "estado": "pendiente_pago",
                "updatedAt": datetime.utcnow()
            })
            contador_actualizaciones += 1

        # 2. Confirmar los cambios en Firestore si se encontró algo
        if contador_actualizaciones > 0:
            batch.commit()

        return {
            "status": "success",
            "message": f"Proceso completado. Se actualizaron {contador_actualizaciones} citas con éxito.",
            "fecha_evaluada": hoy_str
        }

    except Exception as e:
        print(f"ERROR EN CRON DE CITAS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno en el procesamiento por lote: {str(e)}")