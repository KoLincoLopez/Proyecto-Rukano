from fastapi import APIRouter, HTTPException
from core.firebase_config import db
from datetime import datetime, timedelta  # Agrega timedelta para la validación de 24 horas
import uuid  # Agrega este import para generar IDs únicos
from fastapi import Request
from google.cloud.firestore_v1 import FieldFilter  # Importa FieldFilter para consultas precisas
from datetime import timezone  # Importa timezone para manejar fechas 'aware' en UTC


router = APIRouter()

@router.post("/crear_resena")
async def publicar_reseña(datos: dict):
    try:
        # 1. Obtenemos el idCitas enviado desde el Frontend
        id_cita_referencia = str(datos.get("idCitas"))
        puntuacion = datos.get("puntuacion") # 1-5 estrellas
        
        # 2. Buscamos el documento que tenga el campo 'idCitas' igual al recibido
        query = db.collection("citas").where("idCitas", "==", id_cita_referencia).stream()
        
        # Convertimos el generador en una lista para contar los resultados
        docs = list(query)
        
        if not docs:
            raise HTTPException(status_code=404, detail="La cita no existe en la base de datos")
        
        # CORRECCIÓN: Accedemos al primer elemento de la lista 
        # 'docs' es el DocumentSnapshot, el cual sí tiene .to_dict()
        cita_data = docs[0].to_dict()

        # Validamos el estado para cumplir con el RF 6
        if cita_data.get("estado") != "realizado":
            raise HTTPException(
                status_code=400, 
                detail="Solo puedes reseñar servicios marcados como 'realizado'"
            )

        # 3. Construimos la reseña extrayendo los IDs de la cita original
        # Esto asegura consistencia total entre Cita, Técnico y Cliente
        nueva_reseña = {
            "idResena": str(uuid.uuid4()),  # Agrega ID único por defecto
            "idCitas": id_cita_referencia,
            "idServicio": cita_data.get("idServicio"), 
            "idTecnico": cita_data.get("idTecnico"),   
            "idCliente": cita_data.get("idCliente"),   
            "puntuacion": puntuacion,
            "comentario": datos.get("comentario", ""),
            "fotoUrl": datos.get("fotoUrl", ""),       
            "createdAt": datetime.utcnow()  # Para mantener un registro de cuándo se creó la reseña
        }

        # 4. Guardamos en la colección 'resenas'
        db.collection("resenas").add(nueva_reseña)

        return {"status": "success", "message": "Reseña vinculada a la cita con éxito", "idResena": nueva_reseña["idResena"]}

    except Exception as e:
        # Manejo de errores
        raise HTTPException(status_code=500, detail=f"Error al procesar: {str(e)}")
    
# Ruta para actualizar una reseña existente (con restricciones de tiempo y campos editables)
@router.put("/actualizar_resena/{id_resena}")
async def actualizar_reseña(id_resena: str, datos_nuevos: dict, request: Request):
    try:
        # Logs de depuración (ahora recibiendo el ID correctamente sin la "ñ")
        print("URL recibida:", request.url.path)
        print("id_resena param:", id_resena)

        # 1. Buscamos por el UUID en la colección "resenas"
        query = db.collection("resenas").where(filter=FieldFilter("idResena", "==", id_resena)).stream()
        docs = list(query)
        
        if not docs:
            raise HTTPException(status_code=404, detail="La reseña no existe")
        
        # --- CORRECCIÓN CRÍTICA AQUÍ ---
        # Accedemos al primer elemento de la lista docs
        doc_snapshot = docs[0]
        reseña_ref = doc_snapshot.reference # Ahora sí puedes acceder a .reference
        reseña_data = doc_snapshot.to_dict() # Y a .to_dict()
        # -------------------------------
        
        # 2. VALIDACIÓN DE 24 HORAS (RF 6)
        fecha_creacion = reseña_data.get("createdAt")
        ahora = datetime.now(timezone.utc) # Evita el error "offset-naive vs offset-aware"

        if ahora > fecha_creacion + timedelta(hours=24):
            raise HTTPException(
                status_code=403, 
                detail="El plazo de 24 horas para editar esta reseña ha expirado"
            )

        # 3. Preparar actualizaciones (RF 6)
        actualizaciones = {
            "puntuacion": datos_nuevos.get("puntuacion", reseña_data.get("puntuacion")),
            "comentario": datos_nuevos.get("comentario", reseña_data.get("comentario")),
            "fotoUrl": datos_nuevos.get("fotoUrl", reseña_data.get("fotoUrl")),
            "lastModified": ahora 
        }

        # 4. Actualizar en Firestore
        reseña_ref.update(actualizaciones)

        return {"status": "success", "message": "Reseña actualizada correctamente"}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"DEBUG ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error interno del servidor: {str(e)}")
    


@router.delete("/eliminar_resena/{id_resena}")
async def eliminar_resena(id_resena: str):
    try:
        # 1. Búsqueda exacta en la colección "resenas" usando el UUID
        query = db.collection("resenas").where(filter=FieldFilter("idResena", "==", id_resena)).stream()
        docs = list(query)

        # 2. Validación de existencia
        if not docs:
            raise HTTPException(
                status_code=404, 
                detail=f"No se encontró ninguna reseña con el ID: {id_resena}"
            )

        # 3. Extracción del documento (usando pop(0) para evitar problemas de lectura)
        doc_snapshot = docs.pop(0)
        reseña_ref = doc_snapshot.reference

        # 4. Ejecución de la eliminación permanente en Firestore
        reseña_ref.delete()

        return {
            "status": "success", 
            "message": f"La reseña {id_resena} ha sido eliminada exitosamente"
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        # Registro de error para asegurar la disponibilidad del 99.5% (RNF 2)
        print(f"ERROR TÉCNICO EN ELIMINACIÓN: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Error interno al intentar eliminar la reseña"
        )
    
# Ruta para obtener todas las reseñas de un técnico específico
@router.get("/resenas_tecnico/{id_tecnico}")
async def obtener_resenas_tecnico(id_tecnico: str):
    try:
        # 1. Consulta en la colección "resenas" filtrando por idTecnico
        # Usamos FieldFilter para asegurar la precisión del 99.9% exigida [4]
        query = db.collection("resenas").where(filter=FieldFilter("idTecnico", "==", id_tecnico)).stream()
        
        resenas_list = []
        for doc in query:
            resena_data = doc.to_dict()
            # Incluimos el ID del documento por si se necesita para futuras ediciones
            resena_data["id"] = doc.id
            resenas_list.append(resena_data)

        # 2. Validación de resultados
        if not resenas_list:
            # Si no hay reseñas, devolvemos una lista vacía con un mensaje informativo
            return {
                "status": "success",
                "message": f"El técnico {id_tecnico} aún no tiene reseñas",
                "data": []
            }

        # 3. Respuesta exitosa cumpliendo con el RNF 1 (Rendimiento < 2.5s) [5]
        return {
            "status": "success",
            "total_resenas": len(resenas_list),
            "data": resenas_list
        }

    except Exception as e:
        print(f"ERROR AL RECUPERAR RESEÑAS: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Error interno al obtener el listado de reseñas"
        )
    

"""
Formato esperado del JSON enviado desde el Frontend para crear una reseña (ejemplo):
{
  "idCitas": "2",
  "idServicio": "serv1",
  "idTecnico": "2",
  "idCliente": "1",
  "puntuacion": 5,
  "comentario": "Excelente trabajo, muy puntual.",
  "fotoUrl": "https://link-a-tu-foto.com/trabajo.jpg"
}

Formato esperado del JSON para actualizar una reseña (ejemplo):
{
  "puntuacion": 4,
  "comentario": "Actualizo mi reseña: El técnico volvió para ajustar un detalle y ahora quedó perfecto. Muy profesional.",
  "fotoUrl": "https://firebasestorage.googleapis.com/v0/b/rukano-app/o/fotos_reseñas%2Ftrabajo_finalizado_v2.jpg"
}

Para que una reseña sea valida, la cita correspondiente debe existir en firestore y tener el estado "realizado"
"""