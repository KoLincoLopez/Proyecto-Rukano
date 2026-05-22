import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ================= MENU TOGGLE =================
const toggle = document.querySelector(".toggle");
const nav = document.querySelector(".nav");
const container = document.querySelector(".container");

if (toggle && nav && container) {
    toggle.addEventListener("click", () => {
        nav.classList.toggle("active");
        container.classList.toggle("active");
    });
}

// ================= MENU ACTIVO =================
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

// ================= NOTAS =================
const textarea = document.querySelector(".notas-box textarea");
const botonGuardar = document.querySelector(".notas-box .boton");
const fechaCalendario = new Date();
const mesCalendario = fechaCalendario.getMonth();
const anioCalendario = fechaCalendario.getFullYear();
let citasTecnicoActuales = [];

renderizarCalendarioMensual(fechaCalendario);
inicializarFiltroCitas();

window.addEventListener("load", () => {
    if (!textarea) return;

    const notaGuardada = localStorage.getItem("notaAgenda");
    if (notaGuardada) {
        textarea.value = notaGuardada;
    }
});

if (botonGuardar && textarea) {
    botonGuardar.addEventListener("click", () => {
        const texto = textarea.value;

        localStorage.setItem("notaAgenda", texto);

        alert("Nota guardada correctamente");
    });
}

// ================= SESION Y CITAS REALES =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "inicioSesion.html";
        return;
    }

    const rol = await obtenerRolUsuario(user.uid);

    if (!rol) {
        window.location.href = "inicioSesion.html";
        return;
    }

    if (rol === "cliente") {
        window.location.href = "panelCliente.html";
        return;
    }

    if (rol !== "tecnico") {
        window.location.href = "inicioSesion.html";
        return;
    }

    cargarCitasTecnico(user.uid);
});

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
    if (!listaCitas) return;

    listaCitas.innerHTML = "<p>Cargando tus citas...</p>";
    limpiarDiasConCitas();

    try {
        const consulta = query(
            collection(db, "citas"),
            where("idTecnico", "==", uidTecnico)
        );

        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            listaCitas.innerHTML = "<p>No tienes citas agendadas.</p>";
            return;
        }

        citasTecnicoActuales = [];

        resultado.forEach((docCita) => {
            citasTecnicoActuales.push({
                id: docCita.id,
                ...docCita.data()
            });
        });

        citasTecnicoActuales.forEach((cita) => {
            marcarDiaConCita(cita);
        });

        renderizarListaCitas(citasTecnicoActuales);
    } catch (error) {
        console.log("Error al cargar citas del tecnico:", error);
        listaCitas.innerHTML = "<p>No se pudieron cargar tus citas.</p>";
    }
}

function inicializarFiltroCitas() {
    const btnVerTodas = document.getElementById("btnVerTodasCitas");

    if (!btnVerTodas) return;

    btnVerTodas.addEventListener("click", () => {
        limpiarDiaSeleccionado();
        renderizarListaCitas(citasTecnicoActuales);
    });
}

function renderizarListaCitas(citas, mensajeVacio = "No tienes citas agendadas.") {
    const listaCitas = document.getElementById("listaCitasTecnico");
    if (!listaCitas) return;

    if (!Array.isArray(citas) || citas.length === 0) {
        listaCitas.innerHTML = `<p>${mensajeVacio}</p>`;
        return;
    }

    listaCitas.innerHTML = "";

    citas.forEach((cita) => {
        listaCitas.appendChild(crearCardCita(cita));
    });
}

function crearCardCita(cita) {
    const servicio = obtenerDato(cita.servicio, "Servicio no especificado");
    const cliente = obtenerDato(
        cita.nombreCliente || cita.cliente || cita.clienteNombre || cita.idCliente,
        "Cliente no especificado"
    );
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
        <p><span>Estado</span><b>${escaparHtml(estado)}</b></p>
        ${precio ? `<p><span>Precio</span><b>$${escaparHtml(precio)}</b></p>` : ""}
    `;

    return card;
}

function limpiarDiasConCitas() {
    document.querySelectorAll(".calendario .dia.servicio").forEach((dia) => {
        dia.classList.remove("servicio");
        dia.removeAttribute("title");
    });
}

function renderizarCalendarioMensual(fechaBase) {
    const calendario = document.querySelector(".calendario");
    const tituloCalendario = document.getElementById("tituloCalendario");

    if (!calendario) return;

    calendario.innerHTML = "";

    const nombreMes = fechaBase.toLocaleDateString("es-CL", {
        month: "long",
        year: "numeric"
    });

    if (tituloCalendario) {
        tituloCalendario.textContent = capitalizar(nombreMes);
    }

    ["L", "M", "M", "J", "V", "S", "D"].forEach((nombreDia) => {
        const diaNombre = document.createElement("div");
        diaNombre.className = "dia nombre";
        diaNombre.textContent = nombreDia;
        calendario.appendChild(diaNombre);
    });

    const primerDiaMes = new Date(anioCalendario, mesCalendario, 1);
    const totalDiasMes = new Date(anioCalendario, mesCalendario + 1, 0).getDate();
    const offsetLunes = (primerDiaMes.getDay() + 6) % 7;
    const hoy = new Date();

    for (let i = 0; i < offsetLunes; i += 1) {
        const espacio = document.createElement("div");
        espacio.className = "dia dia-vacio";
        calendario.appendChild(espacio);
    }

    for (let numeroDia = 1; numeroDia <= totalDiasMes; numeroDia += 1) {
        const dia = document.createElement("div");
        dia.className = "dia";
        dia.dataset.dia = String(numeroDia);
        dia.textContent = String(numeroDia);
        dia.tabIndex = 0;
        dia.setAttribute("role", "button");
        dia.setAttribute("aria-label", `Ver citas del día ${numeroDia}`);
        dia.addEventListener("click", () => filtrarCitasPorDia(numeroDia));
        dia.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                filtrarCitasPorDia(numeroDia);
            }
        });

        if (
            hoy.getDate() === numeroDia &&
            hoy.getMonth() === mesCalendario &&
            hoy.getFullYear() === anioCalendario
        ) {
            dia.classList.add("hoy");
        }

        calendario.appendChild(dia);
    }
}

function filtrarCitasPorDia(numeroDia) {
    seleccionarDiaCalendario(numeroDia);

    const citasDelDia = citasTecnicoActuales.filter((cita) => {
        return obtenerNumeroDiaMesActual(cita) === String(numeroDia);
    });

    renderizarListaCitas(citasDelDia, "No tienes citas agendadas para este día.");
}

function seleccionarDiaCalendario(numeroDia) {
    limpiarDiaSeleccionado();

    const diaCalendario = document.querySelector(`.calendario .dia[data-dia="${numeroDia}"]`);
    if (diaCalendario) {
        diaCalendario.classList.add("seleccionado");
    }
}

function limpiarDiaSeleccionado() {
    document.querySelectorAll(".calendario .dia.seleccionado").forEach((dia) => {
        dia.classList.remove("seleccionado");
    });
}

function marcarDiaConCita(cita) {
    const numeroDia = obtenerNumeroDiaMesActual(cita);
    if (!numeroDia) return;

    const diaCalendario = document.querySelector(`.calendario .dia[data-dia="${numeroDia}"]`);
    if (!diaCalendario) return;

    diaCalendario.classList.add("servicio");
    diaCalendario.title = "Cita agendada";
}

function obtenerNumeroDiaMesActual(cita) {
    const dia = obtenerDato(cita.dia, "");

    if (dia) {
        const fechaDesdeDia = parsearFecha(dia);

        if (fechaDesdeDia) {
            return obtenerDiaSiEsMesActual(fechaDesdeDia);
        }

        const numeroDia = extraerNumeroDia(dia);
        const totalDiasMes = new Date(anioCalendario, mesCalendario + 1, 0).getDate();

        if (numeroDia >= 1 && numeroDia <= totalDiasMes) {
            return String(numeroDia);
        }
    }

    const fecha = parsearFecha(cita.fecha);

    return fecha ? obtenerDiaSiEsMesActual(fecha) : "";
}

function obtenerDiaSiEsMesActual(fecha) {
    if (
        fecha.getMonth() !== mesCalendario ||
        fecha.getFullYear() !== anioCalendario
    ) {
        return "";
    }

    return String(fecha.getDate());
}

function extraerNumeroDia(valor) {
    const coincidencia = String(valor).match(/\b([1-9]|[12][0-9]|3[01])\b/);
    return coincidencia ? Number(coincidencia[1]) : 0;
}

function obtenerFechaCita(cita) {
    if (cita.dia !== undefined && cita.dia !== null && String(cita.dia).trim() !== "") {
        return String(cita.dia).trim();
    }

    const fecha = parsearFecha(cita.fecha);

    if (fecha) {
        return fecha.toLocaleDateString("es-CL", {
            year: "numeric",
            month: "short",
            day: "2-digit"
        });
    }

    return obtenerDato(cita.fecha, "Fecha no definida");
}

function obtenerHorarioCita(cita) {
    const horaInicio = obtenerDato(cita.horaInicio, "");
    const horaFin = obtenerDato(cita.horaFin, "");

    if (horaInicio && horaFin) {
        return `${horaInicio} - ${horaFin}`;
    }

    return obtenerDato(cita.hora, "Horario no definido");
}

function obtenerDato(valor, fallback) {
    if (valor === undefined || valor === null || String(valor).trim() === "") {
        return fallback;
    }

    return String(valor).trim();
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

function capitalizar(valor) {
    const texto = String(valor || "").trim();
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ================= CERRAR SESION =================
const cerrarSesion = document.querySelector(".cerrar-sesion");

if (cerrarSesion) {
    cerrarSesion.addEventListener("click", async (e) => {
        e.preventDefault();

        const confirmar = confirm("¿Seguro que deseas cerrar sesión?");

        if (!confirmar) return;

        try {
            await signOut(auth);
        } catch (error) {
            console.log("Error al cerrar sesion:", error);
        } finally {
            window.location.href = "inicioSesion.html";
        }
    });
}
