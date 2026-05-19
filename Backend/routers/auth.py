from fastapi import APIRouter, Header, HTTPException
from firebase_admin import auth
from core.firebase_config import db 

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/validate")
async def validate_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No autorizado")
    
    id_token = authorization.split("Bearer ")[1]
    
    try:
        # Verificación del token (Pilar de Seguridad [10, 11])
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        
        # Buscar en Firestore (Integridad de Datos 99.9% [12])
        user_doc = db.collection("usuarios").document(uid).get()
        
        if not user_doc.exists:
            return {"status": "success", "rol": None, "uid": uid}
            
        user_data = user_doc.to_dict()
        return {"status": "success", "rol": user_data.get("rol"), "uid": uid}
        
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido")