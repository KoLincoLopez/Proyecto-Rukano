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

El flujo de pagos aprobado para demo cubre la conexion entre frontend, backend y Mercado Pago:

- `detalleServicio.html` envia nombre y precio reales del servicio al frontend de pagos.
- `js/pagos.js` llama al backend en `/payments/create_preference`.
- El backend crea la preferencia de pago si `MERCADOPAGO_ACCESS_TOKEN` esta configurado.
- Si Mercado Pago responde correctamente, el frontend redirige usando `sandbox_init_point` o `init_point`.
- Si falta `MERCADOPAGO_ACCESS_TOKEN`, se muestra un error controlado.

Este alcance no incluye confirmacion completa por webhook ni actualizacion automatica de la cita como pagada despues del pago.
