const mp = new MercadoPago('APP_USR-6638071284929820-042921-b378cc2d916b6dff6e625c6ef024dbb7-3369359916', {
    locale: 'es-CL' // Configura idioma y moneda de Chile
});

const btnComprar = document.getElementById("btn-comprar");

btnComprar.addEventListener("click", async () => {
    try {
        btnComprar.disabled = true;
        btnComprar.innerText = "Procesando seguridad...";

        // 4. Hacemos la petición a tu backend en Render
        const response = await fetch("https://rukano-sph.onrender.com/payments/create_preference", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: "Servicio Eléctrico - Visita Técnica",
                quantity: 1,
                price: 15000
            })
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