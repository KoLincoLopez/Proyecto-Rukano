import hashlib
from datetime import datetime, timezone

from fastapi import HTTPException
from google.cloud.firestore import FieldFilter

from core.firebase_config import db
from models.enums import EstadoCita


ESTADOS_BLOQUEAN_HORARIO = frozenset({
    EstadoCita.PENDIENTE.value,
    EstadoCita.RESERVADA.value,
    EstadoCita.PAGO_REALIZADO.value,
})

ESTADOS_LIBERAN_HORARIO = frozenset({
    EstadoCita.CANCELADA.value,
    EstadoCita.REEMBOLSO_SOLICITADO.value,
    EstadoCita.CADUCADA.value,
    EstadoCita.CONCLUIDA.value,
})


def normalizar_estado(estado) -> str:
    return str(estado or "").strip().lower()


def estado_bloquea_horario(estado) -> bool:
    return normalizar_estado(estado) in ESTADOS_BLOQUEAN_HORARIO


def obtener_bloque_ref(id_tecnico: str, fecha: str, hora: str):
    clave = f"{id_tecnico}|{fecha}|{hora}"
    bloque_id = hashlib.sha256(clave.encode("utf-8")).hexdigest()
    return db.collection("bloques_horarios").document(bloque_id)


def validar_bloque_disponible(
    transaction,
    id_tecnico: str,
    fecha: str,
    hora: str,
    id_cita_actual: str | None = None,
):
    if not id_tecnico or not fecha or not hora:
        raise HTTPException(
            status_code=400,
            detail="La cita no tiene técnico, fecha u hora válidos para comprobar disponibilidad"
        )

    bloque_ref = obtener_bloque_ref(id_tecnico, fecha, hora)
    bloque_doc = bloque_ref.get(transaction=transaction)

    if bloque_doc.exists:
        bloque_data = bloque_doc.to_dict()
        if bloque_data.get("idCita") != id_cita_actual:
            raise HTTPException(
                status_code=409,
                detail="Este horario ya fue reservado por otro cliente. Selecciona otro bloque disponible."
            )

    citas = (
        db.collection("citas")
        .where(filter=FieldFilter("idTecnico", "==", id_tecnico))
        .stream(transaction=transaction)
    )
    for cita_doc in citas:
        if cita_doc.id == id_cita_actual:
            continue

        cita_data = cita_doc.to_dict()
        if (
            cita_data.get("fecha") == fecha
            and cita_data.get("hora") == hora
            and estado_bloquea_horario(cita_data.get("estado"))
        ):
            raise HTTPException(
                status_code=409,
                detail="Este horario ya fue reservado por otro cliente. Selecciona otro bloque disponible."
            )

    return bloque_ref


def ocupar_bloque(
    transaction,
    id_tecnico: str,
    fecha: str,
    hora: str,
    id_cita: str,
):
    bloque_ref = validar_bloque_disponible(
        transaction,
        id_tecnico,
        fecha,
        hora,
        id_cita_actual=id_cita,
    )
    transaction.set(bloque_ref, {
        "idCita": id_cita,
        "idTecnico": id_tecnico,
        "fecha": fecha,
        "hora": hora,
        "actualizadoEn": datetime.now(timezone.utc),
    })


def liberar_bloque(transaction, cita_data: dict, id_cita: str):
    id_tecnico = cita_data.get("idTecnico")
    fecha = cita_data.get("fecha")
    hora = cita_data.get("hora")
    if not id_tecnico or not fecha or not hora:
        return

    bloque_ref = obtener_bloque_ref(id_tecnico, fecha, hora)
    bloque_doc = bloque_ref.get(transaction=transaction)
    if bloque_doc.exists and bloque_doc.to_dict().get("idCita") == id_cita:
        transaction.delete(bloque_ref)
