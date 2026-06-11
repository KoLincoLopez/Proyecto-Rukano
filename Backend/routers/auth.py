from fastapi import APIRouter, Header, HTTPException
from firebase_admin import auth

from core.firebase_config import db


router = APIRouter(prefix="/auth", tags=["auth"])


def obtener_uid_desde_authorization(
    authorization: str | None,
    requerido: bool = False
) -> str | None:
    if not authorization:
        if requerido:
            raise HTTPException(status_code=401, detail="No autorizado")
        return None

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Formato de autorizacion invalido")

    id_token = authorization.removeprefix("Bearer ").strip()
    if not id_token:
        raise HTTPException(status_code=401, detail="Token invalido")

    try:
        decoded_token = auth.verify_id_token(id_token)
        return decoded_token["uid"]
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token invalido") from exc


def obtener_usuario_autenticado(
    authorization: str | None,
    rol_requerido: str | None = None
) -> tuple[str, dict]:
    uid = obtener_uid_desde_authorization(authorization, requerido=True)
    user_doc = db.collection("usuarios").document(uid).get()

    if not user_doc.exists:
        raise HTTPException(status_code=403, detail="El usuario autenticado no esta registrado")

    user_data = user_doc.to_dict()
    rol_actual = str(user_data.get("rol") or "").strip().lower()
    rol_actual = rol_actual.replace("é", "e")

    if rol_requerido and rol_actual != rol_requerido:
        raise HTTPException(status_code=403, detail="El usuario no tiene el rol requerido")

    return uid, user_data


@router.post("/validate")
async def validate_token(authorization: str = Header(None)):
    uid, user_data = obtener_usuario_autenticado(authorization)
    return {"status": "success", "rol": user_data.get("rol"), "uid": uid}
