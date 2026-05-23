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
    const estadoVerificacion = obtenerEstadoVerificacion(datosUsuario);

    asignarValor("perfilNombre", nombre);
    asignarValor("perfilApellido", apellido);
    asignarValor("perfilCorreo", correo);
    asignarValor("perfilTelefono", telefono);
    asignarValor("perfilComuna", comuna);
    asignarValor("perfilEspecialidad", especialidad);
    asignarValor("perfilExperiencia", experiencia);
    asignarValor("perfilVerificado", estadoVerificacion);
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
