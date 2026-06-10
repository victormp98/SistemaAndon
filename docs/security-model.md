# Modelo de seguridad

- JWT con expiración configurable.
- Cada JWT contiene `jti` ligado a `auth_sessions`.
- Logout, reset de contraseña y desactivación revocan sesiones.
- bcrypt costo 12.
- Cambio obligatorio de contraseña.
- Helmet y CSP de producción.
- CORS limitado a localhost, orígenes configurados y rangos LAN privados.
- Rate limit general y límite de login.
- JSON máximo 100 KB.
- Errores SQLite no se exponen al cliente.
- Socket.IO verifica JWT, sesión activa, usuario activo y salas autorizadas.
- Auditoría nunca almacena contraseñas, tokens ni secretos.

HTTP es predeterminado para facilidad LAN. HTTPS opcional:

```dotenv
HTTPS_ENABLED=true
HTTPS_KEY_PATH=C:\certificados\andon-key.pem
HTTPS_CERT_PATH=C:\certificados\andon-cert.pem
```

Los clientes deben confiar en el certificado utilizado.
