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
function selectBool(identificador, val, btn) {
  const group = btn.parentElement;
  
  // Limpiamos cualquier rastro visual de selección anterior
  group.querySelectorAll('.fq-bool-btn').forEach(b => {
      b.classList.remove('active', 'selected');
  });
  
  // Forzamos el estado activo en el botón clickeado
  btn.classList.add('active', 'selected');
  
  // Obtenemos el input (ahora soporta recibir el elemento directo para no fallar jamás)
  const input = typeof identificador === 'string' ? document.getElementById(identificador) : identificador;
  
  if (input) {
      input.value = val;
  }
}

// ─── CARGA DINÁMICA DESDE EL BACKEND (AL CARGAR LA PÁGINA) ───
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const servicioId = urlParams.get("id");

    if (!servicioId) {
        alert("No se especificó un ID de servicio en la URL.");
        return;
    }

    if (typeof initSchedule === "function") initSchedule();
    cargarDetalleServicio(servicioId);
});

async function cargarDetalleServicio(idServicio) {
    try {
        const response = await fetch(`${API_URL}/servicios/${idServicio}`);
        if (!response.ok) throw new Error("Servicio no encontrado.");
        
        const servicio = await response.json();

        // Llamada al formulario dinámico
        renderFormularioDinamico(servicio.esquema_formulario);

        // 1. INYECCIÓN EN LA SECCIÓN PRINCIPAL (HERO / CUERPO)
        setTxt("servicio-categoria", servicio.categoria);
        setTxt("servicio-nombre", servicio.nombre);
        setTxt("servicio-comuna", servicio.comuna);
        setTxt("servicio-descripcion", servicio.descripcion);
        setTxt("servicio-precio", `$${Number(servicio.precio).toLocaleString('es-CL')}`);

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
            document.getElementById("servicio-tiempo").textContent = horas === 1 ? "1 Hora" : `${horas} Horas`;
        }

        // 2. INYECCIÓN EXCLUSIVA EN EL SIDE-CARD
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

        renderLista("servicio-incluye", servicio.que_incluye);
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

            setTxt("tecnico-nombre", `${tecnico.nombre} ${tecnico.apellido}`);
            setTxt("tecnico-especialidad", tecnico.especialidad || "Técnico Profesional");
            setTxt("tecnico-comuna", tecnico.comuna);
            setTxt("tecnico-calificacion", Number(tecnico.calificacion_promedio || 0).toFixed(1));
            setTxt("tecnico-reviews", `${tecnico.cantidad_reseñas || 0} reseñas`);

            const sideNombre = document.getElementById("side-nombre");
            if (sideNombre) sideNombre.textContent = `${tecnico.nombre} ${tecnico.apellido}`;

            const finalNombre = document.getElementById("final-nombre");
            if (finalNombre) finalNombre.textContent = `${tecnico.nombre} ${tecnico.apellido}`;

            const finalNombre2 = document.getElementById("final-nombre-2");
            if (finalNombre2) finalNombre2.textContent = `${tecnico.nombre} ${tecnico.apellido}`;

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

// ─── GENERACIÓN DEL FORMULARIO DINÁMICO (CORREGIDO Y ROBUSTO) ───
function renderFormularioDinamico(esquema) {
    const formContenedor = document.getElementById("formulario-dinamico");
    if (!formContenedor) return;

    formContenedor.innerHTML = ""; 

    if (!esquema || esquema.length === 0) {
        formContenedor.innerHTML = "<p class='text-muted'>Este servicio no requiere preguntas adicionales.</p>";
        return;
    }

    esquema.forEach(pregunta => {
        const group = document.createElement("div");
        group.className = "form-question"; // Mantiene tus estilos originales del HTML
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

        // Limpieza del tipo para evitar fallos por mayúsculas o traducciones
        const tipoClean = pregunta.tipo ? pregunta.tipo.toLowerCase().trim() : "";

        if (tipoClean === "text" || tipoClean === "texto" || tipoClean === "string") {
            const textarea = document.createElement("textarea");
            textarea.className = "fq-input";
            textarea.id = pregunta.id_pregunta;
            textarea.name = pregunta.id_pregunta;
            textarea.placeholder = "Escribe aquí...";
            textarea.rows = 3;
            if (pregunta.obligatorio) textarea.required = true;
            
            group.appendChild(textarea);

        } else if (tipoClean === "number" || tipoClean === "numero") {
            const input = document.createElement("input");
            input.type = "number";
            input.className = "fq-input";
            input.id = pregunta.id_pregunta;
            input.name = pregunta.id_pregunta;
            input.placeholder = "Ej: 2";
            if (pregunta.obligatorio) input.required = true;
            
            group.appendChild(input);

        }  else if (tipoClean === "boolean" || tipoClean === "bool" || tipoClean === "booleano") {
            const btnGroup = document.createElement("div");
            btnGroup.className = "fq-bool";
            btnGroup.id = `${pregunta.id_pregunta}-bool`;

            // EL TRUCO: Usamos un input de texto para que el navegador sí lo valide,
            // pero lo escondemos completamente con estilos CSS.
            const hiddenInput = document.createElement("input");
            hiddenInput.type = "text"; 
            hiddenInput.id = pregunta.id_pregunta;
            hiddenInput.name = pregunta.id_pregunta;
            if (pregunta.obligatorio) hiddenInput.required = true;
            
            hiddenInput.style.position = "absolute";
            hiddenInput.style.opacity = "0";
            hiddenInput.style.width = "1px";
            hiddenInput.style.height = "1px";
            hiddenInput.style.zIndex = "-1";
            hiddenInput.tabIndex = -1; // Evita que se seleccione con la tecla Tab

            const btnSi = document.createElement("button");
            btnSi.type = "button";
            btnSi.className = "fq-bool-btn";
            btnSi.innerHTML = `<i class="ti ti-check icon-inline"></i> Sí`;
            btnSi.onclick = function(e) { 
                e.preventDefault(); 
                selectBool(hiddenInput, "true", this); 
            };

            const btnNo = document.createElement("button");
            btnNo.type = "button";
            btnNo.className = "fq-bool-btn";
            btnNo.innerHTML = `<i class="ti ti-x icon-inline"></i> No`;
            btnNo.onclick = function(e) { 
                e.preventDefault(); 
                selectBool(hiddenInput, "false", this); 
            };

            btnGroup.appendChild(btnSi);
            btnGroup.appendChild(btnNo);
            
            // Posición relativa para que el globito rojo del error aparezca justo sobre la pregunta
            group.style.position = "relative";
            group.appendChild(btnGroup);
            group.appendChild(hiddenInput);
            
        } else {
            // CASO POR DEFECTO (SAFETY NET): Si el tipo es raro o desconocido, creamos un campo de texto para que no quede invisible
            const fallbackInput = document.createElement("textarea");
            fallbackInput.className = "fq-input";
            fallbackInput.id = pregunta.id_pregunta;
            fallbackInput.name = pregunta.id_pregunta;
            fallbackInput.placeholder = "Escribe aquí...";
            fallbackInput.rows = 3;
            if (pregunta.obligatorio) fallbackInput.required = true;
            
            group.appendChild(fallbackInput);
        }

        formContenedor.appendChild(group);
    });
}

// Procesar contratación (Al hacer click en "Enviar solicitud")
function procesarContratacion() {
    const respuestasCliente = obtenerRespuestasFormulario();
    
    if (!respuestasCliente) {
        return; 
    }

    console.log("Respuestas listas para enviar al backend:", respuestasCliente);

    document.getElementById('modal-form-content').classList.add('hidden');
    document.getElementById('modal-success').classList.add('show');
}

// ─── RECOLECCIÓN Y VALIDACIÓN DE RESPUESTAS ───
function obtenerRespuestasFormulario() {
    const formulario = document.getElementById("formulario-dinamico");
    if (!formulario) return null;

    if (!formulario.checkValidity()) {
        formulario.reportValidity(); 
        return null;
    }

    const formData = new FormData(formulario);
    const respuestas = {};

    formData.forEach((value, key) => {
        respuestas[key] = value;
    });

    return respuestas;
}

// ─── FUNCIONES AUXILIARES DE CONTROL ───
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