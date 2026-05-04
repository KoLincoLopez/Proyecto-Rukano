from fastapi import APIRouter, HTTPException, Query
from core.firebase_config import db
from google.cloud.firestore_v1.base_query import FieldFilter
import re

router = APIRouter()

# --- ENDPOINT: BÚSQUEDA POR CATEGORÍA Y CERCANÍA (RF 2) ---
@router.get("/categoria_solicitada/{comuna}/{categoria}")
async def busqueda_por_categoria(comuna: str, categoria: str):
    try:
        # 1. Identificar zona de búsqueda (Ubicación actual + Cercanas)
        zonas_busqueda = COMUNAS_CERCANAS.get(comuna, [comuna])

        # 2. Consulta a Firestore (Filtrado por categoría y estado activo)
        # Usamos FieldFilter para asegurar precisión del 99.9% [5]
        query = db.collection("servicios") \
                  .where(filter=FieldFilter("categoria", "==", categoria.lower())) \
                  .where(filter=FieldFilter("estado", "==", "activo"))
        
        docs = query.stream()
        
        # 3. Filtrar por comuna y Limpiar datos "a primera vista"
        resultados = []
        for doc in docs:
            d = doc.to_dict()
            if d.get("comuna") in zonas_busqueda:
                # Omitimos el 'esquema_formulario' y 'keyWords' para el cliente
                vista_cliente = {
                    "idServicio": d.get("idServicio"),
                    "nombre": d.get("nombre"),
                    "precio": d.get("precio"),
                    "comuna": d.get("comuna"),
                    "tiempoEstimado": d.get("tiempoEstimado"),
                    "categoria": d.get("categoria"),
                    "idTecnico": d.get("idTecnico")
                }
                resultados.append(vista_cliente)

        return {"status": "success", "total": len(resultados), "data": resultados}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINT: BÚSQUEDA INTELIGENTE POR PALABRAS CLAVE (RF 2) ---
@router.get("/busqueda_general/{comuna}/{texto_busqueda}")
async def busqueda_general(comuna: str, texto_busqueda: str):
    try:
        zonas_busqueda = COMUNAS_CERCANAS.get(comuna, [comuna])
        palabra_objetivo = texto_busqueda.lower()

        # Buscamos todos los servicios activos en la zona
        docs = db.collection("servicios").where(filter=FieldFilter("estado", "==", "activo")).stream()
        
        resultados = []
        for doc in docs:
            d = doc.to_dict()
            
            # Validación de zona y búsqueda en el array de keyWords [6]
            if d.get("comuna") in zonas_busqueda:
                if palabra_objetivo in d.get("keyWords", []):
                    # Solo datos relevantes para la primera vista
                    resultados.append({
                        "idServicio": d.get("idServicio"),
                        "nombre": d.get("nombre"),
                        "precio": d.get("precio"),
                        "comuna": d.get("comuna"),
                        "descripcion_corta": d.get("descripcion")[:100] + "...",
                        "idTecnico": d.get("idTecnico")
                    })

        return {"status": "success", "total": len(resultados), "data": resultados}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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