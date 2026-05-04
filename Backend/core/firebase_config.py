import firebase_admin
from firebase_admin import credentials, firestore
import os
import json

firebase_json = os.getenv("FIREBASE_CREDENTIALS")

if not firebase_json:
    raise ValueError("FIREBASE_CREDENTIALS no está configurado")

firebase_dict = json.loads(firebase_json)

cred = credentials.Certificate(firebase_dict)

if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)

db = firestore.client()