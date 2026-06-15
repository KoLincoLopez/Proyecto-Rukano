from enum import Enum


class EstadoCita(str, Enum):
    PENDIENTE = "pendiente"
    RESERVADA = "reservada"
    PAGO_REALIZADO = "pago_realizado"
    CONCLUIDA = "concluida"
    CANCELADA = "cancelada"
    REEMBOLSO_SOLICITADO = "reembolso_solicitado"
    CADUCADA = "caducada"


class RolUsuario(str, Enum):
    CLIENTE = "cliente"
    TECNICO = "tecnico"
    ADMIN = "admin"
