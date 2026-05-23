(function () {
    const btnComprar = document.getElementById("btn-comprar");
    const usarCheckoutRedireccion = true;
    const apiBaseUrl = window.RukanoApiConfig.getApiBaseUrl();

    if (!btnComprar) {
        return;
    }

    btnComprar.addEventListener("click", iniciarPago);

    async function iniciarPago() {
        const textoOriginal = btnComprar.textContent;

        try {
            const datosPago = obtenerDatosPago();

            btnComprar.disabled = true;
            btnComprar.textContent = "Procesando pago...";
            mostrarEstadoPago("");

            const response = await fetch(`${apiBaseUrl}/payments/create_preference`, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title: datosPago.title,
                    quantity: datosPago.quantity,
                    price: datosPago.price
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 503) {
                    throw new Error("El pago no está configurado en este entorno.");
                }

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

            crearWalletMercadoPago(preferenceId);
            btnComprar.classList.add("is-hidden");
        } catch (error) {
            console.error("Error al procesar el pago:", error);
            mostrarEstadoPago(`No se pudo iniciar el pago: ${error.message}`);

            btnComprar.disabled = false;
            btnComprar.textContent = textoOriginal || "Pagar ahora";
        }
    }

    function obtenerDatosPago() {
        const datosGlobales = window.RukanoPago || {};
        const title = obtenerTexto(btnComprar.dataset.title, datosGlobales.title);
        const quantity = Number(btnComprar.dataset.quantity || datosGlobales.quantity || 1);
        const price = Number(btnComprar.dataset.price || datosGlobales.price);
        const idServicio = obtenerTexto(btnComprar.dataset.servicioId, datosGlobales.idServicio);
        const idTecnico = obtenerTexto(btnComprar.dataset.tecnicoId, datosGlobales.idTecnico);

        if (!title) {
            throw new Error("Falta el nombre del servicio a pagar");
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error("La cantidad del pago no es valida");
        }

        if (!Number.isFinite(price) || price <= 0) {
            throw new Error("Falta el precio del servicio a pagar");
        }

        return {
            title,
            quantity,
            price,
            idServicio,
            idTecnico
        };
    }

    function crearWalletMercadoPago(preferenceId) {
        if (typeof MercadoPago !== "function") {
            throw new Error("Mercado Pago no esta disponible en esta pagina");
        }

        const publicKey = window.RukanoMercadoPagoPublicKey;
        if (!publicKey) {
            throw new Error("Falta la llave publica de Mercado Pago");
        }

        const mp = new MercadoPago(publicKey, {
            locale: "es-CL"
        });

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
    }

    function mostrarEstadoPago(mensaje) {
        const estado = document.getElementById("pago-mensaje");

        if (estado) {
            estado.textContent = mensaje;
        }
    }

    function obtenerTexto(...valores) {
        const valor = valores.find((item) => typeof item === "string" && item.trim());
        return valor ? valor.trim() : "";
    }
})();
