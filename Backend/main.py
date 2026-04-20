from fastapi import FastAPI
from routers import search  # Importa el router de búsqueda
# Aqui hay que ir importando los routers de cada microservicio || from routers import router_users, router_products, etc.

app = FastAPI()

# Aquí conectas tus microservicios internos

app.include_router(search.router, prefix="/search")  # Agrega el router de búsqueda con el prefijo "/search"

app.get("/")  # Ruta raíz para verificar que el servidor está funcionando
def home():
    return {"message": "La API de Rukano esta funcionando correctamente!"}


"""
para ejecutar el servidor localmente y realizar pruebas ingresa el siguiente comando en la terminal:
uvicorn main:app --reload 
(si da error prueba haciendo cd a la carpeta Backend y luego ejecuta el comando o revisando la ruta del archivo llamado .env)
Esto iniciará el servidor de desarrollo de FastAPI y podrás acceder a la documentación automática en http://localhost:8000/docs
"""
