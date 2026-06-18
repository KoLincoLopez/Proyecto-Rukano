# RUKANO

Plataforma web para conectar clientes con técnicos, reservar citas, pagar servicios y registrar reseñas verificadas.

## Recorrido oficial 

El recorrido debe comenzar siempre en:

```text
AppWeb-Rukano/index.html
```

### Flujo cliente

1. `index.html`: explorar servicios y acceder a registro o inicio de sesión.
2. `registro.html?rol=cliente`: crear una cuenta cliente.
3. `inicioSesion.html`: autenticar al usuario.
4. `index.html#servicios`: buscar servicios disponibles.
5. `detalleServicio.html?id=<idServicio>`: revisar y reservar el servicio.
6. `panelCliente.html`: consultar citas, pagar, cancelar o solicitar reembolso cuando corresponda.
7. `payment/exito.html`, `payment/pendiente.html` o `payment/error.html`: retorno de Mercado Pago.
8. `resenasTec.html?citaId=<id>`: reseñar una cita concluida.

### Flujo técnico

1. `registro.html?rol=tecnico`: crear una cuenta técnica.
2. `inicioSesion.html`: autenticar al usuario.
3. `panelTecnico.html`: administrar servicios publicados.
4. `subirServicio.html`: publicar un servicio.
5. `agendaTec.html`: aceptar, cancelar o concluir citas.
6. `dashboard.html`: revisar resumen de citas, clientes y reseñas.
7. `clientesTec.html`: consultar clientes asociados.
8. `miperfilTec.html`: revisar el perfil técnico.
9. `configuracionTec.html`: administrar preferencias técnicas.

### Páginas públicas oficiales

- `index.html`
- `inicioSesion.html`
- `registro.html`
- `detalleServicio.html`
- `sobreNosotros.html`
- `terminos.html`

### Pago

El pago oficial se inicia exclusivamente desde una cita en estado `reservada` dentro de `panelCliente.html`.

- Modo demo: `PATCH /citas/{id_cita}/registrar-pago-demo`
- Mercado Pago: `POST /payments/create_preference/{cita_id}`
- Retornos: `payment/exito.html`, `payment/pendiente.html`, `payment/error.html`

El endpoint antiguo `POST /payments/create_preference` está desactivado y no pertenece al flujo oficial.

## Pantallas y scripts legacy

Se conservan por compatibilidad o referencia, pero no están enlazados desde el recorrido oficial:

- `perfilTec.html`: perfil técnico antiguo.
- `perfiltecnico.html`: detalle de técnico antiguo; el detalle oficial parte desde `detalleServicio.html`.
- `js/perfilTec.js`: controlador del perfil antiguo.
- `js/panelTec.js`: implementación anterior del panel técnico. El panel oficial usa `js/panel.js`.
- `js/pagos.js`: checkout directo por servicio, sustituido por pago asociado a cita.
- `js/app.js`: puente antiguo del flujo de pagos.

Estos archivos no deben usarse durante la evaluación ni volver a conectarse sin una revisión funcional.

## Ejecución local

### Backend

```powershell
cd Backend
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

La API queda disponible normalmente en `http://127.0.0.1:8000`.

### Frontend

Servir `AppWeb-Rukano` mediante un servidor HTTP local. Por ejemplo, con Live Server o:

```powershell
cd AppWeb-Rukano
python -m http.server 5500
```

Abrir `http://127.0.0.1:5500/index.html`.

Antes de probar, revisar `AppWeb-Rukano/js/apiConfig.js` y las variables de entorno del backend para Firebase, URLs y Mercado Pago.

## Validación

1. Abrir `index.html` y probar navbar, registro, login, servicios, nosotros y términos.
2. Registrar y autenticar un cliente; comprobar redirección a `panelCliente.html`.
3. Abrir un servicio, reservarlo y verificarlo en el panel.
4. Pagar una cita aceptada y comprobar los tres retornos de pago.
5. Autenticar un técnico; comprobar acceso a panel, publicación, agenda y dashboard.
6. Confirmar que ninguna página oficial carga `app.js`, `pagos.js`, `panelTec.js` o `perfilTec.js`.
7. Revisar la consola del navegador durante ambos recorridos.

## Riesgos conocidos

- Los archivos legacy siguen siendo accesibles escribiendo su URL manualmente, pero no tienen enlaces desde el flujo oficial.
- Los enlaces de redes sociales se muestran como texto mientras no existan perfiles oficiales.
- Centro de ayuda, seguridad y privacidad reutilizan temporalmente `terminos.html`; no existen páginas independientes.
- La disponibilidad de Mercado Pago depende de las variables de entorno y credenciales del despliegue.
