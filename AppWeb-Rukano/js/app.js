(function () {
    const btnComprar = document.getElementById("btn-comprar");

    if (!btnComprar) {
        return;
    }

    console.warn("El flujo de pagos ahora se maneja desde js/pagos.js.");
})();
// LEGACY: no forma parte del flujo oficial y no debe cargarse desde HTML público.
// El pago vigente se inicia desde panel.js con una cita reservada.
