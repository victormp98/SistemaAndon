# QA responsive

Breakpoints:

- móvil: hasta 767 px;
- tablet: 768 a 1023 px;
- desktop: desde 1024 px.

Implementado:

- sidebar fija sólo en desktop;
- drawer, overlay y hamburguesa en móvil/tablet;
- tablas como tarjetas en móvil;
- paneles apilados;
- modales con alto máximo;
- controles táctiles;
- protección contra overflow horizontal;
- operador y Andon adaptables.

Verificación ejecutada: lint y build.

**NOT RUN:** prueba en teléfono y tablet físicos. Procedimiento: abrir por IP LAN, recorrer todas las rutas, rotar pantalla, confirmar ausencia de scroll horizontal y registrar navegador/resolución.
