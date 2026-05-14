from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from firebase_admin import auth as firebase_auth

from core.firebase_config import db
from routers import citas, reports, reviews, search, servicios

app = FastAPI()
 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registramos todos los microservicios de forma ordenada.
app.include_router(search.router, prefix="/search")
app.include_router(reviews.router, prefix="/reviews")
#app.include_router(payments.router)
app.include_router(citas.router, prefix="/citas")
app.include_router(servicios.router, prefix="/servicios")
app.include_router(reports.router, prefix="/reports")

# Permite que el backend desplegado tambien sirva las paginas de retorno de pago.
APP_WEB_DIR = Path(__file__).resolve().parents[1] / "AppWeb-Rukano"
if APP_WEB_DIR.exists():
    app.mount("/app", StaticFiles(directory=str(APP_WEB_DIR), html=True), name="appweb")


@app.get("/")
def inicio():
    return {"mensaje": "Backend funcionando"}


@app.post("/auth/validate")
def validate_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token no proporcionado")

    parts = authorization.split(" ")
    token = parts[1] if len(parts) > 1 else parts[0]
    token_lower = token.lower()

    # Tokens de prueba para pruebas locales sin Firebase Auth.
    if token_lower == "token_cliente":
        return {"valid": True, "role": "cliente", "rol": "cliente"}

    if token_lower == "token_tecnico":
        return {"valid": True, "role": "tecnico", "rol": "tecnico"}

    try:
        decoded_token = firebase_auth.verify_id_token(token)
        uid = decoded_token["uid"]
    except Exception as exc:
        raise HTTPException(
            status_code=403,
            detail="Token invalido o usuario no reconocido",
        ) from exc

    user_doc = db.collection("usuarios").document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=404, detail="Usuario sin datos de perfil")

    role = str(user_doc.to_dict().get("rol", "")).lower()
    if role not in {"cliente", "tecnico"}:
        raise HTTPException(status_code=403, detail="Rol de usuario invalido")

    return {"valid": True, "role": role, "rol": role}


"""
Para ejecutar el servidor localmente y realizar pruebas:
uvicorn main:app --reload

Si da error, entra a la carpeta Backend y revisa la ruta del archivo .env.
La documentacion automatica queda disponible en http://localhost:8000/docs
"""
