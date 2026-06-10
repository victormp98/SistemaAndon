# Estado del producto

Estado de código al 10 de junio de 2026:

- ownership: implementado;
- profesores: implementado;
- roles: implementado;
- sesiones revocables: implementado;
- configuración dinámica: implementado;
- backup/restore: implementado;
- PDF/XLSX/CSV: implementado;
- auditoría: implementado;
- Andon y KPIs: implementado;
- HTTPS opcional: implementado;
- launcher/release: implementado;
- responsive: implementado en código.

Pruebas automatizadas cubren flujo productivo, concurrencia, ownership, permisos, exportaciones, configuración y restauración programada.

El release fue generado y arrancado desde `release/SistemaAndon` usando únicamente `runtime/node.exe`. Se verificaron health, SQLite, frontend HTTP 200, las nueve credenciales TEST, backup CLI y acciones Start/Status/Stop del launcher.

No se declara ejecutada la validación física en teléfono/tablet, otra computadora LAN o PC Windows limpia sin Internet. Los procedimientos están documentados.
