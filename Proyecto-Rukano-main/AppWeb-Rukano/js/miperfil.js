/* ================= MENU PERFIL ================= */

var perfilBtn = document.querySelector('.perfil-navbar');
var nav = document.querySelector('.nav');

perfilBtn.onclick = function () {
    nav.classList.toggle('active');
}


// ================= MODAL PERFIL =================
const btnEditar = document.querySelector(".btn-editar");
const modal = document.getElementById("modalPerfil");
const cerrarModal = document.getElementById("cerrarModal");
const cancelarModal = document.getElementById("cancelarModal");

btnEditar.addEventListener("click", () => {
    modal.classList.add("active");
});

cerrarModal.addEventListener("click", () => {
    modal.classList.remove("active");
});

cancelarModal.addEventListener("click", () => {
    modal.classList.remove("active");
});

window.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.classList.remove("active");
    }
});


// ================= MODAL PASSWORD =================
const btnPassword = document.getElementById("btnPassword");

const modalPassword = document.getElementById("modalPassword");

const cerrarPassword = document.getElementById("cerrarPassword");

const cancelarPassword = document.getElementById("cancelarPassword");

btnPassword.addEventListener("click", () => {
    modalPassword.classList.add("active");
});

cerrarPassword.addEventListener("click", () => {
    modalPassword.classList.remove("active");
});

cancelarPassword.addEventListener("click", () => {
    modalPassword.classList.remove("active");
});

window.addEventListener("click", (e) => {
    if (e.target === modalPassword) {
        modalPassword.classList.remove("active");
    }
});


// ================= CERRAR SESION =================
const cerrarSesion = document.querySelector(".cerrar-sesion");

if (cerrarSesion) {

    cerrarSesion.addEventListener("click", function (e) {

        e.preventDefault();

        const confirmar = confirm("¿Seguro que deseas cerrar sesión?");

        if (confirmar) {
            window.location.href = "inicioSesion.html";
        }

    });

}


// ================= CERTIFICACIONES =================
const botonesCert = document.querySelectorAll(".cert-btn");

botonesCert.forEach((boton) => {

    boton.addEventListener("click", () => {

        const cert = boton.dataset.cert;

        alert("Abriendo certificado: " + cert);

        // EJEMPLO PDF
        // window.open("certificados/sec.pdf");

    });

});