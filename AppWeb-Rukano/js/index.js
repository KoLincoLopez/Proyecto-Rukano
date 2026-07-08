import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API_URL = window.RukanoApiConfig.getApiBaseUrl();

let serviciosActuales = [];
let cantidadVisible = 6;

document.addEventListener("DOMContentLoaded", () => {
    const inputBusqueda = document.querySelector(".input-invisible");
    const lupaBusqueda = document.querySelector(".lupa-profesional");
    const botonesCategoria = document.querySelectorAll(".boton-ovalado[data-categoria]");
    const ordenServicios = document.getElementById("ordenServicios");
    const soloConPrecio = document.getElementById("soloConPrecio");

    let usuarioLogueado = null;
    let comunaUsuario = null;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            usuarioLogueado = null;
            comunaUsuario = null;
            mostrarAccesoRestringido();
            return;
        }

        usuarioLogueado = user;

        try {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                console.warn("Usuario en Auth pero sin documento en Firestore.");
                mostrarEstadoBusqueda("No pudimos cargar los datos de tu cuenta.");
                return;
            }

            const data = userSnap.data();
            comunaUsuario = obtenerTexto(data.comuna, data.direccion?.comuna, "");
            const urlCatalogoInicial = `${API_URL}/search/busqueda_general/${encodeURIComponent(comunaUsuario)}/todos`;
            ejecutarBusqueda(urlCatalogoInicial, usuarioLogueado, comunaUsuario);
        } catch (error) {
            console.error("Error al obtener datos del usuario:", error);
            mostrarEstadoBusqueda("Error al cargar tus datos. Intentalo de nuevo.");
        }
    });

    botonesCategoria.forEach((boton) => {
        boton.addEventListener("click", () => {
            botonesCategoria.forEach((item) => item.classList.remove("activo"));
            boton.classList.add("activo");

            const categoria = boton.getAttribute("data-categoria");
            const url = `${API_URL}/search/categoria_solicitada/${encodeURIComponent(comunaUsuario || "")}/${encodeURIComponent(categoria)}`;
            ejecutarBusqueda(url, usuarioLogueado, comunaUsuario);
        });
    });

    const realizarBusquedaGeneral = () => {
        const texto = inputBusqueda?.value.trim() || "";
        if (!texto) return;

        botonesCategoria.forEach((boton) => boton.classList.remove("activo"));
        const url = `${API_URL}/search/busqueda_general/${encodeURIComponent(comunaUsuario || "")}/${encodeURIComponent(texto)}`;
        ejecutarBusqueda(url, usuarioLogueado, comunaUsuario);
    };

    lupaBusqueda?.addEventListener("click", realizarBusquedaGeneral);
    inputBusqueda?.addEventListener("keypress", (event) => {
        if (event.key === "Enter") realizarBusquedaGeneral();
    });
    ordenServicios?.addEventListener("change", () => pintarServicios());
    soloConPrecio?.addEventListener("change", () => pintarServicios());
});

async function ejecutarBusqueda(url, usuarioLogueado, comunaUsuario) {
    const grillaServicios = document.querySelector("#servicios");
    if (!grillaServicios) return;

    if (!usuarioLogueado) {
        mostrarAccesoRestringido();
        return;
    }

    if (!comunaUsuario) {
        grillaServicios.innerHTML = `
            <div class="editorial-alerta alerta-advertencia">
                <h2 class="alerta-titulo">DIRECCION INCOMPLETA</h2>
                <p class="alerta-texto">Completa tu comuna para filtrar servicios disponibles cerca de tu hogar.</p>
                <a href="panelCliente.html" class="btn-outlined-pro">IR A MI PANEL</a>
            </div>`;
        return;
    }

    try {
        grillaServicios.innerHTML = crearEstadoBusqueda("Cargando servicios...");
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        const resultados = await response.json();
        const listaFinal = normalizarServicios(resultados);

        if (listaFinal.length > 0) {
            cantidadVisible = 6;
            pintarServicios(listaFinal);
        } else {
            mostrarEstadoBusqueda("Sin servicios disponibles.");
        }
    } catch (error) {
        console.error("Error al buscar servicios:", error);
        mostrarEstadoBusqueda("Error de conexion con el servidor. Intentalo de nuevo.");
    }
}

function normalizarServicios(resultados) {
    if (Array.isArray(resultados)) return resultados;
    if (Array.isArray(resultados?.data)) return resultados.data;
    if (Array.isArray(resultados?.servicios)) return resultados.servicios;
    return [];
}

function pintarServicios(listaDeServicios) {
    const grilla = document.querySelector("#servicios");
    if (!grilla) return;

    if (Array.isArray(listaDeServicios)) {
        serviciosActuales = listaDeServicios;
    }

    if (!serviciosActuales || serviciosActuales.length === 0) {
        mostrarEstadoBusqueda("Sin servicios disponibles.");
        return;
    }

    const serviciosFiltrados = aplicarFiltrosCatalogo(serviciosActuales);
    if (serviciosFiltrados.length === 0) {
        mostrarEstadoBusqueda("No hay servicios que coincidan con los filtros.");
        return;
    }

    const serviciosMostrados = serviciosFiltrados.slice(0, cantidadVisible);
    grilla.innerHTML = serviciosMostrados.map((servicio) => crearCardServicio(servicio)).join("");

    if (serviciosFiltrados.length > cantidadVisible) {
        const wrapperBtn = document.createElement("div");
        wrapperBtn.className = "contenedor-ver-mas";

        const btnVerMas = document.createElement("button");
        btnVerMas.id = "btnVerMas";
        btnVerMas.className = "boton-ovalado activo";
        btnVerMas.type = "button";
        btnVerMas.textContent = "VER MAS SERVICIOS";

        btnVerMas.addEventListener("click", () => {
            cantidadVisible += 6;
            pintarServicios();
        });

        wrapperBtn.appendChild(btnVerMas);
        grilla.appendChild(wrapperBtn);
    }
}

function aplicarFiltrosCatalogo(servicios) {
    const soloConPrecio = document.getElementById("soloConPrecio")?.checked;
    const orden = document.getElementById("ordenServicios")?.value || "relevancia";

    let lista = [...servicios];

    if (soloConPrecio) {
        lista = lista.filter((servicio) => Number(servicio.precio) > 0);
    }

    const precio = (servicio) => Number(servicio.precio) || 0;
    const rating = (servicio) => {
        const valor = servicio.rating ?? servicio.calificacion ?? servicio.promedioResenas ?? servicio["promedioRese\u00f1as"];
        return Number(valor) || 0;
    };

    if (orden === "precio_asc") lista.sort((a, b) => precio(a) - precio(b));
    if (orden === "precio_desc") lista.sort((a, b) => precio(b) - precio(a));
    if (orden === "rating_desc") lista.sort((a, b) => rating(b) - rating(a));

    return lista;
}

function crearCardServicio(servicio) {
    const idServicio = obtenerIdServicio(servicio);
    const nombre = obtenerTexto(servicio.nombre, servicio.titulo, "Servicio profesional");
    const categoria = obtenerTexto(servicio.categoria, servicio.tipo, "Servicio");
    const comuna = obtenerTexto(servicio.comuna, servicio.ubicacion, "Comuna no especificada");
    const descripcion = obtenerTexto(servicio.descripcion, obtenerDescripcionCategoria(categoria), "Servicio profesional disponible para el hogar.");
    const precio = formatearPrecio(servicio.precio);
    const tiempo = formatearTiempo(servicio.tiempoEstimado);
    const rating = obtenerRating(servicio);
    const hrefDetalle = idServicio ? `detalleServicio.html?id=${encodeURIComponent(idServicio)}` : "#servicios";
    const textoAccion = idServicio ? "VER SERVICIO" : "DETALLE NO DISPONIBLE";

    return `
        <article class="card-editorial">
            <div class="card-header-pro">
                <div class="avatar-circular">
                    <img src="https://cdn-icons-png.flaticon.com/512/4792/4792929.png" alt="Tecnico"
                        style="width:100%; height:100%; object-fit:cover; border-radius:50%;">
                </div>

                <div class="info-titulos">
                    <span class="nota-badge">${escapeHtml(rating)}</span>
                    <h3 class="nombre-masivo">${escapeHtml(nombre)}</h3>
                    <p class="tag-especialidad">${escapeHtml(categoria)}</p>
                </div>
            </div>

            <div class="card-body-pro">
                <p class="texto-resumen">${escapeHtml(descripcion)}</p>

                <div class="card-trust-row">
                    <span class="trust-pill">Pago protegido</span>
                    <span class="trust-pill">${rating === "Sin resenas" ? "Nuevo tecnico" : "Evaluado"}</span>
                </div>

                <div class="card-meta-editorial">
                    <div class="meta-row">
                        <span class="meta-tag">COMUNA</span>
                        <span class="meta-value">${escapeHtml(comuna)}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-tag">TARIFA BASE</span>
                        <span class="meta-value">${escapeHtml(precio)}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-tag">TIEMPO ESTIMADO</span>
                        <span class="meta-value">${escapeHtml(tiempo)}</span>
                    </div>
                </div>

                <a href="${hrefDetalle}" class="enlace-perfil" aria-disabled="${idServicio ? "false" : "true"}">
                    <span class="btn-outlined-pro">${textoAccion}</span>
                </a>
            </div>
        </article>
    `;
}

function obtenerIdServicio(servicio) {
    return obtenerTexto(servicio.idServicio, servicio.id, servicio._id, servicio.docId, "");
}

function obtenerDescripcionCategoria(categoria) {
    const categoriaNormalizada = String(categoria || "").toLowerCase();
    const descripcionesPorCategoria = {
        electricidad: "Instalaciones, reparaciones y mantencion electrica para el hogar.",
        plomeria: "Reparacion de fugas, canerias y mantencion sanitaria.",
        gasfiteria: "Reparacion de fugas, canerias y mantencion sanitaria.",
        cocina: "Servicio de apoyo para labores relacionadas con cocina.",
        limpieza: "Limpieza profunda y mantencion de espacios del hogar.",
        jardineria: "Poda, corte de pasto y mantencion de jardines.",
        cerrajeria: "Apertura de puertas, cambio de chapas y cerraduras.",
        pintura: "Pintura interior, exterior y terminaciones del hogar."
    };

    return descripcionesPorCategoria[categoriaNormalizada];
}

function obtenerRating(servicio) {
    const rating = servicio.rating ?? servicio.calificacion ?? servicio.promedioResenas ?? servicio["promedioRese\u00f1as"];
    const numero = Number(rating);
    if (Number.isFinite(numero) && numero > 0) {
        return numero.toFixed(1);
    }
    return "Sin resenas";
}

function formatearPrecio(precio) {
    const numero = Number(precio);
    if (!Number.isFinite(numero) || numero <= 0) return "A coordinar";
    return `$${Math.round(numero).toLocaleString("es-CL")}`;
}

function formatearTiempo(tiempoEstimado) {
    const numero = Number(tiempoEstimado);
    if (!Number.isFinite(numero) || numero <= 0) return "Tiempo a coordinar";
    return numero === 1 ? "1 hora" : `${numero} horas`;
}

function mostrarAccesoRestringido() {
    const grillaServicios = document.querySelector("#servicios");
    if (!grillaServicios) return;

    grillaServicios.innerHTML = `
        <div class="editorial-alerta alerta-restringido">
            <h2 class="alerta-titulo">ACCESO RESTRINGIDO</h2>
            <p class="alerta-texto">Debes iniciar sesion para buscar servicios y profesionales en tu zona.</p>
            <a href="inicioSesion.html" class="btn-outlined-pro">IR AL LOGIN</a>
        </div>`;
}

function mostrarEstadoBusqueda(texto) {
    const grillaServicios = document.querySelector("#servicios");
    if (!grillaServicios) return;
    grillaServicios.innerHTML = crearEstadoBusqueda(texto);
}

function crearEstadoBusqueda(texto) {
    return `
        <div class="estado-busqueda-editorial">
            <div class="bloque-decorativo-brutal">*</div>
            <p class="estado-texto-masivo">${escapeHtml(texto.toUpperCase())}</p>
            <div class="linea-decorativa-ancha"></div>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function obtenerTexto(...valores) {
    const fallback = valores.pop();
    const valor = valores.find((item) => item !== undefined && item !== null && String(item).trim() !== "");
    return valor !== undefined ? String(valor).trim() : fallback;
}
