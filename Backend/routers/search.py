from fastapi import APIRouter, HTTPException
from core.firebase_config import db

router = APIRouter()

@router.get("/categoria_solicitada/{categoria}")
async def busqueda_por_categoria(categoria: str):
    try:
        #1 Obtenemos la referencia de los servicios de la base de datos
        services_ref = db.collection("servicios")

        #2 Realizamos la consulta filtrando por la categoría solicitada
        query = services_ref.where("categoria", "==", categoria)

        #3 Obtenemos los resultados de la consulta
        results = query.stream()

        for doc in query:
            # Es necesario convertir cada documento de la base de datos a un diccionario
            # Solo necesitamos agregar los campos relevantes para el dato a devolver al cliente
            servicio_data = doc.to_dict()

            servicio_data["id"] = servicio_data.get("id")  # Agregamos el ID del documento a los datos del servicio
            servicio_data["titulo"] = servicio_data.get("titulo")  # Agregamos el título del servicio a los datos del servicio
            servicio_data["categoria"] = categoria  # Agregamos la categoría al resultado
            servicio_data["precio base"] = servicio_data.get("precio base")  # Agregamos el precio base del servicio a los datos del servicio
            servicio_data["descripcion"] = servicio_data.get("descripcion")  # Agregamos la descripción del servicio a los datos del servicio
            servicio_data["idTecnico"] = servicio_data.get("idTecnico")  # Agregamos el ID del técnico a los datos del servicio
            
            # Guardamos el resultado en la lista de resultados a devolver al cliente
            results.append(servicio_data)
        
        if not results:
            return {"message": "No se encontraron servicios para la categoría solicitada"}
        else:
            return results
        

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        