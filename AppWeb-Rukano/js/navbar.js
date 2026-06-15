(function () {
    const navbarScriptUrl = document.currentScript?.src || "";

    document.addEventListener("DOMContentLoaded", initRukanoNavbar);

    function initRukanoNavbar() {
        const root = document.getElementById("navbar-root");
        if (!root) return;

        const rutas = crearRutas();

        root.innerHTML = `
            <nav class="navbar-integrada" aria-label="Navegaci&oacute;n principal">
                <a href="${rutas.index}" class="bloque-logo">RUKANO</a>

                <div class="bloque-menu">
                    <div class="nav-izquierda">
                        <a href="${rutas.servicios}">Servicios</a>
                        <a href="${rutas.nosotros}">Nosotros</a>
                        <a href="${rutas.testimonios}">Testimonios</a>
                        <a href="${rutas.ubicacion}">Ubicaci&oacute;n</a>
                    </div>

                    <div class="nav-derecha">
                        <div id="auth-container" class="navbar-auth-loading" aria-live="polite"></div>
                    </div>

                    <button class="hamburguesa" type="button" data-navbar-toggle aria-label="Abrir men&uacute;" aria-expanded="false">&#9776;</button>
                </div>
            </nav>
        `;

        const navbar = root.querySelector(".navbar-integrada");
        const toggle = root.querySelector("[data-navbar-toggle]");
        inicializarAuthNavbar(root, rutas);

        const actualizarNavbar = () => {
            navbar.classList.toggle("scrolled", window.scrollY > 50);
        };

        actualizarNavbar();
        window.addEventListener("scroll", actualizarNavbar);

        document.addEventListener("click", (event) => {
            const userTrigger = event.target.closest("[data-navbar-user-trigger]");
            const userArea = event.target.closest("[data-navbar-user]");
            const menuToggle = event.target.closest("[data-navbar-toggle]");

            if (menuToggle && root.contains(menuToggle)) {
                const abierto = navbar.classList.toggle("menu-open");
                menuToggle.setAttribute("aria-expanded", String(abierto));
                return;
            }

            if (userTrigger && userArea) {
                event.stopPropagation();
                cerrarOtrosMenus(userArea);
                const abierto = userArea.classList.toggle("open");
                userTrigger.setAttribute("aria-expanded", String(abierto));
                return;
            }

            if (!userArea) {
                cerrarTodosLosMenus();
            }
        });

        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;

            cerrarTodosLosMenus();
            navbar.classList.remove("menu-open");
            toggle?.setAttribute("aria-expanded", "false");
        });

        root.querySelectorAll(".nav-izquierda a").forEach((link) => {
            link.addEventListener("click", () => {
                navbar.classList.remove("menu-open");
                toggle?.setAttribute("aria-expanded", "false");
            });
        });
    }

    function crearRutas() {
        const appRoot = navbarScriptUrl ? new URL("../", navbarScriptUrl) : new URL("./", window.location.href);

        return {
            index: crearHref(appRoot, "index.html"),
            panelCliente: crearHref(appRoot, "panelCliente.html"),
            panelTecnico: crearHref(appRoot, "panelTecnico.html"),
            inicioSesion: crearHref(appRoot, "inicioSesion.html"),
            registro: crearHref(appRoot, "registro.html"),
            servicios: crearHref(appRoot, "index.html#servicios"),
            nosotros: crearHref(appRoot, "sobreNosotros.html"),
            testimonios: crearHref(appRoot, "index.html#testimonios"),
            ubicacion: crearHref(appRoot, "index.html#ubicacion")
        };
    }

    function crearHref(appRoot, destino) {
        const url = new URL(destino, appRoot);
        if (url.protocol === "file:") {
            return url.href;
        }
        return `${url.pathname}${url.search}${url.hash}`;
    }

    function cerrarOtrosMenus(menuActual) {
        document.querySelectorAll("[data-navbar-user].open").forEach((menu) => {
            if (menu !== menuActual) cerrarMenuUsuario(menu);
        });
    }

    function cerrarTodosLosMenus() {
        document.querySelectorAll("[data-navbar-user].open").forEach(cerrarMenuUsuario);
    }

    function cerrarMenuUsuario(menu) {
        menu.classList.remove("open");
        const trigger = menu.querySelector("[data-navbar-user-trigger]");
        trigger?.setAttribute("aria-expanded", "false");
    }

    async function inicializarAuthNavbar(root, rutas) {
        try {
            const [{ auth, db }, { onAuthStateChanged }, { doc, getDoc }] = await Promise.all([
                import("./Firebase-config.js"),
                import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js"),
                import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")
            ]);

            onAuthStateChanged(auth, async (user) => {
                const authContainer = root.querySelector("#auth-container");
                if (!authContainer) return;

                if (!user) {
                    renderNavbarPublico(authContainer, rutas);
                    return;
                }

                let datosUsuario = {};

                try {
                    const usuarioSnap = await getDoc(doc(db, "usuarios", user.uid));
                    if (usuarioSnap.exists()) {
                        datosUsuario = usuarioSnap.data();
                    }
                } catch (error) {
                    console.warn("No se pudo cargar el nombre del usuario para el navbar:", error);
                }

                renderNavbarUsuario(authContainer, rutas, obtenerNombreNavbar(datosUsuario, user), datosUsuario);
            });
        } catch (error) {
            console.warn("No se pudo inicializar el usuario del navbar:", error);
            const authContainer = root.querySelector("#auth-container");
            if (authContainer) renderNavbarPublico(authContainer, rutas);
        }
    }

    function renderNavbarPublico(authContainer, rutas) {
        authContainer.classList.remove("navbar-auth-loading");
        authContainer.innerHTML = `
            <div class="navbar-public-actions">
                <a href="${rutas.inicioSesion}" class="navbar-login-link">Iniciar sesi&oacute;n</a>
                <a href="${rutas.registro}" class="navbar-register-link">Registrarse</a>
            </div>
        `;
    }

    function renderNavbarUsuario(authContainer, rutas, nombreUsuario, datosUsuario = {}) {
        const panelDestino = obtenerDestinoPanel(datosUsuario, rutas);

        authContainer.classList.remove("navbar-auth-loading");
        authContainer.innerHTML = `
            <div class="rukano-user-menu" data-navbar-user>
                <button type="button" class="rukano-user-trigger" data-navbar-user-trigger aria-expanded="false" aria-haspopup="true">
                    <span class="navbar-profile-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="16" height="16" focusable="false">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-7.2 1.6-7.2 4.8v1.2h14.4v-1.2c0-3.2-4-4.8-7.2-4.8Z" fill="currentColor"/>
                        </svg>
                    </span>
                    <span class="navbar-profile-name">${escaparHtml(nombreUsuario)}</span>
                    <span class="navbar-profile-chevron" aria-hidden="true">&#9662;</span>
                </button>
                <div class="rukano-user-dropdown">
                    <a href="${panelDestino.href}">${panelDestino.label}</a>
                </div>
            </div>
        `;
    }

    function obtenerDestinoPanel(datosUsuario = {}, rutas) {
        const rol = normalizarRol(datosUsuario.rol);

        if (rol === "tecnico") {
            return {
                href: rutas.panelTecnico,
                label: "Panel t&eacute;cnico"
            };
        }

        return {
            href: rutas.panelCliente,
            label: "Panel cliente"
        };
    }

    function normalizarRol(rol) {
        return String(rol || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    function obtenerNombreNavbar(datosUsuario = {}, user = null) {
        const limpiar = (valor) => {
            if (valor === undefined || valor === null) return "";
            return String(valor).trim();
        };

        const nombreCompleto = [
            limpiar(datosUsuario.nombres || datosUsuario.nombre),
            limpiar(datosUsuario.apellidos || datosUsuario.apellido)
        ].filter(Boolean).join(" ");

        const nombre = limpiar(nombreCompleto || datosUsuario.displayName || user?.displayName);
        return nombre || "Usuario";
    }

    function escaparHtml(valor) {
        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
})();
