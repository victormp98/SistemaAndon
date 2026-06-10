# Respaldo y restauración

## Crear

Configuración permite crear un backup consistente con `VACUUM INTO`. El launcher también ofrece respaldo manual. Se genera un respaldo automático diario.

## Restaurar

1. No debe existir simulación `running` o `paused`.
2. Admin selecciona el archivo.
3. Escribe el nombre completo para confirmar.
4. El sistema crea `pre-restore-*.sqlite`.
5. Prepara `database.sqlite.restore-pending`.
6. Reiniciar el servidor.
7. Antes de abrir SQLite, el arranque sustituye la base y elimina WAL/SHM anteriores.

La prueba automatizada valida backup, archivo pendiente y respaldo de seguridad. La sustitución de arranque se implementa en `backend/src/database/connection.js`.
