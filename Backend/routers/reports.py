from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
from core.firebase_config import db
from google.cloud.firestore_v1.base_query import FieldFilter # Para búsquedas precisas

router = APIRouter()

# --- MODELOS DE DATOS ---
class ReporteCita(BaseModel):
    idCita: str
    idServicio: str | None = None
    idServico: str | None = None
    motivo: str
    cuerpo: str
    imagen: str
    solicitaReembolso: bool = False

class ReporteServicio(BaseModel):
    idServicio: str
    motivo: str
    cuerpo: str
    imagen: str

class ReporteUsuario(BaseModel):
    idUsuario: str
    motivo: str
    cuerpo: str
    imagen: str

class ResolucionReporte(BaseModel):
    comentario_moderador: str # Explicación de por qué se tomó la decisión
    accion_tomada: str # Ej: "Reembolso procesado" o "Pago liberado"


# --- ENDPOINTS ---

@router.post("/reportar_servicio_cita")
async def crear_reporte_cita(datos: ReporteCita):
    try:
        # 1. VERIFICACIÓN: ¿Existe la cita? (Crucial para el reporte de cita)
        cita_query = db.collection("citas").where(filter=FieldFilter("idCita", "==", datos.idCita)).stream()
        if not list(cita_query):
            raise HTTPException(status_code=404, detail=f"Error: La cita con ID {datos.idCita} no existe")

        # 2. PROCESO DE CREACIÓN
        nuevo_id = str(uuid.uuid4())
        ahora = datetime.now(timezone.utc)

        id_servicio = datos.idServicio or datos.idServico
        if not id_servicio:
            cita_ref = db.collection("citas").document(datos.idCita)
            cita_doc = cita_ref.get()
            if cita_doc.exists:
                id_servicio = cita_doc.to_dict().get("idServicio")

        if not id_servicio:
            raise HTTPException(status_code=400, detail="Debe indicar idServicio")

        reporte_data = {
            "idReporte": nuevo_id,
            "reporteTipo": "cita",
            "idCita": datos.idCita,
            "idServicio": id_servicio,
            "motivo": datos.motivo,
            "cuerpo": datos.cuerpo,
            "imagen": datos.imagen,
            "estado": "sin resolver",
            "solicitaReembolso": datos.solicitaReembolso,
            "createdAt": ahora
        }

        db.collection("reportes").document(nuevo_id).set(reporte_data)
        return {"status": "success", "message": "Reporte de cita levantado", "idReporte": nuevo_id}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/reportar_servicio")
async def crear_reporte_servicio(datos: ReporteServicio):
    try:
        servicio_ref = db.collection("servicios").document(datos.idServicio)
        servicio_doc = servicio_ref.get()
        if not servicio_doc.exists:
            raise HTTPException(status_code=404, detail=f"Error: El servicio con ID {datos.idServicio} no existe")

        nuevo_id = str(uuid.uuid4())
        ahora = datetime.now(timezone.utc)

        reporte_data = {
            "idReporte": nuevo_id,
            "reporteTipo": "servicio",
            "idServicio": datos.idServicio,
            "motivo": datos.motivo,
            "cuerpo": datos.cuerpo,
            "imagen": datos.imagen,
            "estado": "sin resolver",
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
