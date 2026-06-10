const jwt = require('jsonwebtoken');
const config = require('../config/appConfig');
const db = require('../database/connection');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      ok: false, 
      error: 'Acceso denegado. Token no proporcionado.' 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);

    // Verify user in DB
    const query = "SELECT id, name, username, email, user_type, is_active, must_change_password FROM users WHERE id = ? AND is_active = 1";
    db.get(query, [decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ 
          ok: false, 
          error: 'Token inválido o usuario no encontrado.' 
        });
      }

      req.user = user;
      if (user.must_change_password && !['/change-password', '/me'].includes(req.path)) {
        return res.status(403).json({
          ok: false,
          code: 'PASSWORD_CHANGE_REQUIRED',
          error: 'Debes cambiar tu contraseña antes de continuar.'
        });
      }
      next();
    });
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return res.status(401).json({ 
      ok: false, 
      error: 'Token inválido o expirado.' 
    });
  }
};
