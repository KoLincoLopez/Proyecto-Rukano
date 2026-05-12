from fastapi import APIRouter, HTTPException
try:
    from ..core.firebase_config import db
except ImportError:
    from core.firebase_config import db
from datetime import datetime, timedelta
import uuid
from fastapi import Request
from google.cloud.firestore_v1 import FieldFilter
from datetime import timezone

router = APIRouter()

@router.post("/crear_resena")
async def publicar_reseña(datos: dict):
    try:
        id_cita_referencia = str(datos.get("idCitas") or datos.get("idCita"))
        puntuacion = datos.get("puntuacion")

        # El documento de cita guarda el campo "idCita" en la colección "citas".
        query = db.collection("citas").where("idCita", "==", id_cita_referencia).stream()
        docs = list(query)

        if not docs:
            raise HTTPException(status_code=404, detail="La cita no existe en la base de datos")

        cita_data = docs[0].to_dict()

        if cita_data.get("estado") != "realizado":
            raise HTTPException(
                status_code=400,
                detail="Solo puedes reseñar servicios marcados como 'realizado'"
            )

        nueva_reseña = {
            "idResena": str(uuid.uuid4()),
            "idCitas": id_cita_referencia,
            "idServicio": cita_data.get("idServicio"),
            "idTecnico": cita_data.get("idTecnico"),
            "idCliente": cita_data.get("idCliente"),
            "puntuacion": puntuacion,
            "comentario": datos.get("comentario", ""),
            "fotoUrl": datos.get("fotoUrl", ""),
            "createdAt": datetime.utcnow()
        }

        db.collection("resenas").add(nueva_reseña)

        return {
            "status": "success",
            "message": "Reseña vinculada a la cita con éxito",
            "idResena": nueva_reseña["idResena"]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar: {str(e)}")


@router.put("/actualizar_resena/{id_resena}")
async def actualizar_reseña(id_resena: str, datos_nuevos: dict, request: Request):
    try:
        query = db.collection("resenas").where(
            filter=FieldFilter("idResena", "==", id_resena)
        ).stream()

        docs = list(query)

        if not docs:
            raise HTTPException(status_code=404, detail="La reseña no existe")

        doc_snapshot = docs[0]
        reseña_ref = doc_snapshot.reference
        reseña_data = doc_snapshot.to_dict()

        fecha_creacion = reseña_data.get("createdAt")
        ahora = datetime.now(timezone.utc)

        if ahora > fecha_creacion + timedelta(hours=24):
            raise HTTPException(
                status_code=403,
                detail="El plazo de 24 horas para editar esta reseña ha expirado"
            )

        actualizaciones = {
            "puntuacion": datos_nuevos.get("puntuacion", reseña_data.get("puntuacion")),
            "comentario": datos_nuevos.get("comentario", reseña_data.get("comentario")),
            "fotoUrl": datos_nuevos.get("fotoUrl", reseña_data.get("fotoUrl")),
            "lastModified": ahora
        }

        reseña_ref.update(actualizaciones)

        return {"status": "success", "message": "Reseña actualizada correctamente"}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")


@router.delete("/eliminar_resena/{id_resena}")
async def eliminar_resena(id_resena: str):
    try:
        query = db.collection("resenas").where(
            filter=FieldFilter("idResena", "==", id_resena)
        ).stream()

        docs = list(query)

        if not docs:
            raise HTTPException(status_code=404, detail="No se encontró la reseña")

        doc_snapshot = docs[0]
        doc_snapshot.reference.delete()

        return {
            "status": "success",
            "message": f"La reseña {id_resena} ha sido eliminada exitosamente"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno al eliminar la reseña")


@router.get("/resenas_tecnico/{id_tecnico}")
async def obtener_resenas_tecnico(id_tecnico: str):
    try:
        query = db.collection("resenas").where(
            filter=FieldFilter("idTecnico", "==", id_tecnico)
        ).stream()

        resenas_list = []

        for doc in query:
            data = doc.to_dict()
            data["id"] = doc.id
            resenas_list.append(data)

        if not resenas_list:
            return {
                "status": "success",
                "message": f"El técnico {id_tecnico} aún no tiene reseñas",
                "data": []
            }

        return {
            "status": "success",
            "total_resenas": len(resenas_list),
            "data": resenas_list
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno al obtener reseñas")
