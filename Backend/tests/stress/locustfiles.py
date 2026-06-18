import os
import random
from datetime import datetime
from locust import HttpUser, task, between
from faker import Faker
from dotenv import load_dotenv

"""
Instrucciones para ejecutarlo en localhost:

    1. Levanta tu backend: uvicorn main:app --reload
    2. Abre esta carpeta: Backend/tests/stress/
    3. Ejecuta: locust -f locustfiles.py --host http://127.0.0.1:8000
    4. Abre el panel en http://localhost:8089

Variables opcionales en .env:
    BASE_URL
    AUTH_TOKEN
    KNOWN_TECNICO_ID
    KNOWN_CLIENTE_ID
    KNOWN_USUARIO_ID
    KNOWN_SERVICE_ID
    KNOWN_CITA_ID
    KNOWN_CITA_REALIZADA_ID
    KNOWN_REPORTE_ID
    KNOWN_RESEÑA_ID
    ENABLE_PAYMENTS_TESTS=True
"""

load_dotenv()
BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8000")
AUTH_TOKEN = os.getenv("AUTH_TOKEN", "token_cliente")
KNOWN_TECNICO_ID = os.getenv("KNOWN_TECNICO_ID", "2")
KNOWN_CLIENTE_ID = os.getenv("KNOWN_CLIENTE_ID", "1")
KNOWN_USUARIO_ID = os.getenv("KNOWN_USUARIO_ID", "2")
KNOWN_SERVICE_ID = os.getenv("KNOWN_SERVICE_ID", "1e32f203-0198-4025-8a95-29a13306f23e")
KNOWN_CITA_ID = os.getenv("KNOWN_CITA_ID", "00aae3e6-829e-44dd-9733-4561cc287d81")
KNOWN_CITA_REALIZADA_ID = os.getenv("KNOWN_CITA_REALIZADA_ID", "0043a218-468a-4fe3-907a-077590c2b69a")
KNOWN_REPORTE_ID = os.getenv("KNOWN_REPORTE_ID", "")
KNOWN_RESEÑA_ID = os.getenv("KNOWN_RESEÑA_ID", "")
ENABLE_PAYMENTS_TESTS = os.getenv("ENABLE_PAYMENTS_TESTS", "False").lower() in ("1", "true", "yes")

fake = Faker()


def log_response(response):
    if 200 <= response.status_code < 300:
        response.success()
    else:
        response.failure(f"{response.request.method} {response.request.url} -> {response.status_code}: {response.text}")


def service_payload():
    return {
        "idTecnico": KNOWN_TECNICO_ID,
        "nombre": fake.sentence(nb_words=3),
        "categoria": random.choice(["plomeria", "electricidad", "cocina", "jardineria"]),
        "comuna": random.choice(["Providencia", "Las Condes", "Ñuñoa", "Puente Alto"]),
        "descripcion": fake.text(max_nb_chars=120),
        "precio": round(random.uniform(15000, 120000), 2),
        "tiempoEstimado": f"{random.randint(1, 4)} horas",
        "que_incluye": ["mano de obra", "materiales básicos"],
        "que_no_incluye": ["materiales especiales", "transporte"],
        "esquema_formulario": [
            {"id_pregunta": "1", "pregunta": "¿Describe el problema?", "tipo": "text", "obligatorio": True},
            {"id_pregunta": "2", "pregunta": "¿Necesitas servicio urgente?", "tipo": "boolean", "obligatorio": False}
        ]
    }


def reserva_payload(service_id):
    return {
        "idServicio": service_id,
        "idCliente": KNOWN_CLIENTE_ID,
        "fecha": datetime.now().strftime("%Y-%m-%d"),
        "hora": f"{random.randint(8, 20)}:{random.choice(['00', '30'])}",
        "respuestas_formulario": {
            "1": "El calefón no enciende",
            "2": "No"
        }
    }


class RukanoStressTest(HttpUser):
    wait_time = between(1, 3)
    host = BASE_URL

    def on_start(self):
        self.service_ids = []
        self.cita_ids = []
        self.reporte_ids = []
        self.resena_ids = []

    @task(2)
    def root_health(self):
        with self.client.get("/", catch_response=True) as response:
            log_response(response)

    @task(4)
    def buscar_por_categoria(self):
        comuna = "Puente Alto"
        categoria = "cocina"
        with self.client.get(f"/search/categoria_solicitada/{comuna}/{categoria}", catch_response=True) as response:
            log_response(response)

    @task(4)
    def buscar_general_keywords(self):
        texto = "urgente"
        with self.client.get(f"/search/busqueda_general/Providencia/{texto}", catch_response=True) as response:
            log_response(response)

    @task(1)
    def auth_validate(self):
        headers = {"Authorization": f"Bearer {AUTH_TOKEN}"}
        with self.client.post("/auth/validate", headers=headers, catch_response=True) as response:
            log_response(response)

    @task(2)
    def crear_servicio(self):
        payload = service_payload()
        with self.client.post("/servicios/crear", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                service_id = data.get("id")
                if service_id:
                    self.service_ids.append(service_id)
            log_response(response)

    @task(2)
    def editar_servicio(self):
        servicio_id = self.service_ids[-1] if self.service_ids else KNOWN_SERVICE_ID
        updates = {"precio": round(random.uniform(18000, 90000), 2), "descripcion": fake.text(max_nb_chars=80)}
        with self.client.patch(f"/servicios/editar/{servicio_id}", json=updates, catch_response=True) as response:
            log_response(response)

    # @task(1)
    # def eliminar_servicio(self):
    #     servicio_id = self.service_ids.pop() if self.service_ids else KNOWN_SERVICE_ID
    #     with self.client.delete(f"/servicios/{servicio_id}", catch_response=True) as response:
    #         log_response(response)

    @task(2)
    def reservar_cita(self):
        service_id = self.service_ids[-1] if self.service_ids else KNOWN_SERVICE_ID
        payload = reserva_payload(service_id)
        with self.client.post("/citas/reservar", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                cita_id = data.get("idCita")
                if cita_id:
                    self.cita_ids.append(cita_id)
            log_response(response)

    @task(1)
    def obtener_agenda(self):
        tecnico_id = KNOWN_TECNICO_ID
        with self.client.get(f"/citas/agenda/{tecnico_id}", catch_response=True) as response:
            log_response(response)

    @task(1)
    def reportar_servicio_cita(self):
        payload = {
            "idCita": KNOWN_CITA_ID or (self.cita_ids[-1] if self.cita_ids else "cita-no-existente"),
            "idServicio": KNOWN_SERVICE_ID or (self.service_ids[-1] if self.service_ids else "servicio-no-existente"),
            "motivo": "Servicio incompleto",
            "cuerpo": fake.paragraph(nb_sentences=3),
            "imagen": "https://example.com/foto.jpg",
            "solicitaReembolso": random.choice([True, False])
        }
        with self.client.post("/reports/reportar_servicio_cita", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                reporte_id = data.get("idReporte")
                if reporte_id:
                    self.reporte_ids.append(reporte_id)
            log_response(response)

    @task(1)
    def reportar_usuario(self):
        payload = {
            "idUsuario": KNOWN_USUARIO_ID,
            "motivo": "Usuario no responde",
            "cuerpo": fake.paragraph(nb_sentences=3),
            "imagen": "https://example.com/foto-report.jpg"
        }
        with self.client.post("/reports/reportar_usuario", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                reporte_id = data.get("idReporte")
                if reporte_id:
                    self.reporte_ids.append(reporte_id)
            log_response(response)

    @task(1)
    def resolver_reporte(self):
        reporte_id = self.reporte_ids[-1] if self.reporte_ids else KNOWN_REPORTE_ID or "reporte-no-existente"
        payload = {
            "comentario_moderador": "Revisión completada, caso resuelto.",
            "accion_tomada": "Pago liberado"
        }
        with self.client.patch(f"/reports/resolver_reporte/{reporte_id}", json=payload, catch_response=True) as response:
            log_response(response)

    @task(1)
    def crear_resena(self):
        payload = {
            "idCitas": KNOWN_CITA_REALIZADA_ID or "cita-realizada-no-existente",
            "puntuacion": random.randint(1, 5),
            "comentario": fake.sentence(nb_words=12),
            "fotoUrl": "https://example.com/resena.jpg"
        }
        with self.client.post("/reviews/crear_resena", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                resena_id = data.get("idResena")
                if resena_id:
                    self.resena_ids.append(resena_id)
            log_response(response)

    @task(1)
    def actualizar_resena(self):
        resena_id = self.resena_ids[-1] if self.resena_ids else KNOWN_RESEÑA_ID
        if not resena_id:
            return

        payload = {"puntuacion": random.randint(1, 5), "comentario": fake.sentence(nb_words=8)}
        with self.client.put(f"/reviews/actualizar_resena/{resena_id}", json=payload, catch_response=True) as response:
            log_response(response)

    # @task(1)
    # def eliminar_resena(self):
    #     resena_id = self.resena_ids.pop() if self.resena_ids else KNOWN_RESEÑA_ID or "resena-no-existente"
    #     with self.client.delete(f"/eliminar_resena/{resena_id}", catch_response=True) as response:
    #         log_response(response)

    @task(2)
    def resenas_tecnico(self):
        tecnico_id = KNOWN_TECNICO_ID
        with self.client.get(f"/reviews/resenas_tecnico/{tecnico_id}", catch_response=True) as response:
            log_response(response)

    @task(1)
    def payments_create_preference(self):
        if not ENABLE_PAYMENTS_TESTS:
            return

        cita_id = KNOWN_CITA_ID or (self.cita_ids[-1] if self.cita_ids else "")
        if not cita_id:
            print("Skipping payments_create_preference: KNOWN_CITA_ID is required for the official payment endpoint")
            return

        with self.client.post(f"/payments/create_preference/{cita_id}", catch_response=True) as response:
            log_response(response)

    @task(1)
    def payments_webhook(self):
        if not ENABLE_PAYMENTS_TESTS:
            return
        payload = {"type": "payment", "data": {"id": str(random.randint(1000, 9999))}}
        with self.client.post("/payments/webhook", json=payload, catch_response=True) as response:
            log_response(response)
