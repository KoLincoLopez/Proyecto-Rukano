import { auth, db } from "./Firebase-config.js";
import { apiFetch } from "./apiFetch.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API_URL = window.RukanoApiConfig.getApiBaseUrl();

let tecnicoUid = "";
let tecnicoDatos = {};
let currentStep = 1;
let questionCounter = 0;

const includeItems = [];
const excludeItems = [];
const questions = [];

document.addEventListener("DOMContentLoaded", () => {
    inicializarEventos();
    renderItems("include");
    renderItems("exclude");
    renderQuestions();
    updatePreview();

    onAuthStateChanged(auth, validarSesionTecnico);
});

async function validarSesionTecnico(user) {
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

        tecnicoUid = user.uid;
        tecnicoDatos = datosUsuario;
        precargarDatosTecnico(datosUsuario);
        precargarFormularioDemo(datosUsuario);
        mostrarPaso(1);
        mostrarEstado("Listo para publicar. Revisa los campos antes de enviar.", "neutral");
    } catch (error) {
        console.log("Error al validar tecnico:", error);
        window.location.href = "inicioSesion.html";
    }
}

function inicializarEventos() {
    document.querySelectorAll("[data-next-step]").forEach((button) => {
        button.addEventListener("click", () => avanzarPaso(Number(button.dataset.nextStep)));
    });

    document.querySelectorAll("[data-prev-step]").forEach((button) => {
        button.addEventListener("click", () => mostrarPaso(Number(button.dataset.prevStep) - 1));
    });

    document.querySelectorAll("[data-list-action]").forEach((button) => {
        button.addEventListener("click", () => addItem(button.dataset.listAction));
    });

    ["includeInput", "excludeInput"].forEach((id) => {
        const input = document.getElementById(id);
        input?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                addItem(id === "includeInput" ? "include" : "exclude");
            }
        });
    });

    document.getElementById("btnAddQuestion")?.addEventListener("click", addQuestion);
    document.getElementById("servicioForm")?.addEventListener("submit", publishService);

    document.querySelectorAll("input, textarea, select").forEach((control) => {
        control.addEventListener("input", () => {
            limpiarError(control.id);
            updateCounters();
            updatePreview();
        });
        control.addEventListener("change", () => {
            limpiarError(control.id);
            updatePreview();
        });
    });
}

function precargarDatosTecnico(datosUsuario = {}) {
    const categoria = document.getElementById("categoria");
    const comuna = document.getElementById("comuna");
    const descripcionTecnico = document.getElementById("descripcionTecnico");
    const experiencia = document.getElementById("experiencia");

    if (categoria && datosUsuario.especialidad) {
        const especialidadNormalizada = normalizarTexto(datosUsuario.especialidad);
        const opcion = Array.from(categoria.options).find((option) => {
            return normalizarTexto(option.value) === especialidadNormalizada;
        });
        if (opcion) categoria.value = opcion.value;
    }

    if (comuna && datosUsuario.comuna) comuna.value = String(datosUsuario.comuna).trim();
    if (descripcionTecnico && datosUsuario.descripcionTecnico) descripcionTecnico.value = String(datosUsuario.descripcionTecnico).trim();
    if (experiencia && datosUsuario.experiencia) experiencia.value = String(datosUsuario.experiencia).trim();

    updatePreview();
}

function precargarFormularioDemo(datosUsuario = {}) {
    setFieldValue("nombre", "Instalacion y reparacion electrica domiciliaria");
    setFieldValue("categoria", "Electricidad");
    setFieldValue("descripcion", "Servicio profesional de diagnostico, reparacion e instalacion electrica para viviendas. Incluye revision de tablero, enchufes, luminarias y circuitos interiores, con recomendaciones claras antes de ejecutar cualquier trabajo adicional.");
    setFieldValue("comuna", obtenerDatoDemo(datosUsuario.comuna, "Puente Alto"));
    setFieldValue("precio", "35000");
    setFieldValue("tiempoEstimado", "2");
    setFieldValue("descripcionTecnico", "Tecnico electricista especializado en instalaciones y reparaciones domiciliarias. Realizo diagnosticos claros, trabajo con medidas de seguridad y explico al cliente el alcance de cada reparacion antes de comenzar.");
    setFieldValue("experiencia", obtenerDatoDemo(
        datosUsuario.experiencia,
        "6 anos de experiencia en electricidad domiciliaria y atencion a clientes residenciales."
    ));

    includeItems.length = 0;
    includeItems.push(
        "Diagnostico inicial del problema electrico",
        "Revision de tablero, enchufes o luminarias",
        "Mano de obra para reparacion menor"
    );

    excludeItems.length = 0;
    excludeItems.push(
        "Materiales electricos especiales o certificados",
        "Trabajos en altura o canalizaciones complejas",
        "Aumento de capacidad autorizado por compania electrica"
    );

    questionCounter = 0;
    questions.length = 0;
    questions.push(
        {
            id: 1,
            text: "Que problema electrico necesitas resolver?",
            type: "text",
            required: true
        },
        {
            id: 2,
            text: "La vivienda tiene cortes de energia frecuentes?",
            type: "boolean",
            required: false
        }
    );
    questionCounter = questions.length;

    precargarDisponibilidadDemo();
    renderItems("include");
    renderItems("exclude");
    renderQuestions();
    limpiarErrores();
    updateCounters();
    updatePreview();
}

function obtenerDatoDemo(...valores) {
    const valor = valores.find((item) => item !== undefined && item !== null && String(item).trim() !== "");
    return valor !== undefined ? String(valor).trim() : "";
}

function setFieldValue(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value;
}

function precargarDisponibilidadDemo() {
    const horarios = {
        Lunes: ["09:00", "13:00"],
        Miercoles: ["14:00", "18:00"],
        Viernes: ["10:00", "15:00"]
    };

    document.querySelectorAll(".availability-day").forEach((day) => {
        const check = day.querySelector(".check-dia");
        const inicio = day.querySelector(".hora-inicio");
        const fin = day.querySelector(".hora-fin");
        const horario = horarios[check?.value];

        if (!check || !inicio || !fin) return;

        check.checked = Boolean(horario);
        inicio.value = horario?.[0] || "";
        fin.value = horario?.[1] || "";
    });
}

function avanzarPaso(step) {
    if (!validateStep(step)) {
        mostrarEstado("Hay campos obligatorios pendientes en esta seccion.", "error");
        return;
    }

    mostrarPaso(step + 1);
}

function mostrarPaso(step) {
    currentStep = Math.max(1, Math.min(4, step));

    document.querySelectorAll("[data-step]").forEach((section) => {
        section.classList.toggle("visible", Number(section.dataset.step) === currentStep);
    });

    document.querySelectorAll("[data-step-indicator]").forEach((indicator) => {
        const indicatorStep = Number(indicator.dataset.stepIndicator);
        indicator.classList.toggle("active", indicatorStep === currentStep);
        indicator.classList.toggle("done", indicatorStep < currentStep);
    });

    updatePreview();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function validateStep(step) {
    limpiarErrores();

    if (step === 1) {
        const nombre = valueOf("nombre");
        const categoria = valueOf("categoria");
        const descripcion = valueOf("descripcion");
        const comuna = valueOf("comuna");
        const precio = Number(valueOf("precio"));
        const tiempoEstimado = Number(valueOf("tiempoEstimado"));

        let ok = true;
        if (!nombre) ok = setError("nombre", "Ingresa el nombre del servicio.");
        if (!categoria) ok = setError("categoria", "Selecciona una categoria.");
        if (descripcion.length < 30) ok = setError("descripcion", "La descripcion debe tener al menos 30 caracteres.");
        if (!comuna) ok = setError("comuna", "Ingresa la comuna.");
        if (!Number.isFinite(precio) || precio <= 0) ok = setError("precio", "Ingresa un precio mayor a 0.");
        if (!Number.isFinite(tiempoEstimado) || tiempoEstimado <= 0) ok = setError("tiempoEstimado", "Ingresa una duracion valida.");
        return ok;
    }

    if (step === 2) {
        let ok = true;
        if (includeItems.length === 0) ok = setError("include", "Agrega al menos un item incluido.");
        if (excludeItems.length === 0) ok = setError("exclude", "Agrega al menos un item no incluido.");
        if (!valueOf("descripcionTecnico")) ok = setError("descripcionTecnico", "Describe tu perfil tecnico.");
        if (!valueOf("experiencia")) ok = setError("experiencia", "Ingresa tu experiencia.");
        return ok;
    }

    if (step === 3) {
        const disponibilidad = obtenerDisponibilidad();
        if (disponibilidad.length === 0) {
            setError("disponibilidad", "Selecciona al menos un dia con hora de inicio y termino.");
            return false;
        }
    }

    return true;
}

function addItem(type) {
    const inputId = type === "include" ? "includeInput" : "excludeInput";
    const input = document.getElementById(inputId);
    const value = input?.value.trim() || "";

    if (!value) return;

    const target = type === "include" ? includeItems : excludeItems;
    target.push(value);
    input.value = "";
    input.focus();

    renderItems(type);
    limpiarError(type);
    updatePreview();
}

function removeItem(type, index) {
    const target = type === "include" ? includeItems : excludeItems;
    target.splice(index, 1);
    renderItems(type);
    updatePreview();
}

function renderItems(type) {
    const target = type === "include" ? includeItems : excludeItems;
    const container = document.getElementById(type === "include" ? "includeItems" : "excludeItems");
    if (!container) return;

    if (target.length === 0) {
        container.innerHTML = '<p class="empty-state">Sin items agregados.</p>';
        return;
    }

    container.innerHTML = "";
    target.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "list-item-row";

        const text = document.createElement("span");
        text.textContent = item;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn-icon";
        button.setAttribute("aria-label", "Eliminar item");
        button.innerHTML = '<i class="ti ti-x"></i>';
        button.addEventListener("click", () => removeItem(type, index));

        row.append(text, button);
        container.appendChild(row);
    });
}

function addQuestion() {
    questionCounter += 1;
    questions.push({
        id: questionCounter,
        text: "",
        type: "text",
        required: false
    });

    renderQuestions();
    updatePreview();
}

function renderQuestions() {
    const container = document.getElementById("questionsContainer");
    if (!container) return;

    if (questions.length === 0) {
        container.innerHTML = '<div class="empty-questions">Sin preguntas adicionales para el cliente.</div>';
        return;
    }

    container.innerHTML = "";
    questions.forEach((question, index) => {
        const card = document.createElement("div");
        card.className = "question-card";

        const number = document.createElement("div");
        number.className = "question-num";
        number.textContent = String(index + 1);

        const input = document.createElement("input");
        input.type = "text";
        input.value = question.text;
        input.placeholder = "Pregunta para el cliente";
        input.addEventListener("input", () => {
            question.text = input.value;
            updatePreview();
        });

        const select = document.createElement("select");
        select.innerHTML = `
            <option value="text">Texto</option>
            <option value="boolean">Si / No</option>
        `;
        select.value = question.type;
        select.addEventListener("change", () => {
            question.type = select.value;
            updatePreview();
        });

        const requiredLabel = document.createElement("label");
        requiredLabel.className = "question-required";
        const required = document.createElement("input");
        required.type = "checkbox";
        required.checked = question.required;
        required.addEventListener("change", () => {
            question.required = required.checked;
            updatePreview();
        });
        requiredLabel.append(required, " Obligatoria");

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn-icon danger";
        remove.setAttribute("aria-label", "Eliminar pregunta");
        remove.innerHTML = '<i class="ti ti-trash"></i>';
        remove.addEventListener("click", () => {
            const questionIndex = questions.findIndex((item) => item.id === question.id);
            if (questionIndex !== -1) questions.splice(questionIndex, 1);
            renderQuestions();
            updatePreview();
        });

        card.append(number, input, select, requiredLabel, remove);
        container.appendChild(card);
    });
}

async function publishService(event) {
    event.preventDefault();

    if (!tecnicoUid) {
        mostrarEstado("No se pudo identificar la sesion tecnica. Vuelve a iniciar sesion.", "error");
        return;
    }

    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
        mostrarEstado("Revisa los campos obligatorios antes de publicar.", "error");
        return;
    }

    const btnPublicar = document.getElementById("btnPublicar");
    btnPublicar.disabled = true;
    btnPublicar.innerHTML = '<i class="ti ti-loader"></i> Publicando...';
    mostrarEstado("Creando servicio...", "neutral");

    const servicioNuevo = construirServicio();

    try {
        const response = await apiFetch(`${API_URL}/servicios/crear`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(servicioNuevo)
        });

        if (!response.ok) {
            throw new Error("El servidor no pudo crear el servicio.");
        }

        mostrarEstado("Servicio creado correctamente. Ya puedes verlo en tu panel tecnico.", "success");
        resetForm();
        mostrarPaso(1);
    } catch (error) {
        console.log("Error al crear servicio:", error);
        mostrarEstado("Error al crear servicio. Revisa tu conexion e intenta nuevamente.", "error");
    } finally {
        btnPublicar.disabled = false;
        btnPublicar.innerHTML = '<i class="ti ti-rocket"></i> Publicar servicio';
    }
}

function construirServicio() {
    return {
        idTecnico: tecnicoUid,
        nombre: valueOf("nombre"),
        categoria: valueOf("categoria"),
        comuna: valueOf("comuna"),
        descripcion: valueOf("descripcion"),
        precio: Number(valueOf("precio")),
        tiempoEstimado: valueOf("tiempoEstimado"),
        que_incluye: [...includeItems],
        que_no_incluye: [...excludeItems],
        esquema_formulario: construirEsquemaFormulario(),
        disponibilidad: obtenerDisponibilidad(),
        descripcionTecnico: valueOf("descripcionTecnico"),
        experiencia: valueOf("experiencia")
    };
}

function construirEsquemaFormulario() {
    return questions
        .map((question, index) => ({
            id_pregunta: String(index + 1),
            pregunta: question.text.trim(),
            tipo: question.type === "boolean" ? "boolean" : "text",
            obligatorio: Boolean(question.required)
        }))
        .filter((question) => question.pregunta);
}

function obtenerDisponibilidad() {
    return Array.from(document.querySelectorAll(".availability-day"))
        .map((day) => {
            const check = day.querySelector(".check-dia");
            const inicio = day.querySelector(".hora-inicio")?.value || "";
            const fin = day.querySelector(".hora-fin")?.value || "";

            if (!check?.checked || !inicio || !fin) return null;

            return {
                dia: check.value,
                inicio,
                fin,
                hora_inicio: inicio,
                hora_fin: fin
            };
        })
        .filter(Boolean);
}

function updatePreview() {
    const preview = document.getElementById("previewCard");
    if (!preview) return;

    const disponibilidad = obtenerDisponibilidad();
    const nombre = valueOf("nombre") || "Nombre del servicio";
    const categoria = valueOf("categoria") || "Categoria pendiente";
    const comuna = valueOf("comuna") || "Comuna pendiente";
    const precio = Number(valueOf("precio"));
    const tiempo = valueOf("tiempoEstimado") || "Tiempo pendiente";

    preview.innerHTML = `
        <h3>${escapeHtml(nombre)}</h3>
        <div class="preview-meta">
            <span>${escapeHtml(categoria)}</span>
            <span>${escapeHtml(comuna)}</span>
            <span>${Number.isFinite(precio) && precio > 0 ? `$${precio.toLocaleString("es-CL")}` : "Precio pendiente"}</span>
            <span>${escapeHtml(tiempo)} hora(s)</span>
        </div>
        <p>${escapeHtml(valueOf("descripcion") || "La descripcion del servicio aparecera aqui.")}</p>
        <div class="preview-columns">
            <div>
                <strong>Incluye</strong>
                <ul>${renderPreviewList(includeItems)}</ul>
            </div>
            <div>
                <strong>No incluye</strong>
                <ul>${renderPreviewList(excludeItems)}</ul>
            </div>
        </div>
        <div class="preview-availability">
            <strong>Disponibilidad</strong>
            <p>${disponibilidad.length ? disponibilidad.map((item) => `${item.dia}: ${item.inicio} - ${item.fin}`).join(" | ") : "Pendiente"}</p>
        </div>
    `;
}

function renderPreviewList(items) {
    if (items.length === 0) return "<li>Pendiente</li>";
    return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function resetForm() {
    document.getElementById("servicioForm")?.reset();
    includeItems.length = 0;
    excludeItems.length = 0;
    questions.length = 0;
    questionCounter = 0;

    precargarDatosTecnico(tecnicoDatos);
    precargarFormularioDemo(tecnicoDatos);
    renderItems("include");
    renderItems("exclude");
    renderQuestions();
    limpiarErrores();
    updateCounters();
    updatePreview();
}

function updateCounters() {
    const counter = document.getElementById("descripcionCount");
    if (counter) counter.textContent = String(valueOf("descripcion").length);
}

function mostrarEstado(message, type) {
    const status = document.getElementById("formStatus");
    if (!status) return;

    status.textContent = message;
    status.className = `status-box ${type}`;
}

function setError(id, message) {
    const error = document.querySelector(`[data-error-for="${id}"]`);
    if (error) error.textContent = message;

    const control = document.getElementById(id);
    if (control) control.classList.add("is-invalid");

    return false;
}

function limpiarError(id) {
    if (!id) return;
    const error = document.querySelector(`[data-error-for="${id}"]`);
    if (error) error.textContent = "";

    const control = document.getElementById(id);
    if (control) control.classList.remove("is-invalid");
}

function limpiarErrores() {
    document.querySelectorAll(".field-error").forEach((error) => {
        error.textContent = "";
    });
    document.querySelectorAll(".is-invalid").forEach((control) => {
        control.classList.remove("is-invalid");
    });
}

function valueOf(id) {
    return document.getElementById(id)?.value.trim() || "";
}

function normalizarRol(rol) {
    return normalizarTexto(rol);
}

function normalizarTexto(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
