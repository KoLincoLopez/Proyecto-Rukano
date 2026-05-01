from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import re  # Importante para que tu función de keywords funcione
from core.firebase_config import db
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter()

# --- TU FUNCIÓN INTEGRADA ---
def generar_keywords(titulo, categoria, descripcion):
    # Combina los campos para la búsqueda inteligente (RF 2)
    full_text = f"{titulo} {categoria} {descripcion}"
    full_text = full_text.lower()
    # Limpieza de caracteres para asegurar la precisión del 99.9% exigida
    clean_text = re.sub(r'[^\w\s]', '', full_text)
    words = clean_text.split()
    # Filtra palabras cortas y elimina duplicados para optimizar Firestore (RNF 4)
    keywords = list(set([w for w in words if len(w) > 2]))
    return keywords

# --- MODELO DE DATOS (Asegura Integridad 99.9%) ---
class Servicio(BaseModel):
    idTecnico: str
    nombre: str
    categoria: str
    comuna: str
    descripcion: str # Campo necesario para generar las keywords
    precio: float
    tiempoEstimado: str
    que_incluye: list[str]    # Obligatorio por RF 3
    que_no_incluye: list[str] # Obligatorio por RF 3

# --- ENDPOINTS ---

@router.post("/crear")
async def crear_servicio(datos: Servicio):
    try:
        # 1. VALIDACIÓN DE IDENTIDAD (RF 8): Verificar que el técnico exista
        # Buscamos por el ID único para asegurar la vinculación segura de la cuenta
        tecnico_ref = db.collection("usuarios").where(filter=FieldFilter("id", "==", datos.idTecnico)).get()
        if not tecnico_ref:
            raise HTTPException(status_code=404, detail="El técnico no está registrado en la plataforma")

        # 2. GENERACIÓN AUTOMÁTICA DE METADATOS Y KEYWORDS
        id_generado = str(uuid.uuid4())
        ahora = datetime.now(timezone.utc)
        
        # Invocamos tu función para automatizar la indexación del buscador (RF 2)
        palabras_clave = generar_keywords(datos.nombre, datos.categoria, datos.descripcion)

        # 3. MAPEO DE DATOS (Normalizado para búsqueda eficiente)
        servicio_doc = {
            "idServicio": id_generado,
            "idTecnico": datos.idTecnico,
            "nombre": datos.nombre,
            "categoria": datos.categoria.lower(),
            "comuna": datos.comuna,
            "descripcion": datos.descripcion,
            "precio": datos.precio,
            "tiempoEstimado": datos.tiempoEstimado,
            "keyWords": palabras_clave, # Resultado de tu función
            "que_incluye": datos.que_incluye,
            "que_no_incluye": datos.que_no_incluye,
            "estado": "active",
            "createdAt": ahora
        }

        # 4. GUARDADO (RNF 4: Escalabilidad NoSQL)
        db.collection("servicios").document(id_generado).set(servicio_doc)
        return {"msg": "Servicio publicado exitosamente con búsqueda inteligente", "id": id_generado}

    except Exception as e:
        # Registro para mantener disponibilidad del 99.5% (RNF 2)
        raise HTTPException(status_code=500, detail=str(e))


"""
Dejo este endpoint por protocolo y pruebas, pero para realizar las busquedas mejor utilicen los 
endpoints de search.py que ya estan optimizados para realizar una busqueda inteligente
"""
@router.get("/buscar")
async def buscar_servicios(
    categoria: str = Query(None), 
    comuna: str = Query(None),
    keyword: str = Query(None)
):
    # Implementación del Buscador Inteligente basado en keywords (RF 2)
    query = db.collection("servicios").where(filter=FieldFilter("estado", "==", "active"))
    
    if categoria:
        query = query.where(filter=FieldFilter("categoria", "==", categoria.lower()))
    if comuna:
        query = query.where(filter=FieldFilter("comuna", "==", comuna))
        
    docs = query.stream()
    resultados = []
    
    for doc in docs:
        d = doc.to_dict()
        # Filtro por las palabras clave generadas automáticamente
        if keyword:
            if keyword.lower() in d.get("keyWords", []):
                resultados.append(d)
        else:
            resultados.append(d)

    return {"status": "success", "data": resultados}

@router.patch("/editar/{servicio_id}")
async def editar_servicio(servicio_id: str, updates: dict):
    try:
        # 1. Obtener la referencia y el documento actual (Precisión 99.9%)
        servicio_ref = db.collection("servicios").document(servicio_id)
        doc = servicio_ref.get()

        if not doc.exists:
            raise HTTPException(
                status_code=404, 
                detail="El servicio que intentas modificar no existe"
            )

        datos_actuales = doc.to_dict()

        # 2. RECALCULAR KEYWORDS (RF 2): Solo si cambian los campos que las alimentan
        # Usamos los datos nuevos o los actuales si no se enviaron en el update
        campos_criticos = ["nombre", "categoria", "descripcion"]
        si_cambio_critico = any(campo in updates for campo in campos_criticos)

        if si_cambio_critico:
            nuevo_nombre = updates.get("nombre", datos_actuales.get("nombre"))
            nueva_cat = updates.get("categoria", datos_actuales.get("categoria"))
            nueva_desc = updates.get("descripcion", datos_actuales.get("descripcion"))
            
            # Invocamos tu función para mantener la "Inmediatez" del buscador
            updates["keyWords"] = generar_keywords(nuevo_nombre, nueva_cat, nueva_desc)

        # 3. Normalización de categoría si es que cambió
        if "categoria" in updates:
            updates["categoria"] = updates["categoria"].lower()

        # 4. Actualización en Firestore (RNF 4: Escalabilidad NoSQL)
        servicio_ref.update(updates)

        return {
            "status": "success",
            "msg": f"Servicio {servicio_id} actualizado correctamente",
            "campos_modificados": list(updates.keys())
        }

    except Exception as e:
        # Registro para asegurar la disponibilidad del 99.5% (RNF 2)
        print(f"ERROR EN EDICIÓN: {str(e)}")
        raise HTTPException(status_code=500, detail="Error interno al actualizar el servicio")
    
"""
Ejemplo de JSON para editar un servicio (PATCH /servicios/editar/{servicio_id}):
{
  "precio": 35000.0,
  "descripcion": "Reparación avanzada de fugas y cambio de llaves de paso"
}
"""


@router.delete("/{servicio_id}")
async def eliminar_servicio(servicio_id: str):
    # Acceso directo para cumplir con rendimiento < 2.5s (RNF 1)
    ref = db.collection("servicios").document(servicio_id)
    if not ref.get().exists:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    
    ref.delete()
    return {"msg": "Servicio eliminado permanentemente"}