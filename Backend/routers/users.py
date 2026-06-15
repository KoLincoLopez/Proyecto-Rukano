from fastapi import APIRouter, Header, HTTPException
from firebase_admin import auth as firebase_auth
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone
from typing import Literal, Optional
import unicodedata
from core.firebase_config import db
from models.enums import RolUsuario
from routers.auth import obtener_uid_desde_authorization, obtener_usuario_autenticado

router = APIRouter()


def normalizar_rol(rol: str) -> str:
    texto = str(rol or "").strip().lower()
    return "".join(
        char for char in unicodedata.normalize("NFD", texto)
        if unicodedata.category(char) != "Mn"
    )

# Modelo Base (Campos comunes)
class UsuarioBase(BaseModel):
    id: Optional[str] = None
    nombre: str
    apellido: str
    correo: EmailStr
    direccion: str = ""
    comuna: str
    telefono: str
    rut: str = ""
    foto_perfil: Optional[str] = None
    rol: Optional[str] = None

# Schema específico para Clientes (RF 1)
class RegistroCliente(UsuarioBase):
    rol: str = "cliente"
    # Se pueden agregar campos específicos de cliente aquí (ej. detalles de depto) [2]

# Modelo específico para Técnico (RF 8 y 21)
class UsuarioTecnico(UsuarioBase):
    rol: str = RolUsuario.TECNICO.value
    especialidad: str
    titulo: str = ""
    descripcion: str = ""
    cuenta_bancaria: str = ""
    calificacion_promedio: float = 0.0
    cantidad_reseñas: int = 0
    verificado: bool = False # Se activa tras revisión manual [4]

@router.post("/registro/cliente", response_model=dict, summary="Registro de Usuario Cliente")
async def registrar_cliente(
    datos: RegistroCliente,
    authorization: str | None = Header(default=None)
):
    try:
        uid = obtener_uid_desde_authorization(authorization, requerido=True)
        if db.collection("usuarios").document(uid).get().exists:
            raise HTTPException(status_code=409, detail="El usuario ya está registrado")
        
        # Convertimos el schema a diccionario y añadimos metadata del sistema
        cuenta_firebase = firebase_auth.get_user(uid)
        correo_verificado = cuenta_firebase.email
        if not correo_verificado:
            raise HTTPException(status_code=400, detail="La cuenta autenticada no tiene correo")

        user_data = datos.model_dump()
        user_data.update({
            "id": uid,
            "correo": correo_verificado,
            "email": correo_verificado,
            "rol": "cliente",
            "createdAt": datetime.now(timezone.utc)
        })

        db.collection("usuarios").document(uid).set(user_data)
        return {"status": "success", "message": "Cliente registrado correctamente"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/registro/tecnico", response_model=dict, summary="Registro de Usuario Técnico")
async def registrar_tecnico(
    datos: UsuarioTecnico,
    authorization: str | None = Header(default=None)
):
    try:
        uid = obtener_uid_desde_authorization(authorization, requerido=True)
        if db.collection("usuarios").document(uid).get().exists:
            raise HTTPException(status_code=409, detail="El usuario ya está registrado")
        
        # Convertimos el schema a diccionario y añadimos metadata del sistema
        cuenta_firebase = firebase_auth.get_user(uid)
        correo_verificado = cuenta_firebase.email
        if not correo_verificado:
            raise HTTPException(status_code=400, detail="La cuenta autenticada no tiene correo")

        user_data = datos.model_dump()
        user_data.update({
            "id": uid,
            "correo": correo_verificado,
            "email": correo_verificado,
            "rol": RolUsuario.TECNICO.value,
            "createdAt": datetime.now(timezone.utc)
        })

        db.collection("usuarios").document(uid).set(user_data)
        return {"status": "success", "message": "Técnico registrado correctamente"}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FotoPerfilUpdate(BaseModel):
    nueva_url: str


class ConfiguracionTecnico(BaseModel):
    notificaciones: bool = True
    disponibilidad: Literal["disponible", "ocupado"] = "disponible"
    idioma: Literal["es", "en"] = "es"
    preferencias: str = Field(default="", max_length=2000)


@router.get("/usuario/configuracion", response_model=dict, summary="Obtener configuracion propia")
async def obtener_configuracion_usuario(
    authorization: str | None = Header(default=None)
):
    uid, usuario = obtener_usuario_autenticado(
        authorization,
        RolUsuario.TECNICO.value
    )
    configuracion = ConfiguracionTecnico.model_validate(
        usuario.get("configuracion") or {}
    )
    return {
        "status": "success",
        "usuario_id": uid,
        "configuracion": configuracion.model_dump()
    }


@router.patch("/usuario/configuracion", response_model=dict, summary="Actualizar configuracion propia")
async def actualizar_configuracion_usuario(
    configuracion: ConfiguracionTecnico,
    authorization: str | None = Header(default=None)
):
    uid, _ = obtener_usuario_autenticado(
        authorization,
        RolUsuario.TECNICO.value
    )
    db.collection("usuarios").document(uid).update({
        "configuracion": configuracion.model_dump(),
        "configuracionActualizadaEn": datetime.now(timezone.utc)
    })
    return {
        "status": "success",
        "message": "Configuracion actualizada correctamente",
        "configuracion": configuracion.model_dump()
    }


@router.patch("/tecnico/verificar/{tecnico_id}", response_model=dict, summary="Activar o desactivar verificación del técnico")
async def cambiar_verificacion_tecnico(
    tecnico_id: str,
    verificado: bool,
    authorization: str | None = Header(default=None)
):
    try:
        obtener_usuario_autenticado(authorization, RolUsuario.ADMIN.value)
        tecnico_ref = db.collection("usuarios").document(tecnico_id)
        tecnico_doc = tecnico_ref.get()

        if not tecnico_doc.exists:
            raise HTTPException(status_code=404, detail="Técnico no encontrado")

        tecnico_data = tecnico_doc.to_dict()
        rol_tecnico = normalizar_rol(tecnico_data.get("rol"))
        if rol_tecnico != RolUsuario.TECNICO.value:
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
async def actualizar_foto_perfil(
    usuario_id: str,
    foto: FotoPerfilUpdate,
    authorization: str | None = Header(default=None)
):
    try:
        uid_usuario, _ = obtener_usuario_autenticado(authorization)
        if usuario_id != uid_usuario:
            raise HTTPException(status_code=403, detail="No puedes modificar la foto de otro usuario")

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
async def eliminar_foto_perfil(
    usuario_id: str,
    authorization: str | None = Header(default=None)
):
    try:
        uid_usuario, _ = obtener_usuario_autenticado(authorization)
        if usuario_id != uid_usuario:
            raise HTTPException(status_code=403, detail="No puedes modificar la foto de otro usuario")

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
        rol = normalizar_rol(data.get("rol"))
        public_data = dict(data)  # copia para modificar

        # Ocultar rut siempre
        public_data.pop("rut", None)

        # Si es técnico, también ocultar cuenta bancaria
        if rol == RolUsuario.TECNICO.value:
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
        "UsuarioBase": UsuarioBase.model_json_schema(),
        "RegistroCliente": RegistroCliente.model_json_schema(),
        "UsuarioTecnico": UsuarioTecnico.model_json_schema()
    }
