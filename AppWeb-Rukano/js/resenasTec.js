import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 1. Obtener parámetros de la URL (Ej: resenasTec.html?idCita=123&idTecnico=456&idServicio=789)
// Esto es para que sepas a qué cita/técnico/servicio le estás haciendo la reseña.
const urlParams = new URLSearchParams(window.location.search);
const idCitas = urlParams.get('idCita') || "ID_CITA_DESCONOCIDA"; 
const idTecnico = urlParams.get('idTecnico') || "ID_TECNICO_DESCONOCIDO";
const idServicio = urlParams.get('idServicio') || "ID_SERVICIO_DESCONOCIDO";

// 2. Variable global para el ID del Cliente logueado
let idCliente = null;

onAuthStateChanged(auth, (user) => {
    if (user) {
        idCliente = user.uid; // Capturamos el ID real del cliente que está evaluando
    } else {
        // Si no está logueado, lo mandamos al login
        window.location.href = "inicioSesion.html";
    }
});

const comentario = document.getElementById("comentario");
const btn = document.getElementById("btnEnviar");
const mensaje = document.getElementById("mensajeEstado");

// Control de flujo (puedes ajustarlo si verificas en BD que la cita ya terminó)
const citaFinalizada = true;

if (!citaFinalizada) {
    document.getElementById("formResena").innerHTML = 
        "<p style='color:red;'>No puedes evaluar esta cita porque aún no ha finalizado.</p>";
}

btn.addEventListener("click", async (e) => {
    e.preventDefault();

    if (!citaFinalizada) return;

    // 3. Capturar las estrellas usando los radio buttons del HTML
    const ratingSeleccionado = document.querySelector('input[name="rating"]:checked');

    if (!ratingSeleccionado) {
        mensaje.textContent = " Por favor, selecciona una calificación en estrellas.";
        mensaje.style.color = "#d9534f";
        return;
    }

    const rating = parseInt(ratingSeleccionado.value);

    if (comentario.value.trim() === "") {
        mensaje.textContent = " Por favor, escribe un comentario.";
        mensaje.style.color = "#d9534f";
        return;
    }

    if (!idCliente) {
        mensaje.textContent = " Debes iniciar sesión para evaluar.";
        mensaje.style.color = "#d9534f";
        return;
    }

    // Cambiar el botón para que el usuario no haga doble clic
    btn.disabled = true;
    btn.textContent = "ENVIANDO...";

    try {
        // 4. Generamos un ID único universal para el idResena
        const idResenaGenerado = crypto.randomUUID(); 

        // 5. Insertamos en Firestore con la estructura exacta requerida
        await addDoc(collection(db, "resenas"), {
            comentario: comentario.value.trim(),
            createdAt: serverTimestamp(), // Esto pone la fecha/hora exacta UTC de Firebase
            fotoUrl: "",
            idCitas: idCitas,
            idCliente: idCliente,
            idResena: idResenaGenerado,
            idServicio: idServicio,
            idTecnico: idTecnico,
            puntuacion: rating // Número entero como lo pide la BD
        });

        mensaje.textContent = "¡Reseña enviada con éxito! Gracias por tu opinión.";
        mensaje.style.color = "#5cb85c";

        // Limpiar el formulario
        comentario.value = "";
        ratingSeleccionado.checked = false;
        
        // Opcional: Redirigir al cliente después de un par de segundos
        setTimeout(() => {
            window.location.href = "panelCliente.html"; // o "dashboard.html"
        }, 2000);

    } catch (error) {
        mensaje.textContent = "ERROR al enviar reseña. Inténtalo de nuevo.";
        mensaje.style.color = "#d9534f";
        console.error("Error guardando reseña en BD:", error);
    } finally {
        // Restaurar el botón
        btn.disabled = false;
        btn.textContent = "ENVIAR RESEÑA";
    }
});