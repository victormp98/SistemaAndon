# Sistema Andon

## Documento fuente para documentación técnica y manual de uso

**Estado verificado:** 10 de junio de 2026
**Ubicación revisada:** `D:\Proyectos\SistemaAndon`
**Tipo de sistema:** aplicación web local para una red LAN
**Estado general:** funcional en desarrollo y en ejecución local de producción; empaquetado portátil pendiente

> Este documento describe únicamente comportamiento comprobado en el código y mediante pruebas locales. Las funciones pendientes o incompletas están identificadas expresamente.

---

# Parte I. Estado técnico

## 1. Propósito del sistema

Sistema Andon administra prácticas o simulaciones de producción. Permite configurar laboratorios, líneas y estaciones; registrar alumnos; crear simulaciones y órdenes; generar tickets unitarios de producción; operar esos tickets por estación; reportar incidentes y paros; consultar un tablero Andon; y generar métricas básicas de la simulación.

El sistema está pensado actualmente para operar dentro de una computadora o red local. No depende de un servidor de base de datos externo ni de servicios en la nube para sus funciones principales.

## 2. Estado funcional resumido

### Implementado y comprobado

- Inicio de sesión con usuarios locales.
- Cambio obligatorio de contraseña para usuarios nuevos o restablecidos.
- Administración de alumnos.
- Administración de laboratorios, líneas y estaciones.
- Creación y administración de simulaciones.
- Asignación de participantes y roles dentro de una simulación.
- Creación de órdenes de producción.
- Generación de tickets unitarios a partir de la cantidad de una orden.
- Flujo de tickets entre estaciones.
- Asignación atómica de tickets a operadores.
- Registro de incidentes y paros.
- Tablero Andon con actualización periódica y eventos en tiempo real.
- Dashboard administrativo.
- Reportes por simulación y exportación CSV.
- Configuración básica persistida en la base de datos.
- Respaldos manuales y respaldo automático diario.
- Pruebas automatizadas del flujo principal.
- Diseño adaptable para escritorio, tablet y teléfono.

### Pendiente

- Empaquetado portátil para copiar a una memoria USB y ejecutar sin instalar ni descargar dependencias.
- Instalador o ejecutable autónomo para Windows.
- Inicio automático como servicio de Windows.
- Validación final de experiencia de usuario en dispositivos físicos.
- HTTPS/TLS para tráfico cifrado.
- Restauración de respaldos desde la interfaz.
- Generación directa de reportes PDF.

### Implementación parcial o con limitaciones

- Los ajustes `andon_refresh_seconds` y `max_ticket_quantity` se guardan, pero el comportamiento actual no los consume dinámicamente.
- El tablero Andon usa actualmente un intervalo fijo de 15 segundos, además de eventos Socket.IO.
- La cantidad máxima de una orden está fijada en código en 500.
- Los roles de simulación `supervisor`, `observer` y `manager` se pueden asignar, pero no tienen interfaces ni permisos especializados.
- La interfaz restringe dashboard y reportes al profesor, pero sus endpoints de análisis requieren solamente un usuario autenticado.
- La tabla de instantáneas KPI existe, pero los reportes actuales calculan datos en tiempo real y no dependen de ella.
- El cierre de sesión elimina el token del navegador; no existe una lista de revocación de tokens en el servidor.

## 3. Arquitectura

La arquitectura implementada es un **monolito modular**:

1. Una SPA React presenta la interfaz.
2. El frontend consume una API REST de Express.
3. Socket.IO comunica actualizaciones en tiempo real.
4. Express aplica reglas de autenticación, autorización y negocio.
5. SQLite almacena toda la información en un archivo local.
6. En producción, Express sirve también los archivos compilados del frontend.

No es una arquitectura de microservicios. No usa Docker actualmente. No necesita PostgreSQL, MySQL, SQL Server ni otro servidor de base de datos.

### Organización del backend

- `backend/src/index.js`: arranque del servidor, conexión a la base, Socket.IO, respaldo automático y cierre controlado.
- `backend/src/app.js`: creación y configuración de la aplicación Express.
- `backend/src/routes/`: endpoints HTTP agrupados por módulo.
- `backend/src/middleware/`: autenticación y autorización.
- `backend/src/domain/`: reglas de transición de estados.
- `backend/src/services/`: lógica de producción y respaldos.
- `backend/src/database/`: conexión, utilidades, migraciones y datos iniciales.

La separación por capas no es completa. Algunos módulos antiguos, especialmente alumnos y laboratorios, todavía contienen consultas SQL directamente en sus rutas.

### Organización del frontend

- `frontend/src/pages/`: pantallas por función.
- `frontend/src/components/`: componentes reutilizables.
- `frontend/src/layouts/`: estructura visual y navegación.
- `frontend/src/services/`: cliente HTTP y servicios de acceso a la API.
- `frontend/src/context/`: estado global de autenticación.
- `frontend/src/styles/`: estilos globales y adaptables.

## 4. Stack tecnológico verificado

### Plataforma

- Node.js `22.13.0`
- npm `10.9.2` en el entorno revisado

### Frontend

- React `19.2.6`
- React DOM `19.2.6`
- React Router `7.15.1`
- Vite `8.0.x`
- Socket.IO Client `4.8.3`
- CSS propio, sin framework visual externo

### Backend

- Express `5.2.1`
- Socket.IO `4.8.3`
- SQLite mediante `sqlite3` `6.0.1`
- JSON Web Token mediante `jsonwebtoken` `9.0.3`
- Contraseñas mediante `bcryptjs` `3.0.3`
- Helmet `8.2.0`
- Express Rate Limit `8.5.2`
- CORS `2.8.6`

### Pruebas

- Ejecutor nativo `node:test`
- Supertest para pruebas HTTP

## 5. Base de datos

### Tipo y ubicación

La base es SQLite. Su ubicación predeterminada es:

```text
data/database.sqlite
```

No se instala ni se inicia un servicio de base de datos. El backend abre directamente ese archivo. Si no existe, el sistema crea la estructura mediante migraciones al arrancar.

### Configuración SQLite

- Llaves foráneas activadas.
- Modo de diario WAL.
- Espera por bloqueos de hasta 5 segundos.
- Sincronización configurada en modo normal.

### Entidades principales

- `users`: profesores y alumnos.
- `laboratories`: laboratorios.
- `production_lines`: líneas de producción.
- `stations`: estaciones de cada línea.
- `simulations`: prácticas o simulaciones.
- `simulation_participants`: alumnos y rol asignado en una simulación.
- `production_orders`: órdenes de producción.
- `production_tickets`: unidades individuales que recorren estaciones.
- `ticket_station_logs`: historial de cada ticket por estación.
- `production_events`: eventos de producción.
- `incidents`: incidentes.
- `downtime_events`: paros.
- `app_settings`: configuración.
- `order_sequences`: consecutivos de órdenes.
- `schema_migrations`: control de migraciones.
- `kpi_snapshots`: estructura disponible para históricos KPI, no integrada al reporte actual.

### Respaldos

Los respaldos se guardan en:

```text
backups/
```

Hay dos mecanismos:

- Manual: se solicita desde Configuración y utiliza una copia consistente con `VACUUM INTO`.
- Automático: al iniciar el servidor se verifica y genera como máximo un respaldo automático por día.

La retención total está limitada a los 10 respaldos SQLite más recientes. La interfaz permite listar y crear respaldos, pero no restaurarlos ni eliminarlos.

Para restaurar manualmente se debe detener el servidor, conservar una copia del archivo actual y reemplazar `data/database.sqlite` por el respaldo elegido. Esta operación no debe hacerse con el servidor activo.

## 6. Configuración de entorno

El archivo local esperado es `.env` en la raíz del proyecto. Está protegido por `.gitignore`.

Ejemplo de estructura, sin revelar secretos reales:

```dotenv
HOST=0.0.0.0
PORT=3000
DATABASE_PATH=data/database.sqlite
JWT_SECRET=COLOCAR_UN_SECRETO_PRIVADO_Y_LARGO
JWT_EXPIRES_IN=8h
```

`JWT_SECRET` no debe publicarse, copiarse a documentación pública ni almacenarse en Git.

## 7. Seguridad implementada

- Contraseñas almacenadas como hash bcrypt, no en texto plano.
- Costo bcrypt configurado en 12 para nuevas contraseñas.
- Tokens JWT con vencimiento configurable; valor actual previsto: 8 horas.
- Verificación del usuario activo en la base en cada solicitud protegida.
- Cambio obligatorio de contraseña para cuentas iniciales o restablecidas.
- Contraseña nueva de al menos 10 caracteres, con letras y números.
- Rate limit general de 300 solicitudes por minuto.
- Límite de 10 intentos fallidos de inicio de sesión por 15 minutos.
- Helmet para encabezados HTTP de seguridad.
- Límite de 100 KB para cuerpos JSON.
- CORS orientado a localhost y direcciones privadas de red.
- Autenticación JWT para conexiones Socket.IO.
- Consultas parametrizadas en las operaciones revisadas.

### Riesgos y decisiones pendientes de seguridad

- El token se almacena en `localStorage`; un XSS podría exponerlo.
- La política CSP de Helmet está desactivada actualmente.
- No existe revocación de JWT al cerrar sesión.
- No hay HTTPS; en una LAN el tráfico viaja sin cifrado.
- La cuenta inicial usa credenciales conocidas y depende del cambio obligatorio en el primer acceso.
- El modelo actual supone una red local controlada.
- Conviene restringir también en backend los endpoints de dashboard y reportes exclusivamente al profesor.

## 8. Usuarios y permisos

### Tipos de usuario de aplicación

#### Profesor

Puede administrar alumnos, infraestructura, simulaciones, órdenes, incidentes, reportes, configuración y respaldos.

#### Alumno

Accede a su pantalla operativa, consulta su asignación y procesa tickets cuando participa como operador.

### Roles dentro de una simulación

- `operator`
- `supervisor`
- `observer`
- `manager`

En la versión actual, el flujo especializado está implementado para `operator`. Los otros roles se almacenan como asignaciones, pero no disponen de pantallas o capacidades diferenciadas.

### Usuario inicial

Si no existe un usuario llamado `admin`, el arranque crea:

```text
Usuario: admin
Contraseña inicial: admin123
Tipo: profesor
```

El sistema obliga a cambiar esa contraseña en el primer inicio de sesión. Estas credenciales no deben conservarse como contraseña definitiva.

No existe actualmente una pantalla para crear profesores adicionales. Los alumnos son creados por un profesor.

## 9. Estados y reglas de negocio

### Estados de una simulación

```text
draft -> ready -> running -> paused -> running
draft/ready/running/paused -> cancelled
running/paused -> completed
```

`completed` y `cancelled` son estados terminales.

Para cambiar una simulación a `ready` se requiere:

- Al menos un operador asignado a una estación.
- Al menos una orden.
- Todos los pedidos deben tener tickets generados.

Al iniciar una simulación:

- Se registra su fecha de inicio.
- Las órdenes en borrador pasan a liberadas.
- Los tickets en espera pasan a disponibles.

No se puede completar manualmente mientras existan tickets pendientes. El sistema completa automáticamente una orden cuando todos sus tickets terminaron, y completa la simulación cuando terminaron todos los tickets de todas sus órdenes.

### Órdenes

- Sólo el profesor las administra.
- Se crean en simulaciones `draft` o `ready`.
- La línea debe pertenecer al laboratorio de la simulación y estar activa.
- La línea debe tener al menos una estación activa.
- Cantidad permitida actualmente: 1 a 500 unidades enteras.
- Prioridades: `low`, `medium`, `high`, `urgent`.
- Códigos secuenciales: `OP-0001`, `OP-0002`, etc.

Los tickets se generan una sola vez, dentro de una transacción. Una orden de cantidad 20 produce 20 tickets, por ejemplo `OP-0001-T001`.

### Tickets y operación

- Cada ticket representa una unidad.
- Comienza en la primera estación activa según su secuencia.
- Sólo puede existir un ticket `in_progress` por operador.
- La toma de un ticket es atómica para evitar que dos operadores reclamen la misma unidad.
- La cola prioriza `urgent`, `high`, `medium`, `low` y después antigüedad.
- Al completar una estación, el ticket pasa a la siguiente.
- Al terminar la última estación, el ticket queda `completed`.
- Los cambios generan historial por estación y eventos de producción.

### Incidentes

Se pueden registrar durante simulaciones `running` o `paused`.

Tipos admitidos:

- `defect`
- `quality`
- `safety`
- `material`
- `other`

Severidades:

- `low`
- `medium`
- `high`
- `critical`

Estados:

- `open`
- `in_progress`
- `resolved`

### Paros

Un paro se asocia a una simulación y estación. No puede haber dos paros abiertos simultáneos para la misma combinación de simulación y estación. Sus estados son `open` y `closed`.

## 10. API disponible

Prefijo general:

```text
/api
```

Módulos principales:

- `/api/health`: salud del servidor.
- `/api/db/status`: estado de base de datos, sólo profesor.
- `/api/auth`: login, usuario actual, cambio de contraseña y logout.
- `/api/students`: administración de alumnos, sólo profesor.
- `/api/labs`: laboratorios, líneas y estaciones, sólo profesor.
- `/api/simulations`: simulaciones y participantes, sólo profesor.
- `/api/orders`: órdenes y generación de tickets, sólo profesor.
- `/api/operator`: contexto y trabajo del alumno operador.
- `/api/incidents`: incidentes y paros.
- `/api/analytics`: dashboard, Andon y reportes.
- `/api/settings`: configuración y respaldos, sólo profesor.

## 11. Comunicación en tiempo real

Socket.IO actualiza a los clientes ante eventos de:

- Tickets.
- Simulaciones.
- Incidentes.
- Paros.

El tablero Andon combina estos eventos con una actualización periódica fija de 15 segundos. Las conexiones usan el JWT del usuario y se agrupan por usuario y por simulación.

## 12. Interfaz y comportamiento adaptable

### Escritorio

- Navegación lateral permanente.
- Tablas y paneles en varias columnas cuando existe espacio.

### Tablet y teléfono

- Menú lateral convertido en panel desplegable a partir de 900 px.
- Paneles reorganizados verticalmente.
- Tablas convertidas en tarjetas en pantallas de hasta 700 px.
- Ajustes adicionales para pantallas de hasta 420 px.
- Modales limitados al tamaño visible.
- Se evita depender de desplazamiento horizontal para las pantallas principales.

La compilación y revisión estática del diseño fueron satisfactorias. La validación de experiencia de usuario en teléfonos y tabletas físicos sigue pendiente.

## 13. Calidad y verificaciones ejecutadas

Resultados comprobados:

- `npm test`: 4 pruebas aprobadas de 4.
- Prueba de salud HTTP aprobada.
- Prueba unitaria de transiciones válidas aprobada.
- Prueba unitaria de transiciones inválidas aprobada.
- Prueba de integración del flujo principal aprobada.
- Lint del frontend aprobado.
- Compilación de producción aprobada.
- Auditoría npm en raíz, backend y frontend: 0 vulnerabilidades reportadas.
- API respondió con base conectada.
- Frontend respondió HTTP 200.
- Respaldo automático confirmado.

La prueba de integración cubre autenticación, cambio de contraseña, laboratorio, línea, estación, alumno, simulación, orden, tickets, transición de estados, reclamo concurrente, terminación, incidentes, paros, dashboard, reportes y respaldo.

Estas verificaciones no sustituyen pruebas de carga, pentesting ni validación final con usuarios.

## 14. Deuda técnica y recomendaciones

Prioridad alta:

1. Realizar validación funcional y de usabilidad con profesor y alumnos reales.
2. Corregir la autorización de analytics para que dashboard y reportes sean exclusivamente de profesor en el backend.
3. Definir el método de distribución portátil y probarlo en una computadora limpia y sin Internet.
4. Incorporar HTTPS si el sistema se usará en una red compartida o no confiable.
5. Probar recuperación real desde un respaldo.

Prioridad media:

1. Conectar `andon_refresh_seconds` y `max_ticket_quantity` con el comportamiento real.
2. Definir funciones concretas para supervisor, observador y gerente, o retirar temporalmente esos roles.
3. Agregar creación y administración de profesores.
4. Sustituir los cuadros `prompt` del operador por formularios y validaciones visuales.
5. Implementar restauración controlada de respaldos.
6. Implementar registro estructurado de errores y auditoría administrativa.
7. Unificar gradualmente la arquitectura de rutas antiguas con servicios de dominio.

Prioridad baja:

1. Generar reportes PDF desde el sistema.
2. Definir y poblar históricos KPI si se requieren tendencias.
3. Agregar filtros, paginación y búsquedas si crece el volumen de datos.
4. Revisar dependencias locales redundantes en los `package.json`.

---

# Parte II. Manual de instalación y arranque actual

## 15. Requisitos del entorno de desarrollo

Mientras no exista el paquete portátil, la computadora necesita:

- Windows.
- Node.js `22.13.0`.
- npm.
- Dependencias del proyecto instaladas.

NVM for Windows permite mantener varias versiones de Node en la misma computadora. NVM no forma parte de `.venv`; los entornos `.venv` son propios de Python y no administran Node.js.

## 16. Seleccionar Node con NVM

Abrir PowerShell en la carpeta del proyecto:

```powershell
cd D:\Proyectos\SistemaAndon
nvm list
nvm use 22.13.0
node --version
npm.cmd --version
```

El resultado de `node --version` debe ser:

```text
v22.13.0
```

Si PowerShell bloquea `npm.ps1`, utilizar `npm.cmd` en todos los comandos. No es necesario modificar la política de ejecución para trabajar.

## 17. Primera preparación en una computadora con Internet

Este proceso se ejecuta una vez o cuando cambien las dependencias:

```powershell
cd D:\Proyectos\SistemaAndon
nvm use 22.13.0
npm.cmd run bootstrap
```

`bootstrap` instala las dependencias de raíz, backend y frontend. No es un comando de arranque diario.

El archivo `.env` también se prepara una sola vez y se conserva localmente. No se debe recrear en cada ejecución.

## 18. Arranque para desarrollo

```powershell
cd D:\Proyectos\SistemaAndon
nvm use 22.13.0
npm.cmd run dev
```

Servicios esperados:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:3000
Salud API: http://localhost:3000/api/health
```

Para acceder desde otro dispositivo de la misma red se utiliza la IP de la computadora anfitriona y el puerto correspondiente, siempre que el firewall permita la conexión.

Ejemplo conceptual:

```text
http://192.168.1.50:5173
```

La dirección exacta depende de la red y debe obtenerse en la computadora anfitriona.

## 19. Arranque local de producción

Primero compilar:

```powershell
cd D:\Proyectos\SistemaAndon
nvm use 22.13.0
npm.cmd run build
```

Después iniciar:

```powershell
npm.cmd start
```

Dirección esperada:

```text
http://localhost:3000
```

En este modo Express sirve API, Socket.IO y frontend compilado desde un solo puerto.

## 20. Ejecuciones posteriores

En cada nueva terminal:

```powershell
cd D:\Proyectos\SistemaAndon
nvm use 22.13.0
npm.cmd run dev
```

No se ejecuta `npm install` o `bootstrap` en cada arranque. Sólo se reinstala cuando:

- Es la primera preparación.
- Cambió algún `package.json` o archivo de bloqueo.
- Se eliminaron las carpetas `node_modules`.
- Las dependencias están dañadas.

## 21. Detener el sistema

En la terminal donde se ejecuta:

```text
Ctrl+C
```

El backend intenta cerrar de forma controlada el servidor y la conexión SQLite.

## 22. Diagnóstico básico

### PowerShell no permite ejecutar npm

Usar:

```powershell
npm.cmd run dev
```

### El puerto está ocupado

Verificar procesos que usan 3000 o 5173. También puede modificarse `PORT` en `.env`, pero el proxy de desarrollo puede requerir el ajuste correspondiente.

### No se puede iniciar sesión

- Confirmar que el backend arrancó.
- Abrir `/api/health`.
- Confirmar que la base está conectada.
- En una base nueva usar la cuenta inicial `admin`.
- Si la contraseña ya fue cambiada, `admin123` deja de ser válida.

### Otro dispositivo no abre el sistema

- Confirmar que ambos dispositivos estén en la misma red.
- Usar la IP LAN, no `localhost`.
- Confirmar que Windows Firewall permita Node en redes privadas.
- Confirmar que el servidor escucha en `0.0.0.0`.

---

# Parte III. Manual de uso

## 23. Primer acceso

1. Abrir la dirección del sistema.
2. Iniciar sesión con `admin` y `admin123` únicamente si la base es nueva.
3. El sistema mostrará el cambio obligatorio de contraseña.
4. Definir una contraseña de al menos 10 caracteres que contenga letras y números.
5. Guardar la nueva contraseña en un medio seguro.

## 24. Orden recomendado de configuración

Para poder ejecutar una simulación correctamente:

1. Crear o verificar el laboratorio.
2. Crear una línea dentro del laboratorio.
3. Crear y ordenar las estaciones de esa línea.
4. Crear los alumnos.
5. Crear una simulación.
6. Asignar alumnos como participantes.
7. Asignar al menos un operador a una estación.
8. Crear una orden de producción.
9. Generar sus tickets.
10. Cambiar la simulación a `ready`.
11. Iniciar la simulación.

## 25. Funciones del profesor

### Dashboard

Muestra:

- Laboratorios activos.
- Alumnos activos.
- Simulaciones en ejecución.
- Tickets en proceso.
- Incidentes abiertos.
- Paros activos.
- Simulaciones recientes.

### Laboratorios

Permite crear y editar:

- Laboratorios.
- Líneas de producción.
- Estaciones.

Las estaciones deben tener una secuencia coherente, porque esa secuencia determina el recorrido de los tickets.

### Alumnos

Permite:

- Crear alumnos.
- Editar sus datos.
- Activarlos o desactivarlos.
- Restablecer su contraseña.

Un alumno nuevo o restablecido debe cambiar su contraseña en el siguiente acceso. Sólo alumnos activos pueden asignarse a simulaciones.

### Simulaciones

Permite:

- Crear una simulación vinculada a un laboratorio.
- Asignar participantes.
- Elegir su rol.
- Asignar una estación a los operadores.
- Cambiar el estado según las reglas permitidas.

Antes de marcarla lista, verificar participantes, órdenes y tickets.

### Órdenes

Permite:

- Crear una orden para una simulación.
- Seleccionar la línea.
- Capturar producto, cantidad y prioridad.
- Generar los tickets unitarios.

Los tickets no deben generarse dos veces. La interfaz y el backend bloquean esa operación.

### Incidentes

Permite revisar incidentes y avanzar su estado hasta `resolved`. Los incidentes permanecen como parte del registro de la simulación.

### Reportes

El reporte por simulación incluye:

- Estado.
- Fecha de inicio y fin.
- Número de órdenes.
- Número de tickets.
- Tickets completados.
- Tiempo promedio de ciclo.
- Cantidad de incidentes.
- Cantidad de paros.

La interfaz permite exportar estos datos en CSV. No genera PDF directamente.

### Configuración y respaldos

Permite:

- Consultar y modificar ajustes persistidos.
- Crear un respaldo manual.
- Consultar la lista de respaldos.

Modificar un ajuste no garantiza que ya afecte el comportamiento: `andon_refresh_seconds` y `max_ticket_quantity` todavía no están conectados dinámicamente.

## 26. Funciones del alumno operador

1. Iniciar sesión.
2. Cambiar la contraseña si el sistema lo exige.
3. Abrir la pantalla de alumno.
4. Verificar la simulación y estación asignadas.
5. Esperar a que la simulación esté `running`.
6. Tomar un ticket disponible.
7. Realizar la operación física correspondiente.
8. Completar el ticket en la interfaz.
9. Repetir el proceso con el siguiente ticket.

Un operador sólo puede mantener un ticket en proceso. Cuando completa su estación, el ticket pasa a la siguiente estación o termina si era la última.

El operador puede reportar:

- Incidente.
- Paro de estación.

La captura actual utiliza diálogos sencillos del navegador y debe describirse como funcionalidad básica, no como formulario avanzado.

## 27. Tablero Andon

El tablero está disponible para cualquier usuario autenticado.

Muestra simulaciones en estados:

- `ready`
- `running`
- `paused`

Por estación presenta información de cola, tickets en proceso y completados, además de indicadores de incidentes o paros abiertos.

La información se actualiza mediante eventos en tiempo real y una consulta periódica cada 15 segundos.

## 28. Pausar, reanudar y finalizar

### Pausar

Una simulación `running` puede pasar a `paused`. El contexto sigue visible, pero no se deben iniciar nuevas operaciones de tickets mientras esté pausada.

### Reanudar

Una simulación `paused` puede volver a `running`.

### Finalizar

La simulación sólo puede completarse cuando no queden tickets pendientes. También puede completarse automáticamente al terminar el último ticket.

### Cancelar

La cancelación es terminal. No existe una transición posterior para reabrir una simulación cancelada.

## 29. Procedimiento operativo sugerido

### Antes de la práctica

1. Encender y conectar la computadora anfitriona a la red.
2. Iniciar el sistema.
3. Probar acceso desde los dispositivos.
4. Confirmar alumnos, laboratorio, línea y estaciones.
5. Preparar simulación, participantes, orden y tickets.
6. Crear un respaldo manual.

### Durante la práctica

1. Cambiar la simulación a `running`.
2. Vigilar el dashboard y el Andon.
3. Registrar incidentes y paros cuando ocurran.
4. Resolver o cerrar eventos desde la interfaz del profesor.
5. Pausar la simulación si la práctica debe detenerse temporalmente.

### Después de la práctica

1. Confirmar que los tickets terminaron.
2. Completar la simulación.
3. Consultar el reporte.
4. Exportar CSV si se requiere.
5. Crear un respaldo manual.
6. Detener el servidor con `Ctrl+C`.

---

# Parte IV. Información para generar los documentos PDF

## 30. PDF de documentación técnica

El PDF técnico debe incluir:

- Propósito y alcance.
- Estado real del proyecto.
- Arquitectura.
- Stack tecnológico.
- Estructura de backend y frontend.
- Modelo de datos.
- Reglas de negocio.
- Autenticación y autorización.
- Seguridad implementada y riesgos.
- API por módulos.
- Comunicación en tiempo real.
- Respaldos.
- Pruebas ejecutadas.
- Requisitos y comandos.
- Limitaciones y deuda técnica.
- Plan pendiente de empaquetado portátil.

No debe afirmar:

- Que existe un ejecutable autónomo.
- Que existe un instalador.
- Que funciona sin Node y dependencias instaladas.
- Que usa Docker.
- Que tiene HTTPS.
- Que restaura respaldos desde la interfaz.
- Que genera PDF internamente.
- Que todos los ajustes guardados ya modifican el comportamiento.

## 31. PDF de manual de usuario

El manual de usuario debe separar:

- Primer acceso.
- Funciones del profesor.
- Funciones del alumno operador.
- Preparación de infraestructura.
- Creación de simulación.
- Creación de orden y tickets.
- Inicio, pausa, reanudación, terminación y cancelación.
- Uso del Andon.
- Incidentes y paros.
- Reportes.
- Respaldos.
- Solución de problemas frecuentes.

Las capturas de pantalla deben obtenerse de la aplicación actual. No deben generarse pantallas ficticias.

## 32. Glosario

- **Andon:** tablero visual del estado de la producción.
- **Laboratorio:** espacio organizativo que contiene líneas.
- **Línea:** flujo de producción compuesto por estaciones.
- **Estación:** etapa de trabajo por la que pasan los tickets.
- **Simulación:** ejecución controlada de una práctica de producción.
- **Orden:** lote de producción solicitado.
- **Ticket:** unidad individual de una orden.
- **Operador:** alumno que procesa tickets en una estación.
- **Incidente:** evento de calidad, seguridad, material u otro problema.
- **Paro:** detención abierta asociada a una estación.
- **JWT:** token utilizado para autenticar solicitudes.
- **SQLite:** base de datos contenida en un archivo local.
- **Socket.IO:** canal de comunicación de eventos en tiempo real.
- **SPA:** aplicación web cuya navegación ocurre principalmente en el navegador.

## 33. Conclusión técnica

El sistema dispone de un flujo funcional completo para configurar y ejecutar simulaciones de producción locales. Su arquitectura es adecuada para una instalación pequeña o de laboratorio: React, Express, Socket.IO y SQLite reducen la infraestructura necesaria. El flujo principal está cubierto por pruebas automatizadas y la compilación actual es correcta.

El proyecto todavía no debe presentarse como producto portátil terminado. Antes de su entrega final faltan la validación de experiencia de usuario, la corrección de algunas autorizaciones y configuraciones parciales, la prueba formal de restauración y, principalmente, el empaquetado para operar en una computadora limpia sin descargas.
