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
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            usuarioLogueado = user;
            try {
                // Obtenemos el perfil completo desde Firestore (Arquitectura Serverless)
                const userRef = doc(db, "usuarios", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const data = userSnap.data();
                    comunaUsuario = data.comuna; // CAPTURAMOS LA COMUNA REAL DEL USUARIO
                    
                    authContainer.innerHTML = `<span>Hola, ${data.nombre}</span>`;
                }
            } catch (error) {
                console.error("Error al obtener datos:", error);
            }
        } else {
            usuarioLogueado = null;
            comunaUsuario = null;
            authContainer.innerHTML = `<a href="login.html" class="boton-inicio">Iniciar Sesión</a>`;
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

    async function cargarServiciosFirestore() {
            if (!grillaServicios) return;

    grillaServicios.innerHTML = crearEstadoBusqueda("Cargando servicios...");

    try {
        const response = await fetch(`${API_URL}/servicios/`);
        const datos = await response.json();

        // VALIDACIÓN CRÍTICA (Métrica de Precisión de Datos)
        // Verificamos si 'datos' es un array. Si es un objeto con una clave, extraemos la lista.
        const listaFinal = Array.isArray(datos) ? datos : (datos.servicios || []);

        console.log("Datos recibidos:", listaFinal);
        pintarServicios(listaFinal); // Ahora pasamos la lista validada

    } catch (error) {
        console.error("Error al cargar servicios:", error);
    }
    }

    // --- FUNCIÓN NÚCLEO DE BÚSQUEDA ---
    async function ejecutarBusqueda(url) {
    const grillaServicios = document.querySelector("#servicios");

    // 1. RESTRICCIÓN: SI NO HAY SESIÓN, NO HAY BÚSQUEDA
    if (!usuarioLogueado) {
        grillaServicios.innerHTML = `
            <div class="mensaje-alerta">
                <p>⚠️ <strong>Acceso Restringido:</strong> Debes iniciar sesión para buscar servicios y técnicos en tu zona.</p>
                <a href="login.html" class="boton-login-msg">Ir al Login</a>
            </div>`;
        return; // Detenemos la ejecución aquí
    }

    // 2. RESTRICCIÓN: SI NO HAY COMUNA ASIGNADA
    if (!comunaUsuario) {
        grillaServicios.innerHTML = "<p>Por favor, completa tu dirección en tu perfil para buscar servicios cercanos.</p>";
        return;
    }

    try {
        grillaServicios.innerHTML = "<p>Buscando...</p>";
        const response = await fetch(url);
        const resultados = await response.json();

        if (resultados.status === "success" && resultados.data.length > 0) {
            pintarServicios(resultados.data);
        } else {
            grillaServicios.innerHTML = "<p>No se encontraron técnicos en tu comuna.</p>";
        }
    } catch (error) {
        grillaServicios.innerHTML = "<p>Error de conexión con el servidor.</p>";
        }
    }

    async function cargarServiciosIniciales() {
        try {
            // Llamamos al router de servicios, NO al de search
            const response = await fetch(`${API_URL}/servicios/`);
            
            if (!response.ok) {
                throw new Error("Error al obtener servicios");
            }

            const datos = await response.json();
            // 2. Llamamos a la función de renderizado con los datos
            pintarServicios(datos); 

        } catch (error) {
            console.error("Error al cargar servicios:", error);
            if (grillaServicios) grillaServicios.innerHTML = "<p>Error al conectar con el servidor.</p>";
        }
    }

    cargarServiciosIniciales();

    function pintarServicios(listaDeServicios) {
    const grilla = document.querySelector("#servicios");
    grilla.innerHTML = ""; // Limpieza para Rendimiento (RNF 1) [3]

    listaDeServicios.forEach(servicio => {
        const card = document.createElement("div");
        card.className = "card-servicio";
        // Usamos los nombres exactos que viste en el JSON del backend
        card.innerHTML = `
            <div class="info">
                <h3>${servicio.nombre}</h3> 
                <p>${servicio.descripcion}</p>
                <p><strong>Comuna:</strong> ${servicio.comuna}</p>
                <span class="precio">$${servicio.precio.toLocaleString()}</span>
                <button class="boton-contratar">Contratar</button>
            </div>
        `;
        grilla.appendChild(card);
        });
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

    // --- 1. BÚSQUEDA POR CATEGORÍA (Al hacer click en botones) [1, 3] ---
    botonesCategoria.forEach(boton => {
    boton.addEventListener("click", () => {
        const categoria = boton.getAttribute("data-categoria");
        // Usamos la comuna detectada en el login
        const url = `${API_URL}/search/categoria_solicitada/${comunaUsuario}/${categoria}`;
        ejecutarBusqueda(url);
        });
    });

    // --- 2. BÚSQUEDA POR PALABRAS CLAVE (Input + Enter/Lupa) [2, 3] ---
    // Listener para el Buscador General
    const realizarBusquedaGeneral = () => {
    const texto = inputBusqueda.value.trim();
    if (texto !== "") {
        const url = `${API_URL}/search/busqueda_general/${comunaUsuario}/${texto}`;
        ejecutarBusqueda(url);
        }
    };

    lupaBusqueda?.addEventListener("click", realizarBusquedaGeneral);
    inputBusqueda?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") realizarBusquedaGeneral();
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