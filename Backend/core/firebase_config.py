import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

# Cargar variables de entorno del archivo .env
load_dotenv()

def initialize_firebase():
    """
    Inicializa el SDK de Firebase utilizando las credenciales seguras.
    Esto soporta la arquitectura Serverless del proyecto [6].
    """
    # Verificamos si la app ya fue inicializada para evitar errores de duplicidad
    if not firebase_admin._apps:
        # Obtenemos la ruta o el contenido del JSON desde la variable de entorno
        cert_path = os.getenv("FIREBASE_KEY_PATH")
        
        if cert_path:
            cred = credentials.Certificate(cert_path)
            firebase_admin.initialize_app(cred)
        else:
            raise Exception("Error: No se encontró la variable FIREBASE_KEY_PATH")

    return firestore.client()

# Exportamos el cliente de la base de datos para usarlo en los routers (MVC) [8]
db = initialize_firebase()