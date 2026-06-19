from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import uuid
from core.firebase_config import db
from models.enums import EstadoCita, RolUsuario
from routers.auth import obtener_usuario_autenticado
from google.cloud import firestore # Para transacciones de concurrencia
from google.cloud.firestore import FieldFilter
import pytz # Para manejo de zonas horarias en el cron job de actualización de estados
from services.availability_service import (
    estado_bloquea_horario,
    liberar_bloque,
    ocupar_bloque,
)

router = APIRouter()

# --- MODELO DE DATOS PARA LA RESERVA ---
class ReservaCita(BaseModel):
    idServicio: str
    fecha: str  # Formato "YYYY-MM-DD"
    hora: str   # Formato "HH:MM"
    # Aquí es donde el cliente envía el formulario ya respondido
    respuestas_formulario: dict = Field(default_factory=dict)

# ---MODELO DE DATOS PARA ACTUALIZAR ESTADO DE CITA (RESERVADA/CANCELADA)---
class ActualizarEstadoCita(BaseModel):
    nuevo_estado: str  # Solo permitiremos "reservada" o "cancelada"

# --- ENDPOINT: RESERVAR CON VALIDACIÓN DE FORMULARIO ---
@router.post("/reservar")
async def reservar_cita(
    datos: ReservaCita,
    authorization: str | None = Header(default=None)
):
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
        servicio_ref = db.collection("servicios").document(datos.idServicio)
        servicio_doc = servicio_ref.get()

        if not servicio_doc.exists:
            raise HTTPException(status_code=404, detail="El servicio no existe")

        datos_servicio = servicio_doc.to_dict()
        id_tecnico = datos_servicio.get("idTecnico")
        if not id_tecnico:
            raise HTTPException(status_code=400, detail="El servicio no tiene tecnico asociado")

        tecnico_doc = db.collection("usuarios").document(id_tecnico).get()
        if not tecnico_doc.exists:
            raise HTTPException(status_code=400, detail="El tecnico asociado no existe")

        zona_horaria = pytz.timezone("America/Santiago")
        try:
            fecha_hora = zona_horaria.localize(
                datetime.strptime(f"{datos.fecha} {datos.hora}", "%Y-%m-%d %H:%M")
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=400,
                detail="Fecha u hora invalida. Usa YYYY-MM-DD y HH:MM"
            ) from exc

        if fecha_hora <= datetime.now(zona_horaria):
            raise HTTPException(status_code=400, detail="La cita debe programarse en una fecha futura")

        dias_semana = {
            0: "lunes",
            1: "martes",
            2: "miercoles",
            3: "jueves",
            4: "viernes",
            5: "sabado",
            6: "domingo"
        }
        dia_cita = dias_semana[fecha_hora.weekday()]
        disponibilidad = datos_servicio.get("disponibilidad") or []
        horario_valido = any(
            str(item.get("dia") or "").strip().lower()
            .replace("é", "e").replace("á", "a")
            == dia_cita
            and str(item.get("inicio") or item.get("hora_inicio") or "") <= datos.hora
            and datos.hora < str(item.get("fin") or item.get("hora_fin") or "")
            for item in disponibilidad
        )
        ## Debug: Imprime la disponibilidad y el día de la cita para verificar
        print(f"DEBUG disponibilidad: {disponibilidad}")
        print(f"DEBUG dia_cita: {dia_cita}")
        print(f"DEBUG hora enviada: {datos.hora}")
        if not horario_valido:
            raise HTTPException(
                status_code=400,
                detail="El horario seleccionado no esta dentro de la disponibilidad del tecnico"
            )

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
            ocupar_bloque(
                transaction,
                id_tecnico,
                datos.fecha,
                datos.hora,
                id_cita,
            )

            # Usamos .get con valores por defecto para evitar Error 500
            cita_data = {
                "idCita": id_cita,
                "idServicio": datos.idServicio,
                "idCliente": uid_cliente,
                "idTecnico": id_tecnico,
                "tituloServicio": datos_servicio.get("nombre", "Servicio sin nombre"),
                "precio": datos_servicio.get("precio"),
                "fecha": datos.fecha,
                "hora": datos.hora,
                "respuestas_formulario": respuestas_str,
                "estado": EstadoCita.PENDIENTE.value,
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
async def obtener_agenda(
    tecnico_id: str,
    authorization: str | None = Header(default=None)
):
    uid_tecnico, _ = obtener_usuario_autenticado(
        authorization,
        RolUsuario.TECNICO.value
    )
    if tecnico_id != uid_tecnico:
        raise HTTPException(status_code=403, detail="No puedes consultar la agenda de otro técnico")
    # RF 4: El técnico puede visualizar sus compromisos de forma ordenada
    docs = db.collection("citas").where(filter=FieldFilter("idTecnico", "==", tecnico_id)).stream()
    agenda = [doc.to_dict() for doc in docs]
    return sorted(agenda, key=lambda x: (x['fecha'], x['hora']))

# ── NUEVO: horas ocupadas por técnico y fecha (para el calendario del frontend) ──
@router.get("/horas_ocupadas/{tecnico_id}/{fecha}")
async def obtener_horas_ocupadas(tecnico_id: str, fecha: str):
    """
    Devuelve las horas bloqueadas por citas activas de un técnico en una fecha.
    Solo pendiente, reservada y pago_realizado ocupan el horario.
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

            if estado_bloquea_horario(estado) and hora:
                horas_ocupadas.append(hora)

        return {"status": "success", "fecha": fecha, "horas_ocupadas": horas_ocupadas}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar agenda: {str(e)}")

@router.get("/agenda/cliente/{cliente_id}")
async def obtener_citas_cliente(
    cliente_id: str,
    authorization: str | None = Header(default=None)
):
    uid_cliente, _ = obtener_usuario_autenticado(
        authorization,
        RolUsuario.CLIENTE.value
    )
    if cliente_id != uid_cliente:
        raise HTTPException(status_code=403, detail="No puedes consultar las citas de otro cliente")

    docs = db.collection("citas").where(filter=FieldFilter("idCliente", "==", cliente_id)).stream()

    # Caché de nombres de técnicos para evitar consultas repetidas a Firestore
    cache_tecnicos: dict[str, str] = {}

    citas_enriquecidas = []
    for doc in docs:
        cita = doc.to_dict()

        # --- SANITIZACIÓN: eliminar campos internos sensibles antes de enviar al cliente ---
        id_tecnico = cita.pop("idTecnico", None)
        cita.pop("idCliente", None)  # El cliente ya sabe quién es; no necesita ver su propio UID

        # Resolver nombre del técnico usando caché local para minimizar lecturas a Firestore
        nombre_tecnico = "Técnico no disponible"
        if id_tecnico:
            if id_tecnico not in cache_tecnicos:
                tecnico_doc = db.collection("usuarios").document(id_tecnico).get()
                if tecnico_doc.exists:
                    datos_tecnico = tecnico_doc.to_dict()
                    # Solo extraemos el nombre para mostrar; ningún campo de auth/seguridad sale
                    nombre_tecnico = datos_tecnico.get("nombre") or datos_tecnico.get("displayName") or "Técnico sin nombre"
                cache_tecnicos[id_tecnico] = nombre_tecnico
            else:
                nombre_tecnico = cache_tecnicos[id_tecnico]

        cita["nombreTecnico"] = nombre_tecnico
        citas_enriquecidas.append(cita)

    return sorted(citas_enriquecidas, key=lambda x: (x.get("fecha", ""), x.get("hora", "")))

# --- ENDPOINT: CAMBIAR ESTADO DE LA CITA (DE PENDIENTE A RESERVADA/CANCELADA) ---
@router.patch("/{id_cita}/estado")
async def cambiar_estado_cita(
    id_cita: str,
    payload: ActualizarEstadoCita,
    authorization: str | None = Header(default=None)
):
    try:
        uid_tecnico, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.TECNICO.value
        )
        # 1. Validar que el nuevo estado sea estrictamente uno de los permitidos
        estados_permitidos = [EstadoCita.RESERVADA.value, EstadoCita.CANCELADA.value]
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
            if cita_data.get("idTecnico") != uid_tecnico:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permisos para modificar esta cita porque pertenece a otro técnico."
                )

            # 4. REGLA DE NEGOCIO: Solo se puede cambiar si el estado actual es "pendiente" o "reservada"
            estado_actual = cita_data.get("estado", "").lower()
            if estado_actual != EstadoCita.PENDIENTE.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Operación rechazada: Solo las citas pendientes pueden ser aceptadas o rechazadas por el técnico (Estado actual: '{estado_actual}')."
                )

            if payload.nuevo_estado == EstadoCita.CANCELADA.value:
                liberar_bloque(transaction, cita_data, id_cita)

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
async def verificar_y_actualizar_citas(
    authorization: str | None = Header(default=None)
):
    """
    Este endpoint está diseñado para ejecutarse de forma automática (ej. cada noche a las 00:00, aunque de momento lo lanzaremos manualmente de forma silencionsa).
    Revisa las citas cuya fecha ya llegó o expiró y ajusta sus estados:
    - 'pendiente' -> 'caducada'
    - 'reservada' -> 'caducada'
    """
    try:
        obtener_usuario_autenticado(authorization, RolUsuario.ADMIN.value)
        # 1. Obtener la fecha de hoy en la zona horaria correcta (ej: America/Santiago)
        # Esto evita que por desfase de UTC se cancelen citas antes de tiempo.
        zona_horaria = pytz.timezone("America/Santiago")
        hoy_str = datetime.now(zona_horaria).strftime("%Y-%m-%d")

        contador_actualizaciones = 0

        for estado in (EstadoCita.PENDIENTE.value, EstadoCita.RESERVADA.value):
            citas_vencidas_query = (
                db.collection("citas")
                .where(filter=FieldFilter("estado", "==", estado))
                .where(filter=FieldFilter("fecha", "<=", hoy_str)) # "<=" por si alguna del pasado quedó colgada
                .stream()
            )

            for doc in citas_vencidas_query:
                doc_ref = db.collection("citas").document(doc.id)

                @firestore.transactional
                def caducar_cita(transaction, ref, id_cita):
                    snapshot = ref.get(transaction=transaction)
                    if not snapshot.exists:
                        return False

                    cita_data = snapshot.to_dict()
                    if (
                        cita_data.get("estado") not in {
                            EstadoCita.PENDIENTE.value,
                            EstadoCita.RESERVADA.value,
                        }
                        or cita_data.get("fecha", "") > hoy_str
                    ):
                        return False

                    liberar_bloque(transaction, cita_data, id_cita)
                    transaction.update(ref, {
                        "estado": EstadoCita.CADUCADA.value,
                        "motivo_sistema": "Caducidad automática al llegar la fecha límite sin completar el flujo.",
                        "updatedAt": datetime.now(timezone.utc)
                    })
                    return True

                if caducar_cita(db.transaction(), doc_ref, doc.id):
                    contador_actualizaciones += 1

        return {
            "status": "success",
            "message": f"Proceso completado. Se actualizaron {contador_actualizaciones} citas con éxito.",
            "fecha_evaluada": hoy_str
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR EN CRON DE CITAS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno en el procesamiento por lote: {str(e)}")

# --- ENDPOINT NOTIFICACIONES: CITAS PENDIENTES (TÉCNICO) ---
@router.get("/notificaciones/tecnico/{tecnico_id}/pendientes")
async def contar_citas_pendientes_tecnico(
    tecnico_id: str,
    authorization: str | None = Header(default=None)
):
    """
    Devuelve la cantidad de citas en estado 'pendiente' para un técnico.
    Ideal para mostrar globos de notificación en el dashboard.
    """
    try:
        uid_tecnico, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.TECNICO.value
        )
        if tecnico_id != uid_tecnico:
            raise HTTPException(status_code=403, detail="No puedes consultar notificaciones de otro técnico")
        query = (
            db.collection("citas")
            .where(filter=FieldFilter("idTecnico", "==", tecnico_id))
            .where(filter=FieldFilter("estado", "==", EstadoCita.PENDIENTE.value))
            .stream()
        )

        # sum() iterará el generador de forma muy eficiente sin cargar grandes listas
        cantidad = sum(1 for _ in query)

        return {
            "status": "success",
            "tecnico_id": tecnico_id,
            "cantidad_pendientes": cantidad
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al contar notificaciones del técnico: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al contar citas pendientes")


# --- ENDPOINT NOTIFICACIONES: CITAS RESERVADAS (CLIENTE) ---
@router.get("/notificaciones/cliente/{cliente_id}/reservadas")
async def contar_citas_reservadas_cliente(
    cliente_id: str,
    authorization: str | None = Header(default=None)
):
    """
    Devuelve la cantidad de citas en estado 'reservada' para un cliente.
    Ideal para avisarle que tiene que realizar el pago o tomar acción.
    """
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
        if cliente_id != uid_cliente:
            raise HTTPException(status_code=403, detail="No puedes consultar notificaciones de otro cliente")
        query = (
            db.collection("citas")
            .where(filter=FieldFilter("idCliente", "==", cliente_id))
            .where(filter=FieldFilter("estado", "==", EstadoCita.RESERVADA.value))
            .stream()
        )

        cantidad = sum(1 for _ in query)

        return {
            "status": "success",
            "cliente_id": cliente_id,
            "cantidad_reservadas": cantidad
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error al contar notificaciones del cliente: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al contar citas reservadas")


# --- MODELO PARA CANCELACIÓN POR CLIENTE ---
# --- ENDPOINT: REGISTRAR PAGO DEMO (reservada -> pago_realizado) ---
@router.patch("/{id_cita}/registrar-pago-demo")
async def registrar_pago_demo(
    id_cita: str,
    authorization: str | None = Header(default=None)
):
    """
    Registra un pago simulado para demo. La integración real con Mercado Pago
    debe actualizar este estado desde el webhook, no desde el frontend.
    """
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
        cita_ref = db.collection("citas").document(id_cita)

        @firestore.transactional
        def procesar_pago_demo(transaction, ref):
            snapshot = ref.get(transaction=transaction)

            if not snapshot.exists:
                raise HTTPException(status_code=404, detail="La cita no existe en la base de datos.")

            cita_data = snapshot.to_dict()

            if cita_data.get("idCliente") != uid_cliente:
                raise HTTPException(status_code=403, detail="No tienes permisos para pagar esta cita.")

            estado_actual = cita_data.get("estado", "").lower()
            if estado_actual != EstadoCita.RESERVADA.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Solo se puede pagar una cita reservada (Estado actual: '{estado_actual}')."
                )

            ocupar_bloque(
                transaction,
                cita_data.get("idTecnico"),
                cita_data.get("fecha"),
                cita_data.get("hora"),
                id_cita,
            )
            transaction.update(ref, {
                "estado": EstadoCita.PAGO_REALIZADO.value,
                "pagadoEn": datetime.now(timezone.utc),
                "modoPago": "demo",
                "modificadoEn": datetime.now(timezone.utc)
            })

        transaction = db.transaction()
        procesar_pago_demo(transaction, cita_ref)

        return {
            "status": "success",
            "message": "Pago demo registrado correctamente.",
            "idCita": id_cita,
            "modoPago": "demo"
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"ERROR AL REGISTRAR PAGO DEMO: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al registrar el pago demo.")


# --- ENDPOINT: CANCELAR CITA POR EL CLIENTE (reservada -> cancelada) ---
@router.patch("/{id_cita}/cancelar-cliente")
async def cancelar_cita_cliente(
    id_cita: str,
    authorization: str | None = Header(default=None)
):
    """
    Permite al cliente cancelar una cita propia en estado 'reservada'.
    Reglas:
      - Solo el cliente dueño de la cita puede cancelarla.
      - No se puede cancelar una cita cuya fecha sea el mismo día de hoy.
      - Si la cita ya fue pagada, debe solicitar reembolso.
    """
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
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
            if cita_data.get("idCliente") != uid_cliente:
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
            if estado_actual == EstadoCita.PAGO_REALIZADO.value:
                raise HTTPException(
                    status_code=400,
                    detail="La cita ya está pagada. Para este caso debes solicitar un reembolso."
                )

            if estado_actual != EstadoCita.RESERVADA.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Operación rechazada: Solo se pueden cancelar citas reservadas (Estado actual: '{estado_actual}')."
                )

            liberar_bloque(transaction, cita_data, id_cita)
            transaction.update(ref, {
                "estado": EstadoCita.CANCELADA.value,
                "canceladoPor": "cliente",
                "modificadoEn": datetime.now(timezone.utc)
            })

            return EstadoCita.CANCELADA.value

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
# --- ENDPOINT: SOLICITAR REEMBOLSO POR EL CLIENTE (pago_realizado -> reembolso_solicitado) ---
@router.patch("/{id_cita}/solicitar-reembolso")
async def solicitar_reembolso_cliente(
    id_cita: str,
    authorization: str | None = Header(default=None)
):
    """
    Permite al cliente solicitar un reembolso en una cita pagada.
    Reglas:
      - Solo el cliente dueño de la cita puede solicitarlo.
      - Solo aplica a citas en estado 'pago_realizado'.
    """
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
        cita_ref = db.collection("citas").document(id_cita)

        @firestore.transactional
        def procesar_reembolso(transaction, ref):
            snapshot = ref.get(transaction=transaction)

            if not snapshot.exists:
                raise HTTPException(status_code=404, detail="La cita no existe en la base de datos.")

            cita_data = snapshot.to_dict()

            # Validar que sea el cliente dueño de la cita
            if cita_data.get("idCliente") != uid_cliente:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permisos para solicitar reembolso en esta cita."
                )

            # Validar que el estado sea 'pago_realizado'
            estado_actual = cita_data.get("estado", "").lower()
            if estado_actual != EstadoCita.PAGO_REALIZADO.value:
                raise HTTPException(
                    status_code=400,
                    detail=f"Operación rechazada: Solo se puede solicitar reembolso en citas con estado 'pago_realizado' (Estado actual: '{estado_actual}')."
                )

            liberar_bloque(transaction, cita_data, id_cita)
            transaction.update(ref, {
                "estado": EstadoCita.REEMBOLSO_SOLICITADO.value,
                "modificadoEn": datetime.now(timezone.utc)
            })

            return EstadoCita.REEMBOLSO_SOLICITADO.value

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
# --- ENDPOINT: CONFIRMAR TRABAJO (pago_realizado -> concluida) ---
@router.patch("/{id_cita}/concluir")
async def concluir_cita(
    id_cita: str,
    authorization: str | None = Header(default=None)
):
    """
    Permite al técnico marcar una cita como 'concluida'.
    Requisitos:
      - La cita debe estar en estado 'pago_realizado'.
      - La fecha de la cita debe ser igual o anterior a hoy.
      - Solo el técnico dueño de la cita puede concluirla.
    """
    try:
        uid_tecnico, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.TECNICO.value
        )
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
            if cita_data.get("idTecnico") != uid_tecnico:
                raise HTTPException(
                    status_code=403,
                    detail="No tienes permisos para concluir esta cita."
                )

            # Validar estado
            estado_actual = cita_data.get("estado", "").lower()
            if estado_actual != EstadoCita.PAGO_REALIZADO.value:
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

            liberar_bloque(transaction, cita_data, id_cita)
            transaction.update(ref, {
                "estado": EstadoCita.CONCLUIDA.value,
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