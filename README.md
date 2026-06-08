# RUKANO - Servicios para el hogar
Desarrollo de proyecto para cierre de titulo.

## Variables de entorno

Para ejecutar el backend localmente, crea o actualiza `Backend/.env` con las variables necesarias.
No subas valores reales ni tokens a GitHub.

```env
FIREBASE_CREDENTIALS_JSON=...
MERCADOPAGO_ACCESS_TOKEN=...
```

En Render, agrega `MERCADOPAGO_ACCESS_TOKEN` desde la seccion Environment del servicio backend.

## Verificacion backend antes de demo

Antes de la demo o del merge final, prueba el backend desde la carpeta `Backend` con un entorno virtual funcional:

```bash
uvicorn main:app --reload
```

Luego abre `http://127.0.0.1:8000/docs` y confirma que cargan los routers principales, incluyendo `payments`.

## Alcance pagos para demo

El flujo de pagos queda dividido en dos caminos, para evitar mezclar la demo funcional con la integracion real pendiente:

### Pago demo de citas

- El panel del cliente usa un pago demo controlado por backend para pasar una cita `reservada` a `pago_realizado`.
- La ruta usada es `/citas/{id_cita}/registrar-pago-demo`.
- Este flujo existe solo para presentar el recorrido completo de la demo: solicitud, aceptacion, pago demo, conclusion y resena.
- El frontend no debe marcar `pago_realizado` directamente en Firestore.

### Checkout Mercado Pago

- `detalleServicio.html` envia nombre y precio reales del servicio al frontend de pagos.
- `js/pagos.js` llama al backend en `/payments/create_preference`.
- El backend crea la preferencia de pago si `MERCADOPAGO_ACCESS_TOKEN` esta configurado.
- Si Mercado Pago responde correctamente, el frontend redirige usando `sandbox_init_point` o `init_point`.
- Si falta `MERCADOPAGO_ACCESS_TOKEN`, se muestra un error controlado.

Este alcance no incluye confirmacion completa por webhook ni actualizacion automatica de la cita como pagada despues del pago. El webhook real de Mercado Pago debe trabajarse en una rama separada.
