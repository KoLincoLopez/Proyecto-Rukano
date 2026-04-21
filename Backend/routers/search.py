from fastapi import APIRouter, HTTPException
from core.firebase_config import db
import re

router = APIRouter()

@router.get("/categoria_solicitada/{categoria}")
async def busqueda_por_categoria(categoria: str):
    try:
        #1 Obtenemos la referencia de los servicios de la base de datos
        services_ref = db.collection("servicios")

        #2 Realizamos la consulta filtrando por la categoría solicitada
        query = services_ref.where("categoria", "==", categoria)

        #3 Obtenemos los resultados de la consulta
        results = []

        for doc in query.stream():
            # Es necesario convertir cada documento de la base de datos a un diccionario
            # Solo necesitamos agregar los campos relevantes para el dato a devolver al cliente
            servicio_data = doc.to_dict()

            servicio_data["idServicio"] = servicio_data.get("idServicio")  # Agregamos el ID del documento a los datos del servicio
            servicio_data["idTecnico"] = servicio_data.get("idTecnico") # Agregamos el ID del técnico a los datos del servicio
            servicio_data["titulo"] = servicio_data.get("titulo")  # Agregamos el título del servicio a los datos del servicio
            servicio_data["categoria"] = categoria  # Agregamos la categoría al resultado
            servicio_data["precio base"] = servicio_data.get("precio base")  # Agregamos el precio base del servicio a los datos del servicio
            servicio_data["descripción"] = servicio_data.get("descripción")  # Agregamos la descripción del servicio a los datos del servicio
            servicio_data["idTecnico"] = servicio_data.get("idTecnico")  # Agregamos el ID del técnico a los datos del servicio
            
            # Guardamos el resultado en la lista de resultados a devolver al cliente
            results.append(servicio_data)
        
        if not results:
            return {"message": "No se encontraron servicios para la categoría solicitada"}
        else:
            return results
        

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/busqueda_general/{texto_busqueda}")
async def busqueda_general(texto_busqueda: str):
    try:
        services_ref = db.collection("servicios")
        
        # 1. Generamos keywords únicas de la búsqueda del usuario
        # Usamos el texto una vez ya que la función lo procesa internamente
        keywords_usuario = generar_keywords(texto_busqueda, "", "") 

        # 2. Usamos un diccionario para evitar duplicados y cumplir con Calidad [2]
        resultados_unicos = {}

        for palabra in keywords_usuario:
            print(f"Buscando la palabra exacta: '{palabra}' en el campo 'keyWords'")
            docs = services_ref.where("keyWords", "array_contains", palabra).stream()
            
            for doc in docs:
                if doc.id not in resultados_unicos:
                    data = doc.to_dict()
                    # Mapeo limpio siguiendo el principio de ZeroLeaking [4]
                    resultados_unicos[doc.id] = {
                        "idServicio": data.get("idServicio"),
                        "idTecnico": data.get("idTecnico"),
                        "titulo": data.get("titulo"),
                        "categoria": data.get("categoria"),
                        "precio_base": data.get("precio base"),
                        "descripcion": data.get("descripción") # Con tilde como en tu DB
                    }
        
        # 3. Convertimos el diccionario a lista para la respuesta final
        final_list = list(resultados_unicos.values())

        if not final_list:
            return {"status": "empty", "message": "No se encontraron servicios"}
            
        return {"status": "success", "total": len(final_list), "results": final_list}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en búsqueda: {str(e)}")
  











"""Esta funcion se encarga de generar las keywords de búsqueda a partir del título, categoría y descripción de un servicio.
Esta funcion no pertenece al microservicio de busqueda, pertenece al microservicio de servicios,
este se debe ejecutar on create y on update de un servicio, para generar las keywords cada vez que se cree o 
actualice un servicio en la base de datos."""

# Funcion para generar las keywords de busqueda 
def generar_keywords(titulo,categoria,descripcion):
    
    # Unimos todo el texto en una sola cadena
    full_text = f"{titulo} {categoria} {descripcion}"

    # Lo pasamos a minúsculas para normalizar el texto
    full_text = full_text.lower()

    # Eliminamos caracteres especiales y puntuación usando regex
    clean_text = re.sub(r'[^\w\s]', '', full_text)

    # Dividimos el texto en palabras individuales
    text = clean_text.split()
        
    # Filtramos palabras de 2 caracteres o menos para evitar palabras como "de", "la", "el", etc. que no aportan valor a la búsqueda
    keywords = [text for text in text if len(text) > 2]  
    return keywords