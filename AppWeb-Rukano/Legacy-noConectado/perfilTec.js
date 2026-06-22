// LEGACY / NO OFICIAL:
// Este archivo controla la pagina antigua perfilTec.html y no debe usarse como
// referencia para el perfil tecnico actual.
// Flujo oficial actual: miperfilTec.html con js/miperfilTec.js y
// js/certificacion.js.
// Antes de eliminarlo, debe ser revisado por el equipo para confirmar que no
// se usa en navegacion activa.
import { auth, db } from "../js/Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. VERIFICACIÓN DE SESIÓN Y ROL ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Si no hay usuario logueado, redirige a inicioSesion.html
            window.location.href = "inicioSesion.html";
            return;
        }

        try {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const data = userSnap.data();
                
                // IMPORTANTE: Asegúrate de que el campo en tu base de datos se llame exactamente 'rol' 
                // y el valor sea 'tecnico'. Ajústalo si usas otro nombre (ej. data.tipoUsuario).
                if (data.rol !== "tecnico") {
                    window.location.href = "index.html";
                    return;
                }
            } else {
                console.warn("Usuario en Auth pero sin documento en Firestore.");
                window.location.href = "inicioSesion.html";
                return;
            }
        } catch (error) {
            console.error("Error al obtener datos del usuario:", error);
            // Ante cualquier error crítico, lo devolvemos al inicio por seguridad
            window.location.href = "index.html"; 
        }
    });

    // --- 2. LÓGICA ORIGINAL DEL FORMULARIO ---
    const form = document.getElementById("tecnicoForm");
    const btn = document.getElementById("btnGuardar");
    const fileInput = document.getElementById("archivo");
    const badge = document.getElementById("estadoBadge");

    const rutInput = document.getElementById("rut");
    const experienciaInput = document.getElementById("experiencia");

    const rutError = document.getElementById("rutError");

    function validarRUT(rutCompleto) {
        rutCompleto = rutCompleto.replace(/\./g, "").replace("-", "");

        if (rutCompleto.length < 8) return false;

        const cuerpo = rutCompleto.slice(0, -1);
        let dv = rutCompleto.slice(-1).toUpperCase();

        let suma = 0;
        let multiplo = 2;

        for (let i = cuerpo.length - 1; i >= 0; i--) {
            suma += parseInt(cuerpo[i]) * multiplo;
            multiplo = multiplo < 7 ? multiplo + 1 : 2;
        }

        const dvEsperado = 11 - (suma % 11);

        let dvFinal;
        if (dvEsperado === 11) dvFinal = "0";
        else if (dvEsperado === 10) dvFinal = "K";
        else dvFinal = dvEsperado.toString();

        return dv === dvFinal;
    }

    rutInput.addEventListener("input", () => {
        if (rutInput.value === "") {
            rutError.style.display = "none";
            rutInput.style.borderBottom = "";
            return;
        }

        if (!validarRUT(rutInput.value)) {
            rutError.style.display = "block";
            rutError.textContent = "RUT no válido";
            rutInput.style.borderBottom = "2px solid red";
        } else {
            rutError.style.display = "none";
            rutInput.style.borderBottom = "2px solid green";
        }
    });

    experienciaInput.addEventListener("input", () => {
        if (experienciaInput.value < 0) {
            experienciaInput.value = 0;
        }
    });

    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) {
            badge.textContent = "En revisión";
            badge.classList.remove("bg-warning");
            badge.classList.add("bg-info");
        }
    });

    form.addEventListener("input", () => {
        const rutValido = validarRUT(rutInput.value);

        if (form.checkValidity() && rutValido) {
            btn.disabled = false;
        } else {
            btn.disabled = true;
        }
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("Perfil guardado correctamente");
    });
});
// LEGACY: controlador de perfil técnico anterior.
// El perfil técnico oficial usa miperfilTec.html con js/miperfilTec.js.
