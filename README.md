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

Ejecutar `npm.cmd run seed:demo` o seleccionar `Cargar/restablecer datos TEST` en el launcher.

Credenciales:

```text
admin / admin123
prof1 / prof123
prof2 / prof123
juanp / juanp123
anag / anag123
carlosm / carlos123
mariag / mariag123
luisr / luis123
sofial / sofia123
```

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


## Orígenes CORS permitidos

El backend acepta peticiones sin encabezado `Origin` (por ejemplo, ciertas herramientas de línea de comandos), el origen local configurado y los orígenes declarados explícitamente mediante `CORS_ORIGINS` (separados por comas). Ya no se autoriza automáticamente cualquier origen en una red privada. Para utilizar una interfaz alojada en otro equipo de la LAN, añade su URL exacta a `CORS_ORIGINS` en el servidor antes de arrancar.

Las credenciales incluidas en la sección de datos TEST son exclusivamente para instalaciones de demostración y no deben reutilizarse en una instancia real con datos o acceso a una red no confiable.
