from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
import re 
from core.firebase_config import db
from google.cloud.firestore_v1.base_query import FieldFilter

router = APIRouter()

# --- MODELOS PARA FORMULARIOS DINÁMICOS (RF 3) ---

class PreguntaFormulario(BaseModel):
    id_pregunta: str  # Ej: "p1"
    pregunta: str     # Ej: "¿Su calefón es de tiro natural o forzado?"
    tipo: str         # Ej: "text", "boolean", "number"
    obligatorio: bool

class Servicio(BaseModel): 
    idTecnico: str 
    nombre: str 
    categoria: str 
    comuna: str 
    descripcion: str 
    precio: float 
    tiempoEstimado: str 
    que_incluye: list[str]    
    que_no_incluye: list[str]
    esquema_formulario: list[PreguntaFormulario] 

# --- FUNCIONES AUXILIARES ---

def generar_keywords(titulo, categoria, descripcion):
    full_text = f"{titulo} {categoria} {descripcion}"
    full_text = full_text.lower()
    clean_text = re.sub(r'[^\w\s]', '', full_text)
    words = clean_text.split()
    keywords = list(set([w for w in words if len(w) > 2]))
    return keywords

# --- ENDPOINTS ---

@router.post("/crear") 
async def crear_servicio(datos: Servicio): 
    try: 
        # 1. VALIDACIÓN DE IDENTIDAD (RF 8)
        tecnico_ref = db.collection("usuarios").where(filter=FieldFilter("id", "==", datos.idTecnico)).get() 
        if not tecnico_ref: 
            raise HTTPException(status_code=404, detail="El técnico no está registrado en la plataforma")

        id_generado = str(uuid.uuid4())
        ahora = datetime.now(timezone.utc)
        palabras_clave = generar_keywords(datos.nombre, datos.categoria, datos.descripcion)

        # 2. MAPEO DE DATOS INCLUYENDO EL FORMULARIO
        servicio_doc = {
            "idServicio": id_generado,
            "idTecnico": datos.idTecnico,
            "nombre": datos.nombre,
            "categoria": datos.categoria.lower(),
            "comuna": datos.comuna,
            "descripcion": datos.descripcion,
            "precio": datos.precio,
            "tiempoEstimado": datos.tiempoEstimado,
            "keyWords": palabras_clave,
            "que_incluye": datos.que_incluye,
            "que_no_incluye": datos.que_no_incluye,
            "esquema_formulario": [p.dict() for p in datos.esquema_formulario], 
            "estado": "active",
            "createdAt": ahora
        }

        db.collection("servicios").document(id_generado).set(servicio_doc)
        return {"msg": "Servicio con formulario dinámico publicado", "id": id_generado}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINTS RECUPERADOS DE LA RAMA 'PRUEBA-LOGIN' ---

@router.get("/tecnico/{tecnico_id}")
async def obtener_servicios_tecnico(tecnico_id: str):
    servicios_ref = db.collection("servicios")
    
    # Nota: Actualizado para buscar por 'idTecnico' en lugar de 'tecnicoId' para que coincida con el modelo de main
    docs = servicios_ref.where(filter=FieldFilter("idTecnico", "==", tecnico_id)).stream()

    servicios = []
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        servicios.append(data)

    return servicios

@router.get("/")
async def obtener_todos():
    docs = db.collection("servicios").stream()
    servicios = []
    
    for doc in docs:
        data = doc.to_dict()
        data["id"] = doc.id
        servicios.append(data)

    return servicios

# --- ENDPOINTS DE EDICIÓN Y ELIMINACIÓN DE 'MAIN' ---

@router.patch("/editar/{servicio_id}") 
async def editar_servicio(servicio_id: str, updates: dict): 
    try: 
        servicio_ref = db.collection("servicios").document(servicio_id) 
        doc = servicio_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")

        datos_actuales = doc.to_dict()

        # Recalcular keywords si cambian campos críticos (RF 2)
        if any(k in updates for k in ["nombre", "categoria", "descripcion"]):
            nuevo_nombre = updates.get("nombre", datos_actuales.get("nombre"))
            nueva_cat = updates.get("categoria", datos_actuales.get("categoria"))
            nueva_desc = updates.get("descripcion", datos_actuales.get("descripcion"))
            updates["keyWords"] = generar_keywords(nuevo_nombre, nueva_cat, nueva_desc)

        # Si el técnico actualiza su formulario, se guarda la nueva lista
        if "esquema_formulario" in updates:
            # Aquí podrías añadir lógica para validar que la estructura de la lista sea correcta
            pass

        servicio_ref.update(updates)
        return {"status": "success", "msg": "Servicio y formulario actualizados"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{servicio_id}") 
async def eliminar_servicio(servicio_id: str): 
    ref = db.collection("servicios").document(servicio_id) 
    if not ref.get().exists: 
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    
    ref.delete()
    return {"msg": "Servicio eliminado permanentemente"}