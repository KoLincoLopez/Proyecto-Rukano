import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    // === 1. MENÚ DESPLEGABLE NAVBAR ===
    const botonPerfil = document.querySelector(".perfil-usuario") || document.querySelector(".toggle");
    const nav = document.querySelector(".nav");

    if (botonPerfil && nav) {
        botonPerfil.addEventListener("click", () => nav.classList.toggle("active"));
    }

    // === 2. VERIFICACIÓN DE AUTENTICACIÓN ===
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "inicioSesion.html";
            return;
        }

        try {
            const userRef = doc(db, "usuarios", user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const datosUsuario = userSnap.data();
                
                if (datosUsuario.rol !== "tecnico" && datosUsuario.rol !== "técnico") {
                    window.location.href = "index.html";
                    return;
                }

                // --- CONFIGURACIÓN VISUAL DEL NAVBAR ---
                document.querySelectorAll(".link-sesion, .btn-registro-nav").forEach(el => el.style.display = "none");

                const navDerecha = document.querySelector(".nav-derecha");
                if (navDerecha && botonPerfil && !document.getElementById("saludoNavbar")) {
                    const saludo = document.createElement("span");
                    saludo.id = "saludoNavbar";
                    saludo.style.cssText = "color: var(--c-arena); font-weight: bold; margin-right: 15px; font-size: 14px;";
                    saludo.textContent = `¡Hola, ${datosUsuario.nombre.split(" ")[0]}!`;
                    navDerecha.insertBefore(saludo, botonPerfil);
                }

                // CONSERVADO: Transformar la foto de perfil en la letra inicial del técnico
                const img = botonPerfil?.querySelector("img");
                if (img && datosUsuario.nombre) {
                    const span = document.createElement("span");
                    span.textContent = datosUsuario.nombre.charAt(0).toUpperCase();
                    span.style.cssText = "color: white; font-size: 18px; font-weight: 900; background-color: var(--c-rosewood); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;";
                    img.replaceWith(span);
                }

                // Cargar datos usando el idTecnico real
                cargarDatosDashboard(user.uid);

            } else {
                window.location.href = "inicioSesion.html";
            }
        } catch (error) {
            console.error("Error al validar sesión:", error);
        }
    });

    // === 3. CARGAR CITAS REALES DESDE FIRESTORE (CORREGIDO) ===
    async function cargarDatosDashboard(idTecnico) {
        const tablaOrdenes = document.querySelector(".ordenes-recientes table tbody");
        const tablaClientes = document.querySelector(".nuevos-clientes table");

        try {
            const citasRef = collection(db, "citas");
            const consulta = query(citasRef, where("idTecnico", "==", idTecnico));
            const querySnapshot = await getDocs(consulta);

            if (tablaOrdenes) tablaOrdenes.innerHTML = "";
            if (tablaClientes) tablaClientes.innerHTML = "";

            if (querySnapshot.empty) {
                if (tablaOrdenes) tablaOrdenes.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:20px;'>No registras citas agendadas aún.</td></tr>";
                if (tablaClientes) tablaClientes.innerHTML = "<tr><td style='text-align:center; padding:20px;'>Sin clientes asociados.</td></tr>";
                return;
            }

            // 1. Almacenar citas en un array temporal y capturar IDs de clientes únicos
            const listaCitas = [];
            const idClientesUnicos = new Set();

            querySnapshot.forEach((documento) => {
                const cita = documento.data();
                listaCitas.push(cita);
                if (cita.idCliente) {
                    idClientesUnicos.add(cita.idCliente);
                }
            });

            // 2. Buscar en paralelo la información de todos los clientes únicos detectados
            const mapaClientes = {}; // Diccionario para mapear idCliente -> { nombre, foto }
            
            const promesasClientes = Array.from(idClientesUnicos).map(async (idCliente) => {
                try {
                    const userRef = doc(db, "usuarios", idCliente);
                    const userSnap = await getDoc(userRef);
                    
                    if (userSnap.exists()) {
                        const datos = userSnap.data();
                        mapaClientes[idCliente] = {
                            nombreCompleto: `${datos.nombre} ${datos.apellido}`,
                            fotoPerfil: datos.foto_perfil || null
                        };
                    } else {
                        mapaClientes[idCliente] = { nombreCompleto: "Usuario Desconocido", fotoPerfil: null };
                    }
                } catch (err) {
                    console.error(`Error al traer datos del cliente ${idCliente}:`, err);
                    mapaClientes[idCliente] = { nombreCompleto: "Error al cargar nombre", fotoPerfil: null };
                }
            });

            // Esperamos que terminen todas las consultas de usuarios antes de renderizar
            await Promise.all(promesasClientes);

            let htmlOrdenes = "";
            let htmlClientes = "";
            const clientesRegistrados = new Set();

            // 3. Construir e inyectar el HTML con los datos reales unidos
            listaCitas.forEach((cita) => {
                // Obtener datos del cliente desde nuestro mapa de caché interno
                const infoCliente = mapaClientes[cita.idCliente] || { nombreCompleto: "Anónimo", fotoPerfil: null };
                
                const claseEstatus = cita.estado ? cita.estado.toLowerCase() : "pendiente";
                const textoEstatus = cita.estado ? cita.estado.toUpperCase() : "PENDIENTE";
                const textoPago = cita.pagoRetenido ? "Retenido" : "Liberado";
                const fechaHora = (cita.fecha && cita.hora) ? `${cita.fecha} a las ${cita.hora}` : "No definida";

                // --- A) INYECTAR EN TABLA DE ÓRDENES (Citas Agendadas) ---
                htmlOrdenes += `
                    <tr>
                        <td title="ID: ${cita.idCliente || ''}">${infoCliente.nombreCompleto}</td>
                        <td>${cita.tituloServicio || "Servicio Técnico"}</td>
                        <td>${fechaHora}</td>
                        <td>${textoPago}</td>
                        <td><span class="estatus ${claseEstatus}">${textoEstatus}</span></td>
                    </tr>
                `;

                // --- B) INYECTAR EN TABLA DE CLIENTES ÚNICOS (Panel Derecho) ---
                if (cita.idCliente && !clientesRegistrados.has(cita.idCliente)) {
                    clientesRegistrados.add(cita.idCliente);
                    
                    // Si el cliente tiene foto guardada en Firebase la usa, si no, usa el placeholder por defecto
                    const urlFoto = infoCliente.fotoPerfil || "https://e7.pngegg.com/pngimages/355/848/png-clipart-computer-icons-user-profile-google-account-s-icon-account-miscellaneous-sphere-thumbnail.png";

                    htmlClientes += `
                        <tr>
                            <td>
                                <div class="imgBox">
                                    <img src="${urlFoto}" alt="Usuario">
                                </div>
                            </td>
                            <td>
                                <h4>${infoCliente.nombreCompleto} <br><span>Cliente</span></h4>
                            </td>
                            <td>
                                <a href="#" style="opacity:0.5; cursor:default;" title="ID completo: ${cita.idCliente}"><ion-icon name="person-outline"></ion-icon></a>
                            </td>
                        </tr>
                    `;
                }
            });

            if (tablaOrdenes) tablaOrdenes.innerHTML = htmlOrdenes;
            if (tablaClientes) tablaClientes.innerHTML = htmlClientes;

        } catch (error) {
            console.error("Error al procesar la colección de citas:", error);
        }
    }

    // === 4. LOGOUT ===
    const btnCerrarSesion = document.querySelector(".cerrar-sesion");
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.href = "inicioSesion.html";
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
            }
        });
    }
});