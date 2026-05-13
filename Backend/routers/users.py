from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
from typing import Optional
from core.firebase_config import db

router = APIRouter()

# Modelo Base (Campos comunes)
class UsuarioBase(BaseModel):
    id: str
    nombre: str
    apellido: str
    correo: EmailStr
    direccion: str
    telefono: str
    rol: str  # "cliente" o "técnico"

# Modelo específico para Cliente (RF 1)
class UsuarioCliente(UsuarioBase):
    pass # Por ahora usa los campos base según tu ejemplo

# Modelo específico para Técnico (RF 8 y 21)
class UsuarioTecnico(UsuarioBase):
    especialidad: str
    titulo: str
    descripcion: str
    cuenta_bancaria: str
    calificacion_promedio: float = 0.0
    cantidad_reseñas: int = 0
    verificado: bool = False # Se activa tras revisión manual [4]

@router.post("/registro")
async def registrar_usuario(datos: dict):
    try:
        user_id = datos.get("id")
        rol = datos.get("rol")
        
        # Estructura de tiempo para createdAt [Métricas de Calidad]
        datos["createdAt"] = datetime.now(timezone.utc)

        # Validación de Identidad para Técnicos (RF 8)
        if rol == "técnico":
            # Aquí podrías agregar la lógica para recibir la foto del carnet [2]
            datos["verificado"] = False # Queda en revisión manual [4]
            # Inicializamos métricas de reputación [RF 6]
            datos["calificacion_promedio"] = 0.0
            datos["cantidad_reseñas"] = 0

        # Guardar en la colección única de "usuarios"
        db.collection("usuarios").document(user_id).set(datos)

        return {"status": "success", "message": f"Usuario {rol} registrado correctamente"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}")
async def obtener_perfil(user_id: str):
    doc = db.collection("usuarios").document(user_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    perfil = doc.to_dict()
    
    # Implementación de ZeroLeaking (Métricas de Calidad)
    # Si el usuario que consulta no es el dueño ni tiene una cita activa, 
    # se podrían ocultar datos sensibles aquí [6, 7]
    
    return perfil