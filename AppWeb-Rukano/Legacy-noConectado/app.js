// LEGACY / NO OFICIAL:
// Este archivo pertenece a un puente antiguo del flujo de pagos y no debe
// usarse como referencia para el flujo actual.
// Flujo oficial actual: panel.js inicia POST /payments/create_preference/{cita_id}
// desde una cita reservada.
// Antes de eliminarlo, debe ser revisado por el equipo para confirmar que no
// se usa en navegacion activa.
(function () {
    const btnComprar = document.getElementById("btn-comprar");

    if (!btnComprar) {
        return;
    }

    console.warn("LEGACY: este script no maneja el flujo oficial de pago. El pago vigente se inicia desde panel.js con una cita reservada.");
})();
// LEGACY: no forma parte del flujo oficial y no debe cargarse desde HTML público.
// El pago vigente se inicia desde panel.js con una cita reservada.
