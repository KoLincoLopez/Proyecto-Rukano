// ================= MENU =================
const toggle = document.querySelector(".toggle");
const nav = document.querySelector(".nav");
const container = document.querySelector(".container");

toggle.onclick = function () {
    nav.classList.toggle("active");
    container.classList.toggle("active");
};


// ================= NOTIFICACIONES =================
const btnNotificaciones = document.getElementById("btnNotificaciones");

btnNotificaciones.addEventListener("click", () => {

    if(btnNotificaciones.textContent === "Activadas"){
        btnNotificaciones.textContent = "Desactivadas";
    } else {
        btnNotificaciones.textContent = "Activadas";
    }

});


// ================= DISPONIBILIDAD =================
const btnDisponibilidad = document.getElementById("btnDisponibilidad");

btnDisponibilidad.addEventListener("click", () => {

    if(btnDisponibilidad.textContent === "Disponible"){
        btnDisponibilidad.textContent = "Ocupado";
    } else {
        btnDisponibilidad.textContent = "Disponible";
    }

});


// ================= ELIMINAR CUENTA =================
const btnEliminar = document.getElementById("btnEliminar");

btnEliminar.addEventListener("click", () => {

    const confirmar = confirm(
        "¿Seguro que deseas eliminar tu cuenta?"
    );

    if(confirmar){
        alert("Cuenta eliminada");
        window.location.href = "login.html";
    }

});


// ================= CERRAR SESION =================
const btnLogout = document.getElementById("btnLogout");

btnLogout.addEventListener("click", (e) => {

    e.preventDefault();

    const confirmar = confirm("¿Deseas cerrar sesión?");

    if(confirmar){
        window.location.href = "login.html";
    }

});