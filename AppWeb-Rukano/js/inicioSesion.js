import { auth } from "./Firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

window.addEventListener("DOMContentLoaded", () => {
    const btnLogin = document.getElementById("btnLogin");
    const emailInput = document.getElementById("emailLogin");
    const passwordInput = document.getElementById("passwordLogin");
    const apiBaseUrl = getApiBaseUrl();

    btnLogin?.addEventListener("click", async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert("Por favor, ingresa tu correo y contraseña.");
            return;
        }

        try {
            // INDICADOR VISUAL (Restricción de Interfaz [7])
            btnLogin.disabled = true;
            btnLogin.innerText = "Validando...";

            // 1. Login con Firebase Auth (Correo/Contraseña)
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Obtener Token para el Backend (Seguridad RNF 3 [2])
            const token = await user.getIdToken();

            // 3. Validación en el Backend local
            const response = await fetch(`${apiBaseUrl}/auth/validate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error("Error en la validación del servidor");

            const data = await response.json();

            // =======================================================
            // 4. Redirección por Rol (¡AQUÍ ESTÁ EL CAMBIO!)
            // =======================================================
            const rol = String(data.rol || "").toLowerCase();
            
            if (rol === "tecnico") {
                window.location.href = "dashboard.html"; // <-- Lo enviamos al nuevo Dashboard
            } else if (rol === "cliente") {
                window.location.href = "index.html";     // <-- Lo enviamos a la página de inicio
            } else {
                alert("Usuario autenticado pero sin rol asignado.");
                window.location.href = "index.html";     // Por seguridad lo enviamos al inicio
            }

        } catch (error) {
            console.error(error);
            alert("Fallo en el inicio de sesión: " + (error.message || "Credenciales incorrectas"));
            btnLogin.disabled = false;
            btnLogin.innerText = "Iniciar Sesión";
        }
    });
});

function getApiBaseUrl() {
    return (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
        ? "http://localhost:8000"
        : "https://rukano-sph.onrender.com";
}