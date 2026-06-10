const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../database/connection');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');

// All routes here require professor authentication
router.use(authMiddleware);
router.use(requireProfessor);

/**
 * GET /api/students
 * List all users with user_type = 'student'
 * Optional: ?search=term
 */
router.get('/', (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT id, name, username, email, user_type, student_code, group_name, is_active, must_change_password, created_at 
    FROM users 
    WHERE user_type = 'student'
  `;
  const params = [];

  if (search) {
    query += ` AND (
      name LIKE ? OR 
      username LIKE ? OR 
      email LIKE ? OR 
      student_code LIKE ? OR 
      group_name LIKE ?
    )`;
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  query += " ORDER BY name ASC";

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching students:', err);
      return res.status(500).json({ ok: false, error: 'Error al obtener alumnos.' });
    }
    res.json({ ok: true, students: rows });
  });
});

/**
 * GET /api/students/:id
 * Get details of a specific student
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const query = "SELECT id, name, username, email, user_type, student_code, group_name, is_active, must_change_password, created_at FROM users WHERE id = ? AND user_type = 'student'";
  
  db.get(query, [id], (err, student) => {
    if (err) return res.status(500).json({ ok: false, error: 'Error al obtener el alumno.' });
    if (!student) return res.status(404).json({ ok: false, error: 'Alumno no encontrado.' });
    res.json({ ok: true, student });
  });
});

/**
 * POST /api/students
 * Create a new student
 */
router.post('/', async (req, res) => {
  const { name, username, email, student_code, group_name, temporary_password } = req.body;

  if (!name || !username || !email) {
    return res.status(400).json({ ok: false, error: 'Nombre, usuario y correo son campos obligatorios.' });
  }

  // Generate a simple random password if none provided
  const passwordToHash = temporary_password || crypto.randomBytes(9).toString('base64url');
  
  try {
    const passwordHash = await bcrypt.hash(passwordToHash, 10);
    const query = `
      INSERT INTO users (
        name, username, email, password_hash, user_type, student_code, group_name, is_active, must_change_password
      ) VALUES (?, ?, ?, ?, 'student', ?, ?, 1, 1)
    `;

    db.run(query, [name, username, email, passwordHash, student_code, group_name], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ ok: false, error: 'El nombre de usuario o correo electrónico ya están registrados.' });
        }
        console.error('Error creating student:', err);
        return res.status(500).json({ ok: false, error: 'Error interno al crear el alumno.' });
      }

      res.status(201).json({
        ok: true,
        student: {
          id: this.lastID,
          name,
          username,
          email,
          student_code,
          group_name,
          user_type: 'student',
          is_active: 1,
          must_change_password: 1
        },
        // Only return the generated password if it was NOT provided in the body
        temporary_password: temporary_password ? undefined : passwordToHash
      });
    });
  } catch (error) {
    console.error('Hashing error:', error);
    res.status(500).json({ ok: false, error: 'Error al procesar la contraseña.' });
  }
});

/**
 * PUT /api/students/:id
 * Update student basic info
 */
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, username, email, student_code, group_name, is_active } = req.body;

  if (!name || !username || !email) {
    return res.status(400).json({ ok: false, error: 'Nombre, usuario y correo son campos obligatorios.' });
  }

  const query = `
    UPDATE users 
    SET name = ?, username = ?, email = ?, student_code = ?, group_name = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_type = 'student'
  `;

  db.run(query, [name, username, email, student_code, group_name, is_active, id], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ ok: false, error: 'El nombre de usuario o correo electrónico ya están en uso.' });
      }
      return res.status(500).json({ ok: false, error: 'Error al actualizar el alumno.' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ ok: false, error: 'Alumno no encontrado.' });
    }

    res.json({ ok: true, message: 'Alumno actualizado correctamente.' });
  });
});

/**
 * PATCH /api/students/:id/status
 * Enable or disable a student
 */
router.patch('/:id/status', (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (is_active === undefined) {
    return res.status(400).json({ ok: false, error: 'Estado is_active es requerido.' });
  }

  const query = "UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_type = 'student'";
  
  db.run(query, [is_active ? 1 : 0, id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: 'Error al cambiar el estado del alumno.' });
    if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Alumno no encontrado.' });
    res.json({ ok: true, message: `Alumno ${is_active ? 'activado' : 'desactivado'} correctamente.` });
  });
});

/**
 * POST /api/students/:id/reset-password
 * Reset student password to a new temporary one
 */
router.post('/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { temporary_password } = req.body;

  const newPassword = temporary_password || crypto.randomBytes(9).toString('base64url');

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const query = "UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_type = 'student'";

    db.run(query, [passwordHash, id], function(err) {
      if (err) return res.status(500).json({ ok: false, error: 'Error al resetear la contraseña.' });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Alumno no encontrado.' });
      
      res.json({ 
        ok: true, 
        message: 'Contraseña reseteada correctamente.',
        temporary_password: newPassword
      });
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al procesar la nueva contraseña.' });
  }
});

module.exports = router;
