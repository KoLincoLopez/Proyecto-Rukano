import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// === VARIABLES DE CONTROL GLOBAL (Módulo Calendario) ===
const cal = {
    hoy: new Date(),
    mesActual: new Date(),         // Controla qué mes se visualiza
    fechaElegidaStr: null,         // "YYYY-MM-DD" seleccionado por el técnico
    idTecnico: null,
    todasLasCitas: []              // Caché local de citas de este técnico
};

const MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

document.addEventListener("DOMContentLoaded", () => {
    // === AUTENTICACIÓN Y NAVBAR ===
    const botonPerfil = document.querySelector(".perfil-usuario") || document.querySelector(".toggle");
    const menuDesplegable = document.querySelector(".nav");
    const container = document.querySelector(".container");

    if (botonPerfil && menuDesplegable) {
        botonPerfil.addEventListener("click", () => {
            menuDesplegable.classList.toggle("active");
            if(container) container.classList.toggle("active");
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userSnap = await getDoc(doc(db, "usuarios", user.uid));
                if (userSnap.exists()) {
                    const datosUsuario = userSnap.data();
                    if (datosUsuario.rol !== "tecnico") return window.location.href = "index.html";

                    cal.idTecnico = user.uid;

                    document.querySelectorAll(".link-sesion, .btn-registro-nav").forEach(el => el.style.display = "none");

                    const navDerecha = document.querySelector(".nav-derecha");
                    if (navDerecha && botonPerfil && !document.getElementById("saludoNavbar")) {
                        const saludo = document.createElement("span");
                        saludo.id = "saludoNavbar";
                        saludo.style.cssText = "color: var(--c-arena); font-weight: bold; margin-right: 15px; font-size: 14px;";
                        saludo.textContent = `¡Hola, ${datosUsuario.nombre.split(" ")[0]} !`;
                        navDerecha.insertBefore(saludo, botonPerfil);
                    }

                    const img = botonPerfil?.querySelector("img");
                    if (img) {
                        const span = document.createElement("span");
                        span.textContent = datosUsuario.nombre.charAt(0).toUpperCase();
                        span.style.cssText = "color: white; font-size: 20px; font-weight: 900; background-color: var(--c-rosewood); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;";
                        img.replaceWith(span);
                    }

                    // Descargar historial de citas del técnico para pintar el calendario
                    await cargarCitasTecnico();
                }
            } catch (error) { console.error("Error:", error); }
        } else {
            window.location.href = "inicioSesion.html";
        }
    });

    const btnCerrarSesion = document.querySelector(".cerrar-sesion");
    if (btnCerrarSesion) btnCerrarSesion.addEventListener("click", async (e) => { e.preventDefault(); await signOut(auth); });

    // === MENÚ ACTIVE LINKS ===
    const lista = document.querySelectorAll(".nav li");
    lista.forEach((item) => {
        item.addEventListener("click", function() {
            lista.forEach((i) => i.classList.remove("active"));
            this.classList.add("active");
        });
    });

    // === BLOC DE NOTAS LOCALSTORAGE ===
    const textarea = document.querySelector(".notas-box textarea");
    const botonGuardar = document.querySelector(".notas-box .boton");
    if(textarea && botonGuardar) {
        textarea.value = localStorage.getItem("notaAgenda") || "";
        botonGuardar.addEventListener("click", () => {
            localStorage.setItem("notaAgenda", textarea.value);
            alert("Nota guardada correctamente");
        });
    }

    // === ASIGNACIÓN DE BOTONES DE NAVEGACIÓN MES DEL CALENDARIO ===
    document.getElementById("btn-prev-mes")?.addEventListener("click", () => cambiarMes(-1));
    document.getElementById("btn-next-mes")?.addEventListener("click", () => cambiarMes(1));
});


// === DESCARGAR CITAS DE FIRESTORE (CRUZADO CON USUARIOS) ===
async function cargarCitasTecnico() {
    try {
        const citasRef = collection(db, "citas");
        const q = query(citasRef, where("idTecnico", "==", cal.idTecnico));
        const snapshot = await getDocs(q);

        // Mapeamos las citas trayendo el nombre real del cliente en paralelo
        const promesas = snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            let nombreCliente = data.idCliente || "Cliente Desconocido";

            if (data.idCliente) {
                try {
                    const uSnap = await getDoc(doc(db, "usuarios", data.idCliente));
                    if (uSnap.exists()) {
                        const dClie = uSnap.data();
                        nombreCliente = `${dClie.nombre || ""} ${dClie.apellido || ""}`.trim() || data.idCliente;
                    }
                } catch (e) {
                    console.error("Error trayendo cliente: ", data.idCliente);
                }
            }
            return { id: docSnap.id, ...data, nombreCliente };
        });

        cal.todasLasCitas = await Promise.all(promesas);

        // Establecer el calendario al primer día del mes corriente
        cal.mesActual = new Date(cal.hoy.getFullYear(), cal.hoy.getMonth(), 1);
        renderCalendario();

    } catch (error) {
        console.error("Error poblando citas del calendario:", error);
    }
}

// === NAVEGAR ENTRE MESES ===
function cambiarMes(direccion) {
    cal.mesActual = new Date(cal.mesActual.getFullYear(), cal.mesActual.getMonth() + direccion, 1);
    renderCalendario();
}

// === RENDERIZAR LA GRILLA DE DÍAS DEL CALENDARIO ===
function renderCalendario() {
    const grid = document.getElementById("cal-grid");
    const label = document.getElementById("cal-mes-label");
    if (!grid || !label) return;

    const anio = cal.mesActual.getFullYear();
    const mes = cal.mesActual.getMonth();

    // Actualizar nombre superior del mes
    label.textContent = `${MESES_ES[mes]} ${anio}`;

    // Obtener primer día del mes y calcular desfase (Lunes = 0 a Domingo = 6)
    const primerDia = new Date(anio, mes, 1);
    let offsetLunes = primerDia.getDay() - 1;
    if (offsetLunes < 0) offsetLunes = 6; 

    const totalDiasMes = new Date(anio, mes + 1, 0).getDate();
    const hoyFormateado = formatearFechaStr(cal.hoy);

    grid.innerHTML = ""; // Limpiar grilla previa

    // 1. Celdas vacías de desfase inicial
    for (let i = 0; i < offsetLunes; i++) {
        const celdaVacia = document.createElement("div");
        celdaVacia.className = "dia";
        celdaVacia.style.opacity = "0"; // Invisible
        grid.appendChild(celdaVacia);
    }

    // 2. Generar los días reales del mes
    for (let d = 1; d <= totalDiasMes; d++) {
        const iterFecha = new Date(anio, mes, d);
        const fechaStr = formatearFechaStr(iterFecha);

        // Filtrar citas del técnico en esta fecha específica
        const citasDelDia = cal.todasLasCitas.filter(c => c.fecha === fechaStr);
        const tieneServicios = citasDelDia.length > 0;

        const celda = document.createElement("div");
        celda.className = "dia";
        celda.textContent = d;
        celda.style.cursor = "pointer";

        // Asignación de clases CSS existentes en tu proyecto
        if (tieneServicios) celda.classList.add("servicio"); // Resalta color de servicio activo
        if (fechaStr === hoyFormateado) celda.classList.add("hoy"); // Círculo o borde de hoy
        if (fechaStr === cal.fechaElegidaStr) {
            celda.style.outline = "3px solid var(--c-arena)";
            celda.style.fontWeight = "bold";
        }

        // Evento click para inspeccionar la agenda del día
        celda.addEventListener("click", () => {
            cal.fechaElegidaStr = fechaStr;
            renderCalendario(); // Redibuja para refrescar el borde de selección
            mostrarDetallesDia(fechaStr, citasDelDia);
        });

        grid.appendChild(celda);
    }
}

// === DESPLEGAR LAS CITAS DEL DÍA SELECCIONADO EN EL PANEL LATERAL ===
function mostrarDetallesDia(fechaStr, citas) {
    const labelFecha = document.getElementById("fecha-seleccionada-label");
    const contenedorLista = document.getElementById("lista-citas-dia");
    if (!contenedorLista) return;

    // Desglosar fecha de forma estética
    const [anio, mes, dia] = fechaStr.split("-");
    if (labelFecha) {
        labelFecha.textContent = `${dia} de ${MESES_ES[Number(mes) - 1]} de ${anio}`;
    }

    if (citas.length === 0) {
        contenedorLista.innerHTML = `
            <div style="text-align: center; padding: 20px; color: #777;">
                <p>¡Día libre! No tienes servicios agendados para esta fecha.</p>
            </div>
        `;
        return;
    }

    // Ordenar citas por hora
    citas.sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));

    let html = "";
    citas.forEach(cita => {
        const estadoCita = (cita.estado || "pendiente").toLowerCase();
        const badgeEstado = estadoCita === "realizado" ? "COMPLETADO" : estadoCita.toUpperCase();

        html += `
            <div style="border-left: 5px solid ${estadoCita === 'realizado' ? '#22c55e' : '#eab308'}; 
                        background: #fdfdfd; padding: 12px; border-radius: 4px; margin-bottom: 12px; 
                        box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
                <div style="font-weight: bold; font-size: 13px; color: #444; margin-bottom: 4px;">
                    ${cita.hora || "Horario no fijado"} hrs
                </div>
                <h4 style="margin: 0 0 5px 0; color: #111; font-size: 15px;">${cita.tituloServicio || "Servicio General"}</h4>
                <p style="margin: 2px 0; font-size: 13px; color: #555;"><strong>Cliente:</strong> ${cita.nombreCliente}</p>
                <p style="margin: 2px 0; font-size: 11px; color: #888; font-family: monospace; word-break: break-all;">ID Cliente: ${cita.idCliente}</p>
                
                <span style="display: inline-block; font-size: 11px; font-weight: bold; margin-top: 6px; 
                             padding: 2px 6px; border-radius: 4px;
                             background: ${estadoCita === 'realizado' ? '#dbf7e6' : '#fef5d1'}; 
                             color: ${estadoCita === 'realizado' ? '#15803d' : '#a16207'};">
                    ${badgeEstado}
                </span>
            </div>
        `;
    });

    contenedorLista.innerHTML = html;
}

// === UTILIDAD: CONVERTIR OBJETO DATE A CADENA "YYYY-MM-DD" ===
function formatearFechaStr(date) {
    const anio = date.getFullYear();
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const dia = String(date.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}