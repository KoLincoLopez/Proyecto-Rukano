from fastapi import APIRouter, Request, BackgroundTasks
from services.mercadopago_service import MercadoPagoService
from core.firebase_config import db

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

mp_service = MercadoPagoService()

@router.post("/create_preference")
async def create_payment_preference(title: str, quantity: int, price: float):
    preference = mp_service.create_preference(title, quantity, price)
    return {"preference_id": preference["id"]}

@router.post("/webhook")
async def mercadopago_webhook(request: Request):
    data = await request.json()
    
    if data.get("type") == "payment":
        payment_id = data.get("data", {}).get("id")
        print(f"Notificación de pago recibida: {payment_id}")

    return {"status": "success"}