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

## Endpoints de Gestión (Módulo Alumnos)
Todos requieren `user_type: professor`.
- `GET /api/students`: Listado y búsqueda (`?search=`).
- `POST /api/students`: Registro de alumno (genera contraseña temporal).
- `PUT /api/students/:id`: Actualización de datos.
- `PATCH /api/students/:id/status`: Activar/Desactivar.
- `POST /api/students/:id/reset-password`: Resetear contraseña.

## Endpoints de Gestión (Módulo Laboratorios)
Todos requieren `user_type: professor`.
- `GET /api/laboratories`: Listado de laboratorios.
- `POST /api/laboratories`: Crear laboratorio.
- `PUT /api/laboratories/:id`: Editar laboratorio.
- `PATCH /api/laboratories/:id/status`: Activar/Desactivar.
- `GET /api/laboratories/:id/lines`: Listar líneas de un laboratorio.
- `POST /api/laboratories/:id/lines`: Crear línea.
- `GET /api/lines/:lineId/stations`: Listar estaciones de una línea.
- `POST /api/lines/:lineId/stations`: Crear estación.

## Endpoints de Gestión (Módulo Simulaciones)
Todos requieren `user_type: professor`.
- `GET /api/simulations`: Listado de simulaciones.
- `GET /api/simulations/:id`: Detalle completo (incluye participantes).
- `POST /api/simulations`: Crear simulación (estado `draft`).
- `PUT /api/simulations/:id`: Editar datos básicos (solo en `draft`).
- `PATCH /api/simulations/:id/status`: Cambiar estado (`draft`, `cancelled`).
- `POST /api/simulations/:id/participants`: Asignar o actualizar participante.
- `DELETE /api/simulations/:id/participants/:pId`: Quitar participante.

## Endpoints de Gestión (Módulo Órdenes y Tickets)
Todos requieren `user_type: professor`.
- `GET /api/orders?simulation_id=<id>`: Listado de órdenes (filtrable por simulación).
- `GET /api/orders/:id`: Detalle de orden con tickets incluidos.
- `POST /api/orders`: Crear orden (genera código OP-XXXX automáticamente, estado `draft`).
- `PUT /api/orders/:id`: Editar datos (solo si draft y sin tickets).
- `PATCH /api/orders/:id/status`: Cambiar estado (`draft`, `cancelled`).
- `POST /api/orders/:id/generate-tickets`: Genera `target_quantity` tickets, cada uno asignado a la primera estación activa de la línea. Solo una vez por orden.

## Endpoints de Operación (Módulo Operador)
Requieren `user_type: student` y asignación como `operator` en una simulación activa o preparada.
- `GET /api/operator/context`: Devuelve el contexto operativo del alumno (simulación, línea, estación).
- `GET /api/operator/tickets`: Lista los tickets con estado `available` en la estación del operador.
- `GET /api/operator/current-ticket`: Devuelve el ticket con estado `in_progress` que está trabajando el operador.
- `POST /api/operator/tickets/:ticketId/start`: Cambia un ticket a `in_progress`, asigna el operador actual y emite eventos de WebSocket.

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
