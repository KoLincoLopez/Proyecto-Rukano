import { auth } from "./Firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

window.addEventListener("DOMContentLoaded", () => {

    const btnLogin = document.getElementById("btnLogin");
    const emailInput = document.getElementById("emailLogin");
    const passwordInput = document.getElementById("passwordLogin");
    const checkbox = document.getElementById("showPasswordLogin");

    // Mostrar contraseña
    if (checkbox) {
        checkbox.addEventListener("change", () => {
            passwordInput.type = checkbox.checked ? "text" : "password";
        });
    }

    // LOGIN
    btnLogin.addEventListener("click", async () => {

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert("Completa todos los campos");
            return;
        }

        try {
            // Login con Firebase
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const token = await user.getIdToken();

            const response = await fetch("http://localhost:8000/auth/validate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Error backend: ${response.status}`);
            }

            const data = await response.json();

            console.log("Respuesta backend:", data);

            // Redirección según rol
            if (data.rol === "TECNICO") {
                window.location.href = "panelTecnico.html";
            } else if (data.rol === "CLIENTE") {
                window.location.href = "panelCliente.html";
            } else {
                alert("Rol desconocido");
            }

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        }

    });

});