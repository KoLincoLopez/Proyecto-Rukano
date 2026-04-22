import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

//  Esperar a que cargue todo el HTML
window.addEventListener("load", () => {

    // MOSTRAR / OCULTAR PASSWORD
    const checkbox = document.getElementById("showPassword");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");

    if (checkbox && password && confirmPassword) {
        checkbox.addEventListener("change", () => {
            const tipo = checkbox.checked ? "text" : "password";
            password.type = tipo;
            confirmPassword.type = tipo;
        });
    } else {
        console.error(" No se encontraron los elementos de contraseña o checkbox");
    }

    //  REGISTRO
    
    const btnRegistro = document.getElementById("btnRegistro");

    if (!btnRegistro) {
        console.error(" No existe el botón btnRegistro");
        return;
    }

    btnRegistro.addEventListener("click", async () => {

        const nombres = document.getElementById("nombres").value;
        const apellidos = document.getElementById("apellidos").value;
        const telefono = document.getElementById("telefono").value;
        const email = document.getElementById("email").value;
        const rol = document.getElementById("rol").value;

        const pass = document.getElementById("password").value;
        const confirmPass = document.getElementById("confirmPassword").value;

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
            //  Crear usuario en Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            //  Guardar en Firestore
            await setDoc(doc(db, "usuarios", user.uid), {
                nombres: nombres,
                apellidos: apellidos,
                telefono: telefono,
                email: email,
                rol: rol,
                fechaRegistro: new Date()
            });

            alert("Usuario registrado correctamente 🎉");

        } catch (error) {
            console.error(error);

            if (error.code === "auth/email-already-in-use") {
                alert("El correo ya está registrado");
            } else {
                alert("Error: " + error.message);
            }
        }

    });

});
