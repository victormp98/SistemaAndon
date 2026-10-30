# Sistema Andon - Producto Completo Local/LAN

Aplicación web para prácticas de producción industrial educativas. Funciona en una computadora Windows anfitriona y atiende navegadores de la misma máquina o de la red LAN. Usa React, Express, Socket.IO y SQLite; no depende de nube ni de un servidor externo de base de datos.

## Desarrollo

Requiere Node.js 22.13.0:

```powershell
nvm use 22.13.0
npm.cmd run bootstrap
npm.cmd run seed:demo
npm.cmd run dev
```

- Frontend de desarrollo: `http://localhost:5173`
- API: `http://localhost:3000/api/health`
- Producción local: `npm.cmd run build` y `npm.cmd start`

## Verificación

```powershell
npm.cmd run seed:demo
npm.cmd run lint
npm.cmd run build
npm.cmd test
npm.cmd audit
npm.cmd --prefix backend audit
npm.cmd --prefix frontend audit
```

## Release portable

El paquete incluye `node.exe`, dependencias productivas, frontend compilado y launcher. La computadora destino no necesita Node, npm, Python ni Internet.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-release.ps1
```

Salida:

```text
release/SistemaAndon/
SistemaAndon-Producto-Final.zip
```

En el paquete abrir `desktop-launcher\INICIAR_SISTEMA_ANDON.cmd`.

## Datos TEST

Inicializar usuarios y registros ficticios con `npm.cmd run seed:demo`. Las cuentas de demostración se describen en la lógica de inicialización; utiliza una base de datos de prueba aislada.

## Documentación

- [Documentación técnica](docs/technical-documentation.md)
- [Manual de usuario](docs/user-manual.md)
- [Modelo de ownership](docs/ownership-model.md)
- [Seguridad](docs/security-model.md)
- [Backup y restauración](docs/backup-restore.md)
- [Roles y permisos](docs/roles-and-permissions.md)
- [Pruebas responsive](docs/mobile-responsive-qa.md)
- [Pruebas LAN](docs/lan-testing-guide.md)
- [Paquete de entrega](docs/release-package.md)
- [Estado final](docs/final-product-status.md)


## Red local y CORS

El frontend compilado se sirve desde el backend. Para desarrollar con Vite, el backend permite `http://localhost:5173`, además de `http://localhost:<PUERTO_BACKEND>`.

Para usar un frontend alojado en otro equipo, declara cada origen HTTP(S) completo en `CORS_ORIGINS`. La coincidencia incluye esquema, host y puerto:

```dotenv
CORS_ORIGINS=http://192.168.1.25:5173,http://equipo-lan:5173
```

`CORS_ORIGINS` controla las solicitudes de navegador con encabezado `Origin`; no sustituye la autenticación, autorización, TLS ni las reglas del firewall. Las conexiones HTTP sin ese encabezado no dependen de CORS.

Para ejecutar la API en una interfaz LAN, comprueba `HOST`, `PORT` y el firewall del equipo anfitrión. La dirección configurada debe ser accesible desde el cliente.

## Cuentas de demostración

`npm.cmd run seed:demo` genera usuarios y datos ficticios para ejercicios. Utiliza estas cuentas únicamente en una base de pruebas aislada; evita contraseñas de ejemplo en instalaciones con usuarios reales o acceso no confiable.

## Configuración de seguridad

- `JWT_SECRET`: secreto privado obligatorio para emitir y validar sesiones.
- `HTTPS_ENABLED`, `HTTPS_KEY_PATH` y `HTTPS_CERT_PATH`: servidor TLS opcional.
- `CORS_ORIGINS`: lista explícita de interfaces web autorizadas.
- `DATABASE_PATH`: ubicación del archivo SQLite.

Los secretos y las bases de datos locales deben permanecer fuera de Git.
