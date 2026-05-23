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
            alert("Por favor, ingresa tu correo y contrasena.");
            return;
        }

        try {
            btnLogin.disabled = true;
            btnLogin.innerText = "Validando...";

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const token = await userCredential.user.getIdToken();

            const response = await fetch(`${apiBaseUrl}/auth/validate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error("Error en la validacion del servidor");

            const data = await response.json();
            const rol = normalizarRol(data.rol);

            if (rol === "tecnico") {
                window.location.href = "panelTecnico.html";
            } else if (rol === "cliente") {
                window.location.href = "panelCliente.html";
            } else {
                alert("Usuario autenticado pero sin rol asignado.");
                window.location.href = "index.html";
            }
        } catch (error) {
            console.error(error);
            alert("Fallo en el inicio de sesion: " + (error.message || "Credenciales incorrectas"));
            btnLogin.disabled = false;
            btnLogin.innerText = "Iniciar Sesion";
        }
    });
});

function getApiBaseUrl() {
    return window.RukanoApiConfig.getApiBaseUrl();
}

function normalizarRol(rol) {
    return String(rol || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}
