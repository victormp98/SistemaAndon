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
    const secret = config.auth?.jwtSecret || 'local-development-secret-change-me';
    const decoded = jwt.verify(token, secret);

    // Verify user in DB
    const query = "SELECT id, name, username, email, user_type, is_active FROM users WHERE id = ? AND is_active = 1";
    db.get(query, [decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ 
          ok: false, 
          error: 'Token inválido o usuario no encontrado.' 
        });
      }

      req.user = user;
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
