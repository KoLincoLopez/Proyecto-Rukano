from fastapi import APIRouter, HTTPException
from core.firebase_config import db
from datetime import datetime
from google.cloud import firestore

router = APIRouter()

#  RESERVAR CON TRANSACCIÓN (CONCURRENCIA REAL)
@router.post("/reservar")
def reservar(data: dict):

    tecnico_id = data["tecnicoId"]
    cliente_id = data["clienteId"]
    fecha = data["fecha"]
    hora = data["hora"]

    citas_ref = db.collection("citas")
    transaction = db.transaction()

    @firestore.transactional
    def transaction_func(transaction):

        query = citas_ref.where("tecnicoId", "==", tecnico_id)\
                         .where("fecha", "==", fecha)\
                         .where("hora", "==", hora)\
                         .where("estado", "==", "confirmada")

        docs = list(query.stream(transaction=transaction))

        if docs:
            raise HTTPException(status_code=400, detail="Hora ocupada")

        nueva_cita = citas_ref.document()
        transaction.set(nueva_cita, {
            "tecnicoId": tecnico_id,
            "clienteId": cliente_id,
            "fecha": fecha,
            "hora": hora,
            "estado": "confirmada",
            "motivoCancelacion": "",
            "createdAt": datetime.utcnow()
        })

    transaction_func(transaction)

    return {"msg": "Reserva creada"}


#  CANCELAR CITA CON MOTIVO
@router.put("/cancelar/{cita_id}")
def cancelar(cita_id: str, motivo: str):

    if not motivo:
        raise HTTPException(status_code=400, detail="Motivo obligatorio")

    ref = db.collection("citas").document(cita_id)
    cita = ref.get().to_dict()

    if not cita:
        raise HTTPException(status_code=404, detail="Cita no encontrada")

    hoy = datetime.utcnow().date()
    fecha_cita = datetime.strptime(cita["fecha"], "%Y-%m-%d").date()

    if fecha_cita < hoy:
        raise HTTPException(status_code=400, detail="No se puede cancelar después del día del servicio")

    ref.update({
        "estado": "cancelada",
        "motivoCancelacion": motivo
    })

    return {"msg": "Cita cancelada"}


#  AGENDA VIRTUAL DEL TÉCNICO (FILTRADA Y ORDENADA)
@router.get("/agenda/{tecnico_id}")
def obtener_agenda(tecnico_id: str):

    citas_ref = db.collection("citas")

    query = citas_ref.where("tecnicoId", "==", tecnico_id)\
                     .where("estado", "==", "confirmada")

    docs = query.stream()

    agenda = []

    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        agenda.append(data)

    #  ORDENAR POR FECHA Y HORA
    agenda.sort(key=lambda x: (x["fecha"], x["hora"]))

    return agenda