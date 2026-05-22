import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Variables globales para almacenar la sesión del técnico
let tecnicoUid = null;
let tecnicoDatos = null;

document.addEventListener("DOMContentLoaded", () => {
    const botonPerfil = document.querySelector(".toggle") || document.querySelector(".perfil-usuario");
    const menuDesplegable = document.querySelector(".nav");

    if (botonPerfil && menuDesplegable) {
        botonPerfil.addEventListener("click", () => menuDesplegable.classList.toggle("active"));
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                tecnicoUid = user.uid;
                const userSnap = await getDoc(doc(db, "usuarios", user.uid));
                if (userSnap.exists()) {
                    tecnicoDatos = userSnap.data();
                    if (tecnicoDatos.rol !== "tecnico") return window.location.href = "index.html";

                    document.querySelectorAll(".link-sesion, .btn-registro-nav").forEach(el => el.style.display = "none");

                    const navDerecha = document.querySelector(".nav-derecha");
                    if (navDerecha && botonPerfil && !document.getElementById("saludoNavbar")) {
                        const saludo = document.createElement("span");
                        saludo.id = "saludoNavbar";
                        saludo.style.cssText = "color: var(--c-arena); font-weight: bold; margin-right: 15px; font-size: 14px;";
                        saludo.textContent = `¡Hola, ${tecnicoDatos.nombre.split(" ")[0]} !`;
                        navDerecha.insertBefore(saludo, botonPerfil);
                    }

                    const img = botonPerfil?.querySelector("img");
                    if (img) {
                        const span = document.createElement("span");
                        span.textContent = tecnicoDatos.nombre.charAt(0).toUpperCase();
                        span.style.cssText = "color: white; font-size: 20px; font-weight: 900; background-color: var(--c-rosewood); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;";
                        img.replaceWith(span);
                    }
                }
            } catch (error) { console.error("Error cargando perfil del técnico:", error); }
        } else {
            window.location.href = "inicioSesion.html";
        }
    });

    const btnCerrarSesion = document.querySelector(".cerrar-sesion");
    if (btnCerrarSesion) btnCerrarSesion.addEventListener("click", async (e) => { e.preventDefault(); await signOut(auth); });

    // Contadores originales
    const tituloInput = document.getElementById('titulo');
    const descInput = document.getElementById('descripcion');
    if (tituloInput) tituloInput.addEventListener('input', function() { document.getElementById('titulo-count').textContent = this.value.length; });
    if (descInput) descInput.addEventListener('input', function() { document.getElementById('desc-count').textContent = this.value.length; });

    renderItems('include'); renderItems('exclude'); renderQuestions();
});


// ==========================================
// 2. VARIABLES GLOBALES DEL FORMULARIO
// ==========================================
let currentStep = 1;
const includeItems = [];
const excludeItems = [];
const questions = [];
let questionCounter = 0;


// ==========================================
// 3. FUNCIONES DE NAVEGACIÓN ENTRE PASOS
// ==========================================
function goStep(n) {
    if (n >= currentStep) return;
    showStep(n);
}

function nextStep(from) {
    if (!validateStep(from)) return;
    showStep(from + 1);
}

function prevStep(from) {
    showStep(from - 1);
}

function showStep(n) {
    currentStep = n;
    for (let i = 1; i <= 4; i++) {
        const sec = document.getElementById('section-' + i);
        if (sec) sec.classList.toggle('visible', i === n);
        
        const btn = document.getElementById('step-' + i + '-btn');
        if (btn) {
            btn.classList.remove('active', 'done');
            if (i === n) btn.classList.add('active');
            else if (i < n) btn.classList.add('done');
        }
    }
    if (n === 4) buildPreview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateStep(step) {
    let ok = true;
    if (step === 1) {
        const titulo = document.getElementById('titulo').value.trim();
        const desc = document.getElementById('descripcion').value.trim();
        const precio = parseFloat(document.getElementById('precio').value);
        const duracion = parseFloat(document.getElementById('duracion').value);
        
        setErr('titulo', !titulo);
        setErr('descripcion', desc.length < 30);
        setErr('precio', !precio || precio <= 0);
        setErr('duracion', !duracion || duracion <= 0);
        
        if (!titulo || desc.length < 30 || !precio || precio <= 0 || !duracion || duracion <= 0) ok = false;
    }
    if (step === 2) {
        const incOk = includeItems.length >= 3;
        const exOk = excludeItems.length >= 3;
        
        document.getElementById('err-include').classList.toggle('show', !incOk);
        document.getElementById('err-exclude').classList.toggle('show', !exOk);
        
        if (!incOk || !exOk) ok = false;
    }
    return ok;
}

function setErr(id, show) {
    const el = document.getElementById('err-' + id);
    const inp = document.getElementById(id);
    if (el) el.classList.toggle('show', show);
    if (inp) inp.classList.toggle('error', show);
}


// ==========================================
// 4. LÓGICA DE LISTAS (INCLUYE / NO INCLUYE)
// ==========================================
function addItem(type) {
    const input = document.getElementById(type + '-input');
    const val = input.value.trim();
    if (!val) return;
    
    const arr = type === 'include' ? includeItems : excludeItems;
    arr.push(val);
    renderItems(type);
    
    input.value = '';
    input.focus();
    if (arr.length >= 3) document.getElementById('err-' + type).classList.remove('show');
}

function handleListKey(e, type) {
    if (e.key === 'Enter') { 
        e.preventDefault(); 
        addItem(type); 
    }
}

function removeItem(type, idx) {
    const arr = type === 'include' ? includeItems : excludeItems;
    arr.splice(idx, 1);
    renderItems(type);
}

function renderItems(type) {
    const arr = type === 'include' ? includeItems : excludeItems;
    const container = document.getElementById(type + '-items');
    document.getElementById(type + '-count').textContent = arr.length;
    
    container.innerHTML = arr.map((item, i) => `
        <div class="list-item-row">
            <div class="list-bullet ${type}"></div>
            <span>${escHtml(item)}</span>
            <button class="btn-icon" onclick="removeItem('${type}',${i})" title="Eliminar">
                <i class="ti ti-x"></i>
            </button>
        </div>
    `).join('');
}


// ==========================================
// 5. LÓGICA DE PREGUNTAS
// ==========================================
function addQuestion() {
    questionCounter++;
    const id = questionCounter;
    questions.push({ id, text: '', type: 'text', required: false });
    renderQuestions();
    setTimeout(() => { 
        const inp = document.getElementById('q-text-' + id); 
        if (inp) inp.focus(); 
    }, 50);
}

function removeQuestion(id) {
    const idx = questions.findIndex(q => q.id === id);
    if (idx !== -1) questions.splice(idx, 1);
    renderQuestions();
}

function setQType(id, type) {
    const q = questions.find(q => q.id === id);
    if (q) { q.type = type; renderQuestions(); }
}

function toggleRequired(id) {
    const q = questions.find(q => q.id === id);
    if (q) { q.required = !q.required; renderQuestions(); }
}

function updateQText(id, val) {
    const q = questions.find(q => q.id === id);
    if (q) q.text = val;
}

function renderQuestions() {
    const c = document.getElementById('questions-container');
    if (questions.length === 0) {
        c.innerHTML = `<div class="empty-questions">
            <i class="ti ti-message-off"></i>
            <p>Sin preguntas — el formulario estará vacío para el cliente</p>
        </div>`;
        return;
    }
    
    c.innerHTML = questions.map((q, idx) => `
        <div class="question-card" id="qcard-${q.id}">
            <div class="question-header">
                <div class="question-num">${idx + 1}</div>
                <input type="text" id="q-text-${q.id}" value="${escHtml(q.text)}"
                    placeholder="Escribe la pregunta aquí..."
                    oninput="updateQText(${q.id}, this.value)">
                <button class="btn-icon" onclick="removeQuestion(${q.id})" title="Eliminar">
                    <i class="ti ti-trash"></i>
                </button>
            </div>
            <div class="question-options">
                <span class="q-type-label">Tipo:</span>
                <div class="toggle-group">
                    <button class="toggle-btn ${q.type === 'text' ? 'active-text' : ''}" onclick="setQType(${q.id},'text')">
                        <i class="ti ti-text-size" style="font-size:13px"></i> Texto
                    </button>
                    <button class="toggle-btn ${q.type === 'bool' ? 'active-bool' : ''}" onclick="setQType(${q.id},'bool')">
                        <i class="ti ti-toggle-right" style="font-size:13px"></i> Sí / No
                    </button>
                </div>
                <label class="required-toggle" onclick="toggleRequired(${q.id})">
                    <div class="toggle-switch ${q.required ? 'on' : ''}"></div>
                    Obligatoria
                </label>
            </div>
        </div>
    `).join('');
}


// ==========================================
// 6. PREVISUALIZACIÓN Y PUBLICACIÓN CON FIRESTORE
// ==========================================
function buildPreview() {
    const titulo = document.getElementById('titulo').value.trim();
    const desc = document.getElementById('descripcion').value.trim();
    const precio = parseFloat(document.getElementById('precio').value);
    const duracion = parseFloat(document.getElementById('duracion').value);

    const incHtml = includeItems.map(i => `<li>${escHtml(i)}</li>`).join('');
    const exHtml = excludeItems.map(i => `<li>${escHtml(i)}</li>`).join('');

    const qHtml = questions.length === 0
        ? `<p style="font-size:12px;color:var(--c-text-muted);font-weight:900;text-transform:uppercase;letter-spacing:0.5px">Sin preguntas adicionales.</p>`
        : questions.map((q, idx) => `
            <div class="preview-question-item">
                <span style="color:var(--c-text-muted);font-size:11px;font-weight:900;font-family:'Arial Black',sans-serif;min-width:20px;">${idx + 1}.</span>
                <span style="flex:1;font-size:14px">${escHtml(q.text) || '<em style="color:var(--c-text-muted)">Sin texto</em>'}</span>
                <span class="q-type ${q.type}">${q.type === 'text' ? 'Texto' : 'Sí / No'}</span>
                ${q.required ? '<span class="q-required-badge">Obligatoria</span>' : ''}
            </div>
        `).join('');

    document.getElementById('preview-content').innerHTML = `
        <div class="preview-title">${escHtml(titulo)}</div>
        <div class="preview-meta">
            <div class="preview-badge"><i class="ti ti-coin"></i> $${precio.toLocaleString('es-CL')}</div>
            <div class="preview-badge"><i class="ti ti-clock"></i> ${duracion} hora${duracion !== 1 ? 's' : ''} aprox.</div>
        </div>
        <div class="preview-desc">${escHtml(desc)}</div>
        <div class="preview-lists">
            <div class="preview-list-box include">
                <div class="preview-list-title">✓ Incluye</div>
                <ul>${incHtml}</ul>
            </div>
            <div class="preview-list-box exclude">
                <div class="preview-list-title">✗ No incluye</div>
                <ul>${exHtml}</ul>
            </div>
        </div>
        ${questions.length > 0 ? `<div class="preview-questions"><h3>Preguntas al contratar</h3>${qHtml}</div>` : ''}
    `;
}

// FUNCIÓN DE ENVÍO REAL A FIRESTORE
async function publishService() {
    if (!tecnicoUid || !tecnicoDatos) {
        alert("❌ Error de sesión: No se identificó al técnico.");
        return;
    }

    // Cambiar estado visual del botón para prevenir múltiples clics
    const btnPublicar = document.querySelector("#section-4 .btn-primary");
    const textoOriginal = btnPublicar.innerHTML;
    btnPublicar.disabled = true;
    btnPublicar.innerHTML = `<i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> Publicando...`;

    try {
        const titulo = document.getElementById('titulo').value.trim();
        const desc = document.getElementById('descripcion').value.trim();
        const precio = parseInt(document.getElementById('precio').value, 10);
        const duracion = document.getElementById('duracion').value; // Se guarda como string según tu ejemplo ("3")

        // 1. Mapeo del esquema del formulario (Arreglo de mapas)
        const esquema_formulario = questions.map((q, idx) => ({
            id_pregunta: String(idx + 1),
            obligatorio: !!q.required,
            pregunta: q.text.trim() || "Pregunta sin título",
            tipo: q.type === 'text' ? 'string' : 'boolean'
        }));

        // 2. Generación del UUID único para el servicio
        const idServicio = crypto.randomUUID();

        // 3. Normalizar categoría y comuna desde la cuenta del técnico
        const categoria = (tecnicoDatos.especialidad || "general").toLowerCase().replace(/técnico\s+/g, "").trim();
        const comuna = tecnicoDatos.comuna || "No especificada";

        // 4. Generación automática del array de palabras clave (keyWords)
        const palabrasBrutas = `${titulo} ${desc} ${categoria}`.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .split(/\s+/);
        const keyWords = [...new Set(palabrasBrutas)].filter(p => p.length > 2);

        // 5. Construcción exacta del objeto para Firebase
        const nuevoServicio = {
            categoria: categoria,
            comuna: comuna,
            createdAt: serverTimestamp(),
            descripcion: desc,
            esquema_formulario: esquema_formulario,
            estado: "activo",
            idServicio: idServicio,
            idTecnico: tecnicoUid,
            keyWords: keyWords,
            nombre: titulo,
            precio: precio,
            que_incluye: includeItems,
            que_no_incluye: excludeItems,
            tiempoEstimado: String(duracion)
        };

        // 6. Guardar el documento en la colección "servicios"
        await addDoc(collection(db, "servicios"), nuevoServicio);

        // Cambiar a la pantalla de éxito
        document.getElementById('section-4').classList.remove('visible');
        document.getElementById('success-screen').classList.add('visible');
        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Error al publicar en Firestore: ", error);
        alert("❌ Ocurrió un error al subir el servicio a la base de datos.");
    } finally {
        // Restaurar botón
        btnPublicar.disabled = false;
        btnPublicar.innerHTML = textoOriginal;
    }
}

function resetForm() {
    ['titulo','descripcion','precio','duracion'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
    });
    document.getElementById('titulo-count').textContent = '0';
    document.getElementById('desc-count').textContent = '0';
    
    includeItems.length = 0; 
    excludeItems.length = 0; 
    questions.length = 0; 
    questionCounter = 0;
    
    renderItems('include'); 
    renderItems('exclude'); 
    renderQuestions();
    
    document.getElementById('success-screen').classList.remove('visible');
    showStep(1);
    document.getElementById('section-1').classList.add('visible');
}

function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Exposición global para los eventos interactivos del HTML
window.goStep = goStep;
window.nextStep = nextStep;
window.prevStep = prevStep;
window.addItem = addItem;
window.handleListKey = handleListKey;
window.removeItem = removeItem;
window.addQuestion = addQuestion;
window.removeQuestion = removeQuestion;
window.setQType = setQType;
window.toggleRequired = toggleRequired;
window.updateQText = updateQText;
window.publishService = publishService;
window.resetForm = resetForm;