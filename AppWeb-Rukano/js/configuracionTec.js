import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    // === 1. MENÚ DESPLEGABLE NAVBAR ===
    const botonPerfil = document.querySelector(".perfil-usuario") || document.querySelector(".toggle");
    const nav = document.querySelector(".nav");

    if (botonPerfil && nav) {
        botonPerfil.addEventListener("click", () => nav.classList.toggle("active"));
    }

    // === 2. AUTENTICACIÓN Y CARGA DE DATOS ===
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "inicioSesion.html";
            return;
        }

        try {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const datosUsuario = userSnap.data();
                
                // Redirigir si no es técnico
                if (datosUsuario.rol !== "tecnico") {
                    window.location.href = "index.html";
                    return;
                }

                // --- CONFIGURACIÓN VISUAL DEL NAVBAR ---
                document.querySelectorAll(".link-sesion, .btn-registro-nav").forEach(el => el.style.display = "none");

                const navDerecha = document.querySelector(".nav-derecha");
                if (navDerecha && botonPerfil && !document.getElementById("saludoNavbar")) {
                    const saludo = document.createElement("span");
                    saludo.id = "saludoNavbar";
                    saludo.style.cssText = "color: var(--c-arena); font-weight: bold; margin-right: 15px; font-size: 14px;";
                    saludo.textContent = `¡Hola, ${datosUsuario.nombre.split(" ")[0]}!`;
                    navDerecha.insertBefore(saludo, botonPerfil);
                }

                const img = botonPerfil?.querySelector("img");
                if (img) {
                    const span = document.createElement("span");
                    span.textContent = datosUsuario.nombre.charAt(0).toUpperCase();
                    span.style.cssText = "color: white; font-size: 20px; font-weight: 900; background-color: var(--c-rosewood); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;";
                    img.replaceWith(span);
                }

                // --- 3. DISPONIBILIDAD (Único botón .boton, índice 0) ---
                const botones = document.querySelectorAll('.boton');
                let estadoDisp = datosUsuario.disponibilidad || 'Disponible';

                // Configurar estado inicial desde la Base de Datos
                if (botones[0]) {
                    botones[0].innerText = estadoDisp;
                    botones[0].style.background = estadoDisp === 'Disponible' ? '#550006' : '#BF353B';

                    // Evento Click para cambiar disponibilidad en tiempo real
                    botones[0].addEventListener('click', async () => {
                        // Alternar el estado
                        estadoDisp = estadoDisp === 'Disponible' ? 'Ocupado' : 'Disponible';
                        
                        // Actualizar elementos visuales
                        botones[0].innerText = estadoDisp;
                        botones[0].style.background = estadoDisp === 'Disponible' ? '#550006' : '#BF353B';
                        
                        // Guardar el cambio inmediatamente en Firestore
                        try {
                            await updateDoc(userRef, { disponibilidad: estadoDisp });
                        } catch (error) {
                            console.error("Error al guardar disponibilidad:", error);
                        }
                    });
                }

                // --- 4. ELIMINAR CUENTA (Zona de Peligro) ---
                const btnEliminar = document.querySelector('.btn-eliminar');
                if (btnEliminar) {
                    btnEliminar.addEventListener('click', async () => {
                        const confirmar = confirm('¿Estás 100% seguro de que deseas eliminar tu cuenta? Esta acción borrará todos tus datos permanentemente y no se puede deshacer.');
                        
                        if (confirmar) {
                            try {
                                // 1. Borrar documento del usuario en Firestore
                                await deleteDoc(userRef);
                                // 2. Borrar autenticación de Firebase
                                await deleteUser(user);
                                
                                alert("Tu cuenta ha sido eliminada. Lamentamos verte partir.");
                                window.location.href = "index.html";
                            } catch (error) {
                                if (error.code === 'auth/requires-recent-login') {
                                    alert("Por motivos de seguridad, debes cerrar sesión y volver a iniciarla para poder eliminar tu cuenta.");
                                } else {
                                    console.error("Error al eliminar cuenta:", error);
                                    alert("Hubo un error al eliminar tu cuenta.");
                                }
                            }
                        }
                    });
                }

            }
        } catch (error) { 
            console.error("Error al cargar configuración:", error); 
        }
    });

    // === 5. CERRAR SESIÓN ===
    const btnCerrarSesion = document.querySelector(".cerrar-sesion");
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", async (e) => { 
            e.preventDefault(); 
            await signOut(auth); 
        });
    }
});