import { auth } from "./Firebase-config.js";
import { apiFetch } from "./apiFetch.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const estrellas = document.querySelectorAll('input[name="rating"]');
const comentario = document.getElementById("comentario");
const btn = document.getElementById("btnEnviar");
const mensaje = document.getElementById("mensajeEstado");
const params = new URLSearchParams(window.location.search);
const citaId = params.get("citaId") || "";
const servicioId = params.get("servicioId") || "";
const tecnicoId = params.get("tecnicoId") || "";
const modalExito = document.getElementById("modalExitoResena");
const btnVolverAhora = document.getElementById("btnVolverAhora");
const destinoPanel = document.referrer || "panelCliente.html";
const API_URL = window.RukanoApiConfig.getApiBaseUrl();

let rating = 0;
let citaPuedeEvaluarse = false;

onAuthStateChanged(auth, (user) => {
    if (user) {
        inicializarResena(); // ✅ Firebase ya confirmó la sesión
    } else {
        bloquearFormulario("Debes iniciar sesión para dejar una reseña.");
    }
});

function volverAlPanel() {
    window.location.href = destinoPanel;
}

async function inicializarResena() {
    if (btnVolverAhora) {
        btnVolverAhora.addEventListener("click", volverAlPanel);
    }

    estrellas.forEach((estrella) => {
        estrella.addEventListener("click", () => {
            rating = Number(estrella.value);
        });
    });

    const resultado = await validarCitaFinalizada();

    if (resultado !== true) {
        // resultado es el mensaje de error específico
        bloquearFormulario(resultado || "No se pudo validar esta cita.");
        return;
    }

    citaPuedeEvaluarse = true;
    btn?.addEventListener("click", enviarResena);
}

// Retorna true si la cita es reseñable, o un string con el motivo si no lo es.
async function validarCitaFinalizada() {
    if (!citaId) return "No se encontró el identificador de la cita.";

    try {
        const response = await apiFetch(`${API_URL}/reviews/verificar_resena/${encodeURIComponent(citaId)}`);
        const resultado = await response.json().catch(() => ({}));
        if (!response.ok) {
            return resultado.detail || "No se pudo validar esta cita.";
        }
        if (resultado.posee_resena) return "Ya reseñado. Solo se permite una reseña por servicio.";
        if (!resultado.puede_resenar) {
            return "No puedes evaluar esta cita porque aún no está marcada como concluida.";
        }

        return true;
    } catch (error) {
        console.log("No se pudo validar la cita antes de resenar:", error);
        return "Ocurrió un error al verificar la cita.";
    }
}

function bloquearFormulario(texto) {
    const form = document.getElementById("formResena");
    if (form) form.innerHTML = `<p>${texto}</p>`;
}

async function enviarResena(e) {
    e.preventDefault();

    if (!citaPuedeEvaluarse) return;

    if (rating === 0) {
        mensaje.textContent = "Selecciona una calificacion";
        return;
    }

    if (comentario.value.trim() === "") {
        mensaje.textContent = "Escribe un comentario";
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        mensaje.textContent = "Debes iniciar sesion para enviar una resena";
        return;
    }

    if (!citaId) {
        mensaje.textContent = "No se pudo identificar la cita a valorar.";
        console.warn("Faltan parametros para guardar la resena", {
            citaId,
            servicioId,
            tecnicoId
        });
        return;
    }

    try {
        const response = await apiFetch(`${API_URL}/reviews/crear_resena`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                citaId,
                idServicio: servicioId,
                idTecnico: tecnicoId,
                puntuacion: rating,
                estrellas: rating,
                comentario: comentario.value.trim()
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 409) {
                bloquearFormulario("Ya reseñado. Esta cita solo admite una reseña.");
            }
            throw new Error(errorData.detail || "Error al enviar reseña");
        }

        /*
        El backend valida que la cita este concluida, que pertenezca al cliente
        y que no exista una resena previa antes de persistirla.
        */

        mensaje.textContent = "";
        comentario.value = "";
        rating = 0;
        estrellas.forEach((estrella) => {
            estrella.checked = false;
        });

        if (modalExito) {
            modalExito.classList.add("visible");
            modalExito.setAttribute("aria-hidden", "false");
        }

        setTimeout(volverAlPanel, 2800);
    } catch (error) {
        mensaje.textContent = error.message || "Error al enviar reseña";
        console.error(error);
    }
}