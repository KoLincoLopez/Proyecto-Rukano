import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def initialize_firebase():
    """
    Inicializa el SDK de Firebase utilizando las credenciales seguras.
    Esto soporta la arquitectura Serverless del proyecto [6].
    """
    # Verificamos si la app ya fue inicializada para evitar errores de duplicidad
    if not firebase_admin._apps:
        # Obtenemos la ruta o el contenido del JSON desde la variable de entorno
        cert_path = os.path.join(os.path.dirname(__file__), "firebase_key.json")
        
        if cert_path:
            cred = credentials.Certificate(cert_path)
            firebase_admin.initialize_app(cred)
        else:
            raise Exception("Error: No se encontró la variable FIREBASE_KEY_PATH")
    if firebase_admin._apps:
        return firestore.client()

    cert_path = os.getenv("FIREBASE_KEY_PATH") or os.getenv("FIREBASE_CREDENTIALS")
    if cert_path:
        cert_file = Path(cert_path)
    else:
        cert_file = BASE_DIR / "core" / "firebase_key.json"

    if not cert_file.is_absolute():
        cert_file = BASE_DIR / cert_file

    if not cert_file.exists():
        raise FileNotFoundError(f"No se encontro la credencial Firebase: {cert_file}")

    cred = credentials.Certificate(str(cert_file))
    firebase_admin.initialize_app(cred)
    return firestore.client()


db = initialize_firebase()
