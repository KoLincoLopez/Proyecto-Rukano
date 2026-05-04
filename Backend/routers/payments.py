from fastapi import APIRouter, Request, BackgroundTasks, HTTPException
from services.mercadopago_service import MercadoPagoService
from core.firebase_config import db
from pydantic import BaseModel

mp_service = MercadoPagoService()

router = APIRouter( prefix="/payments", tags=["Payments"])

class PreferenceRequest(BaseModel):
    title: str
    quantity: int
    price: float

@router.post("/create_preference")
async def create_payment_preference(data: PreferenceRequest):

    preference = mp_service.create_preference(
        data.title,
        data.quantity,
        data.price
    )

    if "id" not in preference:
        raise HTTPException(status_code=400, detail=preference)

    return {"preference_id": preference["id"]}
@router.post("/webhook")
async def mercadopago_webhook(request: Request):
    data = await request.json()
    
    if data.get("type") == "payment":
        payment_id = data.get("data", {}).get("id")
        print(f"Notificación de pago recibida: {payment_id}")

    return {"status": "success"}