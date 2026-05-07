from fastapi import APIRouter, HTTPException, Request

try:
    from ..schemas.payment_schemas import PaymentPreferenceRequest
    from ..services.mercadopago_service import MercadoPagoService
except ImportError:
    from schemas.payment_schemas import PaymentPreferenceRequest
    from services.mercadopago_service import MercadoPagoService

router = APIRouter(
    prefix="/payments",
    tags=["Payments"]
)

mp_service = MercadoPagoService()


@router.post("/create_preference")
async def create_payment_preference(payment: PaymentPreferenceRequest):
    try:
        preference = mp_service.create_preference(
            payment.title,
            payment.quantity,
            payment.price
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    print("=========================================")
    print("RESPUESTA DE MERCADO PAGO:", preference)
    print("=========================================")

    if "id" not in preference:
        raise HTTPException(status_code=400, detail=preference)

    return {
        "preference_id": preference["id"],
        "init_point": preference.get("init_point"),
        "sandbox_init_point": preference.get("sandbox_init_point")
    }


@router.post("/webhook")
async def mercadopago_webhook(request: Request):
    data = await request.json()

    if data.get("type") == "payment":
        payment_id = data.get("data", {}).get("id")
        print(f"Notificacion de pago recibida: {payment_id}")

    return {"status": "success"}
