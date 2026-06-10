const express = require('express');
const db = require('../database/connection');
const { run, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const backupService = require('../services/backupService');

const router = express.Router();
router.use(authMiddleware, requireProfessor);

router.get('/', asyncHandler(async (req, res) => {
  const settings = await all(db, 'SELECT key, value, updated_at FROM app_settings ORDER BY key');
  res.json({ ok: true, settings });
}));

router.put('/', asyncHandler(async (req, res) => {
  const allowed = ['organization_name', 'andon_refresh_seconds', 'max_ticket_quantity'];
  for (const [key, value] of Object.entries(req.body || {})) {
    if (!allowed.includes(key)) continue;
    await run(
      db,
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, String(value)]
    );
  }
  res.json({ ok: true, message: 'Configuración guardada.' });
}));

router.post('/backup', asyncHandler(async (req, res) => {
  const file = await backupService.createBackup();
  res.status(201).json({ ok: true, file });
}));

router.get('/backups', asyncHandler(async (req, res) => {
  res.json({ ok: true, backups: backupService.listBackups() });
}));

module.exports = router;
