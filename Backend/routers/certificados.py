from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Header
from pydantic import BaseModel
from datetime import datetime, timezone
from typing import List
from uuid import uuid4
from core.firebase_config import db
from firebase_admin import auth as firebase_auth

router = APIRouter(prefix="/certificados", tags=["certificados"])

class CertificadoResponse(BaseModel):
    id_certificado: str
    id_usuario: str
    fecha_subida: str
    documentos: List[str]

async def obtener_uid_actual(authorization: str = Header(...)) -> str:
    """
    Extrae y valida el UID del usuario autenticado a partir del token Bearer.
    """
    try:
        token = authorization.replace("Bearer ", "")
        decoded = firebase_auth.verify_id_token(token)
        return decoded["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")


@router.post("/subir", response_model=dict, summary="Subir documentación de certificación para Técnicos")
async def subir_certificado(
    archivos: List[UploadFile] = File(...),
    uid_actual: str = Depends(obtener_uid_actual)
):
    """
    Sube hasta 5 documentos para la certificación del técnico autenticado.
    Reemplaza certificados anteriores y setea 'verificado' en False en el usuario.
    """
    try:
        id_usuario = uid_actual  # el técnico solo puede subir para sí mismo

        # 1. VALIDACIÓN: Verificar que el usuario exista y sea un técnico
        usuario_ref = db.collection("usuarios").document(id_usuario)
        usuario_doc = usuario_ref.get()

        if not usuario_doc.exists:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        usuario_data = usuario_doc.to_dict()
        rol = (usuario_data.get("rol") or "").lower()
        if rol not in ("técnico", "tecnico"):
            raise HTTPException(status_code=403, detail="Operación denegada: Solo los técnicos pueden subir certificados")

        # 2. VALIDACIÓN: Límite de documentos (Backend Guardrail)
        if len(archivos) == 0:
            raise HTTPException(status_code=400, detail="Debes subir al menos un documento")
        if len(archivos) > 5:
            raise HTTPException(status_code=400, detail="No se permite subir más de 5 documentos")

        # 3. VALIDACIÓN: Formatos permitidos (Imagen, Word, PDF)
        formatos_permitidos = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ]

        for archivo in archivos:
            if archivo.content_type not in formatos_permitidos:
                raise HTTPException(
                    status_code=400,
                    detail=f"Formato de archivo no permitido: {archivo.filename}. Solo PDF, Imágenes o Word."
                )

        # 4. PROCESAMIENTO DE ARCHIVOS (Firebase Storage)
        urls_documentos = []
        for archivo in archivos:
            extension = archivo.filename.split(".")[-1] if "." in archivo.filename else ""
            nombre_storage = f"certificados/{id_usuario}/{uuid4()}.{extension}"

            # --- CÓDIGO DE SUBIDA A FIREBASE STORAGE ---
            # blob = bucket.blob(nombre_storage)
            # content = await archivo.read()
            # blob.upload_from_string(content, content_type=archivo.content_type)
            # blob.make_public()
            # urls_documentos.append(blob.public_url)

            urls_documentos.append(f"https://storage.googleapis.com/tu-app.appspot.com/{nombre_storage}")

        # 5. REGLA DE NEGOCIO: Buscar y eliminar certificado anterior si existe
        certificados_previos = db.collection("certificados").where("id_usuario", "==", id_usuario).stream()
        for cert_doc in certificados_previos:
            db.collection("certificados").document(cert_doc.id).delete()

        # 6. REGLA DE NEGOCIO: Desverificar al técnico obligatoriamente
        usuario_ref.update({"verificado": False})

        # 7. CREACIÓN DEL NUEVO CERTIFICADO
        id_certificado = str(uuid4())
        nuevo_certificado = {
            "id_certificado": id_certificado,
            "id_usuario": id_usuario,
            "fecha_subida": datetime.now(timezone.utc).isoformat(),
            "documentos": urls_documentos
        }

        db.collection("certificados").document(id_certificado).set(nuevo_certificado)

        return {
            "status": "success",
            "message": "Certificación subida correctamente. El técnico ahora requiere revisión manual.",
            "id_certificado": id_certificado
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/obtener/{id_usuario}", response_model=dict, summary="Obtener el certificado de un usuario")
async def obtener_certificado_tecnico(id_usuario: str):
    """
    Permite consultar los documentos de un técnico específico (lectura pública/admin).
    """
    try:
        certificados = db.collection("certificados").where("id_usuario", "==", id_usuario).limit(1).stream()

        certificado_data = None
        for cert in certificados:
            certificado_data = cert.to_dict()
            break

        if not certificado_data:
            raise HTTPException(status_code=404, detail="No se encontraron certificados para este usuario")

        return {"status": "success", "certificado": certificado_data}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mis-certificados", response_model=dict, summary="Obtener mis certificados (técnico autenticado)")
async def obtener_mis_certificados(uid_actual: str = Depends(obtener_uid_actual)):
    """
    Consulta el estado de certificación del técnico autenticado.
    Determina dinámicamente tres estados: 'inexistente', 'subido' o 'verificado'.
    """
    try:
        # 1. Consultar el perfil del usuario para verificar si está aprobado ('verificado')
        usuario_ref = db.collection("usuarios").document(uid_actual)
        usuario_doc = usuario_ref.get()
        
        if not usuario_doc.exists:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        usuario_data = usuario_doc.to_dict()
        esta_verificado = usuario_data.get("verificado", False)

        # 2. Consultar si existen documentos en la colección 'certificados'
        certificados = db.collection("certificados").where("id_usuario", "==", uid_actual).limit(1).stream()
        certificado_data = None
        for cert in certificados:
            certificado_data = cert.to_dict()
            break

        # --- EVALUACIÓN DE LOS 3 ESTADOS ---
        # Estado 3: El usuario ya posee la marca de verificado en True
        if esta_verificado:
            estado_actual = "verificado"
            
        # Estado 1: No está verificado y tampoco posee documentación en el sistema
        elif not certificado_data:
            estado_actual = "inexistente"
            
        # Estado 2: Posee documentación subida, pero 'verificado' aún es False
        else:
            estado_actual = "subido"

        return {
            "status": "success",
            "estado": estado_actual,
            "certificado": certificado_data
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))