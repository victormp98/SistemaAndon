const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/appConfig');
const db = require('../database/connection');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ ok: false, error: 'Identificador y contraseña requeridos.' });
  }

  const query = "SELECT id, name, username, email, password_hash, user_type, is_active FROM users WHERE (username = ? OR email = ?)";
  
  db.get(query, [identifier, identifier], async (err, user) => {
    if (err) {
      console.error('Login database error:', err);
      return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
    }

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas.' });
    }

    if (!user.is_active) {
      return res.status(401).json({ ok: false, error: 'Usuario inactivo.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ ok: false, error: 'Credenciales inválidas.' });
    }

    // Create JWT
    const secret = config.auth?.jwtSecret || 'local-development-secret-change-me';
    const expiresIn = config.auth?.jwtExpiresIn || '8h';
    
    const token = jwt.sign(
      { id: user.id, username: user.username, type: user.user_type },
      secret,
      { expiresIn }
    );

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        user_type: user.user_type
      }
    });
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    ok: true,
    user: req.user
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // Simple logout for now
  res.json({ ok: true, message: 'Sesión cerrada correctamente.' });
});

module.exports = router;
