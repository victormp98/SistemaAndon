const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config/appConfig');
const db = require('../database/connection');
const { run, get } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const auditService = require('../services/auditService');

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { ok: false, error: 'Demasiados intentos. Espera 15 minutos.' }
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const identifier = String(req.body.identifier || '').trim();
  const password = String(req.body.password || '');
  if (!identifier || !password) throw httpError(400, 'Identificador y contraseña requeridos.');

  const user = await get(
    db,
    `SELECT id, name, username, email, password_hash, user_type, is_admin, owner_user_id,
       is_active, must_change_password
     FROM users WHERE username = ? OR email = ?`,
    [identifier, identifier]
  );
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    await auditService.record({
      req,
      userId: user?.id,
      action: 'auth.login_failed',
      success: false,
      details: { identifier }
    });
    throw httpError(401, 'Credenciales inválidas.');
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = expirationDate(config.auth.jwtExpiresIn);
  const token = jwt.sign(
    { id: user.id, username: user.username, type: user.user_type },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn, jwtid: sessionId }
  );
  await run(
    db,
    'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES (?, ?, ?)',
    [sessionId, user.id, expiresAt.toISOString()]
  );
  await auditService.record({ req, userId: user.id, action: 'auth.login_success', entityType: 'user', entityId: user.id });
  delete user.password_hash;
  res.json({ ok: true, token, user });
}));

router.get('/me', authMiddleware, (req, res) => {
  res.json({ ok: true, user: req.user });
});

router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.current_password || '');
  const newPassword = String(req.body.new_password || '');
  if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw httpError(400, 'La contraseña debe tener 10 caracteres, letras y números.');
  }
  const user = await get(db, 'SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw httpError(401, 'La contraseña actual es incorrecta.');
  }
  const hash = await bcrypt.hash(newPassword, 12);
  await run(
    db,
    `UPDATE users SET password_hash = ?, must_change_password = 0,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [hash, req.user.id]
  );
  await auditService.record({ req, action: 'auth.password_changed', entityType: 'user', entityId: req.user.id });
  res.json({ ok: true, message: 'Contraseña actualizada.' });
}));

router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
  await run(db, 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?', [req.sessionId]);
  await auditService.record({ req, action: 'auth.logout', entityType: 'session', entityId: req.sessionId });
  res.json({ ok: true });
}));

function expirationDate(value) {
  const match = /^(\d+)([smhd])$/.exec(String(value || '8h'));
  if (!match) return new Date(Date.now() + 8 * 60 * 60 * 1000);
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + Number(match[1]) * multipliers[match[2]]);
}

module.exports = router;
