import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {

    const btnLogin = document.getElementById("btnLogin");
    const emailInput = document.getElementById("emailLogin");
    const passwordInput = document.getElementById("passwordLogin");
    const checkbox = document.getElementById("showPasswordLogin");

    console.log("LOGIN JS CARGADO"); 

    // Mostrar contraseña
    if (checkbox) {
        checkbox.addEventListener("change", () => {
            passwordInput.type = checkbox.checked ? "text" : "password";
        });
    }

    btnLogin.addEventListener("click", async () => {

        console.log("CLICK LOGIN");

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!email || !password) {
            alert("Completa todos los campos");
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                alert("Usuario no existe en Firestore");
                return;
            }

            const data = docSnap.data();

            if (data.rol === "tecnico") {
                window.location.href = "panel-tecnico.html";
            } else {
                window.location.href = "panel-cliente.html";
            }

        } catch (error) {
            console.error("ERROR LOGIN:", error);

            alert(error.message);
        }

    });

});
