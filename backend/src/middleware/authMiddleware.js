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
    const query = `SELECT u.id, u.name, u.username, u.email, u.user_type, u.is_admin,
      u.owner_user_id, u.is_active, u.must_change_password
      FROM users u JOIN auth_sessions s ON s.id = ?
      WHERE u.id = ? AND u.is_active = 1 AND s.user_id = u.id
        AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP`;
    db.get(query, [decoded.jti, decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(401).json({ 
          ok: false, 
          error: 'Token inválido o usuario no encontrado.' 
        });
      }

      req.user = user;
      req.sessionId = decoded.jti;
      db.run('UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [decoded.jti]);
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
