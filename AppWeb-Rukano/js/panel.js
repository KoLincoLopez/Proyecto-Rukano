import { auth, db } from "./Firebase-config.js";
import { apiFetch } from "./apiFetch.js";
import { crearTimelineEstado, obtenerEtiquetaEstadoCita } from "./timelineCita.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API_URL = window.RukanoApiConfig.getApiBaseUrl();
const PAYMENT_MODE = window.RukanoApiConfig.getPaymentMode();

window.addEventListener("DOMContentLoaded", () => {

    let datosUsuarioActual = null;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "inicioSesion.html";
            return;
        }

        try {
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                await signOut(auth);
                window.location.href = "inicioSesion.html";
                return;
            }

            datosUsuarioActual = docSnap.data();

            const rol = normalizarRol(datosUsuarioActual.rol);
            const paginaActual = window.location.href;

            if (rol === "cliente" && paginaActual.includes("panelTecnico.html")) {
                window.location.href = "panelCliente.html";
                return;
            }

            if (rol === "tecnico" && paginaActual.includes("panelCliente.html")) {
                window.location.href = "panelTecnico.html";
                return;
            }

            if (rol === "tecnico" && paginaActual.includes("panelTecnico.html")) {
                await cargarMisServicios(user.uid);
            }

            if (rol === "cliente" && paginaActual.includes("panelCliente.html")) {
                prepararPanelCliente(user.uid, datosUsuarioActual, user);
            }

        } catch (error) {
            console.log("Error al obtener rol:", error);
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

    const btnLogout = document.getElementById("btnLogout");
    const modalPanel = configurarModalPanelTecnico();

    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try {
                await signOut(auth);
                window.location.href = "inicioSesion.html";
            } catch (error) {
                console.log("Error al cerrar sesion:", error);
            }
        });
    }

    function normalizarDisponibilidadItem(item = {}) {
        const inicio = item.inicio || item.hora_inicio || "";
        const fin = item.fin || item.hora_fin || "";

        return {
            dia: item.dia || item["día"] || item.day || "Dia no definido",
            inicio: inicio || "Inicio no definido",
            fin: fin || "Fin no definido"
        };
    }

    function formatearDisponibilidadItem(item = {}) {
        const horario = normalizarDisponibilidadItem(item);
        return `${horario.dia}: ${horario.inicio} - ${horario.fin}`;
    }

    function actualizarResumenServicios(servicios = []) {
        const totalServicios = document.getElementById("totalServiciosTecnico");
        const serviciosActivos = document.getElementById("serviciosActivosTecnico");
        const serviciosConDisponibilidad = document.getElementById("serviciosConDisponibilidad");

        const activos = servicios.filter((servicio) => {
            return normalizarTexto(servicio.estado || "activo") !== "inactivo";
        }).length;

        const conDisponibilidad = servicios.filter((servicio) => {
            return Array.isArray(servicio.disponibilidad) && servicio.disponibilidad.length > 0;
        }).length;

        if (totalServicios) totalServicios.textContent = String(servicios.length);
        if (serviciosActivos) serviciosActivos.textContent = String(activos);
        if (serviciosConDisponibilidad) serviciosConDisponibilidad.textContent = String(conDisponibilidad);
    }

    function configurarModalPanelTecnico() {
        const overlay = document.getElementById("panelModalOverlay");
        const modal = overlay?.querySelector(".panel-modal");
        const titulo = document.getElementById("panelModalTitle");
        const texto = document.getElementById("panelModalText");
        const inputGroup = document.getElementById("panelModalInputGroup");
        const input = document.getElementById("panelModalInput");
        const error = document.getElementById("panelModalError");
        const btnCerrar = document.getElementById("panelModalClose");
        const btnCancelar = document.getElementById("panelModalCancel");
        const btnConfirmar = document.getElementById("panelModalConfirm");
        const toast = document.getElementById("panelToast");
        let estadoModal = null;
        let toastTimer = null;

        if (!overlay || !modal || !titulo || !texto || !inputGroup || !input || !error || !btnCerrar || !btnCancelar || !btnConfirmar) {
            return null;
        }

        function abrir(configuracion) {
            return new Promise((resolve) => {
                estadoModal = {
                    tipo: configuracion.tipo,
                    resolve
                };

                titulo.textContent = configuracion.titulo;
                texto.textContent = configuracion.texto;
                btnConfirmar.textContent = configuracion.confirmar;
                error.textContent = "";
                input.value = configuracion.valorInicial || "";
                inputGroup.hidden = configuracion.tipo !== "editar";
                overlay.hidden = false;
                document.body.classList.add("panel-modal-abierto");

                if (configuracion.tipo === "editar") {
                    input.focus();
                    input.select();
                } else {
                    btnConfirmar.focus();
                }
            });
        }

        function cerrar(resultado = null) {
            if (!estadoModal) return;

            const resolver = estadoModal.resolve;
            estadoModal = null;
            overlay.hidden = true;
            document.body.classList.remove("panel-modal-abierto");
            error.textContent = "";
            resolver(resultado);
        }

        function confirmar() {
            if (!estadoModal) return;

            if (estadoModal.tipo === "editar") {
                const valor = input.value.trim();

                if (!valor) {
                    error.textContent = "Ingresa un nombre para el servicio.";
                    input.focus();
                    return;
                }

                cerrar(valor);
                return;
            }

            cerrar(true);
        }

        function notificar(mensaje, tipo = "exito") {
            if (!toast) return;

            window.clearTimeout(toastTimer);
            toast.textContent = mensaje;
            toast.className = `panel-toast visible ${tipo === "error" ? "error" : "exito"}`;

            toastTimer = window.setTimeout(() => {
                toast.className = "panel-toast";
                toast.textContent = "";
            }, 3200);
        }

        btnConfirmar.addEventListener("click", confirmar);
        btnCancelar.addEventListener("click", () => cerrar(null));
        btnCerrar.addEventListener("click", () => cerrar(null));
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) cerrar(null);
        });
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") confirmar();
        });
        document.addEventListener("keydown", (event) => {
            if (!overlay.hidden && event.key === "Escape") cerrar(null);
        });

        return {
            confirmarEliminacion() {
                return abrir({
                    tipo: "eliminar",
                    titulo: "Eliminar servicio",
                    texto: "Esta accion quitara el servicio de tu listado. Puedes volver a publicarlo mas adelante si lo necesitas.",
                    confirmar: "Confirmar eliminacion"
                });
            },
            editarTitulo(valorActual) {
                return abrir({
                    tipo: "editar",
                    titulo: "Editar servicio",
                    texto: "Actualiza el nombre visible de tu servicio.",
                    confirmar: "Guardar cambios",
                    valorInicial: valorActual || ""
                });
            },
            notificar
        };
    }

    async function cargarMisServicios(uidTecnico, mensajeCarga = "Cargando tus servicios...") {
        const lista = document.getElementById("listaMisServicios");

        if (!lista) return;

        lista.innerHTML = `<p class="servicios-estado">${mensajeCarga}</p>`;

        try {
            const consulta = query(
                collection(db, "servicios"),
                where("idTecnico", "==", uidTecnico)
            );

            const resultado = await getDocs(consulta);

            const serviciosPublicados = [];

            resultado.forEach((docServicio) => {
                serviciosPublicados.push({
                    id: docServicio.id,
                    data: docServicio.data()
                });
            });

            serviciosPublicados.sort((a, b) => obtenerTimestampOrden(b.data) - obtenerTimestampOrden(a.data));
            actualizarResumenServicios(serviciosPublicados.map((servicio) => servicio.data));

            if (serviciosPublicados.length === 0) {
                lista.innerHTML = '<p class="servicios-estado">Aun no has publicado servicios.</p>';
                return;
            }

            lista.innerHTML = "";

            serviciosPublicados.forEach((docServicio) => {
                const servicio = docServicio.data;

                const disponibilidad = Array.isArray(servicio.disponibilidad)
                    ? servicio.disponibilidad.map(formatearDisponibilidadItem).join(" | ")
                    : "Sin disponibilidad";

                const card = document.createElement("div");
                card.className = "dato servicio-tecnico-card";

                card.innerHTML = `
                    <strong>${servicio.nombre || servicio.titulo || "Servicio"}</strong>
                    <p>Categoria: ${servicio.categoria || "No especificada"}</p>
                    <p>Comuna: ${servicio.comuna || "No especificada"}</p>
                    <p>Precio: $${Math.round(servicio.precio || 0)}</p>
                    <p>Tiempo estimado: ${servicio.tiempoEstimado || "No especificado"}</p>
                    <p>Disponibilidad: ${disponibilidad}</p>
                    <p>Estado: ${servicio.estado || "activo"}</p>

                    <div class="servicio-tecnico-acciones">
                        <button class="btnEditar" data-id="${docServicio.id}">
                            Editar titulo
                        </button>

                        <button class="btnEliminar" data-id="${docServicio.id}">
                            Eliminar
                        </button>
                    </div>
                `;

                lista.appendChild(card);

                const btnEliminar = card.querySelector(".btnEliminar");

                btnEliminar.addEventListener("click", async () => {
                    const confirmar = await modalPanel?.confirmarEliminacion();

                    if (!confirmar) return;

                    try {
                        const response = await apiFetch(`${API_URL}/servicios/${docServicio.id}`, {
                            method: "DELETE"
                        });
                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.detail || "No se pudo eliminar el servicio.");
                        }
                        await cargarMisServicios(uidTecnico, "Actualizando tus servicios...");
                        modalPanel?.notificar("Servicio eliminado correctamente.");
                    } catch (error) {
                        console.log(error);
                        modalPanel?.notificar("No se pudo eliminar el servicio. Intenta nuevamente.", "error");
                        await cargarMisServicios(uidTecnico);
                    }
                });

                const btnEditar = card.querySelector(".btnEditar");

                btnEditar.addEventListener("click", async () => {
                    const nuevoTitulo = await modalPanel?.editarTitulo(servicio.nombre || servicio.titulo);

                    if (!nuevoTitulo) return;

                    try {
                        const response = await apiFetch(`${API_URL}/servicios/editar/${docServicio.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                nombre: nuevoTitulo,
                                titulo: nuevoTitulo
                            })
                        });
                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.detail || "No se pudo actualizar el servicio.");
                        }

                        await cargarMisServicios(uidTecnico, "Actualizando tus servicios...");
                        modalPanel?.notificar("Servicio actualizado correctamente.");

                    } catch (error) {
                        console.log(error);
                        modalPanel?.notificar("No se pudo actualizar el servicio. Intenta nuevamente.", "error");
                        await cargarMisServicios(uidTecnico);
                    }
                });
            });

        } catch (error) {
            console.log("Error al cargar servicios:", error);
            lista.innerHTML = '<p class="servicios-estado error">No se pudieron cargar tus servicios. Intenta nuevamente.</p>';
        }
    }

    async function prepararPanelCliente(uidCliente, datosCliente = {}, userAuth = null) {
        pintarDatosCliente(datosCliente, userAuth);

        const params = new URLSearchParams(window.location.search);

        const servicio = params.get("servicio");
        const tecnico = params.get("tecnico");
        const precio = params.get("precio");
        const idTecnico = params.get("idTecnico");
        const idServicio = params.get("idServicio");

        if (idServicio) {
            window.location.replace(`detalleServicio.html?id=${encodeURIComponent(idServicio)}`);
            return;
        }

        const dashboardCliente = document.getElementById("dashboardCliente");
        const seccionReserva = document.getElementById("seccionReserva");

        const vieneDeReserva = servicio && tecnico && precio && idTecnico && idServicio;

        if (vieneDeReserva) {
            if (dashboardCliente) dashboardCliente.style.display = "none";
            if (seccionReserva) seccionReserva.style.display = "block";
        } else {
            if (dashboardCliente) dashboardCliente.style.display = "block";
            if (seccionReserva) seccionReserva.style.display = "none";
        }

        const servicioReserva = document.getElementById("servicioReserva");
        const tecnicoReserva = document.getElementById("tecnicoReserva");
        const precioReserva = document.getElementById("precioReserva");

        if (servicioReserva) servicioReserva.textContent = servicio || "Sin servicio seleccionado";
        if (tecnicoReserva) tecnicoReserva.textContent = tecnico || "Sin tecnico seleccionado";
        if (precioReserva) precioReserva.textContent = precio || "0";

        if (vieneDeReserva) {
            cargarDisponibilidadServicio(idServicio);
        }

        cargarCitasCliente(uidCliente);
        cargarUltimoReporteCliente(uidCliente);
        cargarBadgeCitasReservadas(uidCliente);

        const btnEnviarReporte = document.getElementById("btnEnviarReporte");

        if (btnEnviarReporte) {
            btnEnviarReporte.addEventListener("click", () => {
                enviarReporteCliente(uidCliente);
            });
        }
    }

    function pintarDatosCliente(datosCliente = {}, userAuth = null) {
        const obtenerDato = (...valores) => {
            const valor = valores.find((item) => item !== undefined && item !== null && String(item).trim() !== "");
            return valor !== undefined ? String(valor).trim() : "No registrado";
        };

        const nombreCompleto = obtenerDato(
            [datosCliente.nombres || datosCliente.nombre, datosCliente.apellidos || datosCliente.apellido]
                .filter((item) => item !== undefined && item !== null && String(item).trim() !== "")
                .join(" "),
            datosCliente.displayName,
            userAuth?.displayName
        );

        const correo = obtenerDato(datosCliente.email, datosCliente.correo, userAuth?.email);
        const telefono = obtenerDato(datosCliente.telefono, datosCliente.telefonoCliente, datosCliente.phone);
        const ubicacion = obtenerDato(
            datosCliente.comuna,
            datosCliente.direccion,
            datosCliente["direcci\u00f3n"],
            datosCliente["direccion"],
            datosCliente.region
        );

        const clienteNombre = document.getElementById("clienteNombre");
        const clienteCorreo = document.getElementById("clienteCorreo");
        const clienteTelefono = document.getElementById("clienteTelefono");
        const clienteUbicacion = document.getElementById("clienteUbicacion");
        if (clienteNombre) clienteNombre.textContent = nombreCompleto;
        if (clienteCorreo) clienteCorreo.textContent = correo;
        if (clienteTelefono) clienteTelefono.textContent = telefono;
        if (clienteUbicacion) clienteUbicacion.textContent = ubicacion;
    }

    async function cargarDisponibilidadServicio(idServicio) {
        const contenedor = document.getElementById("horariosDisponibles");

        if (!contenedor) return;

        contenedor.innerHTML = "<p>Cargando horarios disponibles...</p>";

        try {
            const servicioRef = doc(db, "servicios", idServicio);
            const servicioSnap = await getDoc(servicioRef);

            if (!servicioSnap.exists()) {
                contenedor.innerHTML = "<p>No se encontro el servicio.</p>";
                return;
            }

            const servicio = servicioSnap.data();
            const dias = servicio.disponibilidad || [];

            if (!Array.isArray(dias) || dias.length === 0) {
                contenedor.innerHTML = "<p>Este servicio aun no tiene horarios disponibles.</p>";
                return;
            }

            contenedor.innerHTML = "";

            dias.forEach((item) => {
                const horario = normalizarDisponibilidadItem(item);
                const opcion = document.createElement("label");
                opcion.className = "dato";
                opcion.style.display = "block";
                opcion.style.marginTop = "12px";

                opcion.innerHTML = `
                    <input type="radio" name="horarioSeleccionado" value="${horario.dia}|${horario.inicio}|${horario.fin}">
                    <strong>${horario.dia}</strong>
                    ${horario.inicio} - ${horario.fin}
                `;

                contenedor.appendChild(opcion);
            });

        } catch (error) {
            console.log(error);
            contenedor.innerHTML = "<p>Error al cargar horarios.</p>";
        }
    }

    async function enviarReporteCliente(uidCliente) {
        const tipoReporte = document.getElementById("tipoReporte");
        const tecnicoRelacionado = document.getElementById("tecnicoRelacionado");
        const textarea = document.getElementById("mensajeReporte");
        const estadoReporte = document.getElementById("estadoReporte");
        const user = auth.currentUser;

        if (!tipoReporte || !textarea || !estadoReporte) return;

        const tipo = tipoReporte.value.trim();
        const tecnico = tecnicoRelacionado?.value.trim() || "";
        const descripcion = textarea.value.trim();
        if (!user) {
            estadoReporte.textContent = "Debes iniciar sesion para enviar un reporte.";
            return;
        }

        if (!tipo) {
            estadoReporte.textContent = "Selecciona un tipo de reclamo.";
            return;
        }

        if (!descripcion) {
            estadoReporte.textContent = "Describe el problema antes de enviar el reporte.";
            return;
        }

        try {
            const response = await apiFetch(`${API_URL}/reports/reportar_general`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                tipoReporte: tipo,
                tecnicoRelacionado: tecnico,
                    descripcion
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || "No se pudo enviar el reporte.");
            }

            tipoReporte.value = "";
            if (tecnicoRelacionado) tecnicoRelacionado.value = "";
            textarea.value = "";
            estadoReporte.textContent = "Reporte enviado correctamente.";
            cargarUltimoReporteCliente(uidCliente);
        } catch (error) {
            console.log("Error al enviar reporte:", error);
            estadoReporte.textContent = "No se pudo enviar el reporte. Intenta nuevamente.";
        }
    }

    async function cargarUltimoReporteCliente(uidCliente) {
        const estado = document.getElementById("ultimoReporteEstado");
        const fecha = document.getElementById("ultimoReporteFecha");

        if (!estado || !fecha) return;

        estado.textContent = "Cargando estado...";
        fecha.textContent = "Fecha no disponible";
        actualizarTimelineReporte();

        const obtenerDato = (valor, fallback) => {
            if (valor === undefined || valor === null || String(valor).trim() === "") {
                return fallback;
            }

            return String(valor).trim();
        };

        const obtenerFecha = (valor) => {
            if (!valor) return null;
            if (typeof valor.toDate === "function") return valor.toDate();
            if (valor instanceof Date) return valor;
            if (typeof valor.seconds === "number") return new Date(valor.seconds * 1000);

            const fechaParseada = new Date(valor);
            return Number.isNaN(fechaParseada.getTime()) ? null : fechaParseada;
        };

        try {
            const consulta = query(
                collection(db, "reportes"),
                where("idReportante", "==", uidCliente)
            );

            const resultado = await getDocs(consulta);

            if (resultado.empty) {
                estado.textContent = "Sin reclamos activos";
                fecha.textContent = "No tienes reclamos registrados.";
                actualizarTimelineReporte();
                return;
            }

            const reportes = [];

            resultado.forEach((docReporte) => {
                const reporte = docReporte.data();
                const fechaReporte = obtenerFecha(reporte.fecha || reporte.createdAt);

                reportes.push({
                    ...reporte,
                    fechaReporte,
                    fechaOrden: fechaReporte ? fechaReporte.getTime() : 0
                });
            });

            reportes.sort((a, b) => b.fechaOrden - a.fechaOrden);

            const ultimoReporte = reportes[0];
            const estadoReporte = obtenerDato(ultimoReporte.estado, "pendiente");
            const fechaReporte = ultimoReporte.fechaReporte
                ? ultimoReporte.fechaReporte.toLocaleDateString("es-CL", {
                    year: "numeric",
                    month: "short",
                    day: "2-digit"
                })
                : "Fecha no disponible";

            estado.textContent = estadoReporte;
            fecha.textContent = fechaReporte;
            actualizarTimelineReporte(estadoReporte);
        } catch (error) {
            console.log("Error al cargar ultimo reporte:", error);
            estado.textContent = "No se pudo cargar el estado de tus reclamos.";
            fecha.textContent = "Fecha no disponible";
        }
    }

    function actualizarTimelineReporte(estadoReporte = "") {
        const pasos = Array.from(document.querySelectorAll(".timeline-reclamo .timeline-step"));
        if (pasos.length === 0) return;

        pasos.forEach((paso) => {
            paso.classList.remove("is-complete", "is-active");
        });

        const estadoNormalizado = normalizarTexto(estadoReporte);

        if (!estadoNormalizado) return;

        const indicePendiente = 1;
        const indiceRevision = 2;
        const indiceResuelto = 3;

        if (estadoNormalizado.includes("resuelto")) {
            pasos[indicePendiente]?.classList.add("is-complete");
            pasos[indiceRevision]?.classList.add("is-complete");
            pasos[indiceResuelto]?.classList.add("is-active");
            return;
        }

        if (estadoNormalizado.includes("revision")) {
            pasos[indicePendiente]?.classList.add("is-complete");
            pasos[indiceRevision]?.classList.add("is-active");
            return;
        }

        pasos[indicePendiente]?.classList.add("is-active");
    }

    function normalizarTexto(valor) {
        return String(valor || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function obtenerFechaComoDate(valor) {
        if (!valor) return null;
        if (valor instanceof Date) return valor;
        if (typeof valor.toDate === "function") return valor.toDate();
        if (typeof valor.seconds === "number") return new Date(valor.seconds * 1000);
        if (typeof valor._seconds === "number") return new Date(valor._seconds * 1000);

        const fecha = new Date(valor);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }

    function obtenerTimestampOrden(data = {}) {
        const candidatos = [
            data.createdAt,
            data.fechaCreacion,
            data.creadoEn,
            data.modificadoEn,
            data.updatedAt,
            data.fechaActualizacion,
            data.fecha
        ];

        for (const candidato of candidatos) {
            const fecha = obtenerFechaComoDate(candidato);
            if (fecha) return fecha.getTime();
        }

        return 0;
    }

    function obtenerTimestampCita(cita = {}) {
        const fechaBase = cita.fecha || cita.dia || cita.fechaCita || cita.fechaReserva;
        const horaBase = cita.hora || cita.horaInicio || "";

        if (fechaBase && /^\d{4}-\d{2}-\d{2}$/.test(String(fechaBase))) {
            const horaNormalizada = /^\d{2}:\d{2}$/.test(String(horaBase)) ? horaBase : "00:00";
            const fechaHora = new Date(`${fechaBase}T${horaNormalizada}:00`);
            if (!Number.isNaN(fechaHora.getTime())) return fechaHora.getTime();
        }

        return obtenerTimestampOrden(cita);
    }

    function fechaEsHoyOPasada(fechaISO) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaISO || ""))) return false;
        const hoy = new Date();
        const hoyLocal = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
        return fechaISO <= hoyLocal;
    }

    async function cargarBadgeCitasReservadas(uidCliente) {
        // Eliminar badge previo del DOM (para el caso de refrescos tras un pago)
        document.getElementById("badgeCitasReservadas")?.remove();

        const heading = document.querySelector(".citas-section .section-heading h2");
        if (!heading) return;

        try {
            const response = await apiFetch(`${API_URL}/citas/notificaciones/cliente/${uidCliente}/reservadas`);
            if (!response.ok) throw new Error("Error al obtener notificaciones");

            const data = await response.json();
            const cantidad = data.cantidad_reservadas ?? 0;

            // Solo se inserta en el DOM si hay algo que notificar; si es 0 no existe ningún elemento
            if (cantidad > 0) {
                const badge = document.createElement("span");
                badge.id = "badgeCitasReservadas";
                badge.className = "badge-citas-reservadas";
                badge.textContent = String(cantidad);
                heading.appendChild(badge);
            }
        } catch (error) {
            // Silencioso: si falla el endpoint no interrumpimos la UI
            console.warn("[Badge] No se pudo cargar la cantidad de citas reservadas:", error);
        }
    }

    async function cargarCitasClienteOrdenadas(uidCliente, lista) {
        const historial = document.getElementById("historialCitasCliente");
        const historialLista = document.getElementById("listaHistorialCitasCliente");
        const historialResumen = document.getElementById("historialCitasResumen");
        const btnToggleHistorial = document.getElementById("btnToggleHistorial");

        lista.innerHTML = "<p>Cargando tus citas...</p>";
        if (historialLista) historialLista.innerHTML = "";
        if (historial) historial.hidden = true;
        if (btnToggleHistorial) btnToggleHistorial.hidden = true;

        const obtenerDato = (valor, fallback) => {
            if (valor === undefined || valor === null || String(valor).trim() === "") {
                return fallback;
            }

            return String(valor).trim();
        };

        const consulta = query(
            collection(db, "citas"),
            where("idCliente", "==", uidCliente)
        );

        const resultado = await getDocs(consulta);

        if (resultado.empty) {
            lista.innerHTML = '<p class="citas-vacias">Aun no tienes citas registradas.</p>';
            return true;
        }

        const citas = [];

        for (const docCita of resultado.docs) {
            const cita = docCita.data();
            const citaId = docCita.id;
            const servicioId = cita.idServicio || "";
            const tecnicoId = cita.idTecnico || "";
            const estadoNorm = normalizarTexto(cita.estado);
            const faltanDatosResena = !citaId || !servicioId || !tecnicoId;
            let yaResenada = false;
            let puedeResenar = false;
            let validacionResenaDisponible = true;

            if (estadoNorm === "concluida" && !faltanDatosResena) {
                try {
                    const response = await apiFetch(`${API_URL}/reviews/verificar_resena/${encodeURIComponent(citaId)}`);
                    if (!response.ok) throw new Error("No se pudo validar la reseña");
                    const validacion = await response.json();
                    yaResenada = Boolean(validacion.posee_resena);
                    puedeResenar = Boolean(validacion.puede_resenar);
                } catch (error) {
                    validacionResenaDisponible = false;
                    console.warn("No se pudo validar si la cita admite reseña:", error);
                }
            }

            const servicio = obtenerDato(cita.tituloServicio, obtenerDato(cita.servicio, "Servicio no especificado"));
            const tecnico = obtenerDato(cita.tecnico, obtenerDato(cita.idTecnico, "Tecnico no asignado"));
            const dia = obtenerDato(cita.dia, obtenerDato(cita.fecha, "Fecha no definida"));
            const horaInicio = obtenerDato(cita.horaInicio, "");
            const horaFin = obtenerDato(cita.horaFin, "");
            const horario = horaInicio && horaFin ? `${horaInicio} - ${horaFin}` : obtenerDato(cita.hora, "Horario no definido");
            const precio = obtenerDato(cita.precio, "Precio no informado");
            const estadoVisible = obtenerEtiquetaEstadoCita(estadoNorm);
            const esActual = ["pendiente", "reservada", "pago_realizado"].includes(estadoNorm)
                || (estadoNorm === "concluida" && puedeResenar);

            citas.push({
                citaId,
                servicioId,
                tecnicoId,
                servicio,
                tecnico,
                dia,
                horario,
                precio,
                estadoNorm,
                estadoVisible,
                puedeResenar,
                yaResenada,
                validacionResenaDisponible,
                esActual,
                fechaOrden: obtenerTimestampCita(cita)
            });
        }

        citas.sort((a, b) => b.fechaOrden - a.fechaOrden);

        const actuales = citas.filter((cita) => cita.esActual);
        const historicas = citas.filter((cita) => !cita.esActual);

        lista.innerHTML = "";
        if (actuales.length === 0) {
            lista.innerHTML = '<p class="citas-vacias">No tienes citas activas por ahora. Las citas cerradas quedan disponibles en el historial.</p>';
        } else {
            actuales.forEach((cita) => {
                const card = crearCardCitaCliente(cita);
                lista.appendChild(card);
                conectarAccionesCitaCliente(card, cita, uidCliente);
            });
        }

        if (historialLista && historial && btnToggleHistorial) {
            historialLista.innerHTML = "";
            historicas.forEach((cita) => {
                const card = document.createElement("article");
                card.className = "historial-cita-card";
                card.innerHTML = `
                    <strong>${cita.servicio}</strong>
                    <span>${cita.tecnico}</span>
                    <b>${cita.estadoVisible}</b>
                `;
                historialLista.appendChild(card);
            });

            if (historicas.length === 0) {
                historialLista.innerHTML = '<p class="historial-vacio">Aun no hay citas cerradas para mostrar.</p>';
            }

            if (historialResumen) {
                historialResumen.textContent = `${historicas.length} registros`;
            }

            btnToggleHistorial.hidden = false;
            btnToggleHistorial.textContent = "Ver historial";
            btnToggleHistorial.onclick = () => {
                historial.hidden = !historial.hidden;
                btnToggleHistorial.textContent = historial.hidden ? "Ver historial" : "Ocultar historial";
            };
        }

        return true;
    }

    function crearCardCitaCliente(cita) {
        const accionResena = cita.puedeResenar
            ? `<a href="resenasTec.html?citaId=${encodeURIComponent(cita.citaId)}&servicioId=${encodeURIComponent(cita.servicioId)}&tecnicoId=${encodeURIComponent(cita.tecnicoId)}" class="btn-link btn-reservar">Reseñar</a>`
            : cita.yaResenada
                ? `<span class="btn-link" aria-disabled="true">Ya reseñado</span>`
                : cita.estadoNorm === "concluida" && !cita.validacionResenaDisponible
                    ? `<span class="btn-link" aria-disabled="true">Reseña no disponible</span>`
                    : "";
        const accionPago = cita.estadoNorm === "reservada"
            ? `<button type="button" class="btn-link btn-pagar-cita">${PAYMENT_MODE === "demo" ? "Pagar Cita (demo)" : "Pagar Cita"}</button>`
            : "";
        const accionCancelar = cita.estadoNorm === "reservada" && !fechaEsHoyOPasada(cita.dia)
            ? `<button type="button" class="btn-link btn-cancelar-cita" data-cita-fecha="${cita.dia}">Cancelar Cita</button>`
            : "";
        const accionReembolso = cita.estadoNorm === "pago_realizado"
            ? `<button type="button" class="btn-link btn-reembolso-cita">Solicitar Reembolso</button>`
            : "";
        const card = document.createElement("div");
        card.className = "dato cita-card";

        card.innerHTML = `
            <strong>${cita.servicio}</strong>
            <div class="cita-meta">
                <p><span>Tecnico</span><b>${cita.tecnico}</b></p>
                <p><span>Fecha</span><b>${cita.dia}</b></p>
                <p><span>Horario</span><b>${cita.horario}</b></p>
                <p><span>Precio</span><b>${cita.precio === "Precio no informado" ? cita.precio : `$${cita.precio}`}</b></p>
                <p><span>Estado</span><b>${cita.estadoVisible}</b></p>
            </div>
            ${crearTimelineEstado(cita.estadoNorm)}
            <div class="cita-acciones" style="display:flex; flex-wrap:wrap; gap:8px;">
                ${accionPago}
                ${accionCancelar}
                ${accionReembolso}
                ${accionResena}
            </div>
        `;

        return card;
    }

    function conectarAccionesCitaCliente(card, cita, uidCliente) {
        const btnPagar = card.querySelector(".btn-pagar-cita");
        const btnCancelar = card.querySelector(".btn-cancelar-cita");
        const btnReembolso = card.querySelector(".btn-reembolso-cita");

        if (btnPagar) {
            btnPagar.addEventListener("click", async () => {
                btnPagar.disabled = true;
                btnPagar.textContent = "Procesando...";
                try {
                    if (PAYMENT_MODE === "demo") {
                        const response = await apiFetch(`${API_URL}/citas/${cita.citaId}/registrar-pago-demo`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" }
                        });

                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.detail || "Error al registrar el pago demo.");
                        }

                        await cargarCitasCliente(uidCliente);
                        await cargarBadgeCitasReservadas(uidCliente);
                        return;
                    }

                    const response = await apiFetch(`${API_URL}/payments/create_preference/${cita.citaId}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || "Error al crear la preferencia de pago.");
                    }

                    const data = await response.json();
                    const checkoutUrl = data.init_point || data.sandbox_init_point;
                    if (!checkoutUrl) throw new Error("El backend no devolvio una URL de pago.");

                    window.location.href = checkoutUrl;
                } catch (error) {
                    console.log("Error al registrar pago:", error);
                    alert(error.message || "No se pudo iniciar el pago. Intenta nuevamente.");
                    btnPagar.disabled = false;
                    btnPagar.textContent = PAYMENT_MODE === "demo" ? "Pagar Cita (demo)" : "Pagar Cita";
                }
            });
        }

        if (btnCancelar) {
            btnCancelar.addEventListener("click", async () => {
                if (fechaEsHoyOPasada(btnCancelar.dataset.citaFecha || "")) {
                    alert("No puedes cancelar una cita para el mismo dia o con fecha pasada.");
                    return;
                }

                const confirmar = window.confirm("¿Estas seguro de que deseas cancelar esta cita? Esta accion no se puede deshacer.");
                if (!confirmar) return;

                btnCancelar.disabled = true;
                btnCancelar.textContent = "Cancelando...";

                try {
                    const response = await apiFetch(`${API_URL}/citas/${cita.citaId}/cancelar-cliente`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || "Error al cancelar la cita.");
                    }

                    await cargarCitasCliente(uidCliente);
                    await cargarBadgeCitasReservadas(uidCliente);
                } catch (error) {
                    console.log("Error al cancelar cita:", error);
                    alert(error.message || "No se pudo cancelar la cita. Intenta nuevamente.");
                    btnCancelar.disabled = false;
                    btnCancelar.textContent = "Cancelar Cita";
                }
            });
        }

        if (btnReembolso) {
            btnReembolso.addEventListener("click", async () => {
                const confirmar = window.confirm("¿Deseas solicitar un reembolso por esta cita? Tu solicitud sera revisada por el equipo.");
                if (!confirmar) return;

                btnReembolso.disabled = true;
                btnReembolso.textContent = "Enviando solicitud...";

                try {
                    const response = await apiFetch(`${API_URL}/citas/${cita.citaId}/solicitar-reembolso`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" }
                    });

                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.detail || "Error al solicitar el reembolso.");
                    }

                    await cargarCitasCliente(uidCliente);
                } catch (error) {
                    console.log("Error al solicitar reembolso:", error);
                    alert(error.message || "No se pudo enviar la solicitud. Intenta nuevamente.");
                    btnReembolso.disabled = false;
                    btnReembolso.textContent = "Solicitar Reembolso";
                }
            });
        }
    }

    async function cargarCitasCliente(uidCliente) {
        const lista = document.getElementById("listaCitasCliente");

        if (!lista) return;

        if (await cargarCitasClienteOrdenadas(uidCliente, lista)) return;

        lista.innerHTML = "<p>Cargando tus citas...</p>";

        try {
            const consulta = query(
                collection(db, "citas"),
                where("idCliente", "==", uidCliente)
            );

            const resultado = await getDocs(consulta);

            if (resultado.empty) {
                lista.innerHTML = "<p>Aun no tienes citas registradas.</p>";
                return;
            }

            lista.innerHTML = "";

            for (const docCita of resultado.docs) {
                const cita = docCita.data();
                const citaId = docCita.id;
                const servicioId = cita.idServicio || "";
                const tecnicoId = cita.idTecnico || "";
                const faltanDatosResena = !citaId || !servicioId || !tecnicoId;

                const obtenerDato = (valor, fallback) => {
                    if (valor === undefined || valor === null || String(valor).trim() === "") {
                        return fallback;
                    }
                    return String(valor).trim();
                };

                // Compatibilidad con citas creadas desde el frontend (cita.servicio)
                // y citas creadas desde el backend Python (cita.tituloServicio)
                const servicio = obtenerDato(cita.tituloServicio, obtenerDato(cita.servicio, "Servicio no especificado"));

                // Compatibilidad: el backend guarda solo idTecnico, sin nombre
                const tecnico = obtenerDato(cita.tecnico, obtenerDato(cita.idTecnico, "Tecnico no asignado"));

                const dia = obtenerDato(cita.dia, obtenerDato(cita.fecha, "Fecha no definida"));
                const horaInicio = obtenerDato(cita.horaInicio, "");
                const horaFin = obtenerDato(cita.horaFin, "");
                const horario = horaInicio && horaFin ? `${horaInicio} - ${horaFin}` : obtenerDato(cita.hora, "Horario no definido");
                const precio = obtenerDato(cita.precio, "Precio no informado");
                const estadoNorm = String(cita.estado || "").toLowerCase().trim();
                const estadoVisible = obtenerEtiquetaEstadoCita(estadoNorm);

                let yaResenada = false;
                let puedeResenar = false;
                let validacionResenaDisponible = true;
                if (estadoNorm === "concluida" && !faltanDatosResena) {
                    try {
                        const response = await apiFetch(`${API_URL}/reviews/verificar_resena/${encodeURIComponent(citaId)}`);
                        if (!response.ok) throw new Error("No se pudo validar la reseña");
                        const validacion = await response.json();
                        yaResenada = Boolean(validacion.posee_resena);
                        puedeResenar = Boolean(validacion.puede_resenar);
                    } catch (error) {
                        validacionResenaDisponible = false;
                        console.warn("No se pudo validar si la cita admite reseña:", error);
                    }
                }

                const accionResena = puedeResenar
                    ? `<a href="resenasTec.html?citaId=${encodeURIComponent(citaId)}&servicioId=${encodeURIComponent(servicioId)}&tecnicoId=${encodeURIComponent(tecnicoId)}" class="btn-link btn-reservar">
                        Reseñar
                    </a>`
                    : yaResenada
                        ? `<span class="btn-link" aria-disabled="true">Ya reseñado</span>`
                        : estadoNorm === "concluida" && !validacionResenaDisponible
                            ? `<span class="btn-link" aria-disabled="true">Reseña no disponible</span>`
                            : "";

                // Botón "Pagar Cita" solo cuando el estado es "reservada"
                const accionPago = estadoNorm === "reservada"
                    ? `<button type="button" class="btn-link btn-pagar-cita" data-cita-id="${citaId}">
                        ${PAYMENT_MODE === "demo" ? "Pagar Cita (demo)" : "Pagar Cita"}
                    </button>`
                    : "";

                // Botón "Cancelar Cita" para citas en estado "pendiente" o "reservada"
                const puedeCancelar = estadoNorm === "reservada" && !fechaEsHoyOPasada(dia);
                const accionCancelar = puedeCancelar
                    ? `<button type="button" class="btn-link btn-cancelar-cita" data-cita-id="${citaId}" data-cita-fecha="${dia}">
                        Cancelar Cita
                    </button>`
                    : "";

                // Botón "Solicitar Reembolso" para citas en estado "pago_realizado"
                const accionReembolso = estadoNorm === "pago_realizado"
                    ? `<button type="button" class="btn-link btn-reembolso-cita" data-cita-id="${citaId}" data-cita-fecha="${dia}">
                        Solicitar Reembolso
                    </button>`
                    : "";

                const card = document.createElement("div");
                card.className = "dato cita-card";

                card.innerHTML = `
                    <strong>${servicio}</strong>
                    <div class="cita-meta">
                        <p><span>Tecnico</span><b>${tecnico}</b></p>
                        <p><span>Fecha</span><b>${dia}</b></p>
                        <p><span>Horario</span><b>${horario}</b></p>
                        <p><span>Precio</span><b>${precio === "Precio no informado" ? precio : `$${precio}`}</b></p>
                        <p><span>Estado</span><b>${estadoVisible}</b></p>
                    </div>
                    ${crearTimelineEstado(estadoNorm)}
                    <div class="cita-acciones" style="display:flex; flex-wrap:wrap; gap:8px;">
                        ${accionPago}
                        ${accionCancelar}
                        ${accionReembolso}
                        ${accionResena}
                    </div>
                `;

                // Lógica del botón Pagar Cita
                if (estadoNorm === "reservada") {
                    const btnPagar = card.querySelector(".btn-pagar-cita");
                    if (btnPagar) {
                        btnPagar.addEventListener("click", async () => {
                            btnPagar.disabled = true;
                            btnPagar.textContent = "Procesando...";
                            try {
                                if (PAYMENT_MODE === "demo") {
                                    const response = await apiFetch(`${API_URL}/citas/${citaId}/registrar-pago-demo`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" }
                                    });

                                    if (!response.ok) {
                                        const errorData = await response.json().catch(() => ({}));
                                        throw new Error(errorData.detail || "Error al registrar el pago demo.");
                                    }

                                    await cargarCitasCliente(uidCliente);
                                    await cargarBadgeCitasReservadas(uidCliente);
                                    return;
                                }

                                const response = await apiFetch(`${API_URL}/payments/create_preference/${citaId}`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" }
                                });

                                if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({}));
                                    throw new Error(errorData.detail || "Error al crear la preferencia de pago.");
                                }

                                const data = await response.json();
                                const checkoutUrl = data.init_point || data.sandbox_init_point;
                                if (!checkoutUrl) throw new Error("El backend no devolvió una URL de pago.");

                                window.location.href = checkoutUrl;
                            } catch (error) {
                                console.log("Error al registrar pago:", error);
                                alert(error.message || "No se pudo iniciar el pago. Intenta nuevamente.");
                                btnPagar.disabled = false;
                                btnPagar.textContent = PAYMENT_MODE === "demo" ? "Pagar Cita (demo)" : "Pagar Cita";
                            }
                        });
                    }
                }

                // Lógica del botón Cancelar Cita
                if (puedeCancelar) {
                    const btnCancelar = card.querySelector(".btn-cancelar-cita");
                    if (btnCancelar) {
                        btnCancelar.addEventListener("click", async () => {
                            // Validar que la fecha de la cita no sea hoy ni anterior (en el cliente)
                            if (fechaEsHoyOPasada(btnCancelar.dataset.citaFecha || "")) {
                                alert("No puedes cancelar una cita para el mismo día o con fecha pasada.");
                                return;
                            }

                            const confirmar = window.confirm("¿Estás seguro de que deseas cancelar esta cita? Esta acción no se puede deshacer.");
                            if (!confirmar) return;

                            btnCancelar.disabled = true;
                            btnCancelar.textContent = "Cancelando...";

                            try {
                                const response = await apiFetch(`${API_URL}/citas/${citaId}/cancelar-cliente`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" }
                                });

                                if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({}));
                                    throw new Error(errorData.detail || "Error al cancelar la cita.");
                                }

                                await cargarCitasCliente(uidCliente);
                                await cargarBadgeCitasReservadas(uidCliente);
                            } catch (error) {
                                console.log("Error al cancelar cita:", error);
                                alert(error.message || "No se pudo cancelar la cita. Intenta nuevamente.");
                                btnCancelar.disabled = false;
                                btnCancelar.textContent = "Cancelar Cita";
                            }
                        });
                    }
                }

                // Lógica del botón Solicitar Reembolso
                if (estadoNorm === "pago_realizado") {
                    const btnReembolso = card.querySelector(".btn-reembolso-cita");
                    if (btnReembolso) {
                        btnReembolso.addEventListener("click", async () => {
                            const confirmar = window.confirm("¿Deseas solicitar un reembolso por esta cita? Tu solicitud será revisada por el equipo.");
                            if (!confirmar) return;

                            btnReembolso.disabled = true;
                            btnReembolso.textContent = "Enviando solicitud...";

                            try {
                                const response = await apiFetch(`${API_URL}/citas/${citaId}/solicitar-reembolso`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" }
                                });

                                if (!response.ok) {
                                    const errorData = await response.json().catch(() => ({}));
                                    throw new Error(errorData.detail || "Error al solicitar el reembolso.");
                                }

                                await cargarCitasCliente(uidCliente);
                            } catch (error) {
                                console.log("Error al solicitar reembolso:", error);
                                alert(error.message || "No se pudo enviar la solicitud. Intenta nuevamente.");
                                btnReembolso.disabled = false;
                                btnReembolso.textContent = "Solicitar Reembolso";
                            }
                        });
                    }
                }

                lista.appendChild(card);
            }

        } catch (error) {
            console.log("Error al cargar citas:", error);
            lista.innerHTML = "<p>No se pudieron cargar tus citas. Intenta nuevamente.</p>";
        }
    }

});
