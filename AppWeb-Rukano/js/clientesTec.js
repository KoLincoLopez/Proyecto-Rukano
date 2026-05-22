import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    // === AUTENTICACIÓN Y NAVBAR ===
    const botonPerfil = document.querySelector(".perfil-usuario");
    const menuDesplegable = document.querySelector(".nav");

    if (botonPerfil && menuDesplegable) {
        botonPerfil.addEventListener("click", () => menuDesplegable.classList.toggle("active"));
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userSnap = await getDoc(doc(db, "usuarios", user.uid));
                if (userSnap.exists()) {
                    const datosUsuario = userSnap.data();
                    if (datosUsuario.rol !== "tecnico") return window.location.href = "index.html";

                    const linkSesion = document.querySelector(".link-sesion");
                    const btnRegistro = document.querySelector(".btn-registro-nav");
                    if (linkSesion) linkSesion.style.display = "none";
                    if (btnRegistro) btnRegistro.style.display = "none";

                    const navDerecha = document.querySelector(".nav-derecha");
                    if (navDerecha && botonPerfil && !document.getElementById("saludoNavbar")) {
                        const saludoSpan = document.createElement("span");
                        saludoSpan.id = "saludoNavbar";
                        saludoSpan.style.cssText = "color: var(--c-arena); font-weight: bold; margin-right: 15px; font-size: 14px; opacity: 0.9;";
                        saludoSpan.textContent = `¡Hola, ${datosUsuario.nombre.split(" ")[0]} !`;
                        navDerecha.insertBefore(saludoSpan, botonPerfil);
                    }

                    if (botonPerfil) {
                        const img = botonPerfil.querySelector("img");
                        if (img) {
                            const span = document.createElement("span");
                            span.textContent = datosUsuario.nombre.charAt(0).toUpperCase();
                            span.style.cssText = "color: white; font-size: 20px; font-weight: 900; font-family: 'Arial Black', sans-serif; background-color: var(--c-rosewood); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;";
                            img.replaceWith(span);
                        }
                    }

                    // Cargar el listado cruzado optimizado
                    cargarTablaClientes(user.uid);
                }
            } catch (error) { console.error("Error en autenticación:", error); }
        } else {
            window.location.href = "inicioSesion.html";
        }
    });

    const btnCerrarSesion = document.querySelector(".cerrar-sesion");
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", async (e) => {
            e.preventDefault();
            await signOut(auth);
        });
    }

    // === MENÚ SIDEBAR ACTIVE ===
    const lista = document.querySelectorAll(".nav li");
    function activarLink() {
        lista.forEach((item) => item.classList.remove("active"));
        this.classList.add("active");
    }
    lista.forEach((item) => item.addEventListener("click", activarLink));


    // === FUNCIÓN CARGAR CLIENTES (CON DOBLE COMPROBACIÓN Y RESPALDOS) ===
    async function cargarTablaClientes(idTecnico) {
        const tablaBody = document.querySelector(".ordenes-recientes table tbody");
        if (!tablaBody) return;

        tablaBody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px;'>Cargando historial de clientes...</td></tr>";

        try {
            const citasRef = collection(db, "citas");
            const consulta = query(citasRef, where("idTecnico", "==", idTecnico));
            const querySnapshot = await getDocs(consulta);

            if (querySnapshot.empty) {
                tablaBody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px;'>No posees clientes registrados en tu historial.</td></tr>";
                return;
            }

            // Mapeamos las promesas para resolverlas en paralelo de manera ultra veloz
            const promesasCitas = querySnapshot.docs.map(async (documento) => {
                const cita = documento.data();
                
                // Respaldo de ID si no se encuentra al usuario
                let identificadorVisualCliente = cita.idCliente || "Sin ID registrado";
                let contactoCliente = "No registrado";
                
                // Respaldo de Nombre de Servicio (Prioriza 'tituloServicio' de la cita, luego busca 'idServicio')
                let nombreDelServicio = cita.tituloServicio || "Servicio Técnico";

                // 1. BUSQUEDA CRUZADA: Obtener datos del Cliente (usuarios)
                if (cita.idCliente) {
                    try {
                        const clienteRef = doc(db, "usuarios", cita.idCliente);
                        const clienteSnap = await getDoc(clienteRef);
                        
                        if (clienteSnap.exists()) {
                            const datosCliente = clienteSnap.data();
                            const nom = datosCliente.nombre || "";
                            const ape = datosCliente.apellido || "";
                            
                            const nombreFormateado = nom.charAt(0).toUpperCase() + nom.slice(1);
                            const apellidoFormateado = ape.charAt(0).toUpperCase() + ape.slice(1);
                            const nombreCompleto = `${nombreFormateado} ${apellidoFormateado}`.trim();
                            
                            if (nombreCompleto) identificadorVisualCliente = nombreCompleto;
                            contactoCliente = datosCliente.correo || "Sin correo";
                        }
                    } catch (err) {
                        console.error(`Error al traer cliente ${cita.idCliente}:`, err);
                    }
                }

                // 2. BUSQUEDA CRUZADA DE RESPALDO: Si la cita no tiene tituloServicio, lo saca de la colección servicios
                if (!cita.tituloServicio && cita.idServicio) {
                    try {
                        const servicioRef = doc(db, "servicios", cita.idServicio);
                        const servicioSnap = await getDoc(servicioRef);
                        if (servicioSnap.exists()) {
                            const datosServicio = servicioSnap.data();
                            nombreDelServicio = datosServicio.nombre || "Servicio Técnico";
                        }
                    } catch (err) {
                        console.error(`Error al traer servicio ${cita.idServicio}:`, err);
                    }
                }

                return {
                    ...cita,
                    identificadorVisualCliente,
                    contactoCliente,
                    nombreDelServicio
                };
            });

            const listaCitasCompletas = await Promise.all(promesasCitas);
            let htmlFilas = "";

            listaCitasCompletas.forEach((cita) => {
                const claseEstatus = cita.estado ? cita.estado.toLowerCase() : "pendiente";
                
                let textoEstatus = "PENDIENTE";
                if (cita.estado === "realizado") textoEstatus = "COMPLETADO";
                else if (cita.estado) textoEstatus = cita.estado.toUpperCase();

                htmlFilas += `
                    <tr>
                        <td style="font-weight: 600; word-break: break-all;">${cita.identificadorVisualCliente}</td>
                        <td>${cita.nombreDelServicio}</td>
                        <td>
                            <span class="estatus ${claseEstatus}">
                                ${textoEstatus}
                            </span>
                        </td>
                        <td>${cita.contactoCliente}</td>
                    </tr>
                `;
            });

            tablaBody.innerHTML = htmlFilas;

            // Inicializar el buscador con los nuevos elementos inyectados
            inicializarBuscador();

        } catch (error) {
            console.error("Error al poblar la vista de clientes:", error);
            tablaBody.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px; color:red;'>Error al cargar los datos.</td></tr>";
        }
    }

    // === BUSCADOR DINÁMICO ===
    function inicializarBuscador() {
        const buscador = document.querySelector(".buscador-clientes input");
        const filas = document.querySelectorAll(".ordenes-recientes table tbody tr");
        
        if (buscador && filas.length > 0) {
            buscador.onkeyup = () => {
                let texto = buscador.value.toLowerCase().trim();
                filas.forEach((fila) => {
                    if (fila.children.length >= 2) {
                        let identificador = fila.children[0].textContent.toLowerCase();
                        let servicio = fila.children[1].textContent.toLowerCase();
                        
                        if (identificador.includes(texto) || servicio.includes(texto)) {
                            fila.style.display = "";
                        } else {
                            fila.style.display = "none";
                        }
                    }
                });
            };
        }
    }
});