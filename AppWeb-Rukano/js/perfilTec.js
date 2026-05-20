window.addEventListener("DOMContentLoaded", () => {

const form = document.getElementById("tecnicoForm");
const btn = document.getElementById("btnGuardar");
const fileInput = document.getElementById("archivo");
const badge = document.getElementById("estadoBadge");

const rutInput = document.getElementById("rut");
const experienciaInput = document.getElementById("experiencia");

const rutError = document.getElementById("rutError");

function validarRUT(rutCompleto) {
    rutCompleto = rutCompleto.replace(/\./g, "").replace("-", "");

    if (rutCompleto.length < 8) return false;

    const cuerpo = rutCompleto.slice(0, -1);
    let dv = rutCompleto.slice(-1).toUpperCase();

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += parseInt(cuerpo[i]) * multiplo;
        multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }

    const dvEsperado = 11 - (suma % 11);

    let dvFinal;
    if (dvEsperado === 11) dvFinal = "0";
    else if (dvEsperado === 10) dvFinal = "K";
    else dvFinal = dvEsperado.toString();

    return dv === dvFinal;
}

rutInput.addEventListener("input", () => {

    if (rutInput.value === "") {
        rutError.style.display = "none";
        rutInput.style.borderBottom = "";
        return;
    }

    if (!validarRUT(rutInput.value)) {
        rutError.style.display = "block";
        rutError.textContent = "RUT no válido";
        rutInput.style.borderBottom = "2px solid red";
    } else {
        rutError.style.display = "none";
        rutInput.style.borderBottom = "2px solid green";
    }
});

experienciaInput.addEventListener("input", () => {
    if (experienciaInput.value < 0) {
        experienciaInput.value = 0;
    }
});

fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
        badge.textContent = "En revisión";
        badge.classList.remove("bg-warning");
        badge.classList.add("bg-info");
    }
});

form.addEventListener("input", () => {

    const rutValido = validarRUT(rutInput.value);

    if (form.checkValidity() && rutValido) {
        btn.disabled = false;
    } else {
        btn.disabled = true;
    }
});

form.addEventListener("submit", (e) => {
    e.preventDefault();

    alert("Perfil guardado correctamente");

});

});