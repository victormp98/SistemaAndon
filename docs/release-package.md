# Paquete de entrega

Generar:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-release.ps1
```

Contenido:

- `runtime/node.exe`;
- backend y dependencias productivas;
- frontend compilado;
- launcher;
- documentación;
- `.env.example`;
- directorios vacíos de datos, backups y logs.

No contiene `.git`, `.env` real, base local, backups reales ni logs reales.

Abrir `desktop-launcher\INICIAR_SISTEMA_ANDON.cmd`. El launcher crea `.env` con un secreto aleatorio, inicia/detiene, muestra IP/URLs/estado/clientes, abre navegador, crea backup y carga datos TEST.

`INICIAR_SERVIDOR.cmd` y `DETENER_SERVIDOR.cmd` permiten operación directa. Se puede colocar un acceso directo a `INICIAR_SERVIDOR.cmd` en la carpeta de Inicio de Windows si se requiere arranque al iniciar sesión.
