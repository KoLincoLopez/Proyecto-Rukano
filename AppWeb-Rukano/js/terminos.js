import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    const authContainer = document.getElementById("auth-container");

    // OBSERVADOR DE SESIÓN (Revisa si el usuario está logueado para actualizar el Navbar)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);
                
                let nombreUsuario = user.displayName || "Usuario";
                if (userSnap.exists() && userSnap.data().nombre) {
                    nombreUsuario = userSnap.data().nombre;
                }
                
                if (authContainer) {
                    authContainer.innerHTML = `
                        <div class="perfil-nav-container">
                            <div class="usuario-badge">
                                <span class="usuario-inicial">${nombreUsuario.charAt(0).toUpperCase()}</span>
                                <span class="usuario-nombre">${nombreUsuario.toUpperCase()}</span>
                            </div>
                            <a href="panelCliente.html" class="btn-perfil-nav">MI PERFIL</a>
                        </div>
                    `;
                }
            } catch (error) {
                console.error("Error obteniendo datos del usuario:", error);
            }
        } else {
            if (authContainer) {
                authContainer.innerHTML = `
                    <a href="inicioSesion.html" class="link-sesion">Iniciar sesión</a>
                    <a href="registro.html" class="btn-registro-nav">Registrarse</a>
                `;
            }
        }
    });
});