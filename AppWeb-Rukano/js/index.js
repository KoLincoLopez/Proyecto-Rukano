import { db } from "./Firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let servicios = [];
let serviciosActuales = [];
let cantidadVisible = 6;

document.addEventListener("DOMContentLoaded", () => {
    const navbar = document.querySelector(".navbar-integrada");
    const inputBusqueda = document.querySelector(".input-invisible");
    const lupaBusqueda = document.querySelector(".lupa-profesional");
    const botonesCategoria = document.querySelectorAll(".boton-ovalado[data-categoria]");
    const grillaServicios = document.querySelector("#servicios");

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

    async function cargarServiciosFirestore() {
        if (!grillaServicios) return;

        grillaServicios.innerHTML = crearEstadoBusqueda("Cargando servicios...");

        try {
            const resultado = await getDocs(collection(db, "servicios"));

            servicios = [];

            resultado.forEach((docServicio) => {
                const data = docServicio.data();

                if (data.estado === "activo" || data.estado === "active") {
                    servicios.push({
                        id: docServicio.id,
                        ...data
                    });
                }
            });

            serviciosActuales = servicios;
            cantidadVisible = 6;
            pintarServicios(grillaServicios);

        } catch (error) {
            console.log("Error al cargar servicios:", error);
            grillaServicios.innerHTML = crearEstadoBusqueda("No pudimos cargar los servicios.");
        }
    }

    function buscarPorTexto() {
        const texto = inputBusqueda?.value.trim().toLowerCase();

        if (!texto) {
            serviciosActuales = servicios;
            cantidadVisible = 6;
            pintarServicios(grillaServicios);
            return;
        }

        serviciosActuales = servicios.filter((servicio) => {
            return (
                (servicio.nombre || "").toLowerCase().includes(texto) ||
                (servicio.descripcion || "").toLowerCase().includes(texto) ||
                (servicio.categoria || "").toLowerCase().includes(texto) ||
                (servicio.comuna || "").toLowerCase().includes(texto)
            );
        });

        cantidadVisible = 6;
        pintarServicios(grillaServicios);
    }

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

            const categoria = boton.dataset.categoria.toLowerCase();

            serviciosActuales = servicios.filter((servicio) => {
                return (servicio.categoria || "").toLowerCase() === categoria;
            });

            cantidadVisible = 6;
            pintarServicios(grillaServicios);
        });
    });

    cargarServiciosFirestore();
});

function pintarServicios(grillaServicios) {
    if (!grillaServicios) return;

    if (!serviciosActuales.length) {
        grillaServicios.innerHTML = crearEstadoBusqueda("No se encontraron servicios.");
        return;
    }

    const serviciosMostrados = serviciosActuales.slice(0, cantidadVisible);

    grillaServicios.innerHTML = serviciosMostrados
        .map((servicio) => crearCardServicio(servicio))
        .join("");

    if (serviciosActuales.length > cantidadVisible) {
        grillaServicios.innerHTML += `
            <div style="grid-column: 1 / -1; text-align:center; margin-top: 20px;">
                <button id="btnVerMas" class="boton-ovalado activo">
                    Ver más servicios
                </button>
            </div>
        `;

        const btnVerMas = document.getElementById("btnVerMas");

        if (btnVerMas) {
            btnVerMas.addEventListener("click", () => {
                cantidadVisible += 6;
                pintarServicios(grillaServicios);
            });
        }
    }
}

function crearCardServicio(servicio) {
    const categoria = servicio.categoria || "Servicio";
    const comuna = servicio.comuna || "Comuna no especificada";
    const precio = servicio.precio ? Math.round(servicio.precio) : 0;
    const tiempo = servicio.tiempoEstimado || "Tiempo a coordinar";

    const categoriaNormalizada = categoria.toLowerCase();

    const titulosPorCategoria = {
        electricidad: "Electricista domiciliario",
        plomeria: "Gasfiter certificado",
        gasfiteria: "Gasfiter certificado",
        cocina: "Servicio de cocina",
        limpieza: "Limpieza de hogar",
        jardineria: "Jardinería y mantención",
        cerrajeria: "Cerrajero domiciliario",
        pintura: "Pintura y terminaciones"
    };

    const descripcionesPorCategoria = {
        electricidad: "Instalaciones, reparaciones y mantención eléctrica para el hogar.",
        plomeria: "Reparación de fugas, cañerías y mantención sanitaria.",
        gasfiteria: "Reparación de fugas, cañerías y mantención sanitaria.",
        cocina: "Servicio de apoyo para labores relacionadas con cocina.",
        limpieza: "Limpieza profunda y mantención de espacios del hogar.",
        jardineria: "Poda, corte de pasto y mantención de jardines.",
        cerrajeria: "Apertura de puertas, cambio de chapas y cerraduras.",
        pintura: "Pintura interior, exterior y terminaciones del hogar."
    };

    const titulo = titulosPorCategoria[categoriaNormalizada] || servicio.nombre || "Servicio profesional";
    const descripcion = descripcionesPorCategoria[categoriaNormalizada] || "Servicio profesional disponible para el hogar.";

    return `
        <article class="card-editorial">
            <div class="card-header-pro">
                <div class="avatar-circular">
                    <img src="https://cdn-icons-png.flaticon.com/512/4792/4792929.png" alt="Técnico"
                    style="width:100%; height:100%; object-fit:cover; border-radius:50%;">
                </div>

                <div class="info-titulos">
                    <span class="nota-badge">4.9</span>
                    <h3 class="nombre-masivo">${escapeHtml(titulo)}</h3>
                    <p class="tag-especialidad">${escapeHtml(categoria)}</p>
                </div>
            </div>

            <div class="card-body-pro">
                <p class="texto-resumen">
                    ${escapeHtml(descripcion)}
                </p>

                <p class="texto-resumen">
                    <strong>Comuna:</strong> ${escapeHtml(comuna)}<br>
                    <strong>Precio desde:</strong> $${escapeHtml(String(precio))}<br>
                    <strong>Tiempo estimado:</strong> ${escapeHtml(tiempo)}
                </p>

                <a href="perfiltecnico.html?id=${encodeURIComponent(servicio.id)}" class="enlace-perfil">
                    <span class="btn-outlined-pro">
                        VER PERFIL COMPLETO
                    </span>
                </a>
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