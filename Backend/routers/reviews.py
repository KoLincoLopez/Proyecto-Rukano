import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException
from google.cloud import firestore
from google.cloud.firestore_v1 import FieldFilter

from core.firebase_config import db
from models.enums import EstadoCita, RolUsuario
from routers.auth import obtener_usuario_autenticado

router = APIRouter()


def obtener_cita_ref(id_cita: str):
    cita_ref = db.collection("citas").document(id_cita)
    cita_doc = cita_ref.get()
    if cita_doc.exists:
        return cita_ref

    docs = list(
        db.collection("citas")
        .where(filter=FieldFilter("idCita", "==", id_cita))
        .limit(1)
        .stream()
    )
    if not docs:
        raise HTTPException(status_code=404, detail="La cita no existe en la base de datos")

    return docs[0].reference


def obtener_resena_unica_ref(id_cita: str):
    digest = hashlib.sha256(id_cita.encode("utf-8")).hexdigest()
    return db.collection("resenas").document(f"cita_{digest}")


def obtener_marcador_resena_ref(id_cita: str):
    digest = hashlib.sha256(id_cita.encode("utf-8")).hexdigest()
    return db.collection("resenas_por_cita").document(digest)


def recalcular_reputacion_tecnico(id_tecnico: str):
    if not id_tecnico:
        raise HTTPException(status_code=400, detail="La reseña no tiene un técnico asociado")

    tecnico_ref = db.collection("usuarios").document(id_tecnico)

    @firestore.transactional
    def recalcular(transaction):
        tecnico_doc = tecnico_ref.get(transaction=transaction)
        if not tecnico_doc.exists:
            raise HTTPException(status_code=404, detail="El técnico asociado no existe")

        resenas = list(
            db.collection("resenas")
            .where(filter=FieldFilter("idTecnico", "==", id_tecnico))
            .stream(transaction=transaction)
        )
        puntuaciones = [
            float(doc.to_dict().get("puntuacion"))
            for doc in resenas
            if doc.to_dict().get("puntuacion") is not None
        ]
        total = len(puntuaciones)
        promedio = sum(puntuaciones) / total if total else 0

        transaction.update(tecnico_ref, {
            "cantidad_reseñas": total,
            "calificacion_promedio": round(promedio, 1)
        })

    recalcular(db.transaction())


@router.get("/verificar_resena/{id_cita}")
async def verificar_resena_cita(
    id_cita: str,
    authorization: str | None = Header(default=None)
):
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
        cita_doc = obtener_cita_ref(id_cita).get()
        cita_data = cita_doc.to_dict()
        if cita_data.get("idCliente") != uid_cliente:
            raise HTTPException(status_code=403, detail="No puedes consultar una cita de otro cliente")

        docs = list(
            db.collection("resenas")
            .where(filter=FieldFilter("citaId", "==", id_cita))
            .limit(1)
            .stream()
        )
        marcador_doc = obtener_marcador_resena_ref(id_cita).get()
        posee_resena = bool(docs) or marcador_doc.exists
        esta_concluida = cita_data.get("estado") == EstadoCita.CONCLUIDA.value
        return {
            "status": "success",
            "posee_resena": posee_resena,
            "puede_resenar": esta_concluida and not posee_resena,
            "idResena": docs[0].to_dict().get("idResena") if docs else None,
            "estado_cita": cita_data.get("estado")
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al verificar reseña: {str(e)}")


@router.post("/crear_resena")
async def publicar_reseña(
    datos: dict,
    authorization: str | None = Header(default=None)
):
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
        id_cita_referencia = str(datos.get("citaId") or datos.get("idCita") or datos.get("idCitas") or "")
        puntuacion = datos.get("puntuacion")

        if not id_cita_referencia:
            raise HTTPException(status_code=400, detail="Falta el identificador de la cita.")

        try:
            puntuacion = float(puntuacion)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="La puntuación debe ser numérica") from exc
        if puntuacion < 1 or puntuacion > 5:
            raise HTTPException(status_code=400, detail="La puntuación debe estar entre 1 y 5")

        cita_ref = obtener_cita_ref(id_cita_referencia)
        resena_ref = obtener_resena_unica_ref(id_cita_referencia)
        marcador_ref = obtener_marcador_resena_ref(id_cita_referencia)

        @firestore.transactional
        def crear_resena(transaction):
            cita_doc = cita_ref.get(transaction=transaction)
            resena_unica_doc = resena_ref.get(transaction=transaction)
            marcador_doc = marcador_ref.get(transaction=transaction)
            resenas_anteriores = list(
                db.collection("resenas")
                .where(filter=FieldFilter("citaId", "==", id_cita_referencia))
                .stream(transaction=transaction)
            )

            if not cita_doc.exists:
                raise HTTPException(status_code=404, detail="La cita no existe en la base de datos")

            cita_data = cita_doc.to_dict()
            if cita_data.get("idCliente") != uid_cliente:
                raise HTTPException(status_code=403, detail="No puedes reseñar una cita de otro cliente.")
            if cita_data.get("estado") != EstadoCita.CONCLUIDA.value:
                raise HTTPException(
                    status_code=400,
                    detail="Solo puedes reseñar servicios marcados como 'concluida'."
                )

            id_tecnico = cita_data.get("idTecnico")
            if not id_tecnico:
                raise HTTPException(status_code=400, detail="La cita no tiene un técnico asociado")
            tecnico_doc = (
                db.collection("usuarios")
                .document(id_tecnico)
                .get(transaction=transaction)
            )
            if not tecnico_doc.exists:
                raise HTTPException(status_code=404, detail="El técnico asociado no existe")
            if marcador_doc.exists or resena_unica_doc.exists or resenas_anteriores:
                raise HTTPException(
                    status_code=409,
                    detail="Esta cita ya tiene una reseña registrada."
                )

            nueva_resena = {
                "idResena": str(uuid.uuid4()),
                "citaId": id_cita_referencia,
                "idServicio": cita_data.get("idServicio"),
                "idTecnico": id_tecnico,
                "idCliente": uid_cliente,
                "puntuacion": puntuacion,
                "comentario": str(datos.get("comentario") or "").strip(),
                "fotoUrl": str(datos.get("fotoUrl") or "").strip(),
                "createdAt": datetime.now(timezone.utc)
            }
            transaction.set(marcador_ref, {
                "citaId": id_cita_referencia,
                "idResena": nueva_resena["idResena"],
                "idCliente": uid_cliente,
                "idTecnico": id_tecnico,
                "createdAt": nueva_resena["createdAt"]
            })
            transaction.set(resena_ref, nueva_resena)
            return id_tecnico

        id_tecnico = crear_resena(db.transaction())
        recalcular_reputacion_tecnico(id_tecnico)

        return {"status": "success", "message": "Reseña guardada y promedio actualizado"}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al procesar: {str(e)}")


@router.put("/actualizar_resena/{id_resena}")
async def actualizar_reseña(
    id_resena: str,
    datos_nuevos: dict,
    authorization: str | None = Header(default=None)
):
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
        query = db.collection("resenas").where(
            filter=FieldFilter("idResena", "==", id_resena)
        ).stream()

        docs = list(query)

        if not docs:
            raise HTTPException(status_code=404, detail="La reseña no existe")

        doc_snapshot = docs[0]
        reseña_ref = doc_snapshot.reference
        reseña_data = doc_snapshot.to_dict()

        if reseña_data.get("idCliente") != uid_cliente:
            raise HTTPException(status_code=403, detail="No puedes editar una reseña de otro cliente")

        fecha_creacion = reseña_data.get("createdAt")
        ahora = datetime.now(timezone.utc)

        if fecha_creacion is None:
            raise HTTPException(status_code=400, detail="La reseña no tiene una fecha de creación válida")

        if fecha_creacion.tzinfo is None:
            fecha_creacion = fecha_creacion.replace(tzinfo=timezone.utc)

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
        try:
            actualizaciones["puntuacion"] = float(actualizaciones["puntuacion"])
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=400, detail="La puntuación debe ser numérica") from exc
        if actualizaciones["puntuacion"] < 1 or actualizaciones["puntuacion"] > 5:
            raise HTTPException(status_code=400, detail="La puntuación debe estar entre 1 y 5")

        reseña_ref.update(actualizaciones)
        recalcular_reputacion_tecnico(reseña_data.get("idTecnico"))

        return {"status": "success", "message": "Reseña actualizada correctamente"}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")


@router.delete("/eliminar_resena/{id_resena}")
async def eliminar_resena(
    id_resena: str,
    authorization: str | None = Header(default=None)
):
    try:
        uid_cliente, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.CLIENTE.value
        )
        query = db.collection("resenas").where(
            filter=FieldFilter("idResena", "==", id_resena)
        ).stream()

        docs = list(query)

        if not docs:
            raise HTTPException(status_code=404, detail="No se encontró la reseña")

        doc_snapshot = docs[0]
        reseña_data = doc_snapshot.to_dict()

        if reseña_data.get("idCliente") != uid_cliente:
            raise HTTPException(status_code=403, detail="No puedes eliminar una reseña de otro cliente")

        id_cita = reseña_data.get("citaId")
        if not id_cita:
            raise HTTPException(status_code=400, detail="La reseña no tiene una cita asociada")

        marcador_ref = obtener_marcador_resena_ref(id_cita)
        marcador_ref.set({
            "citaId": reseña_data.get("citaId"),
            "idResena": reseña_data.get("idResena"),
            "idCliente": uid_cliente,
            "idTecnico": reseña_data.get("idTecnico"),
            "eliminada": True,
            "eliminadaEn": datetime.now(timezone.utc)
        }, merge=True)
        doc_snapshot.reference.delete()
        recalcular_reputacion_tecnico(reseña_data.get("idTecnico"))

        return {
            "status": "success",
            "message": f"La reseña {id_resena} ha sido eliminada exitosamente"
        }

    except HTTPException:
        raise
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
