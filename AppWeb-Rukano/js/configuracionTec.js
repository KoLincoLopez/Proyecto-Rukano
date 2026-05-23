import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
        const usuarioRef = doc(db, "usuarios", user.uid);
        const usuarioSnap = await getDoc(usuarioRef);

        if (!usuarioSnap.exists()) {
            window.location.href = "inicioSesion.html";
            return;
        }

        const datosUsuario = usuarioSnap.data();
        const rol = normalizarRol(datosUsuario.rol);

        if (rol === "cliente") {
            window.location.href = "panelCliente.html";
            return;
        }

        if (rol !== "tecnico") {
            window.location.href = "inicioSesion.html";
            return;
        }

        inicializarConfiguracion(usuarioRef, datosUsuario);
    } catch (error) {
        console.log("Error al validar acceso tecnico:", error);
        window.location.href = "inicioSesion.html";
    }
});

function normalizarRol(rol) {
    return String(rol || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function inicializarConfiguracion(usuarioRef, datosUsuario) {
    estadoConfiguracion = obtenerConfiguracionInicial(datosUsuario);
    aplicarEstadoVisual();
    inicializarNotificaciones();
    inicializarDisponibilidad();
    inicializarIdioma();
    inicializarGuardarPreferencias(usuarioRef);
}

function obtenerConfiguracionInicial(datosUsuario) {
    const configuracion = datosUsuario.configuracion || {};

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

function inicializarGuardarPreferencias(usuarioRef) {
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

            await updateDoc(usuarioRef, {
                configuracion: {
                    notificaciones: estadoConfiguracion.notificaciones,
                    disponibilidad: estadoConfiguracion.disponibilidad,
                    idioma: estadoConfiguracion.idioma,
                    preferencias: estadoConfiguracion.preferencias
                }
            });

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
