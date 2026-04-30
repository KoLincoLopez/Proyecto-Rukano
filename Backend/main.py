from fastapi import FastAPI
from routers import search , reviews, payments # Importa el router de reseñas
# Aqui hay que ir importando los routers de cada microservicio || from routers import router_users, router_products, etc.
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Aquí conectas tus microservicios internos

app.add_middleware(
    CORSMiddleware,
    # El "*" permite que cualquier frontend se conecte (ideal para desarrollo).
    # En producción, puedes cambiar el "*" por ["http://127.0.0.1:5501", "https://tu-dominio-final.com"]
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"], # Permite todos los métodos (POST, GET, OPTIONS, etc.)
    allow_headers=["*"], # Permite todos los headers
)

app.include_router(search.router, prefix="/search")  # Agrega el router de búsqueda con el prefijo "/search"
app.include_router(reviews.router, prefix="/reviews") 
app.include_router(payments.router) # Agrega el router de reseñas con el prefijo "/reviews"

app.get("/")  # Ruta raíz para verificar que el servidor está funcionando
def home():
    return {"message": "La API de Rukano esta funcionando correctamente!"}


"""
para ejecutar el servidor localmente y realizar pruebas ingresa el siguiente comando en la terminal:
uvicorn main:app --reload 
(si da error prueba haciendo cd a la carpeta Backend y luego ejecuta el comando o revisando la ruta del archivo llamado .env)
Esto iniciará el servidor de desarrollo de FastAPI y podrás acceder a la documentación automática en http://localhost:8000/docs
"""
