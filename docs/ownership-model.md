# Modelo de ownership

- `users.owner_user_id`: propietario de cada alumno.
- `laboratories.created_by_user_id`: propietario del laboratorio.
- Líneas y estaciones heredan el propietario del laboratorio.
- `simulations.created_by_user_id`: propietario de la simulación.
- Órdenes, tickets, incidentes, paros y analytics heredan acceso desde la simulación.

Reglas:

- Admin global (`is_admin = 1`) ve todo.
- Profesor normal sólo consulta y modifica registros propios.
- Alumno sólo accede a simulaciones donde está en `simulation_participants`.
- Migración 3 asigna registros históricos sin propietario a `admin`.
- El backend aplica filtros y validaciones; la UI no es la barrera de seguridad.
