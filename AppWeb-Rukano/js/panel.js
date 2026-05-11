import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {
    const navbar = document.querySelector(".navbar-integrada");

    const actualizarNavbar = () => {
        if (!navbar) return;

        if (window.scrollY > 50) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
    };

    actualizarNavbar();
    window.addEventListener("scroll", actualizarNavbar);

    const inputBusqueda = document.querySelector(".input-panel");
    const lupaBusqueda = document.querySelector(".lupa-panel");
    const botonesCategoria = document.querySelectorAll(".btn-panel[data-categoria]");
    const grillaServicios = document.querySelector("#resultados-servicios-panel");
    const comunaActual = localStorage.getItem("rukano_comuna") || "Santiago";
    const apiBaseUrl = getApiBaseUrl();

    if (grillaServicios) {
        grillaServicios.innerHTML = crearEstadoBusqueda("Busca un servicio o elige una categoria.");
    }

    const buscarPorTexto = () => {
        const texto = inputBusqueda?.value.trim();
        if (!texto) return;

        cargarServicios(`/search/busqueda_general/${encodeURIComponent(comunaActual)}/${encodeURIComponent(texto)}`);
    };

    inputBusqueda?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            buscarPorTexto();
        }
    });

    lupaBusqueda?.addEventListener("click", buscarPorTexto);

    botonesCategoria.forEach((boton) => {
        boton.addEventListener("click", () => {
            botonesCategoria.forEach((item) => item.classList.remove("activo"));
            boton.classList.add("activo");

            const categoria = boton.dataset.categoria;
            cargarServicios(`/search/categoria_solicitada/${encodeURIComponent(comunaActual)}/${encodeURIComponent(categoria)}`);
        });
    });

    async function cargarServicios(path) {
        if (!grillaServicios) return;

        grillaServicios.innerHTML = crearEstadoBusqueda("Buscando servicios...");

        try {
            const response = await fetch(`${apiBaseUrl}${path}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `Error ${response.status}`);
            }

            const servicios = normalizarServicios(data);
            renderServicios(servicios);
        } catch (error) {
            console.error("Error en busqueda:", error);
            grillaServicios.innerHTML = crearEstadoBusqueda("No pudimos cargar los servicios.");
        }
    }

    function renderServicios(servicios) {
        if (!servicios.length) {
            grillaServicios.innerHTML = crearEstadoBusqueda("No se encontraron servicios.");
            return;
        }

        grillaServicios.innerHTML = servicios.map((servicio) => crearCardServicioPanel(servicio)).join("");
        grillaServicios.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    /*
    // Verificar sesion + rol
    // Comentado temporalmente para probar el panel sin iniciar sesion.
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

            // Bloquear acceso incorrecto
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
    */

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

function getApiBaseUrl() {
    const isLocal = (
        window.location.protocol === "file:" ||
        ["localhost", "127.0.0.1"].includes(window.location.hostname)
    );

    return isLocal ? "http://localhost:8000" : "https://rukano-sph.onrender.com";
}

function normalizarServicios(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;
    return [];
}

function crearCardServicioPanel(servicio) {
    const titulo = servicio.titulo || servicio.nombre || "Servicio disponible";
    const categoria = servicio.categoria || "Servicio";
    const descripcion = servicio.descripcion || servicio.descripcion_corta || servicio["descripción"] || servicio["descripciÃ³n"] || "Profesional disponible en tu zona.";
    const precio = servicio["precio base"] || servicio.precio_base || servicio.precio || null;
    const zona = servicio.es_local ? "En tu comuna" : "Comuna cercana";

    return `
        <article class="card-servicio-panel">
            <div>
                <span class="nota-badge-panel">${escapeHtml(zona)}</span>
                <h3>${escapeHtml(titulo)}</h3>
                <p class="categoria-servicio-panel">${escapeHtml(categoria)}</p>
                <p class="descripcion-servicio-panel">${escapeHtml(descripcion)}</p>
            </div>
            <button class="btn-servicio-panel">${precio ? `DESDE $${escapeHtml(String(precio))}` : "VER SERVICIO"}</button>
        </article>
    `;
}

function crearEstadoBusqueda(texto) {
    return `<div class="estado-busqueda-panel">${escapeHtml(texto)}</div>`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
