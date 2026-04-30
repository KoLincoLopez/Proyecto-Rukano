import mercadopago
import os

class MercadoPagoService:
    def __init__(self):
        access_token = os.getenv("MERCADOPAGO_ACCESS_TOKEN")
        self.sdk = mercadopago.SDK(access_token)

    def create_preference(self, item_title: str, quantity: int, unit_price: float):
        preference_data = {
            "items": [
                {
                    "title": item_title,
                    "quantity": quantity,
                    "unit_price": unit_price
                }
            ],
            "back_urls": {
                "success": "https://rukano-sph.onrender.com/exito.html", 
                "failure": "https://rukano-sph.onrender.com/error.html",
                "pending": "https://rukano-sph.onrender.com/pendiente.html"
            },
            "auto_return": "approved",
            "notification_url": "https://rukano-sph.onrender.com/payments/webhook"
        }
        
        response = self.sdk.preference().create(preference_data)
        return response["response"]