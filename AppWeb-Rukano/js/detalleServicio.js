// ─── CONFIGURACIÓN DEL BACKEND ───
const API_URL = "http://127.0.0.1:8000";

// ─── SIMULACIÓN DE SESIÓN EXISTENTE ───
let isLoggedIn = false;

function toggleLogin() {
  isLoggedIn = !isLoggedIn;
  applyLoginState();
}

function simulateLogin(e) {
  e.preventDefault();
  isLoggedIn = true;
  applyLoginState();
}

function applyLoginState() {
  document.body.classList.toggle('logged-in', isLoggedIn);
  document.getElementById('demo-track').classList.toggle('on', isLoggedIn);
  document.getElementById('demo-label').textContent = isLoggedIn ? 'Con sesión' : 'Sin sesión';
  const reportBtn = document.querySelector('.btn-report');
  if (reportBtn) {
    reportBtn.disabled = !isLoggedIn;
    reportBtn.classList.toggle('disabled', !isLoggedIn);
    reportBtn.setAttribute('aria-disabled', (!isLoggedIn).toString());
  }
}

// ─── MANEJO DE MODALES EXISTENTES ───
function openModal() {
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
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
function selectBool(qId, val, btn) {
  const group = btn.parentElement;
  group.querySelectorAll('.fq-bool-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const hiddenInput = document.getElementById(qId);
  if (hiddenInput) hiddenInput.value = val;
}

// ─── CARGA DINÁMICA DESDE EL BACKEND (AL CARGAR LA PÁGINA) ───
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const servicioId = urlParams.get("id");

    if (!servicioId) {
        alert("No se especificó un ID de servicio en la URL.");
        return;
    }

    // Ejecutar inicializaciones visuales tuyas
    if (typeof initSchedule === "function") initSchedule();
    
    // Llamar al backend
    cargarDetalleServicio(servicioId);
});

async function cargarDetalleServicio(idServicio) {
    // ... dentro de async function cargarDetalleServicio(idServicio)
try {
    const response = await fetch(`${API_URL}/servicios/${idServicio}`);
    if (!response.ok) throw new Error("Servicio no encontrado.");
    
    const servicio = await response.json();

    // 1. INYECCIÓN EN LA SECCIÓN PRINCIPAL (HERO / CUERPO)
    setTxt("servicio-categoria", servicio.categoria);
    setTxt("servicio-nombre", servicio.nombre);
    setTxt("servicio-comuna", servicio.comuna);
    setTxt("servicio-descripcion", servicio.descripcion);
    setTxt("servicio-precio", `$${Number(servicio.precio).toLocaleString('es-CL')}`);

    // Datos para el side-card (si existen en el HTML, sino se ignoran sin romper la página)
    const sidePrecio = document.getElementById("side-precio");
    if (sidePrecio) sidePrecio.textContent = Number(servicio.precio).toLocaleString('es-CL');

    const sideComuna = document.getElementById("side-comuna");
    if (sideComuna) sideComuna.textContent = servicio.comuna;

    const sideTiempo = document.getElementById("side-tiempo");
    if (sideTiempo) {
        const horas = Number(servicio.tiempoEstimado);
        sideTiempo.textContent = horas === 1 ? "1 Hora" : `${horas} Horas`;
    }

    
    if (document.getElementById("servicio-tiempo")) {
        const horas = Number(servicio.tiempoEstimado);
        document.getElementById("servicio-tiempo").textContent = horas === 1 ? "1 Hora" : `${horas} Horas`;
    }

    // 2. INYECCIÓN EXCLUSIVA EN EL SIDE-CARD (Nuevos IDs independientes)
    // Nota: Aquí NO le ponemos el '$' al precio porque el HTML ya lo tiene en el <sup>
    setTxt("side-precio", Number(servicio.precio).toLocaleString('es-CL')); 
    setTxt("side-comuna", servicio.comuna);
    
    if (document.getElementById("side-tiempo")) {
        const horasSide = Number(servicio.tiempoEstimado);
        document.getElementById("side-tiempo").textContent = horasSide === 1 ? "1 Hora" : `${horasSide} Horas`;
    }

    // 3. TEXTOS DEL MODAL
    setTxt("modal-servicio-titulo", servicio.nombre);
    setTxt("modal-servicio-detalles", `$${Number(servicio.precio).toLocaleString('es-CL')} · ${servicio.comuna}`);

    if (servicio.idTecnico) {
        await cargarDatosTecnico(servicio.idTecnico);
    }

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

            setTxt("tecnico-nombre", `${tecnico.nombre} ${tecnico.apellido}`);
            setTxt("tecnico-especialidad", tecnico.especialidad || "Técnico Profesional");
            setTxt("tecnico-comuna", tecnico.comuna);
            setTxt("tecnico-calificacion", Number(tecnico.calificacion_promedio || 0).toFixed(1));
            setTxt("tecnico-reviews", `${tecnico.cantidad_reseñas || 0} reseñas`);

            //Carga del Side Panel 

            const sideNombre = document.getElementById("side-nombre");
            if (sideNombre) sideNombre.textContent = `${tecnico.nombre} ${tecnico.apellido}`;

            const sideCalificacion = document.getElementById("side-calificacion");
            if (sideCalificacion) sideCalificacion.textContent = Number(tecnico.calificacion_promedio || 0).toFixed(1);

            const sideCalificacion2 = document.getElementById("side-calificacion-2");
            if (sideCalificacion2) sideCalificacion2.textContent = Number(tecnico.calificacion_promedio || 0).toFixed(1);


            const sideComuna = document.getElementById("side-tecnico-comuna");
            if (sideComuna) sideComuna.textContent = tecnico.comuna;

            const avatar = document.getElementById("tecnico-avatar");
            if (avatar && tecnico.foto_perfil) {
                avatar.src = tecnico.foto_perfil;
            }
        }
    } catch (error) {
        console.error("Error cargando técnico:", error);
    }
}

// ─── FUNCIONES AUXILIARES DE CONTROL ───

// Evita que el código muera si un ID no se encuentra en el HTML
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}