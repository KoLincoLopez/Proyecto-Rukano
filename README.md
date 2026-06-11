# RUKANO - Servicios para el hogar
Desarrollo de proyecto para cierre de titulo.

## Variables de entorno

Para ejecutar el backend localmente, crea o actualiza `Backend/.env` con las variables necesarias.
No subas valores reales ni tokens a GitHub.

```env
FIREBASE_CREDENTIALS_JSON=...
MERCADOPAGO_ACCESS_TOKEN=...
FRONTEND_URL=https://proyecto-rukano.onrender.com
BACKEND_URL=https://rukano-sph.onrender.com
```

En Render, agrega `MERCADOPAGO_ACCESS_TOKEN`, `FRONTEND_URL` y `BACKEND_URL` desde la seccion Environment del servicio backend.

### Variables necesarias para pago real

- `MERCADOPAGO_ACCESS_TOKEN`: token de Mercado Pago usado por el backend para crear preferencias y consultar pagos.
- `FRONTEND_URL`: URL publica del frontend. Se usa para las paginas de retorno `success`, `failure` y `pending`.
- `BACKEND_URL`: URL publica del backend. Mercado Pago la usa para llamar a `/payments/webhook`.
- `FIREBASE_CREDENTIALS_JSON`: credenciales de Firebase requeridas en deploy para leer y actualizar Firestore.

El respaldo demo no depende de Mercado Pago. En el frontend se controla con `window.RUKANO_PAYMENT_MODE = "demo"` antes de cargar `js/apiConfig.js`; si no se define, el modo por defecto es `real`.

## Verificacion backend antes de demo

Antes de la demo o del merge final, prueba el backend desde la carpeta `Backend` con un entorno virtual funcional:

```bash
uvicorn main:app --reload
```

Luego abre `http://127.0.0.1:8000/docs` y confirma que cargan los routers principales, incluyendo `payments`.

## Alcance pagos

El flujo de pagos queda dividido en dos caminos, para evitar mezclar el respaldo demo con la integracion real:

### Pago demo de citas

- El panel del cliente usa un pago demo controlado por backend para pasar una cita `reservada` a `pago_realizado`.
- La ruta usada es `/citas/{id_cita}/registrar-pago-demo`.
- Este flujo existe solo para presentar el recorrido completo de la demo: solicitud, aceptacion, pago demo, conclusion y resena.
- El frontend no debe marcar `pago_realizado` directamente en Firestore.

### Checkout Mercado Pago

- `detalleServicio.html` permite reservar una cita mediante el backend; no inicia pagos sin cita.
- El panel del cliente puede llamar al backend en `/payments/create_preference/{cita_id}` para crear una preferencia asociada a una cita `reservada`.
- Este endpoint exige Firebase ID Token y usa su `uid` para validar al cliente.
- El backend guarda el `cita_id` en `external_reference` y configura `notification_url` hacia `/payments/webhook`.
- El webhook consulta el pago real en Mercado Pago y solo cambia la cita a `pago_realizado` cuando el pago esta `approved`.
- Si Mercado Pago responde correctamente, el frontend redirige usando `sandbox_init_point` o `init_point`.
- Si falta `MERCADOPAGO_ACCESS_TOKEN`, se muestra un error controlado.

Para probar webhook localmente necesitas un backend publico, por ejemplo Render o un tunel tipo ngrok, y configurar `BACKEND_URL`.

### Flujo oficial de demo

1. El cliente reserva desde `detalleServicio.html` mediante `POST /citas/reservar`.
2. El tecnico acepta mediante `PATCH /citas/{id_cita}/estado`.
3. El cliente paga por demo o Mercado Pago desde su panel.
4. El tecnico concluye mediante `PATCH /citas/{id_cita}/concluir`.
5. El cliente publica la resena mediante `POST /reviews/crear_resena`.

Todas estas acciones exigen `Authorization: Bearer <Firebase ID Token>`. El backend obtiene el usuario desde el token y no acepta IDs del body como autorizacion.

`POST /payments/create_preference` esta desactivado y responde `410 Gone`. El unico checkout permitido es `POST /payments/create_preference/{cita_id}`.

La verificacion pendiente es ejecutar el recorrido manual completo y una prueba sandbox con webhook publico.
