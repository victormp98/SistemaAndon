# Documentación técnica

## Arquitectura

Monolito modular local/LAN:

- SPA React 19 compilada con Vite 8.
- API REST Express 5.
- Socket.IO 4 para eventos.
- SQLite local en `data/database.sqlite`.
- Express sirve `frontend/dist` en producción.

## Backend

- `src/app.js`: middleware y rutas.
- `src/database/schema.js`: migraciones automáticas.
- `src/services/accessService.js`: ownership y acceso por simulación.
- `src/services/productionService.js`: órdenes y tickets.
- `src/services/reportService.js`: KPIs, PDF y Excel.
- `src/services/backupService.js`: backup y restauración pendiente.
- `src/services/auditService.js`: auditoría.

## Modelo de datos

Tablas principales: `users`, `laboratories`, `production_lines`, `stations`, `simulations`, `simulation_participants`, `production_orders`, `production_tickets`, `ticket_station_logs`, `production_events`, `incidents`, `downtime_events`, `app_settings`, `auth_sessions`, `audit_logs` y `schema_migrations`.

Las migraciones 3 y 4 agregan administrador global, propietario de alumnos, sesiones revocables, auditoría e inicialización de configuración. Los datos existentes sin propietario se asignan a `admin`.

## Configuración

Variables documentadas en `.env.example`. HTTP es predeterminado. HTTPS es opcional mediante `HTTPS_ENABLED`, `HTTPS_KEY_PATH` y `HTTPS_CERT_PATH`.

## Comandos

```powershell
npm.cmd run bootstrap
npm.cmd run seed:demo
npm.cmd run dev
npm.cmd run build
npm.cmd start
npm.cmd test
npm.cmd run lint
```

## Exportaciones

- CSV desde navegador.
- PDF generado por PDFKit.
- XLSX generado por ExcelJS.
- Hojas XLSX: resumen, tickets, eventos, incidencias, paros, estaciones, órdenes, participantes, ranking y defectos.

## KPIs

Avance, WIP, throughput/h, ciclo promedio, ciclo por estación, lead time, scrap/defectos, tiempo muerto, respuesta de supervisor, cuello de botella y ranking. Se calculan en tiempo real desde eventos e historiales; `kpi_snapshots` se conserva para históricos futuros, pero no es necesario para el reporte actual.
