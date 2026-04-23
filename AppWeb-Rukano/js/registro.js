import { auth, db } from "./Firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {

    console.log("REGISTRO JS CARGADO");

    //  ELEMENTOS
    const checkbox = document.getElementById("showPassword");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");
    const btnRegistro = document.getElementById("btnRegistro");

    //  Validar existencia de elementos clave
    if (!btnRegistro || !password || !confirmPassword) {
        console.error("Faltan elementos");
        return;
    }

    //  Mostrar / ocultar contraseña
    if (checkbox) {
        checkbox.addEventListener("change", () => {
            const tipo = checkbox.checked ? "text" : "password";
            password.type = tipo;
            confirmPassword.type = tipo;
        });
    }

    //  REGISTRO
    btnRegistro.addEventListener("click", async () => {

        console.log("CLICK REGISTRO");

        const nombres = document.getElementById("nombres")?.value.trim();
        const apellidos = document.getElementById("apellidos")?.value.trim();
        const telefono = document.getElementById("telefono")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const rol = document.getElementById("rol")?.value;

        const pass = password.value.trim();
        const confirmPass = confirmPassword.value.trim();

        //  VALIDACIONES
        if (!nombres || !apellidos || !telefono || !email || !pass || !confirmPass) {
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
            //  Crear usuario en Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            console.log("Usuario creado:", user.uid);

            // Guardar en Firestore
            await setDoc(doc(db, "usuarios", user.uid), {
                nombres,
                apellidos,
                telefono,
                email,
                rol: rol || "cliente", 
                fechaRegistro: new Date()
            });

            alert("Usuario registrado correctamente ");

            // formulario
            document.getElementById("nombres").value = "";
            document.getElementById("apellidos").value = "";
            document.getElementById("telefono").value = "";
            document.getElementById("email").value = "";
            password.value = "";
            confirmPassword.value = "";

        } catch (error) {
            console.error("ERROR REGISTRO:", error);

            if (error.code === "auth/email-already-in-use") {
                alert("El correo ya está registrado");
            } else if (error.code === "auth/invalid-email") {
                alert("Correo inválido");
            } else if (error.code === "auth/weak-password") {
                alert("Contraseña muy débil");
            } else {
                alert("Error: " + error.message);
            }
        }

    });

});