import { auth, db } from "./Firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {

    const checkbox = document.getElementById("showPassword");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");
    const btnRegistro = document.getElementById("btnRegistro");

    if (checkbox) {
        checkbox.addEventListener("change", () => {
            const tipo = checkbox.checked ? "text" : "password";
            password.type = tipo;
            confirmPassword.type = tipo;
        });
    }

    btnRegistro?.addEventListener("click", async () => {

        const nombre = document.getElementById("nombres").value.trim();
        const apellido = document.getElementById("apellidos").value.trim();
        const telefono = document.getElementById("telefono").value.trim();
        const email = document.getElementById("email").value.trim();
        const rol = document.querySelector('input[name="rol"]:checked')?.value || "";

        const pass = password.value.trim();
        const confirmPass = confirmPassword.value.trim();

        if (!nombre || !apellido || !telefono || !email || !pass || !confirmPass || !rol) {
            alert("Completa todos los campos");
            return;
        }

        if (pass !== confirmPass) {
            alert("Las contraseñas no coinciden");
            return;
        }

        if (pass.length < 6) {
            alert("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            await setDoc(doc(db, "usuarios", user.uid), {
                id: user.uid,
                uid: user.uid,
                nombre: nombre,
                apellido: apellido,
                nombres: nombre,
                apellidos: apellido,
                telefono: telefono,
                email: email,
                correo: email,
                rol: rol,
                fechaRegistro: new Date()
            });

            alert("Usuario registrado correctamente");
            window.location.href = "inicioSesion.html";

        } catch (error) {
            console.log("Error al registrar usuario:", error);
            alert("Error al registrar usuario: " + error.message);
        }

    });

});