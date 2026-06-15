import { auth } from "./Firebase-config.js";
import {
    createUserWithEmailAndPassword,
    deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { apiFetch } from "./apiFetch.js";

const API_URL = window.RukanoApiConfig.getApiBaseUrl();

window.addEventListener("DOMContentLoaded", () => {
    const checkbox = document.getElementById("showPassword");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");
    const btnRegistro = document.getElementById("btnRegistro");
    const campoEspecialidad = document.getElementById("campoEspecialidad");
    const inputEspecialidad = document.getElementById("especialidad");
    const radiosRol = document.querySelectorAll('input[name="rol"]');
    const rolSolicitado = new URLSearchParams(window.location.search).get("rol");

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

    if (rolSolicitado === "cliente" || rolSolicitado === "tecnico") {
        const radioInicial = document.querySelector(`input[name="rol"][value="${rolSolicitado}"]`);
        if (radioInicial) radioInicial.checked = true;
    }
    actualizarCampoEspecialidad();

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

        let user = null;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            user = userCredential.user;

            const usuarioNuevo = {
                nombre: nombres,
                apellido: apellidos,
                telefono,
                comuna,
                correo: email,
                rol,
                especialidad: rol === "tecnico" ? especialidad : ""
            };

            const response = await apiFetch(`${API_URL}/users/registro/${rol}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(usuarioNuevo)
            });
            const resultado = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(resultado.detail || "No se pudo completar el registro");
            }

            alert("Usuario registrado correctamente");
            window.location.href = "inicioSesion.html";
        } catch (error) {
            if (user) {
                await deleteUser(user).catch(() => {});
            }
            alert("Error: " + error.message);
        }
    });
});

function obtenerValor(id) {
    return document.getElementById(id)?.value.trim() || "";
}
