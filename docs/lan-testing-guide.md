# Guía de prueba LAN

1. Iniciar servidor con `HOST=0.0.0.0`.
2. Consultar IP con launcher o `ipconfig`.
3. Permitir Node sólo en red privada de Windows.
4. Abrir `http://IP:3000` desde otra PC o teléfono.
5. Probar login, Andon y Socket.IO.
6. Iniciar/completar un ticket desde un teléfono y confirmar actualización en otra pantalla.

API/frontend no contienen `localhost` fijo en producción; usan rutas del mismo origen.

**NOT RUN:** prueba multi-equipo física, porque sólo está disponible esta computadora durante la ejecución.
