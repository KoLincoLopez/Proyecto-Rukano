from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
from core.firebase_config import db
from google.cloud.firestore_v1.base_query import FieldFilter # Para búsquedas precisas

router = APIRouter()

# --- MODELOS DE DATOS ---
class ReporteServicio(BaseModel):
    idCita: str
    idServico: str
    motivo: str
    cuerpo: str
    imagen: str
    solicitaReembolso: bool = False

class ReporteUsuario(BaseModel):
    idUsuario: str
    motivo: str
    cuerpo: str
    imagen: str

class ResolucionReporte(BaseModel):
    comentario_moderador: str # Explicación de por qué se tomó la decisión
    accion_tomada: str # Ej: "Reembolso procesado" o "Pago liberado"


# --- ENDPOINTS ---

@router.post("/reportar_servicio")
async def crear_reporte_servicio(datos: ReporteServicio):
    try:
        # 1. VERIFICACIÓN: ¿Existe la cita? (Crucial para RF 5 y RF 9)
        cita_query = db.collection("citas").where(filter=FieldFilter("idCitas", "==", datos.idCita)).stream()
        if not list(cita_query):
            raise HTTPException(status_code=404, detail=f"Error: La cita con ID {datos.idCita} no existe")

        # 2. PROCESO DE CREACIÓN
        nuevo_id = str(uuid.uuid4())
        ahora = datetime.now(timezone.utc)

        reporte_data = {
            "idReporte": nuevo_id,
            "reporteTipo": "servicio",
            "idCita": datos.idCita,
            "idServico": datos.idServico,
            "motivo": datos.motivo,
            "cuerpo": datos.cuerpo,
            "imagen": datos.imagen,
            "estado": "sin resolver",
            "solicitaReembolso": datos.solicitaReembolso,
            "createdAt": ahora
        }

        db.collection("reportes").document(nuevo_id).set(reporte_data)
        return {"status": "success", "message": "Reporte de servicio levantado", "idReporte": nuevo_id}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/reportar_usuario")
async def crear_reporte_usuario(datos: ReporteUsuario):
    try:
        # 1. VERIFICACIÓN: ¿Existe el usuario reportado? (Crucial para RF 8)
        user_query = db.collection("usuarios").where(filter=FieldFilter("id", "==", datos.idUsuario)).stream()
        if not list(user_query):
            raise HTTPException(status_code=404, detail=f"Error: El usuario con ID {datos.idUsuario} no existe")

        # 2. PROCESO DE CREACIÓN
        nuevo_id = str(uuid.uuid4())
        ahora = datetime.now(timezone.utc)

        reporte_data = {
            "idReporte": nuevo_id,
            "reporteTipo": "usuario",
            "idUsuario": datos.idUsuario,
            "motivo": datos.motivo,
            "cuerpo": datos.cuerpo,
            "imagen": datos.imagen,
            "estado": "sin resolver",
            "createdAt": ahora
        }

        db.collection("reportes").document(nuevo_id).set(reporte_data)
        return {"status": "success", "message": "Reporte de usuario levantado", "idReporte": nuevo_id}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.patch("/resolver_reporte/{idReporte}")
async def resolver_reporte(idReporte: str, datos: ResolucionReporte):
    try:
        # 1. Referencia al documento en la colección "reportes"
        reporte_ref = db.collection("reportes").document(idReporte)
        reporte_doc = reporte_ref.get()

        # 2. Verificación de existencia (Aseguramiento de Calidad 99.9%)
        if not reporte_doc.exists:
            raise HTTPException(
                status_code=404, 
                detail=f"No se encontró el reporte con ID: {idReporte}"
            )

        # 3. Preparar los datos de cierre
        actualizacion = {
            "estado": "resuelto",
            "comentario_moderador": datos.comentario_moderador,
            "accion_tomada": datos.accion_tomada,
            "resolvedAt": datetime.now(timezone.utc) # Marca de tiempo para auditoría
        }

        # 4. Actualizar en Firestore
        reporte_ref.update(actualizacion)

        return {
            "status": "success", 
            "message": f"Reporte {idReporte} marcado como resuelto exitosamente",
            "resolucion": datos.accion_tomada
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        # Registro para mantener disponibilidad del 99.5% (RNF 2)
        print(f"ERROR EN RESOLUCIÓN: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail="Error interno al procesar la resolución del reporte"
        )