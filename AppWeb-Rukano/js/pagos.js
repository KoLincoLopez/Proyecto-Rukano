const mercadoPagoPublicKey = "TEST-f27713ec-0ad5-4dfa-8876-75f2c54da7eb";
const mp = new MercadoPago(mercadoPagoPublicKey, {
    locale: "es-CL"
});

const btnComprar = document.getElementById("btn-comprar");
const isLocalBackend = (
    window.location.protocol === "file:" ||
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
);
const apiBaseUrl = isLocalBackend ? "http://localhost:8000" : "https://rukano-sph.onrender.com";
const usarCheckoutRedireccion = true;

if (btnComprar) {
    btnComprar.addEventListener("click", iniciarPago);
}

async function iniciarPago() {
    try {
        btnComprar.disabled = true;
        btnComprar.textContent = "Procesando seguridad...";

        const response = await fetch(`${apiBaseUrl}/payments/create_preference`, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: "Servicio Electrico - Visita Tecnica",
                quantity: 1,
                price: 15000
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `Error en el servidor: ${response.status}`);
        }

        const preferenceId = data.preference_id;
        if (!preferenceId) {
            throw new Error("El servidor no devolvio preference_id");
        }

        if (usarCheckoutRedireccion) {
            const checkoutUrl = data.sandbox_init_point || data.init_point;
            if (!checkoutUrl) {
                throw new Error("El servidor no devolvio una URL de checkout");
            }

            window.location.href = checkoutUrl;
            return;
        }

        mp.bricks().create("wallet", "wallet_container", {
            initialization: {
                preferenceId
            },
            customization: {
                texts: {
                    valueProp: "security_details"
                }
            },
            locale: "es-CL"
        });

        btnComprar.style.display = "none";
    } catch (error) {
        console.error("Error al procesar el pago:", error);
        alert(`Hubo un problema al iniciar el pago: ${error.message}`);

        btnComprar.disabled = false;
        btnComprar.textContent = "Pagar Ahora";
    }
}
