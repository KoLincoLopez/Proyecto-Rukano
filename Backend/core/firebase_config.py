import json
import os

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore


load_dotenv()


def initialize_firebase():
    """
    Inicializa Firebase Admin usando credenciales desde variables de entorno.

    Prioridad:
    1. FIREBASE_CREDENTIALS_JSON: JSON completo del service account.
    2. FIREBASE_KEY_PATH: ruta local al archivo JSON de credenciales.
    """
    if firebase_admin._apps:
        return firestore.client()

    credentials_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    key_path = os.getenv("FIREBASE_KEY_PATH")

    if credentials_json:
        try:
            service_account_info = json.loads(credentials_json)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "FIREBASE_CREDENTIALS_JSON contiene JSON invalido. "
                "Verifica que el JSON completo este en una sola variable de entorno."
            ) from exc

        cred = credentials.Certificate(service_account_info)
    elif key_path:
        if not os.path.exists(key_path):
            raise RuntimeError(
                f"FIREBASE_KEY_PATH apunta a un archivo inexistente: {key_path}"
            )

        cred = credentials.Certificate(key_path)
    else:
        raise RuntimeError(
            "No se encontraron credenciales de Firebase. Configura "
            "FIREBASE_CREDENTIALS_JSON en produccion o FIREBASE_KEY_PATH en local."
        )

    firebase_admin.initialize_app(cred)
    return firestore.client()


db = initialize_firebase()
