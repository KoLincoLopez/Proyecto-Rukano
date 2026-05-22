import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ID global para almacenar la referencia del técnico actual
let uidTecnicoActual = null;

document.addEventListener("DOMContentLoaded", () => {
    // === AUTENTICACIÓN Y NAVBAR ===
    const botonPerfil = document.querySelector(".perfil-usuario") || document.querySelector(".toggle");
    const nav = document.querySelector(".nav");

    if (botonPerfil && nav) {
        botonPerfil.addEventListener("click", (e) => {
            e.stopPropagation();
            nav.classList.toggle("active");
        });
        document.addEventListener("click", (e) => {
            if (!nav.contains(e.target) && !botonPerfil.contains(e.target)) nav.classList.remove("active");
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                uidTecnicoActual = user.uid;
                const userSnap = await getDoc(doc(db, "usuarios", user.uid));
                
                if (userSnap.exists()) {
                    const datosUsuario = userSnap.data();
                    
                    // Protección de Ruta por Rol
                    if (datosUsuario.rol !== "tecnico") return window.location.href = "index.html";

                    // Ocultar botones de login/registro
                    document.querySelectorAll(".link-sesion, .btn-registro-nav").forEach(el => el.style.display = "none");

                    // Renderizar Saludo en Navbar
                    const navDerecha = document.querySelector(".nav-derecha");
                    if (navDerecha && botonPerfil && !document.getElementById("saludoNavbar")) {
                        const saludo = document.createElement("span");
                        saludo.id = "saludoNavbar";
                        saludo.style.cssText = "color: var(--c-arena); font-weight: bold; margin-right: 15px; font-size: 14px;";
                        saludo.textContent = `¡Hola, ${datosUsuario.nombre.split(" ")[0]} !`;
                        navDerecha.insertBefore(saludo, botonPerfil);
                    }

                    // Renderizar Inicial en Botón del Navbar
                    const img = botonPerfil?.querySelector("img");
                    if (img) {
                        const span = document.createElement("span");
                        span.textContent = datosUsuario.nombre.charAt(0).toUpperCase();
                        span.style.cssText = "color: white; font-size: 20px; font-weight: 900; background-color: var(--c-rosewood); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;";
                        img.replaceWith(span);
                    }

                    // === POBLAR LOS CAMPOS DEL FORMULARIO CON FIRESTORE ===
                    poblarFormularioPerfil(datosUsuario);

                }
            } catch (error) { console.error("Error al cargar perfil:", error); }
        } else {
            window.location.href = "inicioSesion.html";
        }
    });

    // === GESTIÓN DE CERRAR SESIÓN ===
    const btnCerrarSesion = document.querySelector(".cerrar-sesion");
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", async (e) => { 
            e.preventDefault(); 
            if(confirm("¿Seguro que deseas cerrar sesión?")) await signOut(auth); 
        });
    }

    // === EVENTO: GUARDAR CAMBIOS PRINCIPALES ===
    document.getElementById("btn-guardar-perfil")?.addEventListener("click", async () => {
        if (!uidTecnicoActual) return;

        const nombre = document.getElementById("input-nombre").value.trim();
        const apellido = document.getElementById("input-apellido").value.trim();
        const telefono = document.getElementById("input-telefono").value.trim();
        const especialidad = document.getElementById("input-especialidad").value.trim();

        if (!nombre || !apellido) {
            alert("⚠️ El nombre y el apellido son campos obligatorios.");
            return;
        }

        try {
            const tecRef = doc(db, "usuarios", uidTecnicoActual);
            await updateDoc(tecRef, {
                nombre: nombre,
                apellido: apellido,
                telefono: telefono,
                especialidad: especialidad
            });

            alert("¡Cambios guardados con éxito! El perfil se ha actualizado correctamente. 💾");
            window.location.reload(); // Recarga para refrescar los textos y navbar

        } catch (error) {
            console.error("Error actualizando perfil:", error);
            alert("Ocurrió un error al intentar guardar los datos.");
        }
    });

    // === EVENTO: ACTUALIZAR DESCRIPCIÓN PROFESIONAL ===
    document.getElementById("btn-actualizar-descripcion")?.addEventListener("click", async () => {
        if (!uidTecnicoActual) return;

        const descripcion = document.getElementById("textarea-descripcion").value.trim();

        try {
            const tecRef = doc(db, "usuarios", uidTecnicoActual);
            await updateDoc(tecRef, {
                descripcion: descripcion
            });

            alert("¡Descripción actualizada con éxito! 📝");
        } catch (error) {
            console.error("Error actualizando descripción:", error);
            alert("Ocurrió un error al intentar actualizar la descripción.");
        }
    });
});

// === FUNCIÓN AUXILIAR PARA VOLCAR LOS DATOS EN LOS ELEMENTOS ===
function poblarFormularioPerfil(datos) {
    if (document.getElementById("input-nombre")) document.getElementById("input-nombre").value = datos.nombre || "";
    if (document.getElementById("input-apellido")) document.getElementById("input-apellido").value = datos.apellido || "";
    if (document.getElementById("input-correo")) document.getElementById("input-correo").value = datos.correo || "";
    if (document.getElementById("input-telefono")) document.getElementById("input-telefono").value = datos.telefono || "";
    if (document.getElementById("input-especialidad")) document.getElementById("input-especialidad").value = datos.especialidad || "";
    if (document.getElementById("textarea-descripcion")) document.getElementById("textarea-descripcion").value = datos.descripcion || "";

    // Poner la inicial grande también en la foto de perfil del cuerpo si no tiene foto_perfil URL
    const contenedorFoto = document.getElementById("contenedor-foto-perfil");
    if (contenedorFoto && (!datos.foto_perfil || datos.foto_perfil === "")) {
        const spanGrande = document.createElement("div");
        spanGrande.textContent = (datos.nombre || "R").charAt(0).toUpperCase();
        spanGrande.style.cssText = "color: white; font-size: 48px; font-weight: 900; background-color: var(--c-rosewood); width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; border-radius: 50%; margin: 0 auto;";
        
        const imgInterna = contenedorFoto.querySelector("img");
        if (imgInterna) imgInterna.replaceWith(spanGrande);
    } else if (contenedorFoto && datos.foto_perfil) {
        const imgInterna = contenedorFoto.querySelector("img");
        if (imgInterna) imgInterna.src = datos.foto_perfil;
    }
}