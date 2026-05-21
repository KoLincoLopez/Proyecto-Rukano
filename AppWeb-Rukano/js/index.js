import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API_URL = "http://127.0.0.1:8000";

let servicios = [];
let serviciosActuales = [];
let cantidadVisible = 6;
let comunaUsuario = null;

document.addEventListener("DOMContentLoaded", () => {
    const navbar = document.querySelector(".navbar-integrada");
    const inputBusqueda = document.querySelector(".input-invisible");
    const lupaBusqueda = document.querySelector(".lupa-profesional");
    const botonesCategoria = document.querySelectorAll(".boton-ovalado[data-categoria]");
    const grillaServicios = document.querySelector("#servicios");
    const authContainer = document.getElementById("auth-container");

    let usuarioLogueado = null;
    let comunaUsuario = null;

    // OBSERVADOR DE ESTADO (Reacciona al inicio/cierre de sesión)q
    // OBSERVADOR DE ESTADO (Reacciona al inicio/cierre de sesión)
    // OBSERVADOR DE ESTADO (Reacciona al inicio/cierre de sesión)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            usuarioLogueado = user;
            try {
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const data = userSnap.data();
                    comunaUsuario = data.comuna; 
                    
                    // Renderizado Editorial del Navbar
                    authContainer.innerHTML = `
                        <div class="perfil-nav-container">
                            <div class="usuario-badge">
                                <span class="usuario-inicial">${escapeHtml(data.nombre.charAt(0).toUpperCase())}</span>
                                <span class="usuario-nombre">${escapeHtml(data.nombre.toUpperCase())}</span>
                            </div>
                            <a href="panelCliente.html" class="btn-perfil-nav">MI PERFIL</a>
                        </div>
                    `;

                    // 1. CARGA INICIAL CORRECTA Y FILTRADA:
                    // Usamos tu buscador general para que traiga "todos" los servicios de su comuna.
                    // (Nota: Si en tu FastAPI tienes un endpoint específico para listar el catálogo 
                    // de una comuna, reemplaza esta URL por la tuya, ej: `${API_URL}/servicios/comuna/${comunaUsuario}`)
                    const urlCatalogoInicial = `${API_URL}/search/busqueda_general/${comunaUsuario}/todos`; 
                    ejecutarBusqueda(urlCatalogoInicial);

                } else {
                    console.warn("Usuario en Auth pero sin documento en Firestore.");
                }

            } catch (error) {
                console.error("Error al obtener datos:", error);
            }
        } else {
            usuarioLogueado = null;
            comunaUsuario = null;
            authContainer.innerHTML = `<a href="inicioSesion.html" class="boton-inicio">Iniciar Sesión</a>`;
            
            // 2. BLOQUEO AUTOMÁTICO DE SEGURIDAD
            // Pasamos un string vacío porque la función abortará inmediatamente
            // en su primera línea mostrando el cartel de "ACCESO RESTRINGIDO".
            ejecutarBusqueda("");
        }
    });
    

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


// --- FUNCIÓN NÚCLEO DE BÚSQUEDA REFINADA E INTELIGENTE ---
async function ejecutarBusqueda(url) {
    const grillaServicios = document.querySelector("#servicios");
    if (!grillaServicios) return;

    // 1. RESTRICCIÓN: SI NO HAY SESIÓN
    if (!usuarioLogueado) {
        grillaServicios.innerHTML = `
            <div class="editorial-alerta alerta-restringido">
                <h2 class="alerta-titulo">ACCESO RESTRINGIDO</h2>
                <p class="alerta-texto">Debes iniciar sesión en la plataforma para buscar servicios y profesionales en tu zona.</p>
                <a href="inicioSesion.html" class="btn-outlined-pro">IR AL LOGIN</a>
            </div>`;
        return;
    }

    // 2. RESTRICCIÓN: SI NO HAY COMUNA ASIGNADA
    if (!comunaUsuario) {
        grillaServicios.innerHTML = `
            <div class="editorial-alerta alerta-advertencia">
                <h2 class="alerta-titulo">DIRECCIÓN INCOMPLETA</h2>
                <p class="alerta-texto">Por favor, completa la configuración de tu dirección en tu perfil para filtrar técnicos cercanos.</p>
                <a href="perfil.html" class="btn-outlined-pro">CONFIGURAR PERFIL</a>
            </div>`;
        return;
    }

    try {
        grillaServicios.innerHTML = crearEstadoBusqueda("Buscando profesionales en tu comuna...");
        const response = await fetch(url);
        const resultados = await response.json();

        // NORMALIZACIÓN INTELIGENTE DE DATOS: 
        // Identifica si la API responde un array directo o un objeto envuelto en "data" o "servicios"
        let listaFinal = [];
        if (Array.isArray(resultados)) {
            listaFinal = resultados;
        } else if (resultados.status === "success" && Array.isArray(resultados.data)) {
            listaFinal = resultados.data;
        } else if (resultados.servicios && Array.isArray(resultados.servicios)) {
            listaFinal = resultados.servicios;
        }

        if (listaFinal.length > 0) {
            cantidadVisible = 6; 
            pintarServicios(listaFinal); 
        } else {
            grillaServicios.innerHTML = crearEstadoBusqueda("No se encontraron técnicos disponibles.");
        }
    } catch (error) {
        grillaServicios.innerHTML = crearEstadoBusqueda("Error de conexión con el servidor. Inténtalo de nuevo.");
    }
}



    /*  Metodo Viejo
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
    */

    // --- 1. BÚSQUEDA POR CATEGORÍA (Al hacer click en botones) ---
    botonesCategoria.forEach(boton => {
        boton.addEventListener("click", () => {
            // DETALLE INTERACTIVO: Removemos 'activo' de todos los botones
            botonesCategoria.forEach(b => b.classList.remove("activo"));
            
            // Le agregamos 'activo' únicamente al botón presionado
            boton.classList.add("activo");

            const categoria = boton.getAttribute("data-categoria");
            // Usamos la comuna detectada en el login
            const url = `${API_URL}/search/categoria_solicitada/${comunaUsuario}/${categoria}`;
            ejecutarBusqueda(url);
        });
    });

    // --- 2. BÚSQUEDA POR PALABRAS CLAVE (Input + Enter/Lupa) ---
    const realizarBusquedaGeneral = () => {
        const texto = inputBusqueda.value.trim();
        if (texto !== "") {
            // PLUS DE EXPERIENCIA DE USUARIO: 
            // Si el usuario escribe una búsqueda global, limpiamos el color rojo de las categorías
            botonesCategoria.forEach(b => b.classList.remove("activo"));

            const url = `${API_URL}/search/busqueda_general/${comunaUsuario}/${texto}`;
            ejecutarBusqueda(url);
        }
    };

    lupaBusqueda?.addEventListener("click", realizarBusquedaGeneral);
    inputBusqueda?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") realizarBusquedaGeneral();
    });
    
    });

    // --- FUNCIÓN UNIFICADA DE RENDERIZADO EDITORIAL ---
    function pintarServicios(listaDeServicios) {
        const grilla = document.querySelector("#servicios");
        if (!grilla) return;

        // Si pasamos una nueva lista (desde fetch), actualizamos la memoria global
        if (Array.isArray(listaDeServicios)) {
            serviciosActuales = listaDeServicios;
        }

        if (!serviciosActuales || serviciosActuales.length === 0) {
            grilla.innerHTML = crearEstadoBusqueda("No hay servicios disponibles.");
            return;
        }

        const serviciosMostrados = serviciosActuales.slice(0, cantidadVisible);

        // Mapeamos directo usando las tarjetas editoriales de alta calidad visual
        grilla.innerHTML = serviciosMostrados
            .map((servicio) => crearCardServicio(servicio))
            .join("");

        // Botón "Ver más" integrado orgánicamente en la grilla adaptativa
        if (serviciosActuales.length > cantidadVisible) {
            const wrapperBtn = document.createElement("div");
            wrapperBtn.className = "contenedor-ver-mas";
            
            const btnVerMas = document.createElement("button");
            btnVerMas.id = "btnVerMas";
            btnVerMas.className = "boton-ovalado activo";
            btnVerMas.textContent = "VER MÁS SERVICIOS";
            
            btnVerMas.addEventListener("click", () => {
                cantidadVisible += 6;
                pintarServicios(); // Llamado recursivo manteniendo la lista actual
            });
            
            wrapperBtn.appendChild(btnVerMas);
            grilla.appendChild(wrapperBtn);
        }
    }

function crearCardServicio(servicio) {
    const categoria = servicio.categoria || "Servicio";
    const comuna = servicio.comuna || "Comuna no especificada";
    const precio = servicio.precio ? Math.round(servicio.precio) : 0;
    const idServicio = servicio.idServicio; 
    
    // CONTROL DE SINGULAR / PLURAL AUTOMÁTICO
    const tiempo = servicio.tiempoEstimado 
        ? (Number(servicio.tiempoEstimado) === 1 ? "1 Hora" : `${servicio.tiempoEstimado} Horas`)
        : "Tiempo a coordinar";

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
                    <span class="nota-badge">✦ 4.9</span>
                    <h3 class="nombre-masivo">${escapeHtml(servicio.nombre)}</h3>
                    <p class="tag-especialidad">${escapeHtml(categoria)}</p>
                </div>
            </div>

            <div class="card-body-pro">
                <p class="texto-resumen">
                    ${escapeHtml(servicio.descripcion || descripcion)}
                </p>

                <div class="card-meta-editorial">
                    <div class="meta-row">
                        <span class="meta-tag">COMUNA</span>
                        <span class="meta-value">${escapeHtml(comuna)}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-tag">TARIFA BASE</span>
                        <span class="meta-value">$${escapeHtml(String(precio))}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-tag">TIEMPO ESTIMADO</span>
                        <span class="meta-value">${escapeHtml(tiempo)}</span>
                    </div>
                </div>

                <a href="detalleServicio.html?id=${encodeURIComponent(idServicio)}" class="enlace-perfil">
                    <span class="btn-outlined-pro">
                        VER SERVICIO
                    </span>
                </a>
            </div>
        </article>
    `;
}


// --- CONTENEDORES DE ESTADO TIPOGRÁFICOS ---
function crearEstadoBusqueda(texto) {
    return `
        <div class="estado-busqueda-editorial">
            <div class="bloque-decorativo-brutal">✦</div>
            <p class="estado-texto-masivo">${escapeHtml(texto.toUpperCase())}</p>
            <div class="linea-decorativa-ancha"></div>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}