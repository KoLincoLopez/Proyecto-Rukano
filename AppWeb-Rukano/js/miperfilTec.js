/* ================= MENU PERFIL ================= */

const perfilBtn = document.querySelector('.toggle');
const nav = document.querySelector('.nav');

if (perfilBtn && nav) {

    perfilBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        nav.classList.toggle("active");
    });

    document.addEventListener("click", (e) => {
        if (!nav.contains(e.target) && !perfilBtn.contains(e.target)) {
            nav.classList.remove("active");
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            nav.classList.remove("active");
        }
    });
}


/* ================= MODAL PERFIL ================= */

const btnEditar = document.querySelector(".btn-editar");
const modal = document.getElementById("modalPerfil");
const cerrarModal = document.getElementById("cerrarModal");
const cancelarModal = document.getElementById("cancelarModal");

if (btnEditar && modal) {

    btnEditar.addEventListener("click", () => {
        modal.style.display = "flex";
    });

    const closeModal = () => {
        modal.style.display = "none";
    };

    cerrarModal?.addEventListener("click", closeModal);
    cancelarModal?.addEventListener("click", closeModal);

    modal?.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
}


/* ================= MODAL PASSWORD ================= */

const btnPassword = document.getElementById("btnPassword");
const modalPassword = document.getElementById("modalPassword");
const cerrarPassword = document.getElementById("cerrarPassword");
const cancelarPassword = document.getElementById("cancelarPassword");

if (btnPassword && modalPassword) {

    btnPassword.addEventListener("click", () => {
        modalPassword.style.display = "flex";
    });

    const closePass = () => {
        modalPassword.style.display = "none";
    };

    cerrarPassword?.addEventListener("click", closePass);
    cancelarPassword?.addEventListener("click", closePass);

    modalPassword?.addEventListener("click", (e) => {
        if (e.target === modalPassword) closePass();
    });
}


/* ================= CERRAR SESION ================= */

const cerrarSesion = document.querySelector(".cerrar-sesion");

if (cerrarSesion) {

    cerrarSesion.addEventListener("click", (e) => {
        e.preventDefault();

        const confirmar = confirm("¿Seguro que deseas cerrar sesión?");

        if (confirmar) {
            window.location.href = "inicioSesion.html";
        }
    });

}


/* ================= CERTIFICACIONES ================= */

document.querySelectorAll(".cert-btn").forEach((boton) => {

    boton.addEventListener("click", () => {
        alert("Abriendo certificado");
    });

});