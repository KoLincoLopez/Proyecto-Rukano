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

const estadoAgenda = {
    hoy: new Date(),
    mesActual: new Date(),
    fechaSeleccionada: "",
    citas: []
};

const MESES_ES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
];

const textareaNota = document.querySelector(".notas-box textarea");
const botonGuardarNota = document.querySelector(".notas-box .boton");
const botonMesAnterior = document.getElementById("btn-prev-mes");
const botonMesSiguiente = document.getElementById("btn-next-mes");
const botonVerTodas = document.getElementById("btnVerTodasCitas");

inicializarNotas();
inicializarControlesCalendario();

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "inicioSesion.html";
        return;
    }

    const rol = await obtenerRolUsuario(user.uid);

    if (rol === "cliente") {
        window.location.href = "panelCliente.html";
        return;
    }

    if (rol !== "tecnico") {
        window.location.href = "inicioSesion.html";
        return;
    }

    estadoAgenda.uidTecnico = user.uid;
    await cargarCitasTecnico(user.uid);
});

function inicializarNotas() {
    if (!textareaNota || !botonGuardarNota) return;

    textareaNota.value = localStorage.getItem("notaAgenda") || "";

    botonGuardarNota.addEventListener("click", () => {
        localStorage.setItem("notaAgenda", textareaNota.value);
        botonGuardarNota.textContent = "Nota guardada";

        window.setTimeout(() => {
            botonGuardarNota.textContent = "Guardar Nota";
        }, 1600);
    });
}

function inicializarControlesCalendario() {
    estadoAgenda.mesActual = new Date(
        estadoAgenda.hoy.getFullYear(),
        estadoAgenda.hoy.getMonth(),
        1
    );

    botonMesAnterior?.addEventListener("click", () => cambiarMes(-1));
    botonMesSiguiente?.addEventListener("click", () => cambiarMes(1));
    botonVerTodas?.addEventListener("click", () => {
        estadoAgenda.fechaSeleccionada = "";
        renderizarCalendario();
        renderizarListaCitas(estadoAgenda.citas);
        actualizarDetalleDia("", []);
    });

    renderizarCalendario();
}

async function obtenerRolUsuario(uid) {
    try {
        const usuarioSnap = await getDoc(doc(db, "usuarios", uid));
        if (!usuarioSnap.exists()) return "";

        return normalizarRol(usuarioSnap.data().rol);
    } catch (error) {
        console.log("Error al validar rol tecnico:", error);
        return "";
    }
}

function normalizarRol(rol) {
    return String(rol || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

async function cargarCitasTecnico(uidTecnico) {
    const listaCitas = document.getElementById("listaCitasTecnico");
    if (listaCitas) listaCitas.innerHTML = "<p>Cargando tus citas...</p>";

    try {
        const consulta = query(
            collection(db, "citas"),
            where("idTecnico", "==", uidTecnico)
        );
        const resultado = await getDocs(consulta);

        const citas = await Promise.all(resultado.docs.map(async (docCita) => {
            const cita = { id: docCita.id, ...docCita.data() };
            return {
                ...cita,
                nombreCliente: await obtenerNombreCliente(cita)
            };
        }));

        estadoAgenda.citas = citas;
        renderizarCalendario();
        renderizarListaCitas(citas);
    } catch (error) {
        console.log("Error al cargar citas del tecnico:", error);
        if (listaCitas) listaCitas.innerHTML = "<p>No se pudieron cargar tus citas.</p>";
    }
}

async function obtenerNombreCliente(cita) {
    const nombreEnCita = obtenerDato(cita.nombreCliente || cita.cliente || cita.clienteNombre, "");
    if (nombreEnCita) return nombreEnCita;
    if (!cita.idCliente) return "Cliente no especificado";

    try {
        const clienteSnap = await getDoc(doc(db, "usuarios", cita.idCliente));
        if (!clienteSnap.exists()) return cita.idCliente;

        const cliente = clienteSnap.data();
        return obtenerDato(`${cliente.nombre || ""} ${cliente.apellido || ""}`, cita.idCliente);
    } catch (error) {
        console.log("Error al cargar cliente de cita:", error);
        return cita.idCliente;
    }
}

function cambiarMes(direccion) {
    estadoAgenda.mesActual = new Date(
        estadoAgenda.mesActual.getFullYear(),
        estadoAgenda.mesActual.getMonth() + direccion,
        1
    );
    estadoAgenda.fechaSeleccionada = "";
    renderizarCalendario();
    actualizarDetalleDia("", []);
}

function renderizarCalendario() {
    const grid = document.getElementById("cal-grid");
    const label = document.getElementById("cal-mes-label");
    if (!grid || !label) return;

    const anio = estadoAgenda.mesActual.getFullYear();
    const mes = estadoAgenda.mesActual.getMonth();
    const totalDiasMes = new Date(anio, mes + 1, 0).getDate();
    const primerDiaMes = new Date(anio, mes, 1);
    const offsetLunes = (primerDiaMes.getDay() + 6) % 7;
    const hoyFormateado = formatearFecha(estadoAgenda.hoy);

    label.textContent = `${MESES_ES[mes]} ${anio}`;
    grid.innerHTML = "";

    for (let i = 0; i < offsetLunes; i += 1) {
        const espacio = document.createElement("div");
        espacio.className = "dia dia-vacio";
        grid.appendChild(espacio);
    }

    for (let dia = 1; dia <= totalDiasMes; dia += 1) {
        const fecha = formatearFecha(new Date(anio, mes, dia));
        const citasDia = filtrarCitasPorFecha(fecha);
        const celda = document.createElement("button");

        celda.type = "button";
        celda.className = "dia";
        celda.dataset.fecha = fecha;
        celda.textContent = String(dia);
        celda.setAttribute("aria-label", `Ver citas del dia ${dia}`);

        if (fecha === hoyFormateado) celda.classList.add("hoy");
        if (citasDia.length > 0) celda.classList.add("servicio");
        if (fecha === estadoAgenda.fechaSeleccionada) celda.classList.add("seleccionado");

        celda.addEventListener("click", () => {
            estadoAgenda.fechaSeleccionada = fecha;
            renderizarCalendario();
            renderizarListaCitas(citasDia, "No tienes citas agendadas para este dia.");
            actualizarDetalleDia(fecha, citasDia);
        });

        grid.appendChild(celda);
    }
}

function filtrarCitasPorFecha(fecha) {
    return estadoAgenda.citas.filter((cita) => obtenerFechaCitaISO(cita) === fecha);
}

function renderizarListaCitas(citas, mensajeVacio = "No tienes citas agendadas.") {
    const listaCitas = document.getElementById("listaCitasTecnico");
    if (!listaCitas) return;

    if (!Array.isArray(citas) || citas.length === 0) {
        listaCitas.innerHTML = `<p>${mensajeVacio}</p>`;
        return;
    }

    listaCitas.innerHTML = "";
    ordenarCitas(citas).forEach((cita) => {
        listaCitas.appendChild(crearCardCita(cita));
    });
}

function actualizarDetalleDia(fecha, citas) {
    const labelFecha = document.getElementById("fecha-seleccionada-label");
    const listaDia = document.getElementById("lista-citas-dia");
    if (!listaDia) return;

    if (!fecha) {
        if (labelFecha) labelFecha.textContent = "Selecciona un dia en el calendario";
        listaDia.innerHTML = '<p class="agenda-dia-vacio">Presiona cualquier dia resaltado para ver tus compromisos.</p>';
        return;
    }

    if (labelFecha) labelFecha.textContent = formatearFechaLarga(fecha);

    if (!Array.isArray(citas) || citas.length === 0) {
        listaDia.innerHTML = '<p class="agenda-dia-vacio">Dia libre. No tienes servicios agendados para esta fecha.</p>';
        return;
    }

    listaDia.innerHTML = "";
    ordenarCitas(citas).forEach((cita) => {
        listaDia.appendChild(crearCardCita(cita));
    });
}

function crearCardCita(cita) {
    const servicio = obtenerDato(cita.tituloServicio || cita.servicio || cita.nombreServicio, "Servicio no especificado");
    const cliente = obtenerDato(cita.nombreCliente || cita.idCliente, "Cliente no especificado");
    const fecha = obtenerFechaCita(cita);
    const horario = obtenerHorarioCita(cita);
    const estado = obtenerDato(cita.estado, "Estado pendiente");
    const precio = obtenerDato(cita.precio, "");
    const card = document.createElement("article");

    card.className = "cita-tecnico-card";
    card.innerHTML = `
        <strong>${escaparHtml(servicio)}</strong>
        <p><span>Cliente</span><b>${escaparHtml(cliente)}</b></p>
        <p><span>Fecha</span><b>${escaparHtml(fecha)}</b></p>
        <p><span>Horario</span><b>${escaparHtml(horario)}</b></p>
        <p><span>Estado</span><b class="estado-badge estado-${escaparHtml(estado)}">${escaparHtml(estado)}</b></p>
        ${precio ? `<p><span>Precio</span><b>$${escaparHtml(precio)}</b></p>` : ""}
        ${cita.estado === "pendiente" ? `
            <div class="cita-acciones">
                <button class="btn-confirmar" type="button">✓ Confirmar</button>
                <button class="btn-cancelar" type="button">✕ Cancelar</button>
            </div>
        ` : ""}
    `;

    // Adjuntar listeners solo si la cita es pendiente
    if (cita.estado === "pendiente") {
        card.querySelector(".btn-confirmar").addEventListener("click", () =>
            manejarCambioCita(cita.id, "reservada", card)
        );
        card.querySelector(".btn-cancelar").addEventListener("click", () =>
            manejarCambioCita(cita.id, "cancelada", card)
        );
    }

    return card;
}

async function manejarCambioCita(idCita, nuevoEstado, card) {
    const btnConfirmar = card.querySelector(".btn-confirmar");
    const btnCancelar = card.querySelector(".btn-cancelar");

    // Deshabilitar botones mientras procesa
    if (btnConfirmar) btnConfirmar.disabled = true;
    if (btnCancelar) btnCancelar.disabled = true;

    try {
        await cambiarEstadoCita(idCita, nuevoEstado);

        // Actualizar estado local en memoria
        const citaLocal = estadoAgenda.citas.find((c) => c.id === idCita);
        if (citaLocal) citaLocal.estado = nuevoEstado;

        // Actualizar badge y remover botones
        const badge = card.querySelector(".estado-badge");
        if (badge) {
            badge.textContent = nuevoEstado;
            badge.className = `estado-badge estado-${nuevoEstado}`;
        }
        const acciones = card.querySelector(".cita-acciones");
        if (acciones) acciones.remove();

    } catch (error) {
        console.error("Error al cambiar estado:", error);
        alert(`No se pudo actualizar la cita: ${error.message}`);
        if (btnConfirmar) btnConfirmar.disabled = false;
        if (btnCancelar) btnCancelar.disabled = false;
    }
}

function ordenarCitas(citas) {
    return [...citas].sort((a, b) => {
        const fechaA = `${obtenerFechaCitaISO(a)} ${obtenerDato(a.horaInicio || a.hora, "")}`;
        const fechaB = `${obtenerFechaCitaISO(b)} ${obtenerDato(b.horaInicio || b.hora, "")}`;
        return fechaA.localeCompare(fechaB);
    });
}

function obtenerFechaCitaISO(cita) {
    const fecha = parsearFecha(cita.fecha || cita.dia);
    return fecha ? formatearFecha(fecha) : "";
}

function obtenerFechaCita(cita) {
    const fecha = parsearFecha(cita.fecha || cita.dia);

    if (fecha) {
        return fecha.toLocaleDateString("es-CL", {
            year: "numeric",
            month: "short",
            day: "2-digit"
        });
    }

    return obtenerDato(cita.fecha || cita.dia, "Fecha no definida");
}

function obtenerHorarioCita(cita) {
    const horaInicio = obtenerDato(cita.horaInicio, "");
    const horaFin = obtenerDato(cita.horaFin, "");

    if (horaInicio && horaFin) return `${horaInicio} - ${horaFin}`;
    return obtenerDato(cita.hora, "Horario no definido");
}

function parsearFecha(valor) {
    if (!valor) return null;
    if (typeof valor.toDate === "function") return valor.toDate();
    if (valor instanceof Date) return valor;
    if (typeof valor.seconds === "number") return new Date(valor.seconds * 1000);

    if (typeof valor === "string") {
        const fechaISO = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (fechaISO) {
            return new Date(Number(fechaISO[1]), Number(fechaISO[2]) - 1, Number(fechaISO[3]));
        }
    }

    const fechaParseada = new Date(valor);
    return Number.isNaN(fechaParseada.getTime()) ? null : fechaParseada;
}

function formatearFecha(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

function formatearFechaLarga(fechaISO) {
    const [anio, mes, dia] = fechaISO.split("-");
    return `${dia} de ${MESES_ES[Number(mes) - 1]} de ${anio}`;
}

function obtenerDato(valor, fallback) {
    const texto = String(valor ?? "").trim();
    return texto || fallback;
}

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function cambiarEstadoCita(idCita, nuevoEstado) {
    const BASE_URL = "http://localhost:8000"; // ← tu URL real de FastAPI

    let res;
    try {
        res = await fetch(`${BASE_URL}/citas/${idCita}/estado`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idTecnico: estadoAgenda.uidTecnico,
                nuevo_estado: nuevoEstado
            })
        });
    } catch (networkError) {
        throw new Error(`Error de red: no se pudo conectar con el servidor (${networkError.message})`);
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Error ${res.status} al actualizar la cita`);
    }

    return res.json();
}