from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from routers import reviews, search, citas, servicios

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(reviews.router)
app.include_router(search.router)
app.include_router(citas.router, prefix="/citas")
app.include_router(servicios.router, prefix="/servicios")
app.include_router(reviews.router, prefix="/reviews")
app.include_router(servicios.router, prefix="/servicios")

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

    if token_lower == "token_cliente":
        return {"valid": True, "role": "cliente"}

    elif token_lower == "token_tecnico":
        return {"valid": True, "role": "tecnico"}

    else:
        raise HTTPException(
            status_code=403,
            detail="Token inválido o usuario no reconocido"
        )
    
"""
para ejecutar el servidor localmente y realizar pruebas ingresa el siguiente comando en la terminal:
uvicorn main:app --reload 
(si da error prueba haciendo cd a la carpeta Backend y luego ejecuta el comando o revisando la ruta del archivo llamado .env)
Esto iniciará el servidor de desarrollo de FastAPI y podrás acceder a la documentación automática en http://localhost:8000/docs
"""