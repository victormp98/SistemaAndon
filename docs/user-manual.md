# Manual de usuario

## Arranque

En desarrollo ejecutar `npm.cmd run dev`. En el paquete portable abrir `desktop-launcher\INICIAR_SISTEMA_ANDON.cmd` y elegir `Iniciar servidor`.

## Administrador global

Administra profesores, ve todos los propietarios, modifica configuración global, restaura respaldos y consulta toda la información.

## Profesor

1. Crear alumnos.
2. Crear laboratorio, línea y estaciones.
3. Crear simulación.
4. Asignar operator, supervisor, observer o manager.
5. Crear orden y generar tickets.
6. Cambiar a `ready` y después `running`.
7. Supervisar dashboard, Andon, incidentes y paros.
8. Descargar CSV, PDF o Excel.
9. Crear respaldo.

Un profesor normal sólo ve sus alumnos, laboratorios, simulaciones, órdenes y reportes.

## Alumno

- Operator: toma y completa tickets, agrega notas, reporta defecto/incidente y abre/cierra paros de su estación.
- Supervisor: consulta dashboard/Andon/reporte y atiende incidentes de simulaciones asignadas.
- Observer: acceso de sólo lectura a dashboard, Andon y reporte.
- Manager: consulta KPIs/reportes y puede completar una simulación asignada cuando no quedan tickets.

## Andon

Permite seleccionar simulación y línea, entrar en pantalla completa y muestra colas, proceso, terminados, incidentes y paros. El intervalo usa `andon_refresh_seconds`.

## Restauración

En Configuración seleccionar un respaldo, escribir su nombre completo y confirmar. Reiniciar el servidor desde el launcher para aplicar la restauración.
