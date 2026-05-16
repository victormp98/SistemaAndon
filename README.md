# Laboratorio Industrial - Sistema Andon

Aplicación portable para Windows diseñada para funcionamiento en red local (LAN) offline.

## Tecnologías Base
- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Tiempo Real**: Socket.IO
- **Base de Datos**: SQLite local

## Estructura del Proyecto
- `backend/`: Código fuente del servidor Express y Socket.IO.
- `frontend/`: Código fuente de la aplicación React.
- `data/`: Almacenamiento de la base de datos SQLite (`database.sqlite`).
- `logs/`: Directorio para registros del sistema.
- `backups/`: Directorio para respaldos de la base de datos.
- `config.json`: Configuración global (puerto, host, rutas).

## Requisitos
- Node.js (v18 o superior recomendado)
- npm

## Instalación
Desde la raíz del proyecto:

1. Instalar dependencias globales y orquestador:
   ```bash
   npm install
   ```

2. Instalar dependencias del backend:
   ```bash
   cd backend
   npm install
   cd ..
   ```

3. Instalar dependencias del frontend:
   ```bash
   cd frontend
   npm install
   cd ..
   ```

## Ejecución en Desarrollo
Para ejecutar backend y frontend simultáneamente:
```bash
npm run dev
```

O por separado:
- Backend: `npm run dev:backend`
- Frontend: `npm run dev:frontend`

## Credenciales de Desarrollo
Para las pruebas iniciales, se crea automáticamente un usuario administrador:
- **Usuario:** `admin`
- **Correo:** `admin@local.test`
- **Contraseña:** `admin123`

## Verificación de Salud e Inspección
- API Health: `http://localhost:3000/api/health`
- DB Status: `http://localhost:3000/api/db/status`
- Auth Check: `http://localhost:3000/api/auth/me` (Requiere Bearer Token)
- Frontend: `http://localhost:5173`

## Modelo de Datos Inicial
El sistema utiliza SQLite para persistencia local. Las tablas principales incluyen:
- **Usuarios y Autenticación:** `users` (con hashing `bcryptjs`), `simulation_participants`.
- **Estructura Industrial:** `laboratories`, `production_lines`, `stations`.
- **Operación:** `simulations`, `production_orders`, `production_tickets`.
- **Trazabilidad y Eventos:** `ticket_station_logs`, `production_events`, `incidents`, `downtime_events`.
- **Metadata y Configuración:** `app_metadata`, `app_settings`, `kpi_snapshots`.

## Seguridad
- Las contraseñas se almacenan hasheadas con un factor de costo de 10.
- La autenticación se maneja mediante JWT (JSON Web Tokens).
- El secreto de firma se encuentra en `config.json`.

## Notas
Este proyecto está configurado para ejecutarse localmente sin dependencia de servicios en la nube.
