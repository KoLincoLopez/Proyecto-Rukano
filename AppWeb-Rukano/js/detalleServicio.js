// ─── IMPORTS DE FIREBASE (igual que en index.js) ───
import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── CONFIGURACIÓN DEL BACKEND ───
const API_URL = "http://127.0.0.1:8000";

// ─── ESTADO GLOBAL DEL USUARIO (llenado por Firebase) ───
let usuarioLogueado = null;   // objeto User de Firebase Auth
let datosUsuario     = null;   // documento Firestore del usuario
let idTecnicoActual  = null;   // idTecnico del servicio cargado, lo usa el calendario

// ─── MANEJO DE MODALES ───
function openModal() {
    if (!usuarioLogueado) return;
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    // Inicializar el calendario cada vez que se abre el modal (limpia selección anterior)
    initCalendario(idTecnicoActual);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
        document.getElementById('modal-form-content').classList.remove('hidden');
        document.getElementById('modal-success').classList.remove('show');
    }, 300);
}

function closeModalOutside(e) {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
}

// ─── BOTONES SÍ/NO (PREGUNTAS DEL MODAL) ───
function selectBool(identificador, val, btn) {
    const group = btn.parentElement;
    group.querySelectorAll('.fq-bool-btn').forEach(b => {
        b.classList.remove('active', 'selected');
    });
    btn.classList.add('active', 'selected');
    const input = typeof identificador === 'string'
        ? document.getElementById(identificador)
        : identificador;
    if (input) input.value = val;
}

// ─── FUNCIÓN QUE APLICA EL ESTADO VISUAL SEGÚN SESIÓN ───
// Reemplaza el viejo applyLoginState() / toggleLogin()
function aplicarEstadoSesion(logueado) {
    document.body.classList.toggle('logged-in', logueado);

    const reportBtn = document.getElementById('btn-report');
    if (reportBtn) {
        reportBtn.disabled = !logueado;
        reportBtn.classList.toggle('disabled', !logueado);
        reportBtn.setAttribute('aria-disabled', (!logueado).toString());
        // Tooltip que explica el estado al usuario sin sesión
        reportBtn.title = logueado ? "" : "Inicia sesión para reportar este servicio";
    }
}

// ─── PUNTO DE ENTRADA PRINCIPAL ───
document.addEventListener("DOMContentLoaded", () => {

    const urlParams  = new URLSearchParams(window.location.search);
    const servicioId = urlParams.get("id");

    if (!servicioId) {
        alert("No se especificó un ID de servicio en la URL.");
        return;
    }

    if (typeof initSchedule === "function") initSchedule();

    // ── OBSERVADOR DE ESTADO DE FIREBASE (igual que en index.js) ──
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            usuarioLogueado = user;

            try {
                const userRef  = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    datosUsuario = userSnap.data();

                    // ── RENDERIZADO DEL NAVBAR CON DATOS REALES ──
                    const authContainer = document.getElementById("auth-container");
                    if (authContainer) {
                        authContainer.innerHTML = `
                            <div class="perfil-nav-container">
                                <div class="usuario-badge">
                                    <span class="usuario-inicial">${escapeHtml(datosUsuario.nombre.charAt(0).toUpperCase())}</span>
                                    <span class="usuario-nombre">${escapeHtml(datosUsuario.nombre.toUpperCase())}</span>
                                </div>
                                <a href="panelCliente.html" class="btn-perfil-nav">MI PERFIL</a>
                            </div>
                        `;
                    }

                    // ── ACTUALIZAR EL user-chip DEL NAV (el que ya existe en el HTML) ──
                    const userChip = document.querySelector('.user-chip');
                    if (userChip) {
                        const avatarEl = userChip.querySelector('.user-avatar-sm');
                        const nombreEl = userChip.querySelector('span:last-child');
                        if (avatarEl) avatarEl.textContent = datosUsuario.nombre.charAt(0).toUpperCase();
                        if (nombreEl) nombreEl.textContent = datosUsuario.nombre;
                        userChip.style.display = 'flex';
                    }

                    // ── OCULTAR BOTÓN "INICIAR SESIÓN" DEL NAV ──
                    const btnSesion = document.querySelector('.btn-nav-sesion');
                    if (btnSesion) btnSesion.style.display = 'none';

                } else {
                    console.warn("Usuario en Auth pero sin documento en Firestore.");
                }

            } catch (error) {
                console.error("Error al obtener datos del usuario:", error);
            }

            aplicarEstadoSesion(true);

        } else {
            // Sin sesión: limpiamos estado
            usuarioLogueado = null;
            datosUsuario    = null;

            // Restaurar nav a estado "sin sesión"
            const userChip = document.querySelector('.user-chip');
            if (userChip) userChip.style.display = 'none';

            const btnSesion = document.querySelector('.btn-nav-sesion');
            if (btnSesion) btnSesion.style.display = '';

            aplicarEstadoSesion(false);
        }

        // La carga del servicio ocurre siempre (logueado o no),
        // pero los botones de acción quedan bloqueados por CSS si no hay sesión.
        cargarDetalleServicio(servicioId);
    });
});


// ─── CARGA DINÁMICA DESDE EL BACKEND ───
async function cargarDetalleServicio(idServicio) {
    try {
        const response = await fetch(`${API_URL}/servicios/${idServicio}`);
        if (!response.ok) throw new Error("Servicio no encontrado.");

        const servicio = await response.json();

        // 1. SECCIÓN PRINCIPAL (HERO)
        setTxt("servicio-categoria", servicio.categoria);
        setTxt("servicio-nombre",    servicio.nombre);
        setTxt("servicio-comuna",    servicio.comuna);
        setTxt("servicio-descripcion", servicio.descripcion);
        setTxt("servicio-precio",    `$${Number(servicio.precio).toLocaleString('es-CL')}`);

        const sidePrecio = document.getElementById("side-precio");
        if (sidePrecio) sidePrecio.textContent = Number(servicio.precio).toLocaleString('es-CL');

        const breadCategoria = document.getElementById("bread-categoria");
        if (breadCategoria) breadCategoria.textContent = servicio.categoria;

        const breadNombre = document.getElementById("bread-nombre");
        if (breadNombre) breadNombre.textContent = servicio.nombre;

        const finalPrecio = document.getElementById("final-precio");
        if (finalPrecio) finalPrecio.textContent = Number(servicio.precio).toLocaleString('es-CL');

        const sideComuna = document.getElementById("side-comuna");
        if (sideComuna) sideComuna.textContent = servicio.comuna;

        const sideTiempo = document.getElementById("side-tiempo");
        if (sideTiempo) {
            const horas = Number(servicio.tiempoEstimado);
            sideTiempo.textContent = horas === 1 ? "1 Hora" : `${horas} Horas`;
        }

        if (document.getElementById("servicio-tiempo")) {
            const horas = Number(servicio.tiempoEstimado);
            document.getElementById("servicio-tiempo").textContent =
                horas === 1 ? "1 Hora" : `${horas} Horas`;
        }

        // 2. SIDE-CARD
        setTxt("side-precio", Number(servicio.precio).toLocaleString('es-CL'));
        setTxt("side-comuna", servicio.comuna);

        if (document.getElementById("side-tiempo")) {
            const horasSide = Number(servicio.tiempoEstimado);
            document.getElementById("side-tiempo").textContent =
                horasSide === 1 ? "1 Hora" : `${horasSide} Horas`;
        }

        // 3. TEXTOS DEL MODAL
        setTxt("modal-servicio-titulo",  servicio.nombre);
        setTxt("modal-servicio-detalles",
            `$${Number(servicio.precio).toLocaleString('es-CL')} · ${servicio.comuna}`);

        if (servicio.idTecnico) {
            idTecnicoActual = servicio.idTecnico; // guardado para el calendario
            await cargarDatosTecnico(servicio.idTecnico);
        }

        // Precargar el formulario dinámico (las preguntas del técnico)
        renderFormularioDinamico(servicio.esquema_formulario);
        renderLista("servicio-no-incluye", servicio.que_no_incluye);

    } catch (error) {
        console.error("Error cargando servicio:", error);
    }
}

async function cargarDatosTecnico(idTecnico) {
    try {
        const response = await fetch(`${API_URL}/users/usuario/publico/${idTecnico}`);
        if (!response.ok) throw new Error("No se pudo obtener el perfil del técnico.");

        const resultado = await response.json();

        if (resultado.status === "success" && resultado.usuario) {
            const tecnico = resultado.usuario;

            setTxt("tecnico-nombre",       `${tecnico.nombre} ${tecnico.apellido}`);
            setTxt("tecnico-especialidad", tecnico.especialidad || "Técnico Profesional");
            setTxt("tecnico-comuna",       tecnico.comuna);
            setTxt("tecnico-calificacion", Number(tecnico.calificacion_promedio || 0).toFixed(1));
            setTxt("tecnico-reviews",      `${tecnico.cantidad_reseñas || 0} reseñas`);

            const sideNombre = document.getElementById("side-nombre");
            if (sideNombre) sideNombre.textContent = `${tecnico.nombre} ${tecnico.apellido}`;

            const finalNombre = document.getElementById("final-nombre");
            if (finalNombre) finalNombre.textContent = `${tecnico.nombre} ${tecnico.apellido}`;

            const finalNombre2 = document.getElementById("final-nombre-2");
            if (finalNombre2) finalNombre2.textContent = `${tecnico.nombre} ${tecnico.apellido}`;

            const sideCalificacion = document.getElementById("side-calificacion");
            if (sideCalificacion) sideCalificacion.textContent =
                Number(tecnico.calificacion_promedio || 0).toFixed(1);

            const sideCalificacion2 = document.getElementById("side-calificacion-2");
            if (sideCalificacion2) sideCalificacion2.textContent =
                Number(tecnico.calificacion_promedio || 0).toFixed(1);

            const sideComunaTecnico = document.getElementById("side-tecnico-comuna");
            if (sideComunaTecnico) sideComunaTecnico.textContent = tecnico.comuna;

            const avatar = document.getElementById("tecnico-avatar");
            if (avatar && tecnico.foto_perfil) avatar.src = tecnico.foto_perfil;
        }
    } catch (error) {
        console.error("Error cargando técnico:", error);
    }
}

// ─── PROCESAR CONTRATACIÓN — envía al backend /citas/reservar ───
async function procesarContratacion() {
    if (!usuarioLogueado) {
        alert("Debes iniciar sesión para contratar un servicio.");
        return;
    }

    // 1. Validar fecha y hora seleccionadas
    const fecha = document.getElementById('selectedDate')?.value;
    const hora  = document.getElementById('selectedTime')?.value;

    if (!fecha) { mostrarWarningBooking("Selecciona una fecha antes de continuar."); return; }
    if (!hora)  { mostrarWarningBooking("Selecciona un horario antes de continuar."); return; }

    // 2. Validar preguntas del formulario dinámico
    const respuestasCliente = obtenerRespuestasFormulario();
    if (!respuestasCliente) return; // checkValidity() ya mostró el error nativo

    // Separar los campos de agenda de las respuestas del técnico
    // (fecha_agenda y hora_agenda vienen del form pero ya los tenemos en las vars)
    delete respuestasCliente.fecha_agenda;
    delete respuestasCliente.hora_agenda;

    const urlParams  = new URLSearchParams(window.location.search);
    const servicioId = urlParams.get("id");

    // 3. Payload exacto que espera ReservaCita del backend
    const payload = {
        idServicio:            servicioId,
        idCliente:             usuarioLogueado.uid,
        fecha:                 fecha,          // "YYYY-MM-DD"
        hora:                  hora,           // "HH:MM"
        respuestas_formulario: respuestasCliente,
    };

    // 4. Deshabilitar botón para evitar doble submit
    const btnEnviar = document.getElementById('btn-enviar-solicitud');
    if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.textContent = "Enviando..."; }

    try {
        const response = await fetch(`${API_URL}/citas/reservar`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });

        const resultado = await response.json();

        if (!response.ok) {
            throw new Error(resultado.detail || `Error ${response.status}`);
        }

        // 5. Éxito
        document.getElementById('modal-form-content').classList.add('hidden');
        document.getElementById('modal-success').classList.add('show');

    } catch (error) {
        console.error("Error al reservar cita:", error);
        mostrarWarningBooking(`No se pudo reservar: ${error.message}`);
    } finally {
        if (btnEnviar) {
            btnEnviar.disabled  = false;
            btnEnviar.innerHTML = `<i class="ti ti-send icon-btn"></i> Enviar solicitud`;
        }
    }
}

// ─── RECOLECCIÓN Y VALIDACIÓN DE RESPUESTAS ───
function obtenerRespuestasFormulario() {
    const formulario = document.getElementById("formulario-dinamico");
    if (!formulario) return {};

    if (!formulario.checkValidity()) {
        formulario.reportValidity();
        return null;
    }

    const formData   = new FormData(formulario);
    const respuestas = {};
    formData.forEach((value, key) => { respuestas[key] = value; });
    return respuestas;
}

// ─── WARNING DEL MODAL DE BOOKING ───
function mostrarWarningBooking(texto) {
    const w = document.getElementById('booking-warning');
    if (!w) return;
    w.textContent = texto;
    w.style.display = 'block';
    setTimeout(() => { w.style.display = 'none'; }, 5000);
}


// ════════════════════════════════════════════════════════════
//  MÓDULO DE CALENDARIO — agenda de citas
// ════════════════════════════════════════════════════════════

// Estado del calendario
const cal = {
    hoy:          new Date(),
    mesActual:    new Date(),       // mes visible en pantalla
    fechaElegida: null,             // Date del día seleccionado
    horaElegida:  null,             // string "HH:MM"
    idTecnico:    null,             // se llena al cargar el servicio
    horasOcupadas: [],              // respuesta del backend para la fecha elegida
};

// Horarios ofrecidos (08:00 a 18:00 cada hora)
const SLOTS_DIA = [
    "08:00","09:00","10:00","11:00",
    "12:00","13:00","14:00","15:00",
    "16:00","17:00","18:00"
];

const MESES_ES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

// ─── INICIALIZAR CALENDARIO (se llama cuando se abre el modal) ───
function initCalendario(idTecnico) {
    cal.idTecnico    = idTecnico;
    cal.mesActual    = new Date(cal.hoy.getFullYear(), cal.hoy.getMonth(), 1);
    cal.fechaElegida = null;
    cal.horaElegida  = null;
    cal.horasOcupadas = [];

    // Limpiar selección previa
    document.getElementById('selectedDate').value = "";
    document.getElementById('selectedTime').value = "";

    // Mostrar solo paso 1, ocultar 2 y 3
    document.getElementById('timeslot-section').style.display = 'none';
    document.getElementById('form-section').style.display     = 'none';
    document.getElementById('cal-selected-summary').style.display = 'none';
    document.getElementById('booking-warning').style.display  = 'none';

    renderCalendario();
}

// ─── NAVEGAR MES ───
function calNavMes(delta) {
    cal.mesActual = new Date(
        cal.mesActual.getFullYear(),
        cal.mesActual.getMonth() + delta,
        1
    );
    // Limpiar selección de día/hora al cambiar mes
    cal.fechaElegida = null;
    cal.horaElegida  = null;
    document.getElementById('selectedDate').value = "";
    document.getElementById('selectedTime').value = "";
    document.getElementById('timeslot-section').style.display = 'none';
    document.getElementById('form-section').style.display     = 'none';
    document.getElementById('cal-selected-summary').style.display = 'none';

    renderCalendario();
}

// ─── RENDERIZAR GRILLA DEL MES ───
function renderCalendario() {
    const grid  = document.getElementById('cal-grid');
    const label = document.getElementById('cal-mes-label');
    if (!grid || !label) return;

    const anio = cal.mesActual.getFullYear();
    const mes  = cal.mesActual.getMonth();

    label.textContent = `${MESES_ES[mes]} ${anio}`;

    // Primer día del mes (0=Dom…6=Sab → ajustamos a Lun=0)
    const primerDia = new Date(anio, mes, 1);
    let offsetLunes = primerDia.getDay() - 1; // getDay() 0=Dom
    if (offsetLunes < 0) offsetLunes = 6;     // Domingo pasa a pos 6

    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    const hoyStr   = toDateStr(cal.hoy);
    const elegidaStr = cal.fechaElegida ? toDateStr(cal.fechaElegida) : null;

    let html = "";

    // Celdas vacías de relleno antes del día 1
    for (let i = 0; i < offsetLunes; i++) {
        html += `<div class="cal-cell empty"></div>`;
    }

    for (let d = 1; d <= diasEnMes; d++) {
        const fecha   = new Date(anio, mes, d);
        const fechaStr = toDateStr(fecha);
        const esPasado = fecha < new Date(hoyStr);          // días anteriores a hoy
        const esDomingo = fecha.getDay() === 0;             // domingos bloqueados
        const bloqueado = esPasado || esDomingo;
        const seleccionado = fechaStr === elegidaStr;

        const clases = [
            "cal-cell",
            bloqueado  ? "disabled"   : "available",
            seleccionado ? "selected" : "",
            fechaStr === hoyStr ? "today" : ""
        ].filter(Boolean).join(" ");

        html += `<div class="${clases}" 
                      ${bloqueado ? "" : `onclick="calSeleccionarDia('${fechaStr}')"`}
                      title="${bloqueado ? (esDomingo ? "Domingos no disponibles" : "Fecha pasada") : ""}">
                    ${d}
                 </div>`;
    }

    grid.innerHTML = html;
}

// ─── SELECCIONAR UN DÍA ───
async function calSeleccionarDia(fechaStr) {
    cal.fechaElegida = new Date(fechaStr + "T12:00:00"); // noon para evitar offset TZ
    cal.horaElegida  = null;
    document.getElementById('selectedDate').value = fechaStr;
    document.getElementById('selectedTime').value = "";

    // Actualizar resumen visual
    const summaryLabel = document.getElementById('selected-date-label');
    if (summaryLabel) {
        const [anio, mes, dia] = fechaStr.split("-");
        summaryLabel.textContent = `${dia} de ${MESES_ES[Number(mes) - 1]} de ${anio}`;
    }
    document.getElementById('cal-selected-summary').style.display = 'flex';

    // Re-renderizar para marcar la celda
    renderCalendario();

    // Mostrar sección de slots con estado de carga
    const slotSection = document.getElementById('timeslot-section');
    const slotNote    = document.getElementById('timeslot-note');
    const slotGrid    = document.getElementById('timeslot-grid');
    slotSection.style.display = 'block';
    slotNote.textContent = "Consultando disponibilidad...";
    slotGrid.innerHTML   = `<div class="slot-loading"><i class="ti ti-loader-2 spin"></i></div>`;

    // Ocultar paso 3 hasta que elijan hora
    document.getElementById('form-section').style.display = 'none';

    // Consultar horas ocupadas al backend
    await cargarHorasOcupadas(fechaStr);
}

// ─── CONSULTAR HORAS OCUPADAS AL BACKEND ───
async function cargarHorasOcupadas(fechaStr) {
    const slotNote = document.getElementById('timeslot-note');
    const slotGrid = document.getElementById('timeslot-grid');

    try {
        if (!cal.idTecnico) {
            cal.horasOcupadas = [];
        } else {
            const res  = await fetch(`${API_URL}/citas/horas_ocupadas/${cal.idTecnico}/${fechaStr}`);
            const data = await res.json();
            cal.horasOcupadas = data.horas_ocupadas || [];
        }
    } catch (e) {
        console.warn("No se pudo consultar horas ocupadas, mostrando todos los slots:", e);
        cal.horasOcupadas = [];
    }

    renderSlots();
    slotNote.textContent = cal.horasOcupadas.length > 0
        ? `${cal.horasOcupadas.length} horario(s) ya reservado(s) aparecen bloqueados.`
        : "Todos los horarios están disponibles para este día.";
}

// ─── RENDERIZAR SLOTS DE HORA ───
function renderSlots() {
    const grid = document.getElementById('timeslot-grid');
    if (!grid) return;

    grid.innerHTML = SLOTS_DIA.map(hora => {
        const ocupada     = cal.horasOcupadas.includes(hora);
        const seleccionada = hora === cal.horaElegida;
        const clases = [
            "timeslot-btn",
            ocupada      ? "ocupado"     : "libre",
            seleccionada ? "seleccionado" : ""
        ].filter(Boolean).join(" ");

        return `<button type="button"
                        class="${clases}"
                        ${ocupada ? "disabled title='Horario reservado'" : `onclick="calSeleccionarHora('${hora}')"`}>
                    ${hora}
                    ${ocupada ? '<i class="ti ti-lock icon-inline"></i>' : ""}
                </button>`;
    }).join("");
}

// ─── SELECCIONAR UN SLOT DE HORA ───
function calSeleccionarHora(hora) {
    cal.horaElegida = hora;
    document.getElementById('selectedTime').value = hora;

    // Re-renderizar slots para reflejar la selección
    renderSlots();

    // Mostrar paso 3 (preguntas del técnico)
    document.getElementById('form-section').style.display = 'block';

    // Scroll suave al formulario dentro del modal
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─── GENERACIÓN DEL FORMULARIO DINÁMICO (sólo preguntas del técnico) ───
// Nota: fecha y hora YA no van aquí, las maneja el calendario.
function renderFormularioDinamico(esquema) {
    const formContenedor = document.getElementById("formulario-dinamico");
    if (!formContenedor) return;

    formContenedor.innerHTML = "";

    if (!esquema || esquema.length === 0) {
        formContenedor.innerHTML = "<p style='color:#64748b;font-size:14px;'>Este servicio no requiere preguntas adicionales.</p>";
        return;
    }

    esquema.forEach(pregunta => {
        const group = document.createElement("div");
        group.className = "form-question";
        group.style.marginBottom = "20px";

        const label = document.createElement("div");
        label.className = "fq-label";
        label.textContent = pregunta.pregunta;

        if (pregunta.obligatorio) {
            const asterisco = document.createElement("span");
            asterisco.className = "fq-req";
            asterisco.textContent = "Obligatoria";
            asterisco.style.marginLeft = "8px";
            label.appendChild(asterisco);
        }

        group.appendChild(label);

        const tipoClean = pregunta.tipo ? pregunta.tipo.toLowerCase().trim() : "";

        if (tipoClean === "text" || tipoClean === "texto" || tipoClean === "string") {
            const textarea = document.createElement("textarea");
            textarea.className   = "fq-input";
            textarea.id          = pregunta.id_pregunta;
            textarea.name        = pregunta.id_pregunta;
            textarea.placeholder = "Escribe aquí...";
            textarea.rows        = 3;
            if (pregunta.obligatorio) textarea.required = true;
            group.appendChild(textarea);

        } else if (tipoClean === "number" || tipoClean === "numero") {
            const input = document.createElement("input");
            input.type        = "number";
            input.className   = "fq-input";
            input.id          = pregunta.id_pregunta;
            input.name        = pregunta.id_pregunta;
            input.placeholder = "Ej: 2";
            if (pregunta.obligatorio) input.required = true;
            group.appendChild(input);

        } else if (tipoClean === "boolean" || tipoClean === "bool" || tipoClean === "booleano") {
            const btnGroup = document.createElement("div");
            btnGroup.className = "fq-bool";
            btnGroup.id        = `${pregunta.id_pregunta}-bool`;

            const hiddenInput = document.createElement("input");
            hiddenInput.type          = "text";
            hiddenInput.id            = pregunta.id_pregunta;
            hiddenInput.name          = pregunta.id_pregunta;
            hiddenInput.style.cssText = "position:absolute;opacity:0;width:1px;height:1px;z-index:-1;";
            hiddenInput.tabIndex      = -1;
            if (pregunta.obligatorio) hiddenInput.required = true;

            const btnSi = document.createElement("button");
            btnSi.type      = "button";
            btnSi.className = "fq-bool-btn";
            btnSi.innerHTML = `<i class="ti ti-check icon-inline"></i> Sí`;
            btnSi.onclick   = function(e) { e.preventDefault(); selectBool(hiddenInput, "true", this); };

            const btnNo = document.createElement("button");
            btnNo.type      = "button";
            btnNo.className = "fq-bool-btn";
            btnNo.innerHTML = `<i class="ti ti-x icon-inline"></i> No`;
            btnNo.onclick   = function(e) { e.preventDefault(); selectBool(hiddenInput, "false", this); };

            btnGroup.appendChild(btnSi);
            btnGroup.appendChild(btnNo);
            group.style.position = "relative";
            group.appendChild(btnGroup);
            group.appendChild(hiddenInput);

        } else {
            const fallback = document.createElement("textarea");
            fallback.className   = "fq-input";
            fallback.id          = pregunta.id_pregunta;
            fallback.name        = pregunta.id_pregunta;
            fallback.placeholder = "Escribe aquí...";
            fallback.rows        = 3;
            if (pregunta.obligatorio) fallback.required = true;
            group.appendChild(fallback);
        }

        formContenedor.appendChild(group);
    });
}

// ─── UTILIDAD: fecha → "YYYY-MM-DD" respetando zona local ───
function toDateStr(date) {
    const anio = date.getFullYear();
    const mes  = String(date.getMonth() + 1).padStart(2, "0");
    const dia  = String(date.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

// ─── FUNCIONES AUXILIARES ───
function setTxt(id, valor) {
    const el = document.getElementById(id);
    if (el) el.textContent = valor || "";
}

function renderLista(idContenedor, listaDatos) {
    const contenedor = document.getElementById(idContenedor);
    if (!contenedor) return;
    contenedor.innerHTML = "";
    if (!listaDatos || listaDatos.length === 0) {
        contenedor.innerHTML = "<li>No especificado</li>";
        return;
    }
    listaDatos.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        contenedor.appendChild(li);
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&",  "&amp;")
        .replaceAll("<",  "&lt;")
        .replaceAll(">",  "&gt;")
        .replaceAll('"',  "&quot;")
        .replaceAll("'",  "&#039;");
}

// ════════════════════════════════════════════════════════════
//  MÓDULO DE REPORTES
// ════════════════════════════════════════════════════════════

// Estado interno del módulo
let reportImagenBase64 = "";   // imagen convertida a base64

// ─── ABRIR / CERRAR MODAL DE REPORTE ───
function openReportModal() {
    // Bloqueo duro: sólo usuarios logueados pueden reportar
    if (!usuarioLogueado) {
        alert("Debes iniciar sesión para reportar un servicio.");
        return;
    }
    // Sincronizar el idServicio en el campo oculto por si la página cargó después
    const urlParams  = new URLSearchParams(window.location.search);
    const servicioId = urlParams.get("id");
    const hiddenId   = document.getElementById("report-service-id");
    if (hiddenId && servicioId) hiddenId.value = servicioId;

    document.getElementById('report-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeReportModal() {
    document.getElementById('report-overlay').classList.remove('open');
    document.body.style.overflow = '';
    // Resetear el modal a su estado inicial tras la animación
    setTimeout(() => resetReportModal(), 300);
}

function closeReportModalOutside(e) {
    if (e.target === document.getElementById('report-overlay')) closeReportModal();
}

function resetReportModal() {
    // Limpiar campos
    const motivo  = document.getElementById('report-motivo');
    const cuerpo  = document.getElementById('report-cuerpo');
    const imagen  = document.getElementById('report-imagen');
    const preview = document.getElementById('report-image-preview');
    const warning = document.getElementById('report-warning');
    const counter = document.getElementById('report-char-count');

    if (motivo)  motivo.value  = "";
    if (cuerpo)  cuerpo.value  = "";
    if (imagen)  imagen.value  = "";
    if (preview) { preview.innerHTML = ""; preview.classList.add('hidden'); }
    if (warning) { warning.textContent = "Completa todos los campos obligatorios antes de enviar.";
                   warning.classList.remove('visible', 'error', 'success'); }
    if (counter) counter.textContent = "0 / 300";

    reportImagenBase64 = "";

    // Restaurar formulario (ocultar estado de éxito si estaba visible)
    const formContent = document.getElementById('report-form-content');
    const successEl   = document.getElementById('report-success');
    if (formContent) formContent.classList.remove('hidden');
    if (successEl)   successEl.classList.remove('show');
}

// ─── CONTADOR DE CARACTERES ───
function updateReportCharCount() {
    const cuerpo  = document.getElementById('report-cuerpo');
    const counter = document.getElementById('report-char-count');
    if (!cuerpo || !counter) return;
    const len = cuerpo.value.length;
    counter.textContent = `${len} / 300`;
    // Colorear el contador según validez (mínimo 30 caracteres)
    counter.style.color = len >= 30 ? "var(--color-success, #22c55e)" : "var(--color-warning, #f59e0b)";
}

// ─── MANEJO DE IMAGEN (convierte a base64 para enviarla al backend) ───
function handleReportImage(event) {
    const file    = event.target.files[0];
    const preview = document.getElementById('report-image-preview');
    if (!file) return;

    // Validar que sea imagen y no supere 5 MB
    if (!file.type.startsWith("image/")) {
        mostrarWarningReporte("Solo se permiten archivos de imagen.");
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        mostrarWarningReporte("La imagen no puede superar 5 MB.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        reportImagenBase64 = e.target.result; // "data:image/jpeg;base64,..."

        // Mostrar miniatura de preview
        if (preview) {
            preview.innerHTML = `<img src="${reportImagenBase64}" alt="Preview" style="max-width:100%;max-height:160px;border-radius:8px;margin-top:8px;">`;
            preview.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
}

// ─── MOSTRAR ADVERTENCIA EN EL MODAL ───
function mostrarWarningReporte(texto) {
    const warning = document.getElementById('report-warning');
    if (!warning) return;
    warning.textContent = texto;
    warning.classList.add('visible');
    // Auto-ocultar tras 4 segundos
    setTimeout(() => warning.classList.remove('visible'), 4000);
}

// ─── ENVÍO DEL REPORTE AL BACKEND ───
async function submitReport() {
    // 1. VERIFICACIÓN DE SESIÓN (defensa en profundidad)
    if (!usuarioLogueado) {
        mostrarWarningReporte("Debes iniciar sesión para enviar un reporte.");
        return;
    }

    // 2. OBTENER VALORES DEL FORMULARIO
    const motivo    = document.getElementById('report-motivo')?.value.trim();
    const cuerpo    = document.getElementById('report-cuerpo')?.value.trim();
    const servicioId = document.getElementById('report-service-id')?.value;

    // 3. VALIDACIONES
    if (!motivo) {
        mostrarWarningReporte("Selecciona un motivo para el reporte.");
        return;
    }
    if (!cuerpo || cuerpo.length < 30) {
        mostrarWarningReporte(`El detalle debe tener al menos 30 caracteres. Llevas ${cuerpo?.length ?? 0}.`);
        return;
    }
    if (!servicioId) {
        mostrarWarningReporte("No se pudo identificar el servicio. Recarga la página.");
        return;
    }

    // 4. ARMAR EL PAYLOAD según el modelo ReporteServicio del backend
    const payload = {
        idServicio: servicioId,
        motivo:     motivo,
        cuerpo:     cuerpo,
        imagen:     reportImagenBase64 || "",  // vacío si no subió imagen
    };

    // 5. DESHABILITAR BOTÓN DURANTE EL ENVÍO (evita doble submit)
    const btnEnviar = document.querySelector('#report-modal .btn-enviar');
    if (btnEnviar) {
        btnEnviar.disabled    = true;
        btnEnviar.textContent = "Enviando...";
    }

    try {
        const response = await fetch(`${API_URL}/reports/reportar_servicio`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(payload),
        });

        const resultado = await response.json();

        if (!response.ok) {
            // El backend devolvió un error descriptivo (ej: 404, 400)
            throw new Error(resultado.detail || `Error ${response.status}`);
        }

        // 6. ÉXITO: mostrar estado de confirmación
        document.getElementById('report-form-content').classList.add('hidden');
        document.getElementById('report-success').classList.add('show');

    } catch (error) {
        console.error("Error al enviar reporte:", error);
        mostrarWarningReporte(`Error al enviar: ${error.message}`);
    } finally {
        // Restaurar botón siempre, haya error o no
        if (btnEnviar) {
            btnEnviar.disabled    = false;
            btnEnviar.innerHTML   = `<i class="ti ti-send icon-btn"></i> Enviar reporte`;
        }
    }
}

// ─── EXPONER FUNCIONES AL HTML (onclick en atributos necesita acceso global) ───
window.openModal               = openModal;
window.closeModal              = closeModal;
window.closeModalOutside       = closeModalOutside;
window.selectBool              = selectBool;
window.procesarContratacion    = procesarContratacion;
window.openReportModal         = openReportModal;
window.closeReportModal        = closeReportModal;
window.closeReportModalOutside = closeReportModalOutside;
window.updateReportCharCount   = updateReportCharCount;
window.handleReportImage       = handleReportImage;
window.submitReport            = submitReport;
// Calendario
window.calNavMes               = calNavMes;
window.calSeleccionarDia       = calSeleccionarDia;
window.calSeleccionarHora      = calSeleccionarHora;