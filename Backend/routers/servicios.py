from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import Any
import uuid
import re 
from core.firebase_config import db
from models.enums import RolUsuario
from routers.auth import obtener_usuario_autenticado
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
    disponibilidad: list[dict[str, Any]]
    descripcionTecnico: str | None = None
    experiencia: str | None = None
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

def dump_model(modelo):
    if hasattr(modelo, "model_dump"):
        return modelo.model_dump()
    return modelo.dict()

def normalizar_disponibilidad(disponibilidad):
    normalizada = []

    for item in disponibilidad:
        data = dump_model(item) if hasattr(item, "dict") or hasattr(item, "model_dump") else dict(item or {})
        dia = data.get("dia") or data.get("día") or data.get("day")
        inicio = data.get("inicio") or data.get("hora_inicio")
        fin = data.get("fin") or data.get("hora_fin")
        horarios = data.get("horarios") or data.get("slots")

        if horarios and isinstance(horarios, list):
            for horario in horarios:
                horario_data = horario if isinstance(horario, dict) else {"inicio": horario, "fin": horario}
                horario_inicio = horario_data.get("inicio") or horario_data.get("hora_inicio") or horario_data.get("hora")
                horario_fin = horario_data.get("fin") or horario_data.get("hora_fin") or horario_inicio

                if not dia or not horario_inicio or not horario_fin:
                    raise HTTPException(status_code=422, detail="Disponibilidad incompleta")

                normalizada.append({
                    "dia": dia,
                    "inicio": horario_inicio,
                    "fin": horario_fin,
                    "hora_inicio": horario_inicio,
                    "hora_fin": horario_fin
                })

            continue

        if not dia or not inicio or not fin:
            raise HTTPException(status_code=422, detail="Disponibilidad incompleta")

        normalizada.append({
            "dia": dia,
            "inicio": inicio,
            "fin": fin,
            "hora_inicio": inicio,
            "hora_fin": fin
        })

    return normalizada

# --- ENDPOINTS ---

@router.post("/crear") 
async def crear_servicio(
    datos: Servicio,
    authorization: str | None = Header(default=None)
):
    try: 
        uid_tecnico, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.TECNICO.value
        )

        id_generado = str(uuid.uuid4())
        ahora = datetime.now(timezone.utc)
        palabras_clave = generar_keywords(datos.nombre, datos.categoria, datos.descripcion)
        disponibilidad = normalizar_disponibilidad(datos.disponibilidad)

        # 2. MAPEO DE DATOS INCLUYENDO EL FORMULARIO
        servicio_doc = {
            "idServicio": id_generado,
            "idTecnico": uid_tecnico,
            "nombre": datos.nombre,
            "categoria": datos.categoria.lower(),
            "comuna": datos.comuna,
            "descripcion": datos.descripcion,
            "precio": datos.precio,
            "tiempoEstimado": datos.tiempoEstimado,
            "disponibilidad": disponibilidad,
            "descripcionTecnico": datos.descripcionTecnico,
            "experiencia": datos.experiencia,
            "keyWords": palabras_clave,
            "que_incluye": datos.que_incluye,
            "que_no_incluye": datos.que_no_incluye,
            "esquema_formulario": [dump_model(p) for p in datos.esquema_formulario],

            "estado": "activo",
            "createdAt": ahora
        }

        db.collection("servicios").document(id_generado).set(servicio_doc)
        return {"msg": "Servicio con formulario dinámico publicado", "id": id_generado}

    except HTTPException:
        raise
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
async def editar_servicio(
    servicio_id: str,
    updates: dict,
    authorization: str | None = Header(default=None)
):
    try: 
        uid_tecnico, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.TECNICO.value
        )
        servicio_ref = db.collection("servicios").document(servicio_id) 
        doc = servicio_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")

        datos_actuales = doc.to_dict()
        if datos_actuales.get("idTecnico") != uid_tecnico:
            raise HTTPException(status_code=403, detail="No puedes editar un servicio de otro técnico")

        updates.pop("idTecnico", None)

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

    except HTTPException:
        raise
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{servicio_id}") 
async def eliminar_servicio(
    servicio_id: str,
    authorization: str | None = Header(default=None)
):
    uid_tecnico, _ = obtener_usuario_autenticado(
        authorization,
        RolUsuario.TECNICO.value
    )
    ref = db.collection("servicios").document(servicio_id) 
    servicio_doc = ref.get()
    if not servicio_doc.exists:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    if servicio_doc.to_dict().get("idTecnico") != uid_tecnico:
        raise HTTPException(status_code=403, detail="No puedes eliminar un servicio de otro técnico")
    
    ref.delete()
    return {"msg": "Servicio eliminado permanentemente"}

@router.get("/{servicio_id}")
async def obtener_servicio(servicio_id: str):
    try:
        servicio_ref = db.collection("servicios").document(servicio_id)
        doc = servicio_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Servicio no encontrado")

        datos = doc.to_dict()
        # Aseguramos que el id vaya dentro de la respuesta
        datos["id"] = servicio_id
        return datos

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
