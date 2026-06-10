const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database/connection');
const { run, get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, requireAdmin);

router.get('/', asyncHandler(async (req, res) => {
  const professors = await all(
    db,
    `SELECT id, name, username, email, user_type, is_admin, is_active,
      must_change_password, created_at, updated_at
     FROM users WHERE user_type = 'professor' ORDER BY is_admin DESC, name`
  );
  res.json({ ok: true, professors });
}));

router.post('/', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim();
  const password = String(req.body.temporary_password || crypto.randomBytes(9).toString('base64url'));
  if (!name || !username || !email) throw httpError(400, 'Nombre, usuario y correo son obligatorios.');
  if (password.length < 8) throw httpError(400, 'La contraseña temporal debe tener al menos 8 caracteres.');
  try {
    const result = await run(
      db,
      `INSERT INTO users
       (name, username, email, password_hash, user_type, is_admin, is_active, must_change_password)
       VALUES (?, ?, ?, ?, 'professor', ?, 1, 1)`,
      [name, username, email, await bcrypt.hash(password, 12), req.body.is_admin ? 1 : 0]
    );
    await auditService.record({ req, action: 'professor.created', entityType: 'user', entityId: result.lastID, details: { is_admin: Boolean(req.body.is_admin) } });
    res.status(201).json({ ok: true, professorId: result.lastID, temporary_password: req.body.temporary_password ? undefined : password });
  } catch (error) {
    if (error.message.includes('UNIQUE')) throw httpError(409, 'El usuario o correo ya existe.');
    throw error;
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const professor = await get(db, "SELECT * FROM users WHERE id = ? AND user_type = 'professor'", [req.params.id]);
  if (!professor) throw httpError(404, 'Profesor no encontrado.');
  if (professor.id === req.user.id && req.body.is_admin === false) throw httpError(409, 'No puedes retirar tus propios permisos administrativos.');
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim();
  if (!name || !username || !email) throw httpError(400, 'Nombre, usuario y correo son obligatorios.');
  await run(
    db,
    `UPDATE users SET name = ?, username = ?, email = ?, is_admin = ?,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, username, email, req.body.is_admin ? 1 : 0, professor.id]
  );
  await auditService.record({ req, action: 'professor.updated', entityType: 'user', entityId: professor.id });
  res.json({ ok: true, message: 'Profesor actualizado.' });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const professor = await get(db, "SELECT * FROM users WHERE id = ? AND user_type = 'professor'", [req.params.id]);
  if (!professor) throw httpError(404, 'Profesor no encontrado.');
  const active = req.body.is_active ? 1 : 0;
  if (!active && professor.id === req.user.id) throw httpError(409, 'No puedes desactivar tu propia cuenta.');
  if (!active && professor.is_admin) {
    const remaining = await get(db, "SELECT COUNT(*) AS total FROM users WHERE user_type = 'professor' AND is_admin = 1 AND is_active = 1 AND id != ?", [professor.id]);
    if (!remaining.total) throw httpError(409, 'El sistema debe conservar al menos un administrador activo.');
  }
  await run(db, 'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [active, professor.id]);
  if (!active) await run(db, 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?', [professor.id]);
  await auditService.record({ req, action: active ? 'professor.activated' : 'professor.deactivated', entityType: 'user', entityId: professor.id });
  res.json({ ok: true, message: 'Estado actualizado.' });
}));

router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  const professor = await get(db, "SELECT id FROM users WHERE id = ? AND user_type = 'professor'", [req.params.id]);
  if (!professor) throw httpError(404, 'Profesor no encontrado.');
  const password = String(req.body.temporary_password || crypto.randomBytes(9).toString('base64url'));
  if (password.length < 8) throw httpError(400, 'La contraseña temporal debe tener al menos 8 caracteres.');
  await run(
    db,
    'UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [await bcrypt.hash(password, 12), professor.id]
  );
  await run(db, 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?', [professor.id]);
  await auditService.record({ req, action: 'professor.password_reset', entityType: 'user', entityId: professor.id });
  res.json({ ok: true, temporary_password: password });
}));

module.exports = router;
