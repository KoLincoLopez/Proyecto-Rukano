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
                
                if (datosUsuario.rol !== "tecnico") {
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

    // === 3. CARGAR CITAS REALES DESDE FIRESTORE ===
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

            let htmlOrdenes = "";
            let htmlClientes = "";
            const clientesRegistrados = new Set();

            querySnapshot.forEach((documento) => {
                const cita = documento.data();
                
                // Mapear campos de tu base de datos real
                const claseEstatus = cita.estado ? cita.estado.toLowerCase() : "pendiente";
                const textoEstatus = cita.estado ? cita.estado.toUpperCase() : "PENDIENTE";
                
                // Evaluar booleano pagoRetenido
                const textoPago = cita.pagoRetenido ? "Retenido" : "Liberado";

                // Unir fecha y hora
                const fechaHora = (cita.fecha && cita.hora) ? `${cita.fecha} a las ${cita.hora}` : "No definida";

                // Acortar idCliente para que no rompa el diseño del HTML
                const idClienteCorto = cita.idCliente ? `${cita.idCliente.substring(0, 8)}...` : "Anónimo";

                // --- A) INYECTAR EN TABLA DE ÓRDENES ---
                htmlOrdenes += `
                    <tr>
                        <td title="${cita.idCliente || ''}">${idClienteCorto}</td>
                        <td>${cita.tituloServicio || "Servicio Técnico"}</td>
                        <td>${fechaHora}</td>
                        <td>${textoPago}</td>
                        <td><span class="estatus ${claseEstatus}">${textoEstatus}</span></td>
                    </tr>
                `;

                // --- B) INYECTAR EN TABLA DE CLIENTES ÚNICOS (DERECHA) ---
                if (cita.idCliente && !clientesRegistrados.has(cita.idCliente)) {
                    clientesRegistrados.add(cita.idCliente);

                    htmlClientes += `
                        <tr>
                            <td>
                                <div class="imgBox">
                                    <img src="https://e7.pngegg.com/pngimages/355/848/png-clipart-computer-icons-user-profile-google-account-s-icon-account-miscellaneous-sphere-thumbnail.png" alt="Usuario">
                                </div>
                            </td>
                            <td>
                                <h4>Cliente <br><span>ID: ${cita.idCliente.substring(0, 6)}...</span></h4>
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