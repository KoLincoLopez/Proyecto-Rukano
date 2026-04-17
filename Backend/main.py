from fastaspi import FastAPI
# Aqui hay que ir importando los routers de cada microservicio || from routers import router_users, router_products, etc.

app = FastAPI()

# Aquí conectas tus microservicios internos
"""
app.include_router(search.router, prefix="/search")
app.include_router(payments.router, prefix="/payments") 
"""