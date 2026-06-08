import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API_URL = window.RukanoApiConfig.getApiBaseUrl();

document.addEventListener("DOMContentLoaded", () => {
    // ==========================================
    // 1. NAVBAR Y MENÚ DESPLEGABLE
    // ==========================================
    const botonPerfil = document.querySelector(".perfil-usuario") || document.querySelector(".toggle");
    const menuDesplegable = document.querySelector(".nav");

    if (botonPerfil && menuDesplegable) {
        botonPerfil.addEventListener("click", () => menuDesplegable.classList.toggle("active"));
    }

    // ==========================================
    // 2. SEGURIDAD Y OBTENCIÓN DE DATOS
    // ==========================================
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "inicioSesion.html";
            return;
        }

        try {
            const userSnap = await getDoc(doc(db, "usuarios", user.uid));
            if (userSnap.exists()) {
                const datosUsuario = userSnap.data();

                if (datosUsuario.rol !== "tecnico") {
                    window.location.href = "index.html";
                    return;
                }

                // Ocultar botones de sesión y mostrar saludo en el Navbar
                document.querySelectorAll(".link-sesion, .btn-registro-nav").forEach(el => el.style.display = "none");
                
                const navDerecha = document.querySelector(".nav-derecha");
                if (navDerecha && botonPerfil && !document.getElementById("saludoNavbar")) {
                    const saludo = document.createElement("span");
                    saludo.id = "saludoNavbar";
                    saludo.style.cssText = "color: var(--c-arena); font-weight: bold; margin-right: 15px; font-size: 14px;";
                    saludo.textContent = `¡Hola, ${datosUsuario.nombre.split(" ")[0]} !`;
                    navDerecha.insertBefore(saludo, botonPerfil);
                }

                // Cambiar foto por inicial
                const img = botonPerfil?.querySelector("img");
                if (img) {
                    const span = document.createElement("span");
                    span.textContent = datosUsuario.nombre.charAt(0).toUpperCase();
                    span.style.cssText = "color: white; font-size: 20px; font-weight: 900; background-color: var(--c-rosewood); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 50%;";
                    img.replaceWith(span);
                }

                // ========================================================
                // AQUÍ LLAMAMOS A LA FUNCIÓN QUE CONECTA CON servicios.py
                // ========================================================
                cargarMisServicios(user.uid);
            }
        } catch (error) {
            console.error("Error al validar el técnico:", error);
        }
    });

    const btnCerrarSesion = document.querySelector(".cerrar-sesion");
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener("click", async (e) => {
            e.preventDefault();
            await signOut(auth);
        });
    }

    // ==========================================
    // 3. OBTENER Y DIBUJAR SERVICIOS DEL BACKEND
    // ==========================================
    async function cargarMisServicios(idTecnico) {
        // Busca el contenedor en panelTecnico.html
        const contenedor = document.getElementById("listaMisServicios");
        if (!contenedor) {
            console.warn("Falta agregar id='listaMisServicios' al contenedor de servicios en tu HTML.");
            return;
        }

        try {
            contenedor.innerHTML = "<p style='padding: 20px;'>Cargando tus servicios desde el servidor...</p>";

            // Conectamos con tu ruta de FastAPI: /api/servicios/tecnico/{id}
            const respuesta = await fetch(`${API_URL}/servicios/tecnico/${idTecnico}`);
            
            if (!respuesta.ok) throw new Error("Error al obtener los datos de la API");

            const servicios = await respuesta.json();
            contenedor.innerHTML = ""; // Limpiar mensaje de "cargando"

            if (servicios.length === 0) {
                contenedor.innerHTML = `
                    <div class="panel-card" style="text-align: center;">
                        <h2 style="color: var(--c-text-muted);">No tienes servicios publicados</h2>
                        <p>Dirígete a la sección 'Subir Servicio' para empezar a ofrecer tu trabajo.</p>
                        <a href="subirServicio.html" class="btnEditar" style="text-decoration:none; display:inline-block; margin-top:15px;">Publicar mi primer servicio</a>
                    </div>`;
                return;
            }

            // Recorrer los servicios que devolvió tu backend y crear el HTML
            servicios.forEach((servicio) => {
                const card = document.createElement("div");
                card.className = "panel-card"; // Estilo que hicimos en el CSS

                // Usamos las variables exactas de tu modelo Python (nombre, descripcion, precio, tiempoEstimado, id)
                card.innerHTML = `
                    <h2>${servicio.nombre}</h2>
                    <p style="margin-bottom: 20px; font-size: 15px; color: #555;">
                        ${servicio.descripcion}
                    </p>
                    
                    <div class="dato">
                        <p><strong>Categoría:</strong> ${servicio.categoria}</p>
                        <p><strong>Comuna:</strong> ${servicio.comuna || "No especificada"}</p>
                        <p><strong>Tarifa base:</strong> $${servicio.precio.toLocaleString("es-CL")}</p>
                        <p><strong>Duración aprox:</strong> ${servicio.tiempoEstimado} horas</p>
                        <p>
                            <strong>Estado:</strong> 
                            <span class="status ${servicio.estado === 'inactivo' ? 'return' : 'delivered'}" style="padding: 2px 8px; font-size: 12px;">
                                ${servicio.estado || "Activo"}
                            </span>
                        </p>
                    </div>

                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button class="btnEditar" data-id="${servicio.id}">Editar</button>
                        <button class="btnEliminar" data-id="${servicio.id}" style="background-color: var(--c-mahogany);">Eliminar</button>
                    </div>
                `;

                // Agregar funcionalidad al botón de eliminar
                card.querySelector(".btnEliminar").addEventListener("click", async () => {
                    const confirmar = confirm(`¿Estás seguro de que deseas eliminar permanentemente el servicio: "${servicio.nombre}"?`);
                    if (confirmar) {
                        try {
                            // Conecta con tu ruta @router.delete("/{servicio_id}")
                            const resDelete = await fetch(`${API_URL}/api/servicios/${servicio.id}`, {
                                method: "DELETE"
                            });
                            
                            if (resDelete.ok) {
                                alert("Servicio eliminado con éxito.");
                                card.remove(); // Borra la tarjeta visualmente sin recargar la página
                            } else {
                                alert("Error al eliminar el servicio en el servidor.");
                            }
                        } catch (err) {
                            console.error("Fallo al eliminar:", err);
                        }
                    }
                });

  // ========================================================
// FUNCIONALIDAD DE EDITAR (MODAL DINÁMICO)
// ========================================================
card.querySelector(".btnEditar").addEventListener("click", () => {
    
    // 1. Creamos el fondo oscuro del modal
    const modal = document.createElement("div");
    modal.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999;";

    // 2. Creamos la caja blanca del formulario y la rellenamos con los datos actuales del servicio
    modal.innerHTML = `
        <div style="background: var(--c-blanco); padding: 30px; border-radius: 15px; width: 90%; max-width: 500px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <h2 style="margin-bottom: 20px; color: var(--c-licorice);">Editar Servicio</h2>
            
            <label style="display:block; margin-bottom: 5px; font-weight: bold; color: var(--c-licorice);">Título del Servicio</label>
            <input type="text" id="editNombre" value="${servicio.nombre}" style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px; font-family: inherit;">

            <label style="display:block; margin-bottom: 5px; font-weight: bold; color: var(--c-licorice);">Descripción</label>
            <textarea id="editDesc" style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px; resize: vertical; min-height: 80px; font-family: inherit;">${servicio.descripcion}</textarea>

            <div style="display: flex; gap: 15px; margin-bottom: 15px;">
                <div style="flex: 1;">
                    <label style="display:block; margin-bottom: 5px; font-weight: bold; color: var(--c-licorice);">Tarifa Base ($)</label>
                    <input type="number" id="editPrecio" value="${servicio.precio}" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 5px; font-family: inherit;">
                </div>
                <div style="flex: 1;">
                    <label style="display:block; margin-bottom: 5px; font-weight: bold; color: var(--c-licorice);">Duración (hrs)</label>
                    <input type="text" id="editTiempo" value="${servicio.tiempoEstimado}" style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 5px; font-family: inherit;">
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 25px;">
                <button id="btnCancelarEdit" style="padding: 10px 20px; background: transparent; color: var(--c-licorice); border: 1px solid #ccc; border-radius: 5px; cursor: pointer; font-weight: bold;">Cancelar</button>
                <button id="btnGuardarEdit" style="padding: 10px 20px; background: var(--c-rosewood); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">Guardar Cambios</button>
            </div>
        </div>
    `;

    // 3. Añadimos el modal a la página
    document.body.appendChild(modal);

    // 4. Lógica para el botón de Cancelar
    document.getElementById("btnCancelarEdit").addEventListener("click", () => {
        modal.remove(); // Destruye el modal
    });

    // 5. Lógica para el botón de Guardar Cambios
    document.getElementById("btnGuardarEdit").addEventListener("click", async () => {
        const btnGuardar = document.getElementById("btnGuardarEdit");
        btnGuardar.innerText = "Guardando...";
        btnGuardar.disabled = true;

        // Recolectamos los nuevos valores escritos por el técnico
        const nuevosDatos = {
            nombre: document.getElementById("editNombre").value,
            descripcion: document.getElementById("editDesc").value,
            precio: parseFloat(document.getElementById("editPrecio").value),
            tiempoEstimado: document.getElementById("editTiempo").value
        };

        try {
            // Mandamos los datos actualizados a FastAPI (Usa PATCH o PUT según tu backend)
            // Asumiendo que tu ruta de actualizar es: PATCH /api/servicios/{servicio_id}
            const resUpdate = await fetch(`${API_URL}/servicios/editar/${servicio.id}`, {
                method: "PATCH", 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nuevosDatos)
            });

            if (resUpdate.ok) {
                alert("Servicio actualizado correctamente.");
                modal.remove(); // Cerramos el modal
                cargarMisServicios(idTecnico); // Recargamos las tarjetas para ver los cambios
            } else {
                alert("Error al actualizar el servicio en el servidor.");
                btnGuardar.innerText = "Guardar Cambios";
                btnGuardar.disabled = false;
            }
        } catch (err) {
            console.error("Fallo al actualizar:", err);
            alert("Error de conexión al intentar guardar.");
            btnGuardar.innerText = "Guardar Cambios";
            btnGuardar.disabled = false;
        }
    });
});

                // Añadimos la tarjeta completa al HTML
                contenedor.appendChild(card);
            });

        } catch (error) {
            console.error("Error al cargar mis servicios:", error);
            contenedor.innerHTML = "<p style='color:red;'>Ocurrió un error al cargar tus servicios. Verifica la conexión con FastAPI.</p>";
        }
    }
});
