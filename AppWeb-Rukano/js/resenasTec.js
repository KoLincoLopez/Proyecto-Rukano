import { auth, db } from "./Firebase-config.js";
import {
    addDoc,
    collection,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

let rating = 0;
let citaPuedeEvaluarse = false;

inicializarResena();

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

    citaPuedeEvaluarse = await validarCitaFinalizada();
    if (!citaPuedeEvaluarse) {
        bloquearFormulario("No puedes evaluar esta cita porque aun no aparece como finalizada.");
        return;
    }

    btn?.addEventListener("click", enviarResena);
}

async function validarCitaFinalizada() {
    if (!citaId) return false;

    try {
        const citaSnap = await getDoc(doc(db, "citas", citaId));
        if (!citaSnap.exists()) return false;

        const cita = citaSnap.data();
        const estado = normalizarTexto(cita.estado);
        const coincideServicio = !servicioId || cita.idServicio === servicioId;
        const coincideTecnico = !tecnicoId || cita.idTecnico === tecnicoId;
        const estadoFinalizado = ["realizado", "finalizado", "completado", "pagada"].includes(estado);

        return coincideServicio && coincideTecnico && estadoFinalizado;
    } catch (error) {
        console.log("No se pudo validar la cita antes de resenar:", error);
        return false;
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

    if (!citaId || !servicioId || !tecnicoId) {
        mensaje.textContent = "No se pudo identificar la cita, el servicio o el tecnico a valorar.";
        console.warn("Faltan parametros para guardar la resena", {
            citaId,
            servicioId,
            tecnicoId
        });
        return;
    }

    try {
        await addDoc(collection(db, "resenas"), {
            idCliente: user.uid,
            citaId: citaId,
            idServicio: servicioId,
            idTecnico: tecnicoId,
            estrellas: rating,
            comentario: comentario.value.trim(),
            fecha: new Date()
        });

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
        mensaje.textContent = "Error al enviar resena";
        console.error(error);
    }
}

function normalizarTexto(texto) {
    return String(texto || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}
