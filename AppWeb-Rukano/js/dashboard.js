var lista = document.querySelectorAll('.nav li');
function activarLink() {
    lista.forEach((item) =>
        item.classList.remove('active'));
    this.classList.add('active');
}

lista.forEach((item) =>
    item.addEventListener('mouseover', activarLink));

/*funcion para mostra/ocultar el menu*/ 

var toggle = document.querySelector('.perfil-usuario');
var nav = document.querySelector('.nav');
var container = document.querySelector('.container');

toggle.onclick = function() {
    nav.classList.toggle('active');
}
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