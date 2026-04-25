from fastapi import APIRouter, HTTPException
from core.firebase_config import db
from datetime import datetime

router = APIRouter()

@router.post("/crear_reseña")
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
            "idCitas": id_cita_referencia,
            "idServicio": cita_data.get("idServicio"), 
            "idTecnico": cita_data.get("idTecnico"),   
            "idCliente": cita_data.get("idCliente"),   
            "puntuacion": puntuacion,
            "comentario": datos.get("comentario", ""),
            "fotoUrl": datos.get("fotoUrl", ""),       
            "createdAt": datetime.utcnow()             # Para mantener un registro de cuándo se creó la reseña
        }

        # 4. Guardamos en la colección 'reseñas'
        db.collection("reseñas").add(nueva_reseña)

        return {"status": "success", "message": "Reseña vinculada a la cita con éxito"}

    except Exception as e:
        # Manejo de errores
        raise HTTPException(status_code=500, detail=f"Error al procesar: {str(e)}")
    

"""
Formato esperado del JSON enviado desde el Frontend para crear una reseña (ejemplo):
{
  "idCitas": "1",
  "idServicio": "2",
  "idTecnico": "3",
  "idCliente": "4",
  "puntuacion": 5,
  "comentario": "Excelente trabajo, muy puntual.",
  "fotoUrl": "https://link-a-tu-foto.com/trabajo.jpg"
}

Para que una reseña sea valida, la cita correspondiente debe existir en firestore y tener el estado "realizado"
"""