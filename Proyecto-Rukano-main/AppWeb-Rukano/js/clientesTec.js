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


// ================= BUSCADOR CLIENTES =================
const buscador = document.querySelector(".buscador-clientes input");
const filas = document.querySelectorAll("tbody tr");

buscador.addEventListener("keyup", () => {

    let texto = buscador.value.toLowerCase();

    filas.forEach((fila) => {

        let nombreCliente = fila.children[0].textContent.toLowerCase();

        if (nombreCliente.includes(texto)) {

            fila.style.display = "";

        } else {

            fila.style.display = "none";

        }

    });

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