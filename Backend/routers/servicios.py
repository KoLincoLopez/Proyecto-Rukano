from fastapi import APIRouter
from core.firebase_config import db

router = APIRouter()

@router.post("/crear")
def crear_servicio(data: dict):

    servicio_ref = db.collection("servicios").document()

    servicio_ref.set({
        "tecnicoId": data["tecnicoId"],
        "nombre": data["nombre"],
        "precio": data["precio"],
        "tiempoEstimado": data["tiempoEstimado"],
        "incluye": data["incluye"],
        "noIncluye": data["noIncluye"]
    })

    return {"msg": "Servicio creado"}