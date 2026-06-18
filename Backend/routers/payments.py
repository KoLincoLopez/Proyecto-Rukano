from datetime import datetime, timezone

from fastapi import APIRouter, Header, HTTPException, Request

from core.firebase_config import db
from google.cloud import firestore
from google.cloud.firestore import FieldFilter
from models.enums import EstadoCita, RolUsuario
from routers.auth import obtener_usuario_autenticado
from services.availability_service import ocupar_bloque
from services.mercadopago_service import MercadoPagoService

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)


def es_error_configuracion_mercadopago(error: Exception) -> bool:
    mensaje = str(error)
    return any(
        variable in mensaje
        for variable in ("MERCADOPAGO_ACCESS_TOKEN", "FRONTEND_URL", "BACKEND_URL")
    )


def obtener_cita_ref(cita_id: str):
    cita_ref = db.collection("citas").document(cita_id)
    cita_doc = cita_ref.get()

    if cita_doc.exists:
        return cita_ref, cita_doc

    docs = list(
        db.collection("citas")
        .where(filter=FieldFilter("idCita", "==", cita_id))
        .limit(1)
        .stream()
    )

    if not docs:
        raise HTTPException(status_code=404, detail="La cita no existe")

    return docs[0].reference, docs[0]


def obtener_precio_y_titulo_cita(cita_data: dict, cita_id: str):
    precio = cita_data.get("precio")
    titulo = cita_data.get("tituloServicio") or cita_data.get("servicio") or f"Cita Rukano {cita_id}"

    if precio is None and cita_data.get("idServicio"):
        servicio_doc = db.collection("servicios").document(cita_data["idServicio"]).get()
        if servicio_doc.exists:
            servicio_data = servicio_doc.to_dict()
            precio = servicio_data.get("precio")
            titulo = servicio_data.get("nombre") or servicio_data.get("titulo") or titulo

    try:
        precio = float(precio)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="La cita no tiene un precio válido para pagar")

    if precio <= 0:
        raise HTTPException(status_code=400, detail="El precio de la cita debe ser mayor a cero")

    return precio, titulo


# NO OFICIAL:
# Endpoint antiguo del checkout directo sin cita. Se mantiene solo para
# responder 410 y evitar que flujos viejos parezcan funcionar.
# Flujo oficial actual: POST /payments/create_preference/{cita_id}.
@router.post("/create_preference", deprecated=True)
async def create_payment_preference():
    raise HTTPException(
        status_code=410,
        detail="Checkout desactivado: primero debes reservar una cita"
    )


@router.post("/create_preference/{cita_id}")
async def create_payment_preference_for_cita(
    cita_id: str,
    authorization: str | None = Header(default=None)
):
    id_cliente_solicitante, _ = obtener_usuario_autenticado(
        authorization,
        RolUsuario.CLIENTE.value
    )
    cita_ref, cita_doc = obtener_cita_ref(cita_id)

    @firestore.transactional
    def validar_y_bloquear_checkout(transaction):
        snapshot = cita_ref.get(transaction=transaction)
        if not snapshot.exists:
            raise HTTPException(status_code=404, detail="La cita no existe")

        cita_actual = snapshot.to_dict()
        if cita_actual.get("idCliente") != id_cliente_solicitante:
            raise HTTPException(status_code=403, detail="No tienes permisos para pagar esta cita")

        estado_actual = (cita_actual.get("estado") or "").lower()
        if estado_actual != EstadoCita.RESERVADA.value:
            raise HTTPException(
                status_code=400,
                detail=f"Solo se puede pagar una cita reservada (Estado actual: '{estado_actual}')."
            )

        ocupar_bloque(
            transaction,
            cita_actual.get("idTecnico"),
            cita_actual.get("fecha"),
            cita_actual.get("hora"),
            cita_ref.id,
        )
        return cita_actual

    cita_data = validar_y_bloquear_checkout(db.transaction())
    precio, titulo = obtener_precio_y_titulo_cita(cita_data, cita_id)

    try:
        mp_service = MercadoPagoService()
        preference = mp_service.create_preference(
            item_title=titulo,
            quantity=1,
            unit_price=precio,
            external_reference=cita_id,
            metadata={
                "cita_id": cita_id,
                "id_cliente": cita_data.get("idCliente"),
                "id_tecnico": cita_data.get("idTecnico"),
                "id_servicio": cita_data.get("idServicio")
            }
        )
    except RuntimeError as exc:
        if es_error_configuracion_mercadopago(exc):
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if "id" not in preference:
        raise HTTPException(status_code=400, detail=preference)

    cita_ref.update({
        "mercadopago_preference_id": preference["id"],
        "pago_iniciado_en": datetime.now(timezone.utc),
        "modificadoEn": datetime.now(timezone.utc)
    })

    return {
        "preference_id": preference["id"],
        "init_point": preference.get("init_point"),
        "sandbox_init_point": preference.get("sandbox_init_point")
    }


@router.post("/webhook")
async def mercadopago_webhook(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}

    event_type = data.get("type") or data.get("topic") or request.query_params.get("type") or request.query_params.get("topic")
    payment_id = (
        data.get("data", {}).get("id")
        or data.get("id")
        or request.query_params.get("data.id")
        or request.query_params.get("id")
    )

    if event_type and event_type != "payment":
        return {"status": "ignored", "reason": f"Evento no procesado: {event_type}"}

    if not event_type and not payment_id:
        return {"status": "ignored", "reason": "Evento no relacionado a pago"}

    if not payment_id:
        return {"status": "ignored", "reason": "Evento de pago sin payment_id"}

    try:
        mp_service = MercadoPagoService()
        payment = mp_service.get_payment(str(payment_id))
    except RuntimeError as exc:
        if es_error_configuracion_mercadopago(exc):
            raise HTTPException(status_code=503, detail=str(exc)) from exc

        print(f"Error al consultar pago en Mercado Pago: {exc}")
        raise HTTPException(status_code=500, detail="No se pudo consultar el pago en Mercado Pago") from exc

    if payment.get("status") != "approved":
        return {
            "status": "ignored",
            "payment_id": str(payment_id),
            "payment_status": payment.get("status")
        }

    cita_id = (
        payment.get("external_reference")
        or (payment.get("metadata") or {}).get("cita_id")
        or (payment.get("metadata") or {}).get("citaId")
    )

    if not cita_id:
        return {"status": "ignored", "reason": "Pago aprobado sin cita asociada", "payment_id": str(payment_id)}

    cita_ref, cita_doc = obtener_cita_ref(str(cita_id))
    cita_data = cita_doc.to_dict()
    estado_actual = (cita_data.get("estado") or "").lower()
    pago_actual = cita_data.get("pago") or {}

    if estado_actual == EstadoCita.PAGO_REALIZADO.value:
        return {
            "status": "success",
            "ya_procesado": True,
            "idCita": str(cita_id),
            "payment_id": str(payment_id)
        }

    if pago_actual.get("payment_id") == str(payment_id):
        return {
            "status": "success",
            "ya_procesado": True,
            "idCita": str(cita_id),
            "payment_id": str(payment_id)
        }

    if estado_actual != EstadoCita.RESERVADA.value:
        print(f"Pago aprobado para cita {cita_id}, pero estado actual no permite pago: {estado_actual}")
        return {
            "status": "ignored",
            "reason": "La cita no esta reservada",
            "idCita": str(cita_id),
            "estado_actual": estado_actual
        }

    pago_data = {
        "proveedor": "mercadopago",
        "payment_id": str(payment_id),
        "preference_id": payment.get("preference_id"),
        "status": payment.get("status"),
        "monto": payment.get("transaction_amount"),
        "external_reference": payment.get("external_reference"),
        "fecha_confirmacion": datetime.now(timezone.utc),
        "payment_method_id": payment.get("payment_method_id")
    }

    cita_ref.update({
        "estado": EstadoCita.PAGO_REALIZADO.value,
        "pago": pago_data,
        "pagadoEn": datetime.now(timezone.utc),
        "modificadoEn": datetime.now(timezone.utc)
    })

    return {
        "status": "success",
        "idCita": str(cita_id),
        "payment_id": str(payment_id)
    }
