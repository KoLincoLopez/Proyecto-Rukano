import firebase_admin
from firebase_admin import credentials, firestore
import os

ruta_credenciales = os.getenv("FIREBASE_CREDENTIALS")

if not ruta_credenciales:
    raise ValueError("FIREBASE_CREDENTIALS no está configurado")

cred = credentials.Certificate(ruta_credenciales)

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()