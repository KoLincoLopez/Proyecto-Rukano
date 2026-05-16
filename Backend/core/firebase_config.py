import json
import os

import firebase_admin
from firebase_admin import credentials, firestore


def initialize_firebase():
    """
    Initialize Firebase Admin from the FIREBASE_CREDENTIALS environment variable.

    FIREBASE_CREDENTIALS must contain the complete service account JSON.
    """
    if firebase_admin._apps:
        return firestore.client()

    raw_credentials = os.getenv("FIREBASE_CREDENTIALS")
    if not raw_credentials:
        raise RuntimeError(
            "FIREBASE_CREDENTIALS no esta configurada. "
            "En Render agrega una variable de entorno con el JSON completo "
            "del service account de Firebase."
        )

    try:
        service_account_info = json.loads(raw_credentials)
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "FIREBASE_CREDENTIALS contiene JSON invalido. "
            "Verifica que pegaste el JSON completo, con comillas dobles y sin "
            "caracteres extra antes o despues."
        ) from exc

    try:
        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred)
    except Exception as exc:
        raise RuntimeError(
            "No se pudo inicializar Firebase Admin con FIREBASE_CREDENTIALS. "
            "Verifica que el JSON corresponda a un service account valido."
        ) from exc

    return firestore.client()


db = initialize_firebase()