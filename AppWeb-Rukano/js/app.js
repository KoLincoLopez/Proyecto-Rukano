const mp = new MercadoPago('TU_PUBLIC_KEY_DE_PRUEBA', {
    locale: 'es-CL'
});

const btnComprar = document.getElementById("btn-comprar");

btnComprar.addEventListener("click", async () => {
    try {
        btnComprar.disabled = true;
        btnComprar.innerText = "Cargando...";

       
        const response = await fetch("https://rukano-sph.onrender.com/payments/create_preference", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title: "Producto de prueba",
                quantity: 1,
                price: 15000
            })
        });

        const data = await response.json();
        
        const preferenceId = data.preference_id;

        mp.bricks().create("wallet", "wallet_container", {
            initialization: {
                preferenceId: preferenceId,
            },
            customization: {
                texts: {
                    valueProp: 'smart_option',
                },
            },
        });

        btnComprar.style.display = "none";

    } catch (error) {
        console.error("Error al procesar el pago:", error);
        btnComprar.disabled = false;
        btnComprar.innerText = "Comprar ahora";
    }
});