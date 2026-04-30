from fastapi import APIRouter, HTTPException
from core.firebase_config import db
import re

router = APIRouter()

@router.get("/categoria_solicitada/{comuna}/{categoria}")
async def busqueda_por_categoria(comuna: str, categoria: str):
    try:

        # Obtenemos las comunas cercanas a la comuna solicitada para ampliar la búsqueda
        # Si la comuna no está en el diccionario, se busca solo en esa comuna
        comunas_objetivo = COMUNAS_CERCANAS.get(comuna, [comuna])
 
        #1 Obtenemos la referencia de los servicios de la base de datos
        services_ref = db.collection("servicios")

        #2 Realizamos la consulta filtrando por la categoría solicitada y por las comunas cercanas a la comuna solicitada
        query = services_ref.where("categoria", "==", categoria).where("comuna", "in", comunas_objetivo)

        #3 Obtenemos los resultados de la consulta
        results = []

        for doc in query.stream():
            # Es necesario convertir cada documento de la base de datos a un diccionario
            # Solo necesitamos agregar los campos relevantes para el dato a devolver al cliente
            servicio_data = doc.to_dict()

            es_local = servicio_data.get("comuna") == comuna

            servicio_data["idServicio"] = servicio_data.get("idServicio")  # Agregamos el ID del documento a los datos del servicio
            servicio_data["idTecnico"] = servicio_data.get("idTecnico") # Agregamos el ID del técnico a los datos del servicio
            servicio_data["titulo"] = servicio_data.get("titulo")  # Agregamos el título del servicio a los datos del servicio
            servicio_data["categoria"] = categoria  # Agregamos la categoría al resultado
            servicio_data["precio base"] = servicio_data.get("precio base")  # Agregamos el precio base del servicio a los datos del servicio
            servicio_data["descripción"] = servicio_data.get("descripción")  # Agregamos la descripción del servicio a los datos del servicio
            servicio_data["idTecnico"] = servicio_data.get("idTecnico")  # Agregamos el ID del técnico a los datos del servicio
            servicio_data["es_local"] = es_local  # Agregamos un campo para indicar si el servicio es local o no, esto se usará para ordenar los resultados dando prioridad a los locales

            # Guardamos el resultado en la lista de resultados a devolver al cliente
            results.append(servicio_data)

        
        if not results:
            return {"message": "No se encontraron servicios para la categoría solicitada"}
        else:
            # Ordenamos los resultados dando prioridad a los servicios locales (es_local = True) sobre los no locales (es_local = False)
            results.sort(key=lambda x: x["es_local"], reverse=True)
            return results
        

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/busqueda_general/{comuna}/{texto_busqueda}")
async def busqueda_general(comuna: str, texto_busqueda: str):
    try:
        # Obtenemos las comunas cercanas a la comuna solicitada para ampliar la búsqueda
        # Si la comuna no está en el diccionario, se busca solo en esa comuna
        comunas_objetivo = COMUNAS_CERCANAS.get(comuna, [comuna])

        services_ref = db.collection("servicios")
        
        # 1. Generamos keywords únicas de la búsqueda del usuario
        # Usamos el texto una vez ya que la función lo procesa internamente
        keywords_usuario = generar_keywords(texto_busqueda, "", "") 

        # 2. Usamos un diccionario para evitar duplicados y cumplir con Calidad [2]
        resultados_unicos = {}

        for palabra in keywords_usuario:

            print(f"Buscando la palabra exacta: '{palabra}' en el campo 'keyWords'")

            # Filtramos por keywords y comuna
            docs = services_ref.where("keyWords", "array_contains", palabra).where("comuna", "in", comunas_objetivo).stream()
            
            for doc in docs:
                if doc.id not in resultados_unicos:
                    data = doc.to_dict()
                    es_local = data.get("comuna") == comuna
                    # Mapeo limpio siguiendo el principio de ZeroLeaking [4]
                    resultados_unicos[doc.id] = {
                        "idServicio": data.get("idServicio"),
                        "idTecnico": data.get("idTecnico"),
                        "titulo": data.get("titulo"),
                        "categoria": data.get("categoria"),
                        "precio_base": data.get("precio base"),
                        "descripcion": data.get("descripción"),  # Con tilde como en tu DB
                        "es_local": es_local  # Agregamos el campo para indicar si es local
                    }
        
        # 3. Convertimos el diccionario a lista para la respuesta final
        final_list = list(resultados_unicos.values())

        # Ordenamos los resultados dando prioridad a los servicios locales
        final_list.sort(key=lambda x: x["es_local"], reverse=True)

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



# Este diccionario se utiliza para definir las comunas cercanas a cada comuna de Santiago
COMUNAS_CERCANAS = {
    # --- ZONA CENTRO ---
    "Santiago": ["Santiago", "Estación Central", "Recoleta", "Independencia", "San Miguel", "Ñuñoa", "Quinta Normal"],
    "Independencia": ["Independencia", "Santiago", "Recoleta", "Conchalí", "Renca", "Quinta Normal"],
    "Recoleta": ["Recoleta", "Independencia", "Santiago", "Conchalí", "Huechuraba", "Providencia"],

    # --- ZONA ORIENTE ---
    "Providencia": ["Providencia", "Santiago", "Recoleta", "Ñuñoa", "Las Condes", "Vitacura"],
    "Las Condes": ["Las Condes", "Providencia", "Vitacura", "Lo Barnechea", "La Reina"],
    "Vitacura": ["Vitacura", "Las Condes", "Lo Barnechea", "Huechuraba", "Providencia"],
    "Lo Barnechea": ["Lo Barnechea", "Las Condes", "Vitacura"],
    "La Reina": ["La Reina", "Las Condes", "Providencia", "Ñuñoa", "Peñalolén"],
    "Ñuñoa": ["Ñuñoa", "Santiago", "Providencia", "La Reina", "Macul", "Peñalolén"],
    "Macul": ["Macul", "Ñuñoa", "Peñalolén", "La Florida", "San Joaquín"],
    "Peñalolén": ["Peñalolén", "La Reina", "Ñuñoa", "Macul", "La Florida"],

    # --- ZONA SUR / SUR-ORIENTE ---
    "La Florida": ["La Florida", "Puente Alto", "Macul", "Peñalolén", "La Granja", "San José de Maipo"],
    "Puente Alto": ["Puente Alto", "La Florida", "Pirque", "San José de Maipo", "La Pintana"],
    "San Joaquín": ["San Joaquín", "San Miguel", "Santiago", "Macul", "La Granja"],
    "San Miguel": ["San Miguel", "Santiago", "San Joaquín", "Pedro Aguirre Cerda", "La Cisterna", "Lo Espejo"],
    "La Cisterna": ["La Cisterna", "San Miguel", "Lo Espejo", "El Bosque", "San Ramón", "La Granja"],
    "La Granja": ["La Granja", "San Ramón", "La Cisterna", "La Florida", "San Joaquín"],
    "San Ramón": ["San Ramón", "La Granja", "La Cisterna", "El Bosque", "La Pintana"],
    "La Pintana": ["La Pintana", "El Bosque", "San Bernardo", "Puente Alto", "San Ramón"],
    "El Bosque": ["El Bosque", "San Bernardo", "La Pintana", "La Cisterna", "San Ramón"],
    "San Bernardo": ["San Bernardo", "El Bosque", "La Pintana", "Calera de Tango", "Buin", "Maipú", "Lo Espejo"],

    # --- ZONA SUR PERIFÉRICA ---
    "Pirque": ["Pirque", "Puente Alto", "San José de Maipo", "Buin"],
    "San José de Maipo": ["San José de Maipo", "Puente Alto", "Pirque", "La Florida"],
    "Buin": ["Buin", "Paine", "San Bernardo", "Pirque", "Calera de Tango"],
    "Paine": ["Paine", "Buin", "Alhué"],
    "Calera de Tango": ["Calera de Tango", "San Bernardo", "Talagante", "Peñaflor", "Maipú"],

    # --- ZONA PONIENTE ---
    "Estación Central": ["Estación Central", "Santiago", "Quinta Normal", "Lo Prado", "Cerrillos", "Maipú", "Pudahuel"],
    "Maipú": ["Maipú", "Cerrillos", "Pudahuel", "Estación Central", "San Bernardo", "Padre Hurtado"],
    "Cerrillos": ["Cerrillos", "Maipú", "Lo Espejo", "Pedro Aguirre Cerda", "Estación Central"],
    "Pedro Aguirre Cerda": ["Pedro Aguirre Cerda", "Santiago", "San Miguel", "Lo Espejo", "Cerrillos"],
    "Lo Espejo": ["Lo Espejo", "Pedro Aguirre Cerda", "San Miguel", "La Cisterna", "San Bernardo", "Cerrillos"],
    "Pudahuel": ["Pudahuel", "Maipú", "Lo Prado", "Cerro Navia", "Quilicura", "Curacaví", "Lampa"],
    "Lo Prado": ["Lo Prado", "Pudahuel", "Quinta Normal", "Estación Central", "Cerro Navia"],
    "Quinta Normal": ["Quinta Normal", "Santiago", "Renca", "Independencia", "Lo Prado", "Cerro Navia"],
    "Cerro Navia": ["Cerro Navia", "Quinta Normal", "Renca", "Pudahuel", "Lo Prado"],
    "Renca": ["Renca", "Quilicura", "Conchalí", "Independencia", "Quinta Normal", "Cerro Navia"],

    # --- ZONA NORTE ---
    "Quilicura": ["Quilicura", "Renca", "Lampa", "Colina", "Conchalí", "Pudahuel"],
    "Conchalí": ["Conchalí", "Quilicura", "Renca", "Independencia", "Recoleta", "Huechuraba"],
    "Huechuraba": ["Huechuraba", "Conchalí", "Recoleta", "Vitacura", "Colina"],
    "Colina": ["Colina", "Lampa", "Tiltil", "Huechuraba", "Lo Barnechea"],
    "Lampa": ["Lampa", "Colina", "Tiltil", "Quilicura", "Pudahuel"],
    "Tiltil": ["Tiltil", "Lampa", "Colina"],

    # --- ZONA RURAL / PERIFÉRICA PONIENTE ---
    "Talagante": ["Talagante", "Peñaflor", "Isla de Maipo", "El Monte", "Calera de Tango"],
    "Peñaflor": ["Peñaflor", "Talagante", "Padre Hurtado", "Calera de Tango"],
    "Padre Hurtado": ["Padre Hurtado", "Maipú", "Peñaflor"],
    "El Monte": ["El Monte", "Talagante", "Melipilla"],
    "Isla de Maipo": ["Isla de Maipo", "Talagante", "Buin"],
    "Melipilla": ["Melipilla", "El Monte", "Curacaví", "San Pedro", "Alhué"],
    "Curacaví": ["Curacaví", "Pudahuel", "Melipilla", "María Pinto"],
    "María Pinto": ["María Pinto", "Curacaví", "Melipilla"],
    "San Pedro": ["San Pedro", "Melipilla", "Alhué"],
    "Alhué": ["Alhué", "San Pedro", "Melipilla", "Paine"]
}