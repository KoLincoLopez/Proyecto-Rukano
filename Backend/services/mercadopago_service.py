import os

import mercadopago
from dotenv import load_dotenv

load_dotenv()


class MercadoPagoService:
    def __init__(self):
        access_token = self._get_required_env("MERCADOPAGO_ACCESS_TOKEN")
        self.frontend_url = self._normalize_frontend_url(
            self._get_required_env("FRONTEND_URL")
        )
        self.webhook_url = f"{self._get_required_env('BACKEND_URL').rstrip('/')}/payments/webhook"

        self.sdk = mercadopago.SDK(access_token)

    def _get_required_env(self, name: str) -> str:
        value = os.getenv(name)
        if value:
            value = value.strip()

        if not value:
            raise RuntimeError(f"No se encontro {name} en el entorno")

        return value

    def _normalize_frontend_url(self, app_base_url: str) -> str:
        app_base_url = app_base_url.rstrip("/")

        payment_suffixes = (
            "/payment/exito.html",
            "/payment/error.html",
            "/payment/pendiente.html",
            "/payment"
        )

        for suffix in payment_suffixes:
            if app_base_url.endswith(suffix):
                return app_base_url[: -len(suffix)]

        return app_base_url

    def create_preference(
        self,
        item_title: str,
        quantity: int,
        unit_price: float,
        external_reference: str | None = None,
        metadata: dict | None = None,
        notification_url: str | None = None
    ):
        app_base_url = self.frontend_url
        webhook_url = notification_url.rstrip("/") if notification_url else self.webhook_url

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

        if external_reference:
            preference_data["external_reference"] = external_reference

        if metadata:
            preference_data["metadata"] = metadata

        preference_data["notification_url"] = webhook_url

        response = self.sdk.preference().create(preference_data)
        status = response.get("status")

        if status and not 200 <= status < 300:
            detail = response.get("response", response)
            raise RuntimeError(f"Mercado Pago rechazo la preferencia: {detail}")

        return response["response"]

    def get_payment(self, payment_id: str):
        response = self.sdk.payment().get(payment_id)
        status = response.get("status")

        if status and not 200 <= status < 300:
            detail = response.get("response", response)
            raise RuntimeError(f"Mercado Pago rechazo la consulta del pago: {detail}")

        return response["response"]
