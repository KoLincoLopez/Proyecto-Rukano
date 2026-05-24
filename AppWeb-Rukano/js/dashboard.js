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

        inicializarDashboardTecnico();
        pintarMetricasCargando();
        await cargarDashboardTecnico(user.uid);
    } catch (error) {
        console.log("Error al validar acceso tecnico:", error);
        window.location.href = "inicioSesion.html";
    }
});

function normalizarRol(rol) {
    return normalizarTexto(rol);
}

function inicializarDashboardTecnico() {
    const lista = document.querySelectorAll(".tech-nav li");

    lista.forEach((item) => {
        item.addEventListener("mouseover", () => {
            lista.forEach((navItem) => navItem.classList.remove("active"));
            item.classList.add("active");
        });
    });
}

async function cargarDashboardTecnico(uidTecnico) {
    try {
        const [serviciosSnap, citasSnap, resenas] = await Promise.all([
            getDocs(query(collection(db, "servicios"), where("idTecnico", "==", uidTecnico))),
            getDocs(query(collection(db, "citas"), where("idTecnico", "==", uidTecnico))),
            cargarResenasTecnico(uidTecnico)
        ]);

        const servicios = serviciosSnap.docs.map((documento) => ({
            id: documento.id,
            ...documento.data()
        }));

        const citas = citasSnap.docs.map((documento) => ({
            id: documento.id,
            ...documento.data()
        }));

        const clientes = await cargarClientesAsociados(citas);

        renderizarMetricas(servicios, citas, clientes, resenas);
        renderizarProximasCitas(citas, clientes);
        renderizarClientes(clientes);
    } catch (error) {
        console.log("Error al cargar dashboard tecnico:", error);
        pintarMetricasError();
        pintarEstadoTabla("tablaOrdenesDashboard", 5, "No se pudieron cargar tus datos.", true);
        pintarEstadoTabla("tablaClientesDashboard", 3, "No se pudieron cargar tus clientes.", true);
    }
}

async function cargarResenasTecnico(uidTecnico) {
    const resenas = new Map();

    try {
        const consultas = await Promise.all([
            getDocs(query(collection(db, "resenas"), where("tecnicoId", "==", uidTecnico))),
            getDocs(query(collection(db, "resenas"), where("idTecnico", "==", uidTecnico)))
        ]);

        consultas.forEach((resultado) => {
            resultado.docs.forEach((documento) => {
                resenas.set(documento.id, {
                    id: documento.id,
                    ...documento.data()
                });
            });
        });
    } catch (error) {
        console.log("No se pudieron cargar las resenas del tecnico:", error);
    }

    return Array.from(resenas.values());
}

async function cargarClientesAsociados(citas) {
    const clientes = new Map();
    const idsCliente = [...new Set(citas.map((cita) => obtenerDato(cita.idCliente, "")).filter(Boolean))];

    await Promise.all(
        idsCliente.map(async (idCliente) => {
            try {
                const clienteSnap = await getDoc(doc(db, "usuarios", idCliente));
                clientes.set(idCliente, clienteSnap.exists() ? clienteSnap.data() : null);
            } catch (error) {
                console.log("No se pudo cargar un cliente del dashboard:", error);
                clientes.set(idCliente, null);
            }
        })
    );

    return clientes;
}

function renderizarMetricas(servicios, citas, clientes, resenas) {
    const totalServicios = servicios.length;
    const totalCitas = citas.length;
    const totalClientes = clientes.size;
    const calificaciones = resenas
        .map((resena) => Number(resena.puntuacion ?? resena.estrellas ?? resena.rating ?? resena.calificacion))
        .filter((valor) => Number.isFinite(valor) && valor > 0);

    pintarMetrica(
        "metricServicios",
        "metricServiciosDetalle",
        totalServicios,
        totalServicios === 1 ? "1 servicio publicado" : `${totalServicios} servicios publicados`
    );

    pintarMetrica(
        "metricCitas",
        "metricCitasDetalle",
        totalCitas,
        totalCitas === 1 ? "1 cita registrada" : `${totalCitas} citas registradas`
    );

    pintarMetrica(
        "metricClientes",
        "metricClientesDetalle",
        totalClientes,
        totalClientes === 1 ? "1 cliente asociado" : `${totalClientes} clientes asociados`
    );

    if (calificaciones.length === 0) {
        pintarMetrica("metricResenas", "metricResenasDetalle", "0", "Sin resenas aun");
        return;
    }

    const promedio = calificaciones.reduce((suma, valor) => suma + valor, 0) / calificaciones.length;
    pintarMetrica(
        "metricResenas",
        "metricResenasDetalle",
        promedio.toFixed(1),
        calificaciones.length === 1 ? "1 resena" : `${calificaciones.length} resenas`
    );
}

function renderizarProximasCitas(citas, clientes) {
    const tabla = document.getElementById("tablaOrdenesDashboard");
    if (!tabla) return;

    if (citas.length === 0) {
        pintarEstadoTabla("tablaOrdenesDashboard", 5, "No tienes citas registradas.");
        return;
    }

    tabla.innerHTML = "";
    ordenarCitasPorFecha(citas).slice(0, 6).forEach((cita) => {
        const fila = document.createElement("tr");
        const cliente = clientes.get(cita.idCliente);
        const estado = obtenerDato(cita.estado, "Estado pendiente");

        agregarCelda(fila, obtenerNombreCliente(cliente));
        agregarCelda(fila, obtenerDato(cita.servicio ?? cita.tituloServicio ?? cita.nombreServicio, "Servicio no especificado"));
        agregarCelda(fila, obtenerFechaCita(cita));
        agregarCelda(fila, obtenerHorarioCita(cita));

        const celdaEstado = document.createElement("td");
        const etiquetaEstado = document.createElement("span");
        etiquetaEstado.className = `estatus ${obtenerClaseEstado(estado)}`;
        etiquetaEstado.textContent = estado;
        celdaEstado.appendChild(etiquetaEstado);
        fila.appendChild(celdaEstado);

        tabla.appendChild(fila);
    });
}

function renderizarClientes(clientes) {
    const tabla = document.getElementById("tablaClientesDashboard");
    if (!tabla) return;

    const clientesValidos = Array.from(clientes.values()).filter(Boolean);

    if (clientes.size === 0) {
        pintarEstadoTabla("tablaClientesDashboard", 3, "Aun no tienes clientes asociados.");
        return;
    }

    tabla.innerHTML = "";

    clientesValidos.slice(0, 5).forEach((cliente) => {
        const fila = document.createElement("tr");
        const nombre = obtenerNombreCliente(cliente);

        const celdaAvatar = document.createElement("td");
        const avatar = document.createElement("div");
        avatar.className = "cliente-avatar";
        avatar.textContent = obtenerIniciales(nombre);
        celdaAvatar.appendChild(avatar);

        const celdaNombre = document.createElement("td");
        const titulo = document.createElement("h4");
        titulo.textContent = nombre;
        const contacto = document.createElement("span");
        contacto.className = "cliente-contacto";
        contacto.textContent = obtenerContactoCliente(cliente);
        celdaNombre.appendChild(titulo);
        celdaNombre.appendChild(contacto);

        const celdaAcciones = document.createElement("td");
        celdaAcciones.textContent = obtenerDato(cliente.comuna, "Sin comuna");

        fila.appendChild(celdaAvatar);
        fila.appendChild(celdaNombre);
        fila.appendChild(celdaAcciones);
        tabla.appendChild(fila);
    });

    if (clientesValidos.length === 0) {
        pintarEstadoTabla("tablaClientesDashboard", 3, "Tienes citas con clientes no registrados.");
    }
}

function pintarMetricasCargando() {
    [
        ["metricServicios", "metricServiciosDetalle"],
        ["metricCitas", "metricCitasDetalle"],
        ["metricClientes", "metricClientesDetalle"],
        ["metricResenas", "metricResenasDetalle"]
    ].forEach(([valorId, detalleId]) => {
        pintarMetrica(valorId, detalleId, "--", "Cargando...");
    });
}

function pintarMetricasError() {
    [
        ["metricServicios", "metricServiciosDetalle"],
        ["metricCitas", "metricCitasDetalle"],
        ["metricClientes", "metricClientesDetalle"],
        ["metricResenas", "metricResenasDetalle"]
    ].forEach(([valorId, detalleId]) => {
        pintarMetrica(valorId, detalleId, "0", "No disponible");
    });
}

function pintarMetrica(valorId, detalleId, valor, detalle) {
    const valorElemento = document.getElementById(valorId);
    const detalleElemento = document.getElementById(detalleId);

    if (valorElemento) valorElemento.textContent = obtenerDato(valor, "0");
    if (detalleElemento) detalleElemento.textContent = obtenerDato(detalle, "No disponible");
}

function pintarEstadoTabla(tablaId, colspan, mensaje, esError = false) {
    const tabla = document.getElementById(tablaId);
    if (!tabla) return;

    tabla.innerHTML = "";
    const fila = document.createElement("tr");
    const celda = document.createElement("td");
    celda.colSpan = colspan;
    celda.className = `dashboard-estado${esError ? " error" : ""}`;
    celda.textContent = mensaje;
    fila.appendChild(celda);
    tabla.appendChild(fila);
}

function agregarCelda(fila, contenido) {
    const celda = document.createElement("td");
    celda.textContent = obtenerDato(contenido, "No disponible");
    fila.appendChild(celda);
}

function ordenarCitasPorFecha(citas) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return [...citas].sort((a, b) => {
        const fechaA = convertirFecha(a.dia || a.fecha);
        const fechaB = convertirFecha(b.dia || b.fecha);

        if (!fechaA && !fechaB) return 0;
        if (!fechaA) return 1;
        if (!fechaB) return -1;

        const diaA = new Date(fechaA);
        const diaB = new Date(fechaB);
        diaA.setHours(0, 0, 0, 0);
        diaB.setHours(0, 0, 0, 0);

        const aEsProxima = diaA.getTime() >= hoy.getTime();
        const bEsProxima = diaB.getTime() >= hoy.getTime();

        if (aEsProxima && !bEsProxima) return -1;
        if (!aEsProxima && bEsProxima) return 1;

        return aEsProxima
            ? diaA.getTime() - diaB.getTime()
            : diaB.getTime() - diaA.getTime();
    });
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

function obtenerClaseEstado(estado) {
    const estadoNormalizado = normalizarTexto(estado);

    if (estadoNormalizado.includes("complet") || estadoNormalizado.includes("resuelt") || estadoNormalizado.includes("finaliz")) {
        return "completado";
    }

    if (estadoNormalizado.includes("progreso") || estadoNormalizado.includes("revision")) {
        return "en-progreso";
    }

    return "pendiente";
}

function obtenerFechaCita(cita) {
    const fechaDia = obtenerDato(cita.dia, "");

    if (fechaDia) return formatearFecha(fechaDia);

    return formatearFecha(cita.fecha);
}

function obtenerHorarioCita(cita) {
    const horaInicio = obtenerDato(cita.horaInicio, "");
    const horaFin = obtenerDato(cita.horaFin, "");

    if (horaInicio && horaFin) {
        return `${horaInicio} - ${horaFin}`;
    }

    return obtenerDato(cita.hora, "Horario no definido");
}

function formatearFecha(valor) {
    const fecha = convertirFecha(valor);

    if (!fecha) return "Fecha no definida";

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

    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function obtenerIniciales(nombre) {
    return String(nombre || "Cliente")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join("") || "C";
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
