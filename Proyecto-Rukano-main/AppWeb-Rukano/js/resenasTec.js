import { db } from "./Firebase-config.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
const citaFinalizada = true;

const estrellas = document.querySelectorAll("#estrellas span");
const comentario = document.getElementById("comentario");
const btn = document.getElementById("btnEnviar");
const mensaje = document.getElementById("mensajeEstado");

let rating = 0;

if (!citaFinalizada) {
    document.getElementById("formResena").innerHTML = 
        "<p>No puedes evaluar esta cita.</p>";
}

estrellas.forEach((estrella, index) => {
    estrella.addEventListener("click", () => {
        rating = index + 1;

        estrellas.forEach(e => e.classList.remove("activa"));

        for (let i = 0; i < rating; i++) {
            estrellas[i].classList.add("activa");
        }
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

    try {
        await addDoc(collection(db, "resenas"), {
            estrellas: rating,
            comentario: comentario.value,
            fecha: new Date()
        });

        mensaje.textContent = "Reseña enviada con éxito";

        comentario.value = "";
        rating = 0;
        estrellas.forEach(e => e.classList.remove("activa"));

    } catch (error) {
        mensaje.textContent = "Error al enviar reseña";
        console.error(error);
    }
});