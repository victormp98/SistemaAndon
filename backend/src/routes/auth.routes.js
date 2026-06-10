const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/appConfig');
const db = require('../database/connection');
const { run, get } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');

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
    `SELECT id, name, username, email, password_hash, user_type, is_active, must_change_password
     FROM users WHERE username = ? OR email = ?`,
    [identifier, identifier]
  );
  if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
    throw httpError(401, 'Credenciales inválidas.');
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, type: user.user_type },
    config.auth.jwtSecret,
    { expiresIn: config.auth.jwtExpiresIn }
  );
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
  res.json({ ok: true, message: 'Contraseña actualizada.' });
}));

router.post('/logout', (req, res) => res.json({ ok: true }));

module.exports = router;
