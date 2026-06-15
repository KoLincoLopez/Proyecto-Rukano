from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone
import uuid
from core.firebase_config import db
from models.enums import RolUsuario
from routers.auth import obtener_usuario_autenticado
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

class ReporteGeneral(BaseModel):
    tipoReporte: str
    tecnicoRelacionado: str | None = None
    descripcion: str

class ResolucionReporte(BaseModel):
    comentario_moderador: str # Explicación de por qué se tomó la decisión
    accion_tomada: str # Ej: "Reembolso procesado" o "Pago liberado"


# --- ENDPOINTS ---

@router.post("/reportar_servicio_cita")
async def crear_reporte_cita(
    datos: ReporteCita,
    authorization: str | None = Header(default=None)
):
    try:
        uid_reportante, _ = obtener_usuario_autenticado(authorization)
        cita_ref = db.collection("citas").document(datos.idCita)
        cita_doc = cita_ref.get()
        if not cita_doc.exists:
            cita_query = list(
                db.collection("citas")
                .where(filter=FieldFilter("idCita", "==", datos.idCita))
                .limit(1)
                .stream()
            )
            cita_doc = cita_query[0] if cita_query else None

        if cita_doc is None or not cita_doc.exists:
            raise HTTPException(status_code=404, detail=f"Error: La cita con ID {datos.idCita} no existe")

        cita_data = cita_doc.to_dict()
        if uid_reportante not in {cita_data.get("idCliente"), cita_data.get("idTecnico")}:
            raise HTTPException(status_code=403, detail="No tienes permisos para reportar esta cita")

        nuevo_id = str(uuid.uuid4())
        ahora = datetime.now(timezone.utc)

        id_servicio = datos.idServicio or datos.idServico
        if not id_servicio:
            id_servicio = cita_data.get("idServicio")

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
            "idReportante": uid_reportante,
            "createdAt": ahora
        }

        db.collection("reportes").document(nuevo_id).set(reporte_data)
        return {"status": "success", "message": "Reporte de cita levantado", "idReporte": nuevo_id}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/reportar_servicio")
async def crear_reporte_servicio(
    datos: ReporteServicio,
    authorization: str | None = Header(default=None)
):
    try:
        uid_reportante, _ = obtener_usuario_autenticado(authorization)
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
            "idReportante": uid_reportante,
            "createdAt": ahora
        }

        db.collection("reportes").document(nuevo_id).set(reporte_data)
        return {"status": "success", "message": "Reporte de servicio levantado", "idReporte": nuevo_id}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/reportar_usuario")
async def crear_reporte_usuario(
    datos: ReporteUsuario,
    authorization: str | None = Header(default=None)
):
    try:
        uid_reportante, _ = obtener_usuario_autenticado(authorization)
        usuario_doc = db.collection("usuarios").document(datos.idUsuario).get()
        if not usuario_doc.exists:
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
            "idReportante": uid_reportante,
            "createdAt": ahora
        }

        db.collection("reportes").document(nuevo_id).set(reporte_data)
        return {"status": "success", "message": "Reporte de usuario levantado", "idReporte": nuevo_id}

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

@router.post("/reportar_general")
async def crear_reporte_general(
    datos: ReporteGeneral,
    authorization: str | None = Header(default=None)
):
    uid_reportante, user_data = obtener_usuario_autenticado(authorization)
    nuevo_id = str(uuid.uuid4())
    ahora = datetime.now(timezone.utc)

    reporte_data = {
        "idReporte": nuevo_id,
        "reporteTipo": "general",
        "tipoReporte": datos.tipoReporte,
        "tecnicoRelacionado": datos.tecnicoRelacionado,
        "descripcion": datos.descripcion,
        "mensaje": datos.descripcion,
        "idReportante": uid_reportante,
        "nombreReportante": " ".join(
            filter(None, [user_data.get("nombre"), user_data.get("apellido")])
        ).strip(),
        "correoReportante": user_data.get("correo"),
        "estado": "sin resolver",
        "createdAt": ahora
    }

    db.collection("reportes").document(nuevo_id).set(reporte_data)
    return {"status": "success", "message": "Reporte enviado correctamente", "idReporte": nuevo_id}

@router.patch("/resolver_reporte/{idReporte}")
async def resolver_reporte(
    idReporte: str,
    datos: ResolucionReporte,
    authorization: str | None = Header(default=None)
):
    try:
        uid_admin, _ = obtener_usuario_autenticado(
            authorization,
            RolUsuario.ADMIN.value
        )
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
            "resueltoPor": uid_admin,
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
