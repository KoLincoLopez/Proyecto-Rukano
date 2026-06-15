/**
 * certificacion.js
 * Gestiona la pestaña de certificación del perfil técnico.
 * Conecta con los endpoints de /certificados definidos en certificados.py
 */

import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── Configuración ────────────────────────────────────────────────────────────

const API_BASE = window.RukanoApiConfig?.getApiBaseUrl?.() ?? "http://127.0.0.1:8000";
const MAX_ARCHIVOS = 5;
const FORMATOS_PERMITIDOS = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ─── Estado local ─────────────────────────────────────────────────────────────

let archivosSeleccionados = []; // File[]
let tokenActual = null;
let uidActual = null;

// ─── Referencias al DOM ───────────────────────────────────────────────────────

const dropzone       = document.getElementById("certDropzone");
const inputArchivo   = document.getElementById("certInput");
const listaArchivos  = document.getElementById("certArchivosList");
const contador       = document.getElementById("certContador");
const alertaError    = document.getElementById("certAlertaError");
const btnSubir       = document.getElementById("certBtnSubir");
const toast          = document.getElementById("certToast");
const estadoCard     = document.getElementById("certEstadoCard");
const estadoIcono    = document.getElementById("certEstadoIcono");
const estadoLabel    = document.getElementById("certEstadoLabel");
const estadoDesc     = document.getElementById("certEstadoDescripcion");
const estadoMeta     = document.getElementById("certEstadoMeta");
const fechaSubida    = document.getElementById("certFechaSubida");
const docsCount      = document.getElementById("certDocsCount");

// ─── Auth: obtener token ──────────────────────────────────────────────────────

onAuthStateChanged(auth, async (user) => {
    if (!user) return; // miperfilTec.js ya redirige si no hay sesión

    try {
        uidActual = user.uid;
        tokenActual = await user.getIdToken();

        // Cargar el estado de certificación (independiente de si está verificado o no)
        await cargarEstadoCertificado();
    } catch (err) {
        console.error("Error al obtener token o estado de certificación:", err);
    }
});

// ─── Cargar estado actual del certificado ─────────────────────────────────────

async function cargarEstadoCertificado() {
    const divInexistente = document.getElementById("certEstadoInexistente");
    const divSubido      = document.getElementById("certEstadoSubido");
    const divVerificado  = document.getElementById("certEstadoVerificado");
    const txtFecha       = document.getElementById("certFechaSubidaValor");
    const formularioSubida = document.getElementById("certDropzoneForm");

    try {
        // 1. Obtener el estado de verificación real desde Firestore
        const usuarioSnap = await getDoc(doc(db, "usuarios", uidActual));
        const datosUsuario = usuarioSnap.exists() ? usuarioSnap.data() : {};
        const esVerificado = datosUsuario.verificado === true;

        // 2. Obtener los documentos cargados desde el Backend
        const response = await fetch(`${API_BASE}/certificados/mis-certificados`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenActual}`
            }
        });

        if (!response.ok) {
            throw new Error("Error al consultar el servicio de certificados");
        }

        const data = await response.json();
        const estadoActual = data.estado; // ← Usar el estado que calcula el backend

        // Limpieza absoluta de vistas previas
        if (divInexistente) divInexistente.style.display = "none";
        if (divSubido)      divSubido.style.display = "none";
        if (divVerificado)  divVerificado.style.display = "none";

        // 🔥 REGLA DE NEGOCIO: El formulario de subida SIEMPRE debe estar visible
        if (formularioSubida) {
            formularioSubida.style.display = "block"; // O "" si usas estilos CSS nativos (Flexbox/Grid)
        }

        // 2. Usar el estado que viene del backend
        if (estadoActual === "verificado") {
            // --- ESTADO: Técnico Verificado ---
            if (divVerificado) divVerificado.style.display = "block";

        } else if (estadoActual === "subido") {
            // --- ESTADO: Documentación en revisión ---
            if (divSubido) {
                divSubido.style.display = "block";
                if (data.certificado && data.certificado.fecha_subida) {
                    const fecha = new Date(data.certificado.fecha_subida);
                    txtFecha.textContent = fecha.toLocaleString("es-CL", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit"
                    });
                }
            }

        } else if (estadoActual === "inexistente") {
            // --- ESTADO: Sin documentos previos ---
            if (divInexistente) divInexistente.style.display = "block";
            archivosSeleccionados = [];
        }

    } catch (error) {
        console.error("Error crítico al procesar estados de certificación:", error);
        // Fallback de rescate: Si la API cae, jamás bloqueamos el formulario de subida
        if (divInexistente) divInexistente.style.display = "block";
        if (formularioSubida) formularioSubida.style.display = "";
    }
}

function renderizarEstado(certificado, error = false, mensajePersonalizado = "") {
    // Limpiar modificadores anteriores
    estadoCard.classList.remove("cert-estado--verificado", "cert-estado--pendiente", "cert-estado--sin-cert");

    if (error) {
        estadoLabel.textContent = "No se pudo cargar el estado";
        estadoDesc.textContent  = "Hubo un problema al conectar con el servidor.";
        estadoIcono.innerHTML   = '<ion-icon name="alert-circle-outline"></ion-icon>';
        estadoCard.classList.add("cert-estado--sin-cert");
        return;
    }

    if (!certificado) {
        estadoCard.classList.add("cert-estado--sin-cert");
        estadoLabel.textContent = "Sin certificación";
        estadoDesc.textContent  = mensajePersonalizado || "Aún no has subido documentos de certificación.";
        estadoIcono.innerHTML   = '<ion-icon name="document-outline"></ion-icon>';
        estadoMeta.hidden       = true;
        return;
    }

    // Hay un certificado existente — estado depende del campo verificado del usuario
    // (el backend pone verificado=false al subir nuevos docs)
    const docs  = certificado.documentos ?? [];
    const fecha = certificado.fecha_subida
        ? new Date(certificado.fecha_subida).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
          })
        : "—";

    // Usamos el label pendiente por defecto; si el usuario está verificado el campo
    // llegará desde el perfil (gestionado por miperfilTec.js).
    // Aquí solo reflejamos que hay documentos subidos.
    estadoCard.classList.add("cert-estado--pendiente");
    estadoLabel.textContent = "Documentación entregada · En revisión";
    estadoDesc.textContent  = "Tu documentación está siendo revisada por el equipo de RUKANO.";
    estadoIcono.innerHTML   = '<ion-icon name="time-outline"></ion-icon>';

    fechaSubida.textContent = fecha;
    docsCount.textContent   = `${docs.length} ${docs.length === 1 ? "documento" : "documentos"}`;
    estadoMeta.hidden       = false;
}

// ─── Drop zone: eventos ───────────────────────────────────────────────────────

dropzone.addEventListener("click", () => inputArchivo.click());

dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        inputArchivo.click();
    }
});

dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("cert-dropzone--over");
});

dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("cert-dropzone--over");
});

dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("cert-dropzone--over");
    procesarArchivos([...e.dataTransfer.files]);
});

inputArchivo.addEventListener("change", () => {
    procesarArchivos([...inputArchivo.files]);
    // Reset para permitir seleccionar el mismo archivo de nuevo
    inputArchivo.value = "";
});

// ─── Procesamiento de archivos ────────────────────────────────────────────────

function procesarArchivos(nuevos) {
    ocultarAlerta();
    ocultarToast();

    const errores = [];

    for (const archivo of nuevos) {
        if (archivosSeleccionados.length >= MAX_ARCHIVOS) {
            errores.push(`Límite de ${MAX_ARCHIVOS} documentos alcanzado. "${archivo.name}" no fue agregado.`);
            break;
        }

        if (!FORMATOS_PERMITIDOS.includes(archivo.type)) {
            errores.push(`Formato no permitido: "${archivo.name}". Usa PDF, JPG, PNG o Word.`);
            continue;
        }

        // Evitar duplicados por nombre
        const yaTiene = archivosSeleccionados.some((a) => a.name === archivo.name && a.size === archivo.size);
        if (yaTiene) {
            errores.push(`"${archivo.name}" ya está en la lista.`);
            continue;
        }

        archivosSeleccionados.push(archivo);
    }

    if (errores.length) mostrarAlerta(errores.join(" "));
    renderizarListaArchivos();
    actualizarContador();
    actualizarBoton();
}

// ─── Renderizado de lista ─────────────────────────────────────────────────────

function renderizarListaArchivos() {
    listaArchivos.innerHTML = "";

    if (archivosSeleccionados.length === 0) {
        listaArchivos.hidden = true;
        return;
    }

    listaArchivos.hidden = false;

    for (let i = 0; i < archivosSeleccionados.length; i++) {
        const archivo = archivosSeleccionados[i];
        const icono   = iconoPorTipo(archivo.type);
        const tamaño  = formatearTamaño(archivo.size);

        const li = document.createElement("li");
        li.className = "cert-archivo-item";
        li.innerHTML = `
            <ion-icon name="${icono}"></ion-icon>
            <span class="cert-archivo-nombre" title="${archivo.name}">${archivo.name}</span>
            <span class="cert-archivo-size">${tamaño}</span>
            <button class="cert-archivo-remove" type="button" aria-label="Eliminar ${archivo.name}">
                <ion-icon name="close-circle-outline"></ion-icon>
            </button>
        `;

        li.querySelector(".cert-archivo-remove").addEventListener("click", () => {
            archivosSeleccionados.splice(i, 1);
            renderizarListaArchivos();
            actualizarContador();
            actualizarBoton();
        });

        listaArchivos.appendChild(li);
    }
}

function iconoPorTipo(tipo) {
    if (tipo === "application/pdf") return "document-text-outline";
    if (tipo.startsWith("image/")) return "image-outline";
    return "document-outline";
}

function formatearTamaño(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Contador y botón ─────────────────────────────────────────────────────────

function actualizarContador() {
    const n = archivosSeleccionados.length;

    if (n === 0) {
        contador.textContent = "";
        contador.classList.remove("cert-contador--lleno");
        return;
    }

    contador.textContent = `${n} de ${MAX_ARCHIVOS} documentos seleccionados`;
    contador.classList.toggle("cert-contador--lleno", n === MAX_ARCHIVOS);
}

function actualizarBoton() {
    btnSubir.disabled = archivosSeleccionados.length === 0;
}

// ─── Subida al backend ────────────────────────────────────────────────────────

btnSubir.addEventListener("click", async () => {
    if (!tokenActual) {
        mostrarAlerta("No se pudo obtener tu sesión. Recarga la página.");
        return;
    }

    if (archivosSeleccionados.length === 0) return;

    // Confirmación si ya hay certificados (el backend los reemplazará)
    const confirmar = window.confirm(
        "Al subir nuevos documentos, tu certificación anterior será reemplazada y tu estado de verificación quedará pendiente de revisión. ¿Continuar?"
    );
    if (!confirmar) return;

    iniciarCarga();

    try {
        const formData = new FormData();
        for (const archivo of archivosSeleccionados) {
            formData.append("archivos", archivo);
        }

        const res = await fetch(`${API_BASE}/certificados/subir`, {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenActual}` },
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail ?? `Error ${res.status}`);
        }

        // Éxito
        archivosSeleccionados = [];
        renderizarListaArchivos();
        actualizarContador();
        actualizarBoton();
        mostrarToast("Documentación subida correctamente. Tu perfil queda en revisión.", "exito");
        await cargarEstadoCertificado();
    } catch (err) {
        console.error("Error al subir certificados:", err);
        mostrarToast(`No se pudo subir la documentación: ${err.message}`, "error");
    } finally {
        finalizarCarga();
    }
});

// ─── Estados UI durante la carga ─────────────────────────────────────────────

function iniciarCarga() {
    btnSubir.classList.add("cert-btn--cargando");
    btnSubir.disabled = true;
    btnSubir.innerHTML = `<ion-icon name="sync-outline"></ion-icon> Subiendo...`;
    ocultarAlerta();
    ocultarToast();
}

function finalizarCarga() {
    btnSubir.classList.remove("cert-btn--cargando");
    btnSubir.innerHTML = `<ion-icon name="arrow-up-circle-outline"></ion-icon> Subir certificación`;
    actualizarBoton();
}

// ─── Alertas y toast ─────────────────────────────────────────────────────────

function mostrarAlerta(mensaje) {
    alertaError.textContent = mensaje;
    alertaError.hidden = false;
}

function ocultarAlerta() {
    alertaError.hidden = true;
    alertaError.textContent = "";
}

function mostrarToast(mensaje, tipo = "exito") {
    toast.textContent = mensaje;
    toast.className = `cert-toast cert-toast--${tipo}`;
    toast.hidden = false;

    // Auto-ocultar después de 6 segundos
    setTimeout(ocultarToast, 6000);
}

function ocultarToast() {
    toast.hidden = true;
    toast.textContent = "";
    toast.className = "cert-toast";
}