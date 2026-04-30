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