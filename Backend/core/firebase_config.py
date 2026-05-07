import os
from pathlib import Path

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def initialize_firebase():
    if firebase_admin._apps:
        return firestore.client()

    cert_path = os.getenv("FIREBASE_KEY_PATH")
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
