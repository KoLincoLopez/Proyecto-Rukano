import { auth } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { apiFetch } from "./apiFetch.js";

const API_URL = window.RukanoApiConfig.getApiBaseUrl();

let estadoConfiguracion = {
    notificaciones: true,
    disponibilidad: "disponible",
    idioma: "es",
    preferencias: ""
};

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "inicioSesion.html";
        return;
    }

    try {
        const response = await apiFetch(`${API_URL}/users/usuario/configuracion`);
        if (response.status === 403) {
            window.location.href = "panelCliente.html";
            return;
        }
        const resultado = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(resultado.detail || "No se pudo cargar la configuracion");
        }

        inicializarConfiguracion(resultado.configuracion || {});
    } catch (error) {
        console.log("Error al validar acceso tecnico:", error);
        window.location.href = "inicioSesion.html";
    }
});

function inicializarConfiguracion(configuracion) {
    estadoConfiguracion = obtenerConfiguracionInicial(configuracion);
    aplicarEstadoVisual();
    inicializarNotificaciones();
    inicializarDisponibilidad();
    inicializarIdioma();
    inicializarGuardarPreferencias();
}

function obtenerConfiguracionInicial(configuracion) {
    return {
        notificaciones: obtenerBooleano(configuracion.notificaciones, true),
        disponibilidad: normalizarDisponibilidad(configuracion.disponibilidad),
        idioma: normalizarIdioma(configuracion.idioma),
        preferencias: obtenerTexto(configuracion.preferencias)
    };
}

function obtenerBooleano(valor, fallback) {
    if (typeof valor === "boolean") return valor;

    const texto = String(valor ?? "").trim().toLowerCase();
    if (["true", "activadas", "activado", "si", "sí"].includes(texto)) return true;
    if (["false", "desactivadas", "desactivado", "no"].includes(texto)) return false;

    return fallback;
}

function normalizarDisponibilidad(valor) {
    const texto = String(valor ?? "").trim().toLowerCase();
    return texto === "ocupado" ? "ocupado" : "disponible";
}

function normalizarIdioma(valor) {
    const texto = String(valor ?? "").trim().toLowerCase();
    return texto === "english" || texto === "en" ? "en" : "es";
}

function obtenerTexto(valor) {
    return String(valor ?? "").trim();
}

function inicializarNotificaciones() {
    const boton = document.getElementById("btnNotificaciones");
    if (!boton) return;

    boton.addEventListener("click", () => {
        estadoConfiguracion.notificaciones = !estadoConfiguracion.notificaciones;
        aplicarEstadoVisual();
        limpiarMensajeEstado();
    });
}

function inicializarDisponibilidad() {
    const boton = document.getElementById("btnDisponibilidad");
    if (!boton) return;

    boton.addEventListener("click", () => {
        estadoConfiguracion.disponibilidad =
            estadoConfiguracion.disponibilidad === "disponible" ? "ocupado" : "disponible";
        aplicarEstadoVisual();
        limpiarMensajeEstado();
    });
}

function inicializarIdioma() {
    const boton = document.getElementById("btnIdioma");
    if (!boton) return;

    boton.addEventListener("click", () => {
        estadoConfiguracion.idioma = estadoConfiguracion.idioma === "es" ? "en" : "es";
        aplicarEstadoVisual();
        limpiarMensajeEstado();
    });
}

function inicializarGuardarPreferencias() {
    const botonGuardar = document.getElementById("btnGuardarPreferencias");
    const preferencias = document.getElementById("preferenciasTexto");

    if (!botonGuardar || !preferencias) return;

    preferencias.value = estadoConfiguracion.preferencias;
    botonGuardar.disabled = false;

    preferencias.addEventListener("input", () => {
        estadoConfiguracion.preferencias = preferencias.value.trim();
        limpiarMensajeEstado();
    });

    botonGuardar.addEventListener("click", async () => {
        try {
            botonGuardar.disabled = true;
            mostrarMensajeEstado("Guardando configuración...", "info");

            estadoConfiguracion.preferencias = preferencias.value.trim();

            const response = await apiFetch(`${API_URL}/users/usuario/configuracion`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    notificaciones: estadoConfiguracion.notificaciones,
                    disponibilidad: estadoConfiguracion.disponibilidad,
                    idioma: estadoConfiguracion.idioma,
                    preferencias: estadoConfiguracion.preferencias
                })
            });
            const resultado = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(resultado.detail || "No se pudo guardar la configuracion");
            }

            mostrarMensajeEstado("Configuración guardada correctamente.", "exito");
        } catch (error) {
            console.log("Error al guardar preferencias:", error);
            mostrarMensajeEstado("No se pudo guardar la configuración.", "error");
        } finally {
            botonGuardar.disabled = false;
        }
    });
}

function aplicarEstadoVisual() {
    const btnNotificaciones = document.getElementById("btnNotificaciones");
    const btnDisponibilidad = document.getElementById("btnDisponibilidad");
    const btnIdioma = document.getElementById("btnIdioma");

    actualizarBotonEstado(
        btnNotificaciones,
        estadoConfiguracion.notificaciones ? "Activadas" : "Desactivadas",
        estadoConfiguracion.notificaciones
    );

    actualizarBotonEstado(
        btnDisponibilidad,
        obtenerTextoDisponibilidad(estadoConfiguracion.disponibilidad),
        estadoConfiguracion.disponibilidad === "disponible"
    );

    actualizarBotonEstado(btnIdioma, obtenerTextoIdioma(estadoConfiguracion.idioma), true);
}

function actualizarBotonEstado(boton, texto, activo) {
    if (!boton) return;

    boton.textContent = texto;
    boton.disabled = false;
    boton.classList.toggle("boton--inactivo", !activo);
}

function obtenerTextoDisponibilidad(disponibilidad) {
    return disponibilidad === "ocupado" ? "Ocupado" : "Disponible";
}

function obtenerTextoIdioma(idioma) {
    return idioma === "en" ? "English" : "Español";
}

function mostrarMensajeEstado(mensaje, tipo) {
    const estado = document.getElementById("configuracionEstado");
    if (!estado) return;

    estado.textContent = mensaje;
    estado.className = `configuracion-estado configuracion-estado--${tipo}`;
}

function limpiarMensajeEstado() {
    const estado = document.getElementById("configuracionEstado");
    if (!estado) return;

    estado.textContent = "";
    estado.className = "configuracion-estado";
}
