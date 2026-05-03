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
                # Agregamos la carpeta /payment/ a la ruta
                "success": "https://rukano-sph.onrender.com/payment/exito.html",
                "failure": "https://rukano-sph.onrender.com/payment/error.html",
                "pending": "https://rukano-sph.onrender.com/payment/pendiente.html"
            },
            "auto_return": "approved"
        }
        
        response = self.sdk.preference().create(preference_data)
        return response["response"]