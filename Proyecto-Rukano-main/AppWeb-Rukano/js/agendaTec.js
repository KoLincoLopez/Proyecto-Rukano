// ================= MENU TOGGLE =================
const toggle = document.querySelector(".toggle");
const nav = document.querySelector(".nav");
const container = document.querySelector(".container");

toggle.onclick = function () {
    nav.classList.toggle("active");
    container.classList.toggle("active");
};


// ================= MENU ACTIVO =================
const lista = document.querySelectorAll(".nav li");

function activarLink() {
    lista.forEach((item) => {
        item.classList.remove("active");
    });

    this.classList.add("active");
}

lista.forEach((item) => {
    item.addEventListener("click", activarLink);
});


// ================= NOTAS =================
const textarea = document.querySelector(".notas-box textarea");
const botonGuardar = document.querySelector(".notas-box .boton");

// Cargar nota guardada
window.addEventListener("load", () => {
    const notaGuardada = localStorage.getItem("notaAgenda");
    if (notaGuardada) {
        textarea.value = notaGuardada;
    }
});

// Guardar nota
botonGuardar.addEventListener("click", () => {
    const texto = textarea.value;

    localStorage.setItem("notaAgenda", texto);

    alert("Nota guardada correctamente 💾");
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