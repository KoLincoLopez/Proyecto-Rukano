import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {

    //  Verificar sesión + rol
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "inicioSesion.html";
            return;
        }

        try {
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                alert("Error: usuario sin datos");
                await signOut(auth);
                window.location.href = "inicioSesion.html";
                return;
            }

            const rol = docSnap.data().rol;
            const paginaActual = window.location.pathname;

            //  Bloquear acceso incorrecto
            if (rol === "cliente" && paginaActual.includes("panelTecnico")) {
                window.location.href = "panelCliente.html";
            }

            if (rol === "tecnico" && paginaActual.includes("panelCliente")) {
                window.location.href = "panelTecnico.html";
            }

        } catch (error) {
            console.log("Error al obtener rol:", error);
        }
    });

    // Logout seguro
    const btnLogout = document.getElementById("btnLogout");

    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try {
                await signOut(auth);
                window.location.href = "inicioSesion.html";
            } catch (error) {
                console.log("Error al cerrar sesión:", error);
            }
        });
    }

});