const mp = new MercadoPago('APP_USR-4fe19cc9-952e-4ec7-ad20-8998638a546f', {
    locale: 'es-CL' 
});

const btnComprar = document.getElementById("btn-comprar");

btnComprar.addEventListener("click", async () => {
    try {
        btnComprar.disabled = true;
        btnComprar.innerText = "Procesando seguridad...";

        const url = new URL("https://rukano-sph.onrender.com/payments/create_preference");
        url.searchParams.append("title", "Servicio Eléctrico - Visita Técnica");
        url.searchParams.append("quantity", 1);
        url.searchParams.append("price", 15000);

        const response = await fetch(url);

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