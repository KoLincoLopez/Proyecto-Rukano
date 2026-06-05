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
    Excluye las citas con estado 'cancelada' para que esos horarios queden libres.
    Formato fecha esperado: YYYY-MM-DD
    """
    try:
        docs = (
            db.collection("citas")
            .where(filter=FieldFilter("idTecnico", "==", tecnico_id))
            .where(filter=FieldFilter("fecha", "==", fecha))
            .stream()
        )
        
        horas_ocupadas = []
        
        for doc in docs:
            cita_data = doc.to_dict()
            estado = cita_data.get("estado", "").lower()
            hora = cita_data.get("hora")
            
            # REGLA: Si la cita está cancelada o reembolsada, se ignora (el horario queda disponible)
            if estado != "cancelada" and estado != "reembolso_solicitado" and hora:
                horas_ocupadas.append(hora)
                
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

# --- ENDPOINT NOTIFICACIONES: CITAS PENDIENTES (TÉCNICO) ---
@router.get("/notificaciones/tecnico/{tecnico_id}/pendientes")
async def contar_citas_pendientes_tecnico(tecnico_id: str):
    """
    Devuelve la cantidad de citas en estado 'pendiente' para un técnico.
    Ideal para mostrar globos de notificación en el dashboard.
    """
    try:
        query = (
            db.collection("citas")
            .where(filter=FieldFilter("idTecnico", "==", tecnico_id))
            .where(filter=FieldFilter("estado", "==", "pendiente"))
            .stream()
        )
        
        # sum() iterará el generador de forma muy eficiente sin cargar grandes listas
        cantidad = sum(1 for _ in query)
        
        return {
            "status": "success", 
            "tecnico_id": tecnico_id,
            "cantidad_pendientes": cantidad
        }
    except Exception as e:
        print(f"Error al contar notificaciones del técnico: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al contar citas pendientes")


# --- ENDPOINT NOTIFICACIONES: CITAS RESERVADAS (CLIENTE) ---
@router.get("/notificaciones/cliente/{cliente_id}/reservadas")
async def contar_citas_reservadas_cliente(cliente_id: str):
    """
    Devuelve la cantidad de citas en estado 'reservada' para un cliente.
    Ideal para avisarle que tiene que realizar el pago o tomar acción.
    """
    try:
        query = (
            db.collection("citas")
            .where(filter=FieldFilter("idCliente", "==", cliente_id))
            .where(filter=FieldFilter("estado", "==", "reservada"))
            .stream()
        )
        
        cantidad = sum(1 for _ in query)
        
        return {
            "status": "success", 
            "cliente_id": cliente_id,
            "cantidad_reservadas": cantidad
        }
    except Exception as e:
        print(f"Error al contar notificaciones del cliente: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al contar citas reservadas")


# --- MODELO PARA CANCELACIÓN POR CLIENTE ---
class CancelarCitaCliente(BaseModel):
    idCliente: str

# --- ENDPOINT: CANCELAR CITA POR EL CLIENTE (pendiente o reservada -> cancelada) ---
@router.patch("/{id_cita}/cancelar-cliente")
async def cancelar_cita_cliente(id_cita: str, payload: CancelarCitaCliente):
    """
    Permite al cliente cancelar una cita propia en estado 'pendiente' o 'reservada'.
    Reglas:
      - Solo el cliente dueño de la cita puede cancelarla.
      - No se puede cancelar una cita cuya fecha sea el mismo día de hoy.
      - Solo aplica a citas en estado 'pendiente' o 'reservada'.
    """
    try:
        zona_horaria = pytz.timezone("America/Santiago")
        hoy_str = datetime.now(zona_horaria).strftime("%Y-%m-%d")

        cita_ref = db.collection("citas").document(id_cita)

        @firestore.transactional
        def procesar_cancelacion_cliente(transaction, ref):
            snapshot = ref.get(transaction=transaction)

            if not snapshot.exists:
                raise HTTPException(status_code=404, detail="La cita no existe en la base de datos.")

            cita_data = snapshot.to_dict()

            # Validar que sea el cliente dueño de la cita
            if cita_data.get("idCliente") != payload.idCliente:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permisos para cancelar esta cita."
                )

            # Validar que la fecha de la cita no sea hoy ni anterior
            fecha_cita = cita_data.get("fecha", "")
            if fecha_cita <= hoy_str:
                raise HTTPException(
                    status_code=400,
                    detail="No puedes cancelar una cita para el mismo día o con fecha pasada."
                )

            # Validar que el estado permita la cancelación
            estado_actual = cita_data.get("estado", "").lower()
            if estado_actual not in ("pendiente", "reservada"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Operación rechazada: Solo se pueden cancelar citas en estado 'pendiente' o 'reservada' (Estado actual: '{estado_actual}')."
                )

            transaction.update(ref, {
                "estado": "cancelada",
                "canceladoPor": "cliente",
                "modificadoEn": datetime.now(timezone.utc)
            })

            return "cancelada"

        transaction = db.transaction()
        procesar_cancelacion_cliente(transaction, cita_ref)

        return {
            "status": "success",
            "message": "La cita fue cancelada correctamente.",
            "idCita": id_cita
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERROR AL CANCELAR CITA (CLIENTE): {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al intentar cancelar la cita.")


# --- MODELO PARA SOLICITAR REEMBOLSO ---
class SolicitarReembolso(BaseModel):
    idCliente: str

# --- ENDPOINT: SOLICITAR REEMBOLSO POR EL CLIENTE (pendiente_pago -> reembolso_solicitado) ---
@router.patch("/{id_cita}/solicitar-reembolso")
async def solicitar_reembolso_cliente(id_cita: str, payload: SolicitarReembolso):
    """
    Permite al cliente solicitar un reembolso en una cita en estado 'pendiente_pago'.
    Reglas:
      - Solo el cliente dueño de la cita puede solicitarlo.
      - No se puede solicitar reembolso si la fecha de la cita es hoy o ya pasó.
      - Solo aplica a citas en estado 'pago_realizado'.
    """
    try:
        zona_horaria = pytz.timezone("America/Santiago")
        hoy_str = datetime.now(zona_horaria).strftime("%Y-%m-%d")

        cita_ref = db.collection("citas").document(id_cita)

        @firestore.transactional
        def procesar_reembolso(transaction, ref):
            snapshot = ref.get(transaction=transaction)

            if not snapshot.exists:
                raise HTTPException(status_code=404, detail="La cita no existe en la base de datos.")

            cita_data = snapshot.to_dict()

            # Validar que sea el cliente dueño de la cita
            if cita_data.get("idCliente") != payload.idCliente:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permisos para solicitar reembolso en esta cita."
                )

            # Validar que la fecha de la cita no sea hoy ni anterior
            fecha_cita = cita_data.get("fecha", "")
            if fecha_cita <= hoy_str:
                raise HTTPException(
                    status_code=400,
                    detail="No puedes solicitar reembolso en una cita para el mismo día o con fecha pasada."
                )

            # Validar que el estado sea 'pago_realizado'
            estado_actual = cita_data.get("estado", "").lower()
            if estado_actual != "pago_realizado":
                raise HTTPException(
                    status_code=400,
                    detail=f"Operación rechazada: Solo se puede solicitar reembolso en citas con estado 'pago_realizado' (Estado actual: '{estado_actual}')."
                )

            transaction.update(ref, {
                "estado": "reembolso_solicitado",
                "modificadoEn": datetime.now(timezone.utc)
            })

            return "reembolso_solicitado"

        transaction = db.transaction()
        procesar_reembolso(transaction, cita_ref)

        return {
            "status": "success",
            "message": "Solicitud de reembolso registrada correctamente. Será revisada por el equipo.",
            "idCita": id_cita
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERROR AL SOLICITAR REEMBOLSO (CLIENTE): {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al intentar solicitar el reembolso.")


# --- MODELO PARA CONFIRMAR TRABAJO ---
class ConfirmarTrabajo(BaseModel):
    idTecnico: str

# --- ENDPOINT: CONFIRMAR TRABAJO (pago_realizado -> concluida) ---
@router.patch("/{id_cita}/concluir")
async def concluir_cita(id_cita: str, payload: ConfirmarTrabajo):
    """
    Permite al técnico marcar una cita como 'concluida'.
    Requisitos:
      - La cita debe estar en estado 'pago_realizado'.
      - La fecha de la cita debe ser igual o anterior a hoy.
      - Solo el técnico dueño de la cita puede concluirla.
    """
    try:
        zona_horaria = pytz.timezone("America/Santiago")
        hoy_str = datetime.now(zona_horaria).strftime("%Y-%m-%d")

        cita_ref = db.collection("citas").document(id_cita)

        @firestore.transactional
        def procesar_conclusion(transaction, ref):
            snapshot = ref.get(transaction=transaction)

            if not snapshot.exists:
                raise HTTPException(status_code=404, detail="La cita no existe en la base de datos.")

            cita_data = snapshot.to_dict()

            # Validar que sea el técnico dueño
            if cita_data.get("idTecnico") != payload.idTecnico:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permisos para concluir esta cita."
                )

            # Validar estado
            estado_actual = cita_data.get("estado", "").lower()
            if estado_actual != "pago_realizado":
                raise HTTPException(
                    status_code=400,
                    detail=f"Operación rechazada: La cita debe estar en 'pago_realizado' para poder concluirse (Estado actual: '{estado_actual}')."
                )

            # Validar que la fecha de la cita ya llegó
            fecha_cita = cita_data.get("fecha", "")
            if fecha_cita > hoy_str:
                raise HTTPException(
                    status_code=400,
                    detail=f"Operación rechazada: No puedes concluir una cita que aún no ha ocurrido (Fecha de la cita: '{fecha_cita}')."
                )

            transaction.update(ref, {
                "estado": "concluida",
                "modificadoEn": datetime.now(timezone.utc)
            })

            return "concluida"

        transaction = db.transaction()
        procesar_conclusion(transaction, cita_ref)

        return {
            "status": "success",
            "message": "La cita fue marcada como concluida correctamente.",
            "idCita": id_cita
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERROR AL CONCLUIR CITA: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al intentar concluir la cita.")