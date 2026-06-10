# Sistema Andon

Aplicación web para prácticas de producción industrial en una red local. Usa React
en el navegador, Node.js como servidor y una base SQLite almacenada en un archivo.

## Estado actual

El sistema administra alumnos, laboratorios, líneas, estaciones, simulaciones,
órdenes y tickets. Incluye ciclo de simulación, panel Andon, dashboard, reportes
CSV, incidentes, paros, configuración local y respaldos SQLite.

Estados de simulación:

```text
draft -> ready -> running -> paused -> completed
   \        \          \          \
    +--------+----------+-----------> cancelled
```

## Requisitos

- Windows 10/11.
- Node.js 22 LTS, versión 22.13.0 o posterior.
- npm, incluido con Node.js.
- Git, recomendado.

Comprueba la instalación:

```powershell
nvm use 22.13.0
node --version
npm --version
```

Vite 8 y ESLint 10 no funcionan con Node.js 18. Se debe utilizar Node.js 22.13
o una versión compatible posterior.

## Instalación inicial

Desde la raíz del repositorio:

```powershell
npm run bootstrap
```

El archivo `.env` es configuración privada de esta instalación y no se guarda en
Git. Ya debe existir en el entorno de desarrollo o en el paquete portable.

## Ejecución en desarrollo

Inicia backend y frontend:

```powershell
npm run dev
```

Direcciones:

- Interfaz local: `http://localhost:5173`
- API directa: `http://localhost:3000/api/health`
- Interfaz desde otra computadora: `http://IP_DEL_SERVIDOR:5173`

Para conocer la IP del servidor:

```powershell
ipconfig
```

Busca la dirección IPv4 del adaptador de red activo. Si Windows pregunta por el
firewall, permite Node.js únicamente en redes privadas.

## Ejecución de producción

Compila el frontend una vez:

```powershell
npm run build
```

Después inicia un único servidor:

```powershell
npm start
```

La aplicación completa estará disponible en:

```text
http://localhost:3000
http://IP_DEL_SERVIDOR:3000
```

Cada cambio en el frontend requiere ejecutar de nuevo `npm run build`. Los
cambios de backend solo requieren reiniciar `npm start`.

## Base de datos

No se requiere instalar un servidor de base de datos. El proyecto usa SQLite y
crea automáticamente:

```text
data/database.sqlite
```

Las migraciones, tablas e índices se aplican automáticamente al arrancar.
SQLite utiliza claves foráneas, modo WAL y espera controlada por bloqueos.
El usuario administrador inicial también se crea automáticamente.
Credenciales iniciales:

```text
Usuario: admin
Contraseña: admin123
```

Estas credenciales sirven únicamente para el primer acceso. El sistema obliga a
cambiar la contraseña antes de permitir otras operaciones.

### Consultar la base

La forma más sencilla es instalar DB Browser for SQLite y abrir:

```text
D:\Proyectos\SistemaAndon\data\database.sqlite
```

También puede usarse la consola oficial de SQLite:

```powershell
sqlite3 .\data\database.sqlite
```

Ejemplos dentro de SQLite:

```sql
.tables
SELECT id, name, username, user_type, is_active FROM users;
.quit
```

No edites la base mientras el sistema está procesando tickets.

### Respaldar la base

La pantalla de configuración permite crear respaldos consistentes mientras el
servidor está activo. También puedes detenerlo y copiarla manualmente:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item .\data\database.sqlite ".\backups\database-$stamp.sqlite"
```

Para restaurar, detén el servidor y reemplaza `data/database.sqlite` por una
copia válida.

## Configuración

El archivo `.env` admite:

```dotenv
HOST=0.0.0.0
PORT=3000
DATABASE_PATH=data/database.sqlite
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h
```

`.env` y la base SQLite son archivos locales y no deben subirse a Git.

## Docker

Docker no es necesario para la etapa actual. La aplicación está diseñada para
ejecutarse en una sola computadora Windows y SQLite ya está embebido.

Una imagen Docker tendría sentido cuando se necesite:

- instalación idéntica en varias máquinas;
- despliegue automatizado;
- ejecución como servicio administrado;
- aislamiento de versiones.

Antes de contenerizar deben resolverse las migraciones, respaldos, seguridad LAN
y persistencia del volumen SQLite.

## Comandos

```powershell
npm run bootstrap       # Instala todas las dependencias
npm run dev             # Desarrollo: puertos 5173 y 3000
npm run build           # Compila el frontend
npm start               # Producción: aplicación completa en puerto 3000
npm run dev:backend     # Solo backend
npm run dev:frontend    # Solo frontend
npm --prefix frontend run lint
```

La suite de integración se ejecuta con:

```powershell
npm test
```

Valida autenticación, cambio de contraseña, estructura industrial, simulaciones,
órdenes, concurrencia de tickets, incidentes, paros, reportes y respaldos.

## Estructura

```text
SistemaAndon/
|-- backend/
|   |-- src/
|   |-- test/
|   |-- package.json
|   `-- package-lock.json
|-- frontend/
|   |-- public/
|   |-- src/
|   |-- package.json
|   `-- package-lock.json
|-- data/                # Base SQLite local, ignorada por Git
|-- backups/             # Respaldos locales, ignorados por Git
|-- logs/                # Registros locales, ignorados por Git
|-- .gitignore
|-- config.json
|-- package.json
`-- package-lock.json
```

Las carpetas `node_modules` no forman parte del código fuente. Se crean con
`npm run bootstrap` y pueden borrarse y regenerarse.

## Verificación antes de entregar cambios

```powershell
npm test
npm --prefix frontend run lint
npm run build
npm audit
npm --prefix backend audit
npm --prefix frontend audit
```

## Pendiente

La etapa pendiente es el punto 10: refinamiento visual final y generación del
paquete portable para USB con runtime de Node incluido y prueba en una
computadora Windows limpia sin acceso a internet.
