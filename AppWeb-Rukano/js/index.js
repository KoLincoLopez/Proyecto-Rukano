document.addEventListener("DOMContentLoaded", () => {
    const navbar = document.querySelector(".navbar-integrada");
    const inputBusqueda = document.querySelector(".input-invisible");
    const lupaBusqueda = document.querySelector(".lupa-profesional");
    const botonesCategoria = document.querySelectorAll(".boton-ovalado[data-categoria]");
    const grillaServicios = document.querySelector("#servicios");
    const comunaActual = localStorage.getItem("rukano_comuna") || "Santiago";
    const apiBaseUrl = getApiBaseUrl();

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

        grillaServicios.innerHTML = servicios.map((servicio) => crearCardServicio(servicio)).join("");
        grillaServicios.scrollIntoView({ behavior: "smooth", block: "start" });
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
    if (Array.isArray(data.results)) return data.results;
    return [];
}

function crearCardServicio(servicio) {
    const titulo = servicio.titulo || servicio.nombre || "Servicio disponible";
    const categoria = servicio.categoria || "Servicio";
    const descripcion = servicio.descripcion || servicio["descripción"] || servicio["descripciÃ³n"] || "Profesional disponible en tu zona.";
    const precio = servicio["precio base"] || servicio.precio_base || servicio.precio || null;
    const zona = servicio.es_local ? "En tu comuna" : "Comuna cercana";

    return `
        <article class="card-editorial">
            <div class="card-header-pro">
                <div class="avatar-circular">
                    <img src="https://cdn-icons-png.flaticon.com/512/4792/4792929.png" alt="Tecnico" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">
                </div>
                <div class="info-titulos">
                    <span class="nota-badge">${escapeHtml(zona)}</span>
                    <h3 class="nombre-masivo">${escapeHtml(titulo)}</h3>
                    <p class="tag-especialidad">${escapeHtml(categoria)}</p>
                </div>
            </div>

            <div class="card-body-pro">
                <p class="texto-resumen">${escapeHtml(descripcion)}</p>
                <button class="btn-outlined-pro">${precio ? `DESDE $${escapeHtml(String(precio))}` : "VER PERFIL COMPLETO"}</button>
            </div>
        </article>
    `;
}

function crearEstadoBusqueda(texto) {
    return `<div class="estado-busqueda">${escapeHtml(texto)}</div>`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
