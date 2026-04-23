import { auth, db } from "./Firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {

    const btnLogin = document.getElementById("btnLogin");
    const emailInput = document.getElementById("emailLogin");
    const passwordInput = document.getElementById("passwordLogin");
    const checkbox = document.getElementById("showPasswordLogin");

    //  Mostrar contraseña
    if (checkbox) {
        checkbox.addEventListener("change", () => {
            passwordInput.type = checkbox.checked ? "text" : "password";
        });
    }

    //  LOGIN
    btnLogin.addEventListener("click", async () => {

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert("Completa todos los campos");
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            //  OBTENER ROL
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                alert("Usuario sin datos");
                return;
            }

            const rol = docSnap.data().rol;

            // REDIRECCIÓN
            if (rol === "cliente") {
                window.location.href = "panelCliente.html";
            } else if (rol === "tecnico") {
                window.location.href = "panelTecnico.html";
            }

        } catch (error) {
            alert("Error: " + error.message);
        }

    });

});