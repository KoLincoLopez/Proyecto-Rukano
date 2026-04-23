import { auth } from "./Firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

window.addEventListener("DOMContentLoaded", () => {

    console.log("inicioSesion.js CARGADO");

    //  ELEMENTOS
    const btnLogin = document.getElementById("btnLogin");
    const emailInput = document.getElementById("emailLogin");
    const passwordInput = document.getElementById("passwordLogin");
    const checkbox = document.getElementById("showPasswordLogin");

    //  Validar elementos
    if (!btnLogin || !emailInput || !passwordInput) {
        console.error("Faltan elementos");
        return;
    }

    //  Mostrar / ocultar contraseña
    if (checkbox) {
        checkbox.addEventListener("change", () => {
            passwordInput.type = checkbox.checked ? "text" : "password";
        });
    }

    //  LOGIN
    btnLogin.addEventListener("click", async () => {

        console.log("CLICK LOGIN");

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        //  Validación
        if (!email || !password) {
            alert("Completa todos los campos");
            return;
        }

        try {
            //  Autenticación
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            console.log("Usuario logueado:", userCredential.user.email);

            alert("Inicio de sesión exitoso ");

            //  Redirección simple (sin rol)
            window.location.href = "panel.html";

        } catch (error) {
            console.error("ERROR LOGIN:", error);

            if (error.code === "auth/user-not-found") {
                alert("Usuario no registrado");
            } else if (error.code === "auth/wrong-password") {
                alert("Contraseña incorrecta");
            } else if (error.code === "auth/invalid-email") {
                alert("Correo inválido");
            } else {
                alert("Error: " + error.message);
            }
        }

    });

});