import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    doc,
    getDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {

    let datosUsuarioActual = null;

    verificarCitasExpiradasSilencioso();   // Verificar citas expiradas al cargar el panel, sin mostrar errores al usuario en caso de fallo

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
                        await deleteDoc(doc(db, "servicios", docServicio.id));
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
                        await updateDoc(doc(db, "servicios", docServicio.id), {
                            nombre: nuevoTitulo,
                            titulo: nuevoTitulo
                        });

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

        const btnConfirmarReserva = document.getElementById("btnConfirmarReserva");

        if (btnConfirmarReserva) {
            btnConfirmarReserva.addEventListener("click", () => {
                crearReservaCliente(uidCliente);
            });
        }

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

    async function crearReservaCliente(uidCliente) {
        const mensajeReserva = document.getElementById("mensajeReserva");

        if (!mensajeReserva) return;

        const params = new URLSearchParams(window.location.search);

        const servicio = params.get("servicio") || "Servicio seleccionado";
        const tecnico = params.get("tecnico") || "Tecnico seleccionado";
        const precio = params.get("precio") || "0";
        const idTecnico = params.get("idTecnico") || "sin-id-tecnico";
        const idServicio = params.get("idServicio") || "sin-id-servicio";

        const horarioSeleccionado = document.querySelector("input[name='horarioSeleccionado']:checked");

        if (!horarioSeleccionado) {
            mensajeReserva.textContent = "Selecciona un horario disponible.";
            return;
        }

        const [dia, inicio, fin] = horarioSeleccionado.value.split("|");

        try {
            await addDoc(collection(db, "citas"), {
                idCliente: uidCliente,
                idTecnico: idTecnico,
                idServicio: idServicio,
                servicio: servicio,
                tecnico: tecnico,
                precio: Number(precio),
                dia: dia,
                horaInicio: inicio,
                horaFin: fin,
                estado: "pendiente",
                createdAt: new Date()
            });

            mensajeReserva.textContent = "Reserva creada correctamente.";
            cargarCitasCliente(uidCliente);

        } catch (error) {
            console.log(error);
            mensajeReserva.textContent = "Error al crear la reserva.";
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
        const obtenerDatoReporte = (...valores) => {
            const valor = valores.find((item) => item !== undefined && item !== null && String(item).trim() !== "");
            return valor !== undefined ? String(valor).trim() : "";
        };
        const nombreCliente = obtenerDatoReporte(
            [datosUsuarioActual?.nombres || datosUsuarioActual?.nombre, datosUsuarioActual?.apellidos || datosUsuarioActual?.apellido]
                .filter((item) => item !== undefined && item !== null && String(item).trim() !== "")
                .join(" "),
            datosUsuarioActual?.displayName,
            user?.displayName
        ) || "Cliente";
        const correoCliente = obtenerDatoReporte(
            datosUsuarioActual?.email,
            datosUsuarioActual?.correo,
            user?.email
        ) || "No registrado";

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
            await addDoc(collection(db, "reportes"), {
                idCliente: uidCliente,
                tipoReporte: tipo,
                tecnicoRelacionado: tecnico,
                descripcion: descripcion,
                mensaje: descripcion,
                nombreCliente: nombreCliente,
                correoCliente: correoCliente,
                fecha: new Date(),
                estado: "pendiente"
            });

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
                where("idCliente", "==", uidCliente)
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

    async function cargarBadgeCitasReservadas(uidCliente) {
        // Eliminar badge previo del DOM (para el caso de refrescos tras un pago)
        document.getElementById("badgeCitasReservadas")?.remove();

        const heading = document.querySelector(".citas-section .section-heading h2");
        if (!heading) return;

        try {
            const URL_API = window.API_BASE_URL
                ? `${window.API_BASE_URL}/citas/notificaciones/cliente/${uidCliente}/reservadas`
                : `http://localhost:8000/citas/notificaciones/cliente/${uidCliente}/reservadas`;

            const response = await fetch(URL_API);
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

    async function cargarCitasCliente(uidCliente) {
        const lista = document.getElementById("listaCitasCliente");

        if (!lista) return;

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

            resultado.forEach((docCita) => {
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
                const estado = obtenerDato(cita.estado, "pendiente");
                const estadoNorm = estado.toLowerCase().trim();

                if (faltanDatosResena) {
                    console.warn("Cita sin datos suficientes para valorar servicio", {
                        citaId,
                        servicioId,
                        tecnicoId,
                        cita
                    });
                }

                const accionResena = faltanDatosResena
                    ? `<button type="button" class="btn-link btn-reservar" disabled style="opacity:0.65; cursor:not-allowed;">
                        Valoracion no disponible
                    </button>`
                    : `<a href="resenasTec.html?citaId=${encodeURIComponent(citaId)}&servicioId=${encodeURIComponent(servicioId)}&tecnicoId=${encodeURIComponent(tecnicoId)}" class="btn-link btn-reservar">
                        Valorar servicio
                    </a>`;

                // Botón "Pagar Cita" solo cuando el estado es "reservada"
                const accionPago = estadoNorm === "reservada"
                    ? `<button type="button" class="btn-link btn-pagar-cita" data-cita-id="${citaId}">
                        Pagar Cita
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
                        <p><span>Estado</span><b>${estado}</b></p>
                    </div>
                    <div class="cita-acciones">
                        ${accionPago}
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
                                await updateDoc(doc(db, "citas", citaId), {
                                    estado: "pago_realizado",
                                    pagadoEn: new Date()
                                });
                                // Refrescar la lista y el badge para reflejar el nuevo estado
                                await cargarCitasCliente(uidCliente);
                                await cargarBadgeCitasReservadas(uidCliente);
                            } catch (error) {
                                console.log("Error al registrar pago:", error);
                                btnPagar.disabled = false;
                                btnPagar.textContent = "Pagar Cita";
                            }
                        });
                    }
                }

                lista.appendChild(card);
            });

        } catch (error) {
            console.log("Error al cargar citas:", error);
            lista.innerHTML = "<p>No se pudieron cargar tus citas. Intenta nuevamente.</p>";
        }
    }

});

/**
 * Ejecuta una actualización silenciosa de los estados de las citas vencidas.
 * Utiliza localStorage para asegurarse de que solo se llame una vez al día por usuario,
 * sin importar cuántas pestañas tenga abiertas.
 */
async function verificarCitasExpiradasSilencioso() {
    // 1. Obtener la fecha local de hoy en formato YYYY-MM-DD
    const hoy = new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }).split('-').reverse().join('-'); 
    // Nota: El split/reverse adapta el formato según cómo devuelva el string tu región local, 
    // una alternativa limpia es: new Date().toISOString().split('T')[0];

    const fechaHoyFormateada = new Date().toISOString().split('T')[0];
    const ultimaVerificacion = localStorage.getItem('backend_cron_citas_fecha');

    // 2. Si ya se ejecutó con éxito el día de hoy, saltar la petición
    if (ultimaVerificacion === fechaHoyFormateada) {
        console.log('[Sistema] Los estados de las citas ya están sincronizados hoy.');
        return;
    }

    try {
        // 3. Cambia esto por tu URL real de producción cuando corresponda
        const URL_API = 'http://localhost:8000/citas/cron/verificar-fechas-citas'; 

        // Al ser un fetch silencioso, no bloqueamos la UI con loaders o spinners
        const response = await fetch(URL_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`[Cron Silencioso] Éxito: ${data.message}`);
            
            // Guardamos en el almacenamiento del navegador que hoy ya se cumplió la tarea
            localStorage.setItem('backend_cron_citas_fecha', fechaHoyFormateada);
        } else {
            // Error de respuesta del servidor (ej: 500), no guardamos en localStorage para reintentar luego
            console.warn('[Cron Silencioso] El servidor respondió con un error al procesar fechas.');
        }

    } catch (error) {
        // Al ser silencioso, capturamos el error en consola para desarrollo sin interrumpir al cliente
        console.error('[Cron Silencioso] Error de red o servidor caído:', error);
    }
}