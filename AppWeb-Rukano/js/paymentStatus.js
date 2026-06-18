import { auth, db } from "./Firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const primaryLink = document.querySelector("[data-payment-primary]");
const brandLink = document.querySelector(".payment-brand");
const headerNote = document.querySelector(".payment-header-note");

function normalizarRol(rol) {
    return String(rol || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function aplicarDestino(href, texto, nota = "Sesion protegida") {
    if (primaryLink) {
        primaryLink.href = href;
        primaryLink.textContent = texto;
    }

    if (brandLink) {
        brandLink.href = href;
    }

    if (headerNote) {
        headerNote.textContent = nota;
    }
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        aplicarDestino("../inicioSesion.html", "Iniciar sesion", "Sesion no detectada");
        return;
    }

    try {
        const userSnap = await getDoc(doc(db, "usuarios", user.uid));
        const rol = userSnap.exists() ? normalizarRol(userSnap.data().rol) : "";

        if (rol === "tecnico") {
            aplicarDestino("../panelTecnico.html", "Volver al panel tecnico");
            return;
        }

        aplicarDestino("../panelCliente.html", "Volver al panel cliente");
    } catch (error) {
        console.warn("No se pudo resolver el panel del usuario tras el pago:", error);
        aplicarDestino("../panelCliente.html", "Volver al panel");
    }
});
