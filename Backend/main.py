from fastapi import FastAPI
from routers import search  # Importa el router de búsqueda
from routers import reviews  # Importa el router de reseñas
from routers import users  # Importa el router de usuarios
from routers import citas  # Importa el router de citas
from routers import reports  # Importa el router de reportes
from routers import servicios  # Importa el router de servicios
from routers import auth  # Importa el router de autenticación
from fastapi.middleware.cors import CORSMiddleware

from fastapi.staticfiles import StaticFiles
from firebase_admin import auth as firebase_auth

try:

    from .core.firebase_config import db
    from .routers import citas, payments, reports, reviews, search, servicios

    from core.firebase_config import db
    from routers import citas,  reports, reviews, search, servicios
except ImportError:
    from core.firebase_config import db
    from routers import citas, payments, reports, reviews, search, servicios
=======
# Aqui hay que ir importando los routers de cada microservicio || from routers import router_users, router_products, etc.

app = FastAPI(
    title="API Rukano",
    description="API de gestión de servicios técnicos con reserva de citas, pagos y reseñas",
    version="1.0.0",
    contact={
        "name": "Rukano Support",
        "url": "https://rukano.com",
    }
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=["*"],  

    allow_origins=["http://127.0.0.1:5500", "http://localhost:5500"], # Cambia el puerto si usas otro

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Registramos todos los microservicios de forma ordenada.
app.include_router(search.router, prefix="/search")
app.include_router(reviews.router, prefix="/reviews")
app.include_router(payments.router, prefix="/payments")
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

# Aquí conectas tus microservicios internos


app.include_router(search.router, prefix="/search")  # Agrega el router de búsqueda con el prefijo "/search"
app.include_router(reviews.router, prefix="/reviews")  # Agrega el router de reseñas con el prefijo "/reviews"
app.include_router(users.router, prefix="/users")  # Agrega el router de usuarios con el prefijo "/users"
app.include_router(citas.router, prefix="/citas")  # Agrega el router de citas con el prefijo "/citas"
app.include_router(reports.router, prefix="/reports")  # Agrega el router de reportes con el prefijo "/reports"
app.include_router(servicios.router, prefix="/servicios")  # Agrega el router de servicios con el prefijo "/servicios"
app.include_router(auth.router)  

@app.get("/")  # Ruta raíz para verificar que el servidor está funcionando
def home():
    return {"message": "La API de Rukano esta funcionando correctamente!"}


"""
para ejecutar el servidor localmente y realizar pruebas ingresa el siguiente comando en la terminal:
uvicorn main:app --reload 
(si da error prueba haciendo cd a la carpeta Backend y luego ejecuta el comando o revisando la ruta del archivo llamado .env)
Esto iniciará el servidor de desarrollo de FastAPI y podrás acceder a la documentación automática en http://localhost:8000/docs
"""