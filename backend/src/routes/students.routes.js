const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database/connection');
const { run, get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const { isAdmin } = require('../services/accessService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, requireProfessor);

function ownerClause(req, alias = 'u') {
  return isAdmin(req.user) ? { sql: '1=1', params: [] } : { sql: `${alias}.owner_user_id = ?`, params: [req.user.id] };
}

async function assertStudent(req, id) {
  const scope = ownerClause(req);
  const student = await get(
    db,
    `SELECT id, name, username, email, user_type, student_code, group_name,
      owner_user_id, is_active, must_change_password, created_at
     FROM users u WHERE u.id = ? AND u.user_type = 'student' AND ${scope.sql}`,
    [id, ...scope.params]
  );
  if (!student) throw httpError(404, 'Alumno no encontrado.');
  return student;
}

router.get('/', asyncHandler(async (req, res) => {
  const scope = ownerClause(req);
  const params = [...scope.params];
  let search = '';
  if (req.query.search) {
    search = ` AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?
      OR u.student_code LIKE ? OR u.group_name LIKE ?)`;
    const term = `%${String(req.query.search).trim()}%`;
    params.push(term, term, term, term, term);
  }
  const students = await all(
    db,
    `SELECT u.id, u.name, u.username, u.email, u.user_type, u.student_code,
      u.group_name, u.owner_user_id, u.is_active, u.must_change_password, u.created_at,
      owner.name AS owner_name
     FROM users u LEFT JOIN users owner ON owner.id = u.owner_user_id
     WHERE u.user_type = 'student' AND ${scope.sql}${search}
     ORDER BY u.name`,
    params
  );
  res.json({ ok: true, students });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ ok: true, student: await assertStudent(req, req.params.id) });
}));

router.post('/', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim();
  if (!name || !username || !email) throw httpError(400, 'Nombre, usuario y correo son obligatorios.');
  const password = String(req.body.temporary_password || crypto.randomBytes(9).toString('base64url'));
  if (password.length < 8) throw httpError(400, 'La contraseña temporal debe tener al menos 8 caracteres.');
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const result = await run(
      db,
      `INSERT INTO users
       (name, username, email, password_hash, user_type, student_code, group_name,
        owner_user_id, is_active, must_change_password)
       VALUES (?, ?, ?, ?, 'student', ?, ?, ?, 1, 1)`,
      [name, username, email, passwordHash, req.body.student_code || null, req.body.group_name || null, req.user.id]
    );
    await auditService.record({ req, action: 'student.created', entityType: 'user', entityId: result.lastID });
    res.status(201).json({
      ok: true,
      student: { id: result.lastID, name, username, email, user_type: 'student', owner_user_id: req.user.id, is_active: 1, must_change_password: 1 },
      temporary_password: req.body.temporary_password ? undefined : password
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) throw httpError(409, 'El usuario o correo ya existe.');
    throw error;
  }
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const student = await assertStudent(req, req.params.id);
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim();
  const email = String(req.body.email || '').trim();
  if (!name || !username || !email) throw httpError(400, 'Nombre, usuario y correo son obligatorios.');
  try {
    await run(
      db,
      `UPDATE users SET name = ?, username = ?, email = ?, student_code = ?,
       group_name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [name, username, email, req.body.student_code || null, req.body.group_name || null, req.body.is_active ? 1 : 0, student.id]
    );
  } catch (error) {
    if (error.message.includes('UNIQUE')) throw httpError(409, 'El usuario o correo ya está en uso.');
    throw error;
  }
  await auditService.record({ req, action: 'student.updated', entityType: 'user', entityId: student.id });
  res.json({ ok: true, message: 'Alumno actualizado.' });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const student = await assertStudent(req, req.params.id);
  await run(
    db,
    'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [req.body.is_active ? 1 : 0, student.id]
  );
  await auditService.record({
    req,
    action: req.body.is_active ? 'student.activated' : 'student.deactivated',
    entityType: 'user',
    entityId: student.id
  });
  res.json({ ok: true, message: 'Estado actualizado.' });
}));

router.post('/:id/reset-password', asyncHandler(async (req, res) => {
  const student = await assertStudent(req, req.params.id);
  const password = String(req.body.temporary_password || crypto.randomBytes(9).toString('base64url'));
  if (password.length < 8) throw httpError(400, 'La contraseña temporal debe tener al menos 8 caracteres.');
  await run(
    db,
    `UPDATE users SET password_hash = ?, must_change_password = 1,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [await bcrypt.hash(password, 12), student.id]
  );
  await run(db, 'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?', [student.id]);
  await auditService.record({ req, action: 'student.password_reset', entityType: 'user', entityId: student.id });
  res.json({ ok: true, message: 'Contraseña restablecida.', temporary_password: password });
}));

module.exports = router;
