const mp = new MercadoPago('APP_USR-6638071284929820-042921-b378cc2d916b6dff6e625c6ef024dbb7-3369359916', {
    locale: 'es-CL' // Configura idioma y moneda de Chile
});

const btnComprar = document.getElementById("btn-comprar");

btnComprar.addEventListener("click", async () => {
    try {
        btnComprar.disabled = true;
        btnComprar.innerText = "Procesando seguridad...";

        // 4. Hacemos la petición a tu backend en Render
        const url = new URL("http://127.0.0.1:8000/payments/create_preference");
        url.searchParams.append("title", "Servicio Eléctrico - Visita Técnica");
        url.searchParams.append("quantity", 1);
        url.searchParams.append("price", 15000);

        // 2. Hacemos el fetch SIN el 'body'
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json"
            }
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
        });

        btnComprar.style.display = "none";

    } catch (error) {
        console.error("Error al procesar el pago:", error);
        alert("Hubo un problema de conexión. Por favor, intenta de nuevo.");

        btnComprar.disabled = false;
        btnComprar.innerText = "Pagar Ahora";
    }
});