import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let interaccionesInicializadas = false;
let clientesTecnicoActuales = [];

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "inicioSesion.html";
        return;
    }

    try {
        const usuarioSnap = await getDoc(doc(db, "usuarios", user.uid));

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

        inicializarClientesTecnico();
        cargarClientesTecnico(user.uid);
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

function inicializarClientesTecnico() {
    if (interaccionesInicializadas) return;

    interaccionesInicializadas = true;
    inicializarMenuTecnico();
    inicializarMenuActivo();
    inicializarBuscadorClientes();
}

// ================= MENU TOGGLE =================

function inicializarMenuTecnico() {
    const toggle = document.querySelector(".toggle");
    const nav = document.querySelector(".nav");
    const container = document.querySelector(".container");

    if (toggle && nav) {
        toggle.onclick = function () {
            nav.classList.toggle("active");

            if (container) {
                container.classList.toggle("active");
            }
        };
    }
}

// ================= MENU ACTIVO =================

function inicializarMenuActivo() {
    const lista = document.querySelectorAll(".nav li");

    function activarLink() {
        lista.forEach((item) => {
            item.classList.remove("active");
        });

        this.classList.add("active");
    }

    lista.forEach((item) => {
        item.addEventListener("click", activarLink);
    });
}

// ================= BUSCADOR CLIENTES =================

function inicializarBuscadorClientes() {
    const buscador = document.querySelector(".buscador-clientes input");

    if (buscador) {
        buscador.addEventListener("keyup", () => {
            renderizarClientes(clientesTecnicoActuales, buscador.value);
        });
    }
}

// ================= CLIENTES REALES =================

async function cargarClientesTecnico(uidTecnico) {
    const tabla = document.getElementById("tablaClientesTecnico");

    if (!tabla) return;

    pintarEstadoTabla("Cargando clientes...");

    try {
        const consulta = query(
            collection(db, "citas"),
            where("idTecnico", "==", uidTecnico)
        );
        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            clientesTecnicoActuales = [];
            pintarEstadoTabla("Aún no tienes clientes asociados a citas.");
            return;
        }

        const clientes = await Promise.all(
            resultado.docs.map(async (docCita) => {
                const cita = {
                    id: docCita.id,
                    ...docCita.data()
                };
                const cliente = await obtenerDatosCliente(cita.idCliente);

                return construirFilaCliente(cita, cliente);
            })
        );

        clientesTecnicoActuales = clientes.sort((a, b) => b.fechaOrden - a.fechaOrden);
        renderizarClientes(clientesTecnicoActuales);
    } catch (error) {
        console.log("Error al cargar clientes del tecnico:", error);
        clientesTecnicoActuales = [];
        pintarEstadoTabla("No se pudieron cargar tus clientes.", true);
    }
}

async function obtenerDatosCliente(idCliente) {
    if (!idCliente) return null;

    try {
        const clienteSnap = await getDoc(doc(db, "usuarios", idCliente));
        return clienteSnap.exists() ? clienteSnap.data() : null;
    } catch (error) {
        console.log("Error al cargar cliente:", error);
        return null;
    }
}

function construirFilaCliente(cita, cliente) {
    const nombre = obtenerNombreCliente(cliente);
    const contacto = obtenerContactoCliente(cliente);
    const servicio = obtenerDato(cita.servicio || cita.tituloServicio, "Servicio no especificado");
    const fecha = obtenerDato(cita.dia, obtenerDato(formatearFecha(cita.fecha), "Fecha no definida"));
    const horario = obtenerHorario(cita);
    const estado = obtenerDato(cita.estado, "Estado pendiente");

    return {
        nombre,
        contacto,
        servicio,
        fecha,
        horario,
        estado,
        fechaOrden: obtenerTimestampCita(cita)
    };
}

function renderizarClientes(clientes, filtro = "") {
    const tabla = document.getElementById("tablaClientesTecnico");

    if (!tabla) return;

    const textoFiltro = normalizarTexto(filtro);
    const clientesFiltrados = clientes.filter((cliente) => {
        const textoCliente = normalizarTexto(`${cliente.nombre} ${cliente.contacto} ${cliente.servicio} ${cliente.estado}`);
        return textoCliente.includes(textoFiltro);
    });

    if (clientes.length === 0) {
        pintarEstadoTabla("Aún no tienes clientes asociados a citas.");
        return;
    }

    if (clientesFiltrados.length === 0) {
        pintarEstadoTabla("No se encontraron clientes con ese criterio.");
        return;
    }

    tabla.innerHTML = "";

    clientesFiltrados.forEach((cliente) => {
        const fila = document.createElement("tr");

        fila.innerHTML = `
            <td>
                <strong>${cliente.nombre}</strong>
                <span class="cliente-detalle">${cliente.fecha} · ${cliente.horario}</span>
            </td>
            <td>${cliente.servicio}</td>
            <td>
                <span class="estatus ${obtenerClaseEstado(cliente.estado)}">
                    ${cliente.estado}
                </span>
            </td>
            <td>${cliente.contacto}</td>
        `;

        tabla.appendChild(fila);
    });
}

function pintarEstadoTabla(mensaje, esError = false) {
    const tabla = document.getElementById("tablaClientesTecnico");

    if (!tabla) return;

    tabla.innerHTML = `
        <tr>
            <td colspan="4" class="clientes-estado ${esError ? "error" : ""}">
                ${mensaje}
            </td>
        </tr>
    `;
}

function obtenerNombreCliente(cliente) {
    if (!cliente) return "Cliente no registrado";

    const nombreCompleto = [cliente.nombre, cliente.apellido]
        .filter(Boolean)
        .join(" ")
        .trim();

    return obtenerDato(nombreCompleto || cliente.displayName, "Cliente no registrado");
}

function obtenerContactoCliente(cliente) {
    if (!cliente) return "Contacto no disponible";

    return obtenerDato(cliente.correo || cliente.email || cliente.telefono || cliente.phone, "Contacto no disponible");
}

function obtenerHorario(cita) {
    const horaInicio = obtenerDato(cita.horaInicio, "");
    const horaFin = obtenerDato(cita.horaFin, "");

    if (horaInicio && horaFin) {
        return `${horaInicio} - ${horaFin}`;
    }

    return obtenerDato(cita.hora, "Horario no definido");
}

function formatearFecha(valor) {
    const fecha = convertirFecha(valor);

    if (!fecha) return "";

    return fecha.toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function convertirFecha(valor) {
    if (!valor) return null;

    if (typeof valor.toDate === "function") {
        return valor.toDate();
    }

    if (typeof valor.seconds === "number") {
        return new Date(valor.seconds * 1000);
    }

    if (typeof valor._seconds === "number") {
        return new Date(valor._seconds * 1000);
    }

    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function obtenerTimestampCita(cita = {}) {
    const fechaBase = cita.fecha || cita.dia || cita.fechaCita || cita.fechaReserva;
    const horaBase = cita.hora || cita.horaInicio || "";

    if (fechaBase && /^\d{4}-\d{2}-\d{2}$/.test(String(fechaBase))) {
        const horaNormalizada = /^\d{2}:\d{2}$/.test(String(horaBase)) ? horaBase : "00:00";
        const fechaHora = new Date(`${fechaBase}T${horaNormalizada}:00`);
        if (!Number.isNaN(fechaHora.getTime())) return fechaHora.getTime();
    }

    const candidatos = [cita.createdAt, cita.fechaCreacion, cita.modificadoEn, cita.updatedAt, fechaBase];

    for (const candidato of candidatos) {
        const fecha = convertirFecha(candidato);
        if (fecha) return fecha.getTime();
    }

    return 0;
}

function obtenerClaseEstado(estado) {
    const estadoNormalizado = normalizarTexto(estado);

    if (estadoNormalizado.includes("complet") || estadoNormalizado.includes("resuelt")) {
        return "entregado";
    }

    if (estadoNormalizado.includes("progreso") || estadoNormalizado.includes("revision")) {
        return "en-progreso";
    }

    return "pendiente";
}

function obtenerDato(valor, fallback) {
    if (valor === undefined || valor === null) return fallback;

    const texto = String(valor).trim();
    return texto || fallback;
}

function normalizarTexto(texto) {
    return String(texto || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}
