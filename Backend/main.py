from fastapi import FastAPI, Header
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

# Routers
app.include_router(reviews.router)
app.include_router(search.router)
app.include_router(citas.router, prefix="/citas")
app.include_router(servicios.router, prefix="/servicios")

@app.get("/")
def inicio():
    return {"mensaje": "Backend funcionando"}

@app.post("/auth/validate")
def validate_user(authorization: str = Header(None)):
    return {"rol": "TECNICO"}