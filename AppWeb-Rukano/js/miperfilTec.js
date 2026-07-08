import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "inicioSesion.html";
        return;
    }

    try {
        const usuarioSnap = await getDoc(doc(db, "usuarios", user.uid));

        if (!usuarioSnap.exists()) {
            window.location.href = "inicioSesion.html";
            return;
        }

        const datosUsuario = usuarioSnap.data();
        const rol = normalizarRol(datosUsuario.rol);

        if (rol === "cliente") {
            window.location.href = "panelCliente.html";
            return;
        }

        if (rol !== "tecnico") {
            window.location.href = "inicioSesion.html";
            return;
        }

        renderizarPerfilTecnico(datosUsuario, user);
        
        // ACTIVACIÓN DE PESTAÑAS: Se ejecuta justo después de cargar los datos del técnico
        inicializarTabsPerfil();

    } catch (error) {
        console.log("Error al validar acceso tecnico:", error);
        window.location.href = "inicioSesion.html";
    }
});

function normalizarRol(rol) {
    return String(rol || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// FUNCIÓN CORREGIDA Y REFORZADA CONTRA ERRORES DE CSS
function inicializarTabsPerfil() {
    const panelInformacion = document.getElementById("tab-informacion");
    const panelCertificacion = document.getElementById("tab-certificacion");

    if (!panelInformacion || !panelCertificacion) return;

    const botonesTabs = document.querySelectorAll(".perfil-tab");

    botonesTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const target = tab.dataset.tab;

            // 1. Manejar el estado visual de los botones superiores
            botonesTabs.forEach((btn) => {
                btn.classList.remove("perfil-tab--active");
                btn.setAttribute("aria-selected", "false");
            });

            tab.classList.add("perfil-tab--active");
            tab.setAttribute("aria-selected", "true");

            // 2. Forzar visualización con !important para romper cualquier restricción del CSS
            if (target === "informacion") {
                panelInformacion.style.setProperty("display", "grid", "important"); // Perfil usa diseño grid
                panelInformacion.removeAttribute("hidden");
                
                panelCertificacion.style.setProperty("display", "none", "important");
                panelCertificacion.setAttribute("hidden", "true");
            } else if (target === "certificacion") {
                panelInformacion.style.setProperty("display", "none", "important");
                panelInformacion.setAttribute("hidden", "true");
                
                panelCertificacion.style.setProperty("display", "block", "important"); // Muestra la certificación limpia
                panelCertificacion.removeAttribute("hidden");
            }
        });
    });

    // 3. ESTADO INICIAL: Mostrar Información y ocultar Certificación al cargar la página
    panelInformacion.style.setProperty("display", "grid", "important");
    panelInformacion.removeAttribute("hidden");
    
    panelCertificacion.style.setProperty("display", "none", "important");
    panelCertificacion.setAttribute("hidden", "true");

    if (window.location.hash === "#certificacion") {
        document.querySelector('.perfil-tab[data-tab="certificacion"]')?.click();
    }
}

function renderizarPerfilTecnico(datosUsuario, user) {
    const nombre = obtenerDato(datosUsuario.nombre ?? datosUsuario.nombres, "No registrado");
    const apellido = obtenerDato(datosUsuario.apellido ?? datosUsuario.apellidos, "No registrado");
    const correo = obtenerDato(datosUsuario.correo ?? datosUsuario.email ?? user?.email, "No registrado");
    const telefono = obtenerDato(datosUsuario.telefono ?? datosUsuario.telefonoContacto ?? datosUsuario.phone, "No registrado");
    const comuna = obtenerDato(datosUsuario.comuna, "No registrado");
    const especialidad = obtenerEspecialidad(datosUsuario);
    const descripcion = obtenerDato(
        datosUsuario.descripcionTecnico ?? datosUsuario.descripcion ?? datosUsuario.bio,
        "Sin descripción"
    );
    const experiencia = obtenerDato(datosUsuario.experiencia, "Sin experiencia registrada");

    asignarValor("perfilNombre", nombre);
    asignarValor("perfilApellido", apellido);
    asignarValor("perfilCorreo", correo);
    asignarValor("perfilTelefono", telefono);
    asignarValor("perfilComuna", comuna);
    asignarValor("perfilEspecialidad", especialidad);
    asignarValor("perfilExperiencia", experiencia);
    asignarValor("perfilDescripcion", descripcion);
    renderizarFotoPerfil(datosUsuario, user, nombre, apellido);
}

function obtenerEspecialidad(datosUsuario) {
    const especialidad = datosUsuario.especialidad
        ?? datosUsuario.categoria
        ?? datosUsuario.rubro
        ?? datosUsuario.profesion
        ?? datosUsuario.servicioPrincipal;

    if (Array.isArray(especialidad)) {
        const valores = especialidad.map((valor) => obtenerDato(valor, "")).filter(Boolean);
        return valores.length ? valores.join(", ") : "No registrado";
    }

    return obtenerDato(especialidad, "No registrado");
}

function obtenerEstadoVerificacion(datosUsuario) {
    const estado = datosUsuario.verificado ?? datosUsuario.estadoVerificado ?? datosUsuario.estado_verificacion;

    if (estado === true) return "Verificado";
    if (estado === false || estado == null) return "Pendiente de verificación";

    return obtenerDato(estado, "Pendiente de verificación");
}

function renderizarFotoPerfil(datosUsuario, user, nombre, apellido) {
    const imagen = document.getElementById("perfilFoto");
    const fallback = document.getElementById("perfilFotoFallback");

    if (!imagen || !fallback) return;

    const fotoPerfil = obtenerDato(
        datosUsuario.foto_perfil ?? datosUsuario.foto ?? datosUsuario.photoURL ?? user?.photoURL,
        ""
    );

    if (fotoPerfil) {
        imagen.src = fotoPerfil;
        imagen.hidden = false;
        fallback.hidden = true;
        return;
    }

    imagen.removeAttribute("src");
    imagen.hidden = true;
    fallback.textContent = obtenerIniciales(nombre, apellido);
    fallback.hidden = false;
}

function obtenerIniciales(nombre, apellido) {
    const inicialNombre = obtenerDato(nombre, "").charAt(0);
    const inicialApellido = obtenerDato(apellido, "").charAt(0);
    const iniciales = `${inicialNombre}${inicialApellido}`.trim();

    return iniciales || "T";
}

function asignarValor(id, valor) {
    const elemento = document.getElementById(id);
    if (!elemento) return;

    const valorSeguro = obtenerDato(valor, "No registrado");

    if ("value" in elemento) {
        elemento.value = valorSeguro;
        return;
    }

    elemento.textContent = valorSeguro;
}

function obtenerDato(valor, fallback) {
    if (valor === undefined || valor === null) return fallback;

    const texto = String(valor).trim();
    return texto || fallback;
}
