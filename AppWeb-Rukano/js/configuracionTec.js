// ==================== MENU DESPLEGABLE ====================

let toggle = document.querySelector('.toggle');
let nav = document.querySelector('.nav');

toggle.onclick = function () {
    nav.classList.toggle('active');
};


// ==================== NOTIFICACIONES ====================

const btnNotificaciones = document.querySelectorAll('.boton')[1];

btnNotificaciones.addEventListener('click', () => {

    if(btnNotificaciones.innerText === 'Activadas'){
        btnNotificaciones.innerText = 'Desactivadas';
        btnNotificaciones.style.background = '#BF353B';
    }else{
        btnNotificaciones.innerText = 'Activadas';
        btnNotificaciones.style.background = '#550006';
    }

});


// ==================== DISPONIBILIDAD ====================

const btnDisponibilidad = document.querySelectorAll('.boton')[2];

btnDisponibilidad.addEventListener('click', () => {

    if(btnDisponibilidad.innerText === 'Disponible'){
        btnDisponibilidad.innerText = 'Ocupado';
        btnDisponibilidad.style.background = '#BF353B';
    }else{
        btnDisponibilidad.innerText = 'Disponible';
        btnDisponibilidad.style.background = '#550006';
    }

});


// ==================== IDIOMA ====================

const btnIdioma = document.querySelectorAll('.boton')[3];

btnIdioma.addEventListener('click', () => {

    if(btnIdioma.innerText === 'Español'){
        btnIdioma.innerText = 'English';
    }else{
        btnIdioma.innerText = 'Español';
    }

});


// ==================== GUARDAR PREFERENCIAS ====================

const btnGuardar = document.querySelector('.notas-box .boton');

btnGuardar.addEventListener('click', () => {

    alert('Preferencias guardadas correctamente');

});


// ==================== ELIMINAR CUENTA ====================

const btnEliminar = document.querySelector('.btn-eliminar');

btnEliminar.addEventListener('click', () => {

    let confirmar = confirm('¿Estás seguro de eliminar tu cuenta?');

    if(confirmar){
        alert('Cuenta eliminada correctamente');
    }

});


// ==================== CERRAR SESION ====================

const cerrarSesion = document.querySelector('.cerrar-sesion');

cerrarSesion.addEventListener('click', (e) => {

    e.preventDefault();

    let salir = confirm('¿Deseas cerrar sesión?');

    if(salir){
        window.location.href = 'inicioSesion.html';
    }

});