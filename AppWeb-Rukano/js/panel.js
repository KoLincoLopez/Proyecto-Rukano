import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, addDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", () => {

    // Verificar sesión + rol
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

            const rol = docSnap.data().rol;
            const paginaActual = window.location.pathname;

            // Bloquear acceso incorrecto
            if (rol === "cliente" && paginaActual.includes("panelTecnico")) {
                window.location.href = "panelCliente.html";
                return;
            }

            if (rol === "tecnico" && paginaActual.includes("panelCliente")) {
                window.location.href = "panelTecnico.html";
                return;
            }

            // Cargar servicios del técnico autenticado
            if (rol === "tecnico" && paginaActual.includes("panelTecnico")) {
                cargarMisServicios(user.uid);
            }

        } catch (error) {
            console.log("Error al obtener rol:", error);
        }
    });

    // Logout seguro
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

    // PUBLICAR SERVICIO
    const formServicio = document.getElementById("formServicio");

    if (formServicio) {
        formServicio.addEventListener("submit", async (e) => {
            e.preventDefault();

            const titulo = document.getElementById("tituloServicio").value.trim();
            const categoria = document.getElementById("categoriaServicio").value.trim();
            const comuna = document.getElementById("comunaServicio").value.trim();
            const precio = document.getElementById("precioServicio").value.trim();
            const incluye = document.getElementById("incluyeServicio").value.trim();
            const noIncluye = document.getElementById("noIncluyeServicio").value.trim();

            const mensajeServicio = document.getElementById("mensajeServicio");
            const user = auth.currentUser;

            if (!user) {
                mensajeServicio.textContent = "Debes iniciar sesión.";
                return;
            }

            if (!titulo || !categoria || !comuna || !precio || !incluye || !noIncluye) {
                mensajeServicio.textContent = "Completa todos los campos.";
                return;
            }

            try {
                await addDoc(collection(db, "servicios"), {
                    idTecnico: user.uid,
                    titulo: titulo,
                    categoria: categoria,
                    comuna: comuna,
                    precio: Number(precio),
                    incluye: incluye,
                    noIncluye: noIncluye,
                    estado: "activo",
                    createdAt: new Date()
                });

                mensajeServicio.textContent = "Servicio publicado correctamente.";
                formServicio.reset();

                cargarMisServicios(user.uid);

            } catch (error) {
                console.log(error);
                mensajeServicio.textContent = "Error al publicar servicio.";
            }
        });
    }

    // CARGAR SERVICIOS DEL TÉCNICO
    async function cargarMisServicios(uidTecnico) {
        const lista = document.getElementById("listaMisServicios");

        if (!lista) {
            return;
        }

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

                const card = document.createElement("div");
                card.className = "dato";
                card.style.marginTop = "15px";

                card.innerHTML = `
                    <strong>${servicio.titulo}</strong>
                    <p>Categoría: ${servicio.categoria}</p>
                    <p>Comuna: ${servicio.comuna}</p>
                    <p>Precio: $${servicio.precio}</p>
                    <p>Estado: ${servicio.estado}</p>
                `;

                lista.appendChild(card);
            });

        } catch (error) {
            console.log("Error al cargar servicios:", error);
            lista.innerHTML = "<p>Error al cargar tus servicios.</p>";
        }
    }

});