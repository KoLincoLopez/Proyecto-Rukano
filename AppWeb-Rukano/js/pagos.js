const mp = new MercadoPago('TEST-f27713ec-0ad5-4dfa-8876-75f2c54da7eb', {
    locale: 'es-CL' 
});

const btnComprar = document.getElementById("btn-comprar");

btnComprar.addEventListener("click", async () => {
    try {
        btnComprar.disabled = true;
        btnComprar.innerText = "Procesando seguridad...";

        const url = "https://rukano-sph.onrender.com/payments/create_preference";
        const datosPago = {
            title: "Servicio Eléctrico - Visita Técnica",
            quantity: 1,
            price: 15000
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(datosPago)
        });

        if (!response.ok) {
            throw new Error(`Error en el servidor: ${response.status}`);
        }

        const data = await response.json();
        const preferenceId = data.preference_id;

        mp.bricks().create("wallet", "wallet_container", {
            initialization: {
                preferenceId: preferenceId,
            },
            customization: {
                texts: {
                    valueProp: 'security_details',
                },
            },
            locale: 'es-CL'
        });

        btnComprar.style.display = "none";

    } catch (error) {
        console.error("Error al procesar el pago:", error);
        alert("Hubo un problema de conexión. Por favor, intenta de nuevo.");

        btnComprar.disabled = false;
        btnComprar.innerText = "Pagar Ahora";
    }
});