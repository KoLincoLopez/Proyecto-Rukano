import os

import mercadopago
from dotenv import load_dotenv

load_dotenv()


class MercadoPagoService:
    def __init__(self):
        access_token = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
        if not access_token:
            raise RuntimeError("No se encontro MERCADOPAGO_ACCESS_TOKEN en el entorno")

        self.sdk = mercadopago.SDK(access_token)

    def create_preference(self, item_title: str, quantity: int, unit_price: float):
        app_base_url = os.getenv("APP_BASE_URL", "https://rukano-sph.onrender.com").rstrip("/")
        webhook_url = os.getenv("MERCADOPAGO_WEBHOOK_URL")

        preference_data = {
            "items": [
                {
                    "title": item_title,
                    "quantity": quantity,
                    "unit_price": unit_price
                }
            ],
            "back_urls": {
                "success": f"{app_base_url}/payment/exito.html",
                "failure": f"{app_base_url}/payment/error.html",
                "pending": f"{app_base_url}/payment/pendiente.html"
            },
            "auto_return": "approved"
        }

        if webhook_url:
            preference_data["notification_url"] = webhook_url

        response = self.sdk.preference().create(preference_data)
        status = response.get("status")

        if status and not 200 <= status < 300:
            detail = response.get("response", response)
            raise RuntimeError(f"Mercado Pago rechazo la preferencia: {detail}")

        return response["response"]
