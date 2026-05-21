import { auth, db } from "./Firebase-config.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const citaFinalizada = true;

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

function volverAlPanel() {
    window.location.href = destinoPanel;
}

if (btnVolverAhora) {
    btnVolverAhora.addEventListener("click", volverAlPanel);
}

if (!citaFinalizada) {
    document.getElementById("formResena").innerHTML = 
        "<p>No puedes evaluar esta cita.</p>";
}

estrellas.forEach((estrella) => {
    estrella.addEventListener("click", () => {
        rating = Number(estrella.value);
    });
});

btn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!citaFinalizada) return;

    if (rating === 0) {
        mensaje.textContent = "Selecciona una calificación";
        return;
    }

    if (comentario.value.trim() === "") {
        mensaje.textContent = "Escribe un comentario";
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        mensaje.textContent = "Debes iniciar sesiÃ³n para enviar una reseÃ±a";
        return;
    }

    if (!citaId || !servicioId || !tecnicoId) {
        mensaje.textContent = "No se pudo identificar la cita, el servicio o el tÃ©cnico a valorar.";
        console.warn("Faltan parametros para guardar la reseÃ±a", {
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
            comentario: comentario.value,
            fecha: new Date()
        });

        mensaje.textContent = "";

        comentario.value = "";
        rating = 0;
        estrellas.forEach(e => {
            e.checked = false;
        });

        if (modalExito) {
            modalExito.classList.add("visible");
            modalExito.setAttribute("aria-hidden", "false");
        }

        setTimeout(volverAlPanel, 2800);

    } catch (error) {
        mensaje.textContent = "Error al enviar reseña";
        console.error(error);
    }
});
