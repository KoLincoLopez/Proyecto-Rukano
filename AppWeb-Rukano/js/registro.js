import { auth, db } from "./Firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {
    const checkbox = document.getElementById("showPassword");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");
    const btnRegistro = document.getElementById("btnRegistro");
    const campoEspecialidad = document.getElementById("campoEspecialidad");
    const inputEspecialidad = document.getElementById("especialidad");
    const radiosRol = document.querySelectorAll('input[name="rol"]');

    if (checkbox) {
        checkbox.addEventListener("change", () => {
            const tipo = checkbox.checked ? "text" : "password";
            password.type = tipo;
            confirmPassword.type = tipo;
        });
    }

    radiosRol.forEach((radio) => {
        radio.addEventListener("change", actualizarCampoEspecialidad);
    });

    function actualizarCampoEspecialidad() {
        const rol = document.querySelector('input[name="rol"]:checked')?.value || "";
        const esTecnico = rol === "tecnico";

        if (campoEspecialidad) {
            campoEspecialidad.hidden = !esTecnico;
        }

        if (inputEspecialidad) {
            inputEspecialidad.required = esTecnico;
            if (!esTecnico) inputEspecialidad.value = "";
        }
    }

    btnRegistro?.addEventListener("click", async () => {
        const nombres = obtenerValor("nombres");
        const apellidos = obtenerValor("apellidos");
        const telefono = obtenerValor("telefono");
        const comuna = obtenerValor("comuna");
        const email = obtenerValor("email");
        const rol = document.querySelector('input[name="rol"]:checked')?.value || "";
        const especialidad = inputEspecialidad?.value.trim() || "";

        const pass = password.value.trim();
        const confirmPass = confirmPassword.value.trim();

        if (!nombres || !apellidos || !telefono || !comuna || !email || !pass || !confirmPass || !rol) {
            alert("Completa todos los campos");
            return;
        }

        if (rol === "tecnico" && !especialidad) {
            alert("Indica tu especialidad tecnica");
            return;
        }

        if (pass !== confirmPass) {
            alert("Las contrasenas no coinciden");
            return;
        }

        if (pass.length < 6) {
            alert("La contrasena debe tener al menos 6 caracteres");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            const usuarioNuevo = {
                id: user.uid,
                nombre: nombres,
                apellido: apellidos,
                nombres,
                apellidos,
                telefono,
                comuna,
                correo: email,
                email,
                rol,
                especialidad: rol === "tecnico" ? especialidad : "",
                fechaRegistro: new Date()
            };

            await setDoc(doc(db, "usuarios", user.uid), usuarioNuevo);

            alert("Usuario registrado correctamente");
            window.location.href = "inicioSesion.html";
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
});

function obtenerValor(id) {
    return document.getElementById(id)?.value.trim() || "";
}
