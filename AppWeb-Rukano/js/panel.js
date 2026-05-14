import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    doc,
    getDoc,
    addDoc,
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const API_URL = "http://127.0.0.1:8000";

window.addEventListener("DOMContentLoaded", () => {

    let datosUsuarioActual = null;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "inicioSesion.html";
            return;
        }

        try {
            const docRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                alert("Error: usuario sin datos");
                await signOut(auth);
                window.location.href = "inicioSesion.html";
                return;
            }

            datosUsuarioActual = docSnap.data();

            const rol = datosUsuarioActual.rol;
            const paginaActual = window.location.href;

            if (rol === "cliente" && paginaActual.includes("panelTecnico.html")) {
                window.location.href = "panelCliente.html";
                return;
            }

            if (rol === "tecnico" && paginaActual.includes("panelCliente.html")) {
                window.location.href = "panelTecnico.html";
                return;
            }

            if (rol === "tecnico" && paginaActual.includes("panelTecnico.html")) {
                cargarMisServicios(user.uid);
            }

            if (rol === "cliente" && paginaActual.includes("panelCliente.html")) {
                prepararPanelCliente(user.uid);
            }

        } catch (error) {
            console.log("Error al obtener rol:", error);
        }
    });

    const btnLogout = document.getElementById("btnLogout");

    if (btnLogout) {
        btnLogout.addEventListener("click", async () => {
            try {
                await signOut(auth);
                window.location.href = "inicioSesion.html";
            } catch (error) {
                console.log("Error al cerrar sesión:", error);
            }
        });
    }

    const formServicio = document.getElementById("formServicio");

    if (formServicio) {
        formServicio.addEventListener("submit", async (e) => {
            e.preventDefault();

            const titulo = document.getElementById("tituloServicio").value.trim();
            const categoria = document.getElementById("categoriaServicio").value.trim();
            const comuna = document.getElementById("comunaServicio").value.trim();
            const precio = document.getElementById("precioServicio").value.trim();
            const tiempo = document.getElementById("tiempoServicio").value.trim();
            const descripcion = document.getElementById("descripcionServicio").value.trim();
            const descripcionTecnico = document.getElementById("descripcionTecnicoServicio").value.trim();
            const experiencia = document.getElementById("experienciaTecnicoServicio").value.trim();
            const incluye = document.getElementById("incluyeServicio").value.trim();
            const noIncluye = document.getElementById("noIncluyeServicio").value.trim();

            const mensajeServicio = document.getElementById("mensajeServicio");
            const user = auth.currentUser;

            if (!user) {
                mensajeServicio.textContent = "Debes iniciar sesión.";
                return;
            }

            const disponibilidad = obtenerDisponibilidadFormulario();

            if (
                !titulo ||
                !categoria ||
                !comuna ||
                !precio ||
                !tiempo ||
                !descripcion ||
                !descripcionTecnico ||
                !experiencia ||
                !incluye ||
                !noIncluye
            ) {
                mensajeServicio.textContent = "Completa todos los campos del servicio.";
                return;
            }

            if (disponibilidad.length === 0) {
                mensajeServicio.textContent = "Selecciona al menos un día disponible con hora inicio y hora fin.";
                return;
            }

            try {
                const servicioNuevo = {
                    idTecnico: user.uid,
                    nombre: titulo,
                    categoria: categoria,
                    comuna: comuna,
                    descripcion: descripcion,
                    precio: Number(precio),
                    tiempoEstimado: tiempo,
                    que_incluye: textoALista(incluye),
                    que_no_incluye: textoALista(noIncluye),
                    esquema_formulario: [
                        {
                            id_pregunta: "1",
                            pregunta: "Describe el problema",
                            tipo: "text",
                            obligatorio: true
                        },
                        {
                            id_pregunta: "2",
                            pregunta: "¿Necesitas servicio urgente?",
                            tipo: "boolean",
                            obligatorio: false
                        }
                    ]
                };

                const response = await fetch(`${API_URL}/servicios/crear`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(servicioNuevo)
                });

                if (!response.ok) {
                    throw new Error("Error al crear servicio en backend");
                }

                mensajeServicio.textContent = "Servicio publicado correctamente.";
                formServicio.reset();
                limpiarDisponibilidadFormulario();

                cargarMisServicios(user.uid);

            } catch (error) {
                console.log(error);
                mensajeServicio.textContent = "Error al publicar servicio.";
            }
        });
    }

    function textoALista(texto) {
        return texto
            .split("\n")
            .map(item => item.trim())
            .filter(item => item !== "");
    }

    function obtenerDisponibilidadFormulario() {
        const dias = document.querySelectorAll(".agenda-dia");
        let disponibilidad = [];

        dias.forEach((dia) => {
            const check = dia.querySelector(".check-dia");
            const inicio = dia.querySelector(".hora-inicio").value;
            const fin = dia.querySelector(".hora-fin").value;

            if (check.checked && inicio && fin) {
                disponibilidad.push({
                    dia: check.value,
                    inicio: inicio,
                    fin: fin
                });
            }
        });

        return disponibilidad;
    }

    function limpiarDisponibilidadFormulario() {
        const dias = document.querySelectorAll(".agenda-dia");

        dias.forEach((dia) => {
            const check = dia.querySelector(".check-dia");
            const inicio = dia.querySelector(".hora-inicio");
            const fin = dia.querySelector(".hora-fin");

            check.checked = false;
            inicio.value = "";
            fin.value = "";
        });
    }

    async function cargarMisServicios(uidTecnico) {
        const lista = document.getElementById("listaMisServicios");

        if (!lista) return;

        lista.innerHTML = "<p>Cargando servicios...</p>";

        try {
            const consulta = query(
                collection(db, "servicios"),
                where("idTecnico", "==", uidTecnico)
            );

            const resultado = await getDocs(consulta);

            if (resultado.empty) {
                lista.innerHTML = "<p>Aún no has publicado servicios.</p>";
                return;
            }

            lista.innerHTML = "";

            resultado.forEach((docServicio) => {
                const servicio = docServicio.data();

                const disponibilidad = Array.isArray(servicio.disponibilidad)
                    ? servicio.disponibilidad.map(item => `${item.dia}: ${item.inicio} - ${item.fin}`).join(" | ")
                    : "Sin disponibilidad";

                const card = document.createElement("div");
                card.className = "dato";
                card.style.marginTop = "15px";

                card.innerHTML = `
                    <strong>${servicio.nombre || servicio.titulo || "Servicio"}</strong>
                    <p>Categoría: ${servicio.categoria || "No especificada"}</p>
                    <p>Comuna: ${servicio.comuna || "No especificada"}</p>
                    <p>Precio: $${Math.round(servicio.precio || 0)}</p>
                    <p>Tiempo estimado: ${servicio.tiempoEstimado || "No especificado"}</p>
                    <p>Disponibilidad: ${disponibilidad}</p>
                    <p>Estado: ${servicio.estado || "activo"}</p>

                    <div style="margin-top:15px; display:flex; gap:10px;">
                        <button class="btnEditar" data-id="${docServicio.id}">
                            Editar título
                        </button>

                        <button class="btnEliminar" data-id="${docServicio.id}">
                            Eliminar
                        </button>
                    </div>
                `;

                lista.appendChild(card);

                const btnEliminar = card.querySelector(".btnEliminar");

                btnEliminar.addEventListener("click", async () => {
                    const confirmar = confirm("¿Eliminar este servicio?");

                    if (!confirmar) return;

                    try {
                        await deleteDoc(doc(db, "servicios", docServicio.id));
                        cargarMisServicios(uidTecnico);
                    } catch (error) {
                        console.log(error);
                        alert("Error al eliminar servicio");
                    }
                });

                const btnEditar = card.querySelector(".btnEditar");

                btnEditar.addEventListener("click", async () => {
                    const nuevoTitulo = prompt("Nuevo título:", servicio.nombre || servicio.titulo);

                    if (!nuevoTitulo) return;

                    try {
                        await updateDoc(doc(db, "servicios", docServicio.id), {
                            nombre: nuevoTitulo,
                            titulo: nuevoTitulo
                        });

                        cargarMisServicios(uidTecnico);

                    } catch (error) {
                        console.log(error);
                        alert("Error al editar servicio");
                    }
                });
            });

        } catch (error) {
            console.log("Error al cargar servicios:", error);
            lista.innerHTML = "<p>Error al cargar tus servicios.</p>";
        }
    }

    async function prepararPanelCliente(uidCliente) {
        const params = new URLSearchParams(window.location.search);

        const servicio = params.get("servicio");
        const tecnico = params.get("tecnico");
        const precio = params.get("precio");
        const idTecnico = params.get("idTecnico");
        const idServicio = params.get("idServicio");

        const dashboardCliente = document.getElementById("dashboardCliente");
        const seccionReserva = document.getElementById("seccionReserva");

        const vieneDeReserva = servicio && tecnico && precio && idTecnico && idServicio;

        if (vieneDeReserva) {
            if (dashboardCliente) dashboardCliente.style.display = "none";
            if (seccionReserva) seccionReserva.style.display = "block";
        } else {
            if (dashboardCliente) dashboardCliente.style.display = "block";
            if (seccionReserva) seccionReserva.style.display = "none";
        }

        const servicioReserva = document.getElementById("servicioReserva");
        const tecnicoReserva = document.getElementById("tecnicoReserva");
        const precioReserva = document.getElementById("precioReserva");

        if (servicioReserva) servicioReserva.textContent = servicio || "Sin servicio seleccionado";
        if (tecnicoReserva) tecnicoReserva.textContent = tecnico || "Sin técnico seleccionado";
        if (precioReserva) precioReserva.textContent = precio || "0";

        if (vieneDeReserva) {
            cargarDisponibilidadServicio(idServicio);
        }

        cargarCitasCliente(uidCliente);

        const btnConfirmarReserva = document.getElementById("btnConfirmarReserva");

        if (btnConfirmarReserva) {
            btnConfirmarReserva.addEventListener("click", () => {
                crearReservaCliente(uidCliente);
            });
        }
    }

    async function cargarDisponibilidadServicio(idServicio) {
        const contenedor = document.getElementById("horariosDisponibles");

        if (!contenedor) return;

        contenedor.innerHTML = "<p>Cargando horarios disponibles...</p>";

        try {
            const servicioRef = doc(db, "servicios", idServicio);
            const servicioSnap = await getDoc(servicioRef);

            if (!servicioSnap.exists()) {
                contenedor.innerHTML = "<p>No se encontró el servicio.</p>";
                return;
            }

            const servicio = servicioSnap.data();
            const dias = servicio.disponibilidad || [];

            if (!Array.isArray(dias) || dias.length === 0) {
                contenedor.innerHTML = "<p>Este servicio aún no tiene horarios disponibles.</p>";
                return;
            }

            contenedor.innerHTML = "";

            dias.forEach((item) => {
                const opcion = document.createElement("label");
                opcion.className = "dato";
                opcion.style.display = "block";
                opcion.style.marginTop = "12px";

                opcion.innerHTML = `
                    <input type="radio" name="horarioSeleccionado" value="${item.dia}|${item.inicio}|${item.fin}">
                    <strong>${item.dia}</strong>
                    ${item.inicio} - ${item.fin}
                `;

                contenedor.appendChild(opcion);
            });

        } catch (error) {
            console.log(error);
            contenedor.innerHTML = "<p>Error al cargar horarios.</p>";
        }
    }

    async function crearReservaCliente(uidCliente) {
        const mensajeReserva = document.getElementById("mensajeReserva");

        if (!mensajeReserva) return;

        const params = new URLSearchParams(window.location.search);

        const servicio = params.get("servicio") || "Servicio seleccionado";
        const tecnico = params.get("tecnico") || "Técnico seleccionado";
        const precio = params.get("precio") || "0";
        const idTecnico = params.get("idTecnico") || "sin-id-tecnico";
        const idServicio = params.get("idServicio") || "sin-id-servicio";

        const horarioSeleccionado = document.querySelector("input[name='horarioSeleccionado']:checked");

        if (!horarioSeleccionado) {
            mensajeReserva.textContent = "Selecciona un horario disponible.";
            return;
        }

        const [dia, inicio, fin] = horarioSeleccionado.value.split("|");

        try {
            await addDoc(collection(db, "citas"), {
                idCliente: uidCliente,
                idTecnico: idTecnico,
                idServicio: idServicio,
                servicio: servicio,
                tecnico: tecnico,
                precio: Number(precio),
                dia: dia,
                horaInicio: inicio,
                horaFin: fin,
                estado: "pendiente",
                createdAt: new Date()
            });

            mensajeReserva.textContent = "Reserva creada correctamente.";
            cargarCitasCliente(uidCliente);

        } catch (error) {
            console.log(error);
            mensajeReserva.textContent = "Error al crear la reserva.";
        }
    }

    async function cargarCitasCliente(uidCliente) {
        const lista = document.getElementById("listaCitasCliente");

        if (!lista) return;

        lista.innerHTML = "<p>Cargando citas...</p>";

        try {
            const consulta = query(
                collection(db, "citas"),
                where("idCliente", "==", uidCliente)
            );

            const resultado = await getDocs(consulta);

            if (resultado.empty) {
                lista.innerHTML = "<p>No tienes citas registradas.</p>";
                return;
            }

            lista.innerHTML = "";

            resultado.forEach((docCita) => {
                const cita = docCita.data();

                const card = document.createElement("div");
                card.className = "dato";
                card.style.marginTop = "15px";

                card.innerHTML = `
                    <strong>${cita.servicio}</strong>
                    <p>Técnico: ${cita.tecnico}</p>
                    <p>Día: ${cita.dia}</p>
                    <p>Horario: ${cita.horaInicio} - ${cita.horaFin}</p>
                    <p>Precio: $${cita.precio}</p>
                    <p>Estado: ${cita.estado}</p>
                `;

                lista.appendChild(card);
            });

        } catch (error) {
            console.log("Error al cargar citas:", error);
            lista.innerHTML = "<p>Error al cargar tus citas.</p>";
        }
    }

});