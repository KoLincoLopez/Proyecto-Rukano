from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from core.firebase_config import db

router = APIRouter()

# Modelo Base (Campos comunes)
class UsuarioBase(BaseModel):
    id: Optional[str] = None
    nombre: str
    apellido: str
    correo: EmailStr
    direccion: str
    telefono: str
    rut: str
    foto_perfil: Optional[str] = None
    rol: Optional[str] = None

# Schema específico para Clientes (RF 1)
class RegistroCliente(UsuarioBase):
    rol: str = "cliente"
    # Se pueden agregar campos específicos de cliente aquí (ej. detalles de depto) [2]

# Modelo específico para Técnico (RF 8 y 21)
class UsuarioTecnico(UsuarioBase):
    rol: str = "técnico"
    especialidad: str
    titulo: str
    descripcion: str
    cuenta_bancaria: str
    calificacion_promedio: float = 0.0
    cantidad_reseñas: int = 0
    verificado: bool = False # Se activa tras revisión manual [4]

@router.post("/registro/cliente", response_model=dict, summary="Registro de Usuario Cliente")
async def registrar_cliente(datos: RegistroCliente):
    try:
        # Generar ID automático si no se proporciona
        if datos.id is None:
            datos.id = str(uuid4())
        
        # Convertimos el schema a diccionario y añadimos metadata del sistema
        user_data = datos.dict()
        user_data.update({
            "rol": "cliente",
            "createdAt": datetime.now(timezone.utc)
        })

        db.collection("usuarios").document(datos.id).set(user_data)
        return {"status": "success", "message": "Cliente registrado correctamente"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/registro/tecnico", response_model=dict, summary="Registro de Usuario Técnico")
async def registrar_tecnico(datos: UsuarioTecnico):
    try:
        # Generar ID automático si no se proporciona
        if datos.id is None:
            datos.id = str(uuid4())
        
        # Convertimos el schema a diccionario y añadimos metadata del sistema
        user_data = datos.dict()
        user_data.update({
            "rol": "técnico",
            "createdAt": datetime.now(timezone.utc)
        })

        db.collection("usuarios").document(datos.id).set(user_data)
        return {"status": "success", "message": "Técnico registrado correctamente"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FotoPerfilUpdate(BaseModel):
    nueva_url: str

@router.patch("/tecnico/verificar/{tecnico_id}", response_model=dict, summary="Activar o desactivar verificación del técnico")
async def cambiar_verificacion_tecnico(tecnico_id: str, verificado: bool):
    try:
        tecnico_ref = db.collection("usuarios").document(tecnico_id)
        tecnico_doc = tecnico_ref.get()

        if not tecnico_doc.exists:
            raise HTTPException(status_code=404, detail="Técnico no encontrado")

        tecnico_data = tecnico_doc.to_dict()
        if tecnico_data.get("rol") != "técnico":
            raise HTTPException(status_code=400, detail="El ID proporcionado no pertenece a un técnico")

        tecnico_ref.update({"verificado": verificado})
        return {
            "status": "success",
            "message": f"Técnico {'verificado' if verificado else 'desverificado'} correctamente",
            "verificado": verificado
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/usuario/foto_perfil/{usuario_id}", response_model=dict, summary="Actualizar foto de perfil de un usuario")
async def actualizar_foto_perfil(usuario_id: str, foto: FotoPerfilUpdate):
    try:
        usuario_ref = db.collection("usuarios").document(usuario_id)
        usuario_doc = usuario_ref.get()

        if not usuario_doc.exists:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        usuario_ref.update({"foto_perfil": foto.nueva_url})
        return {
            "status": "success",
            "message": "Foto de perfil actualizada correctamente",
            "foto_perfil": foto.nueva_url
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/usuario/foto_perfil/{usuario_id}", response_model=dict, summary="Eliminar foto de perfil de un usuario")
async def eliminar_foto_perfil(usuario_id: str):
    try:
        usuario_ref = db.collection("usuarios").document(usuario_id)
        usuario_doc = usuario_ref.get()

        if not usuario_doc.exists:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        usuario_ref.update({"foto_perfil": None})
        return {
            "status": "success",
            "message": "Foto de perfil eliminada correctamente",
            "foto_perfil": None
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.get("/usuario/publico/{usuario_id}", response_model=dict, summary="Obtener datos públicos de un usuario/ técnico")
async def obtener_usuario_publico(usuario_id: str):
    """
    Devuelve los datos de un usuario omitiendo campos sensibles:
    - Clientes: oculta `rut`
    - Técnicos: oculta `rut` y `cuenta_bancaria`
    """
    try:
        usuario_ref = db.collection("usuarios").document(usuario_id)
        usuario_doc = usuario_ref.get()

        if not usuario_doc.exists:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        data = usuario_doc.to_dict()

        # Campos sensibles por rol
        rol = (data.get("rol") or "").lower()
        public_data = dict(data)  # copia para modificar

        # Ocultar rut siempre
        public_data.pop("rut", None)

        # Si es técnico, también ocultar cuenta bancaria
        if rol in ("técnico", "tecnico"):
            public_data.pop("cuenta_bancaria", None)

        return {"status": "success", "usuario": public_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/schemas", summary="Esquemas de Usuario Disponibles")
async def obtener_schemas():
    """
    Devuelve los esquemas JSON de los modelos de usuario para referencia.
    Esto permite ver cómo se estructuran los datos sin modificar otros endpoints.
    """
    return {
        "UsuarioBase": UsuarioBase.schema(),
        "RegistroCliente": RegistroCliente.schema(),
        "UsuarioTecnico": UsuarioTecnico.schema()
    }