from fastapi import APIRouter, HTTPException
from core.firebase_config import db

router = APIRouter()

# CREAR SERVICIO
@router.post("/crear")
def crear_servicio(data: dict):

    required_fields = ["tecnicoId", "nombre", "precio", "tiempoEstimado"]

    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Falta campo: {field}")

    servicio_ref = db.collection("servicios").document()

    servicio_ref.set({
        "tecnicoId": data["tecnicoId"],
        "nombre": data["nombre"],
        "precio": data["precio"],
        "tiempoEstimado": data["tiempoEstimado"],
        "incluye": data.get("incluye", ""),
        "noIncluye": data.get("noIncluye", ""),
        "estado": "activo"
    })

    return {
        "msg": "Servicio creado",
        "id": servicio_ref.id
    }



# OBTENER SERVICIOS POR TÉCNICO
@router.get("/tecnico/{tecnico_id}")
def obtener_servicios_tecnico(tecnico_id: str):

    servicios_ref = db.collection("servicios")

    docs = servicios_ref.where("tecnicoId", "==", tecnico_id).stream()

    servicios = []

    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        servicios.append(data)

    return servicios


# OBTENER TODOS LOS SERVICIOS
@router.get("/")
def obtener_todos():

    docs = db.collection("servicios").stream()

    servicios = []

    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        servicios.append(data)

    return servicios



# ELIMINAR SERVICIO 
@router.delete("/{servicio_id}")
def eliminar_servicio(servicio_id: str):

    ref = db.collection("servicios").document(servicio_id)
    doc = ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    ref.delete()

    return {"msg": "Servicio eliminado"}