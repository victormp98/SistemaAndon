const express = require('express');
const db = require('../database/connection');
const { get } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor, requireAdmin } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const backupService = require('../services/backupService');
const settingsService = require('../services/settingsService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, requireProfessor);

router.get('/', asyncHandler(async (req, res) => {
  res.json({ ok: true, settings: await settingsService.getAll() });
}));

router.put('/', requireAdmin, asyncHandler(async (req, res) => {
  const settings = await settingsService.update(req.body);
  await auditService.record({ req, action: 'settings.updated', entityType: 'settings', details: req.body });
  res.json({ ok: true, message: 'Configuración guardada.', settings });
}));

router.post('/backup', asyncHandler(async (req, res) => {
  const file = await backupService.createBackup();
  await auditService.record({ req, action: 'backup.created', entityType: 'backup', entityId: file });
  res.status(201).json({ ok: true, file });
}));

router.get('/backups', asyncHandler(async (req, res) => {
  res.json({ ok: true, backups: backupService.listBackups() });
}));

router.post('/backups/:name/restore', requireAdmin, asyncHandler(async (req, res) => {
  const active = await get(db, "SELECT COUNT(*) AS total FROM simulations WHERE status IN ('running', 'paused')");
  if (active.total) throw httpError(409, 'No se puede restaurar mientras exista una simulación activa o pausada.');
  const result = await backupService.scheduleRestore(req.params.name);
  await auditService.record({
    req,
    action: 'backup.restore_scheduled',
    entityType: 'backup',
    entityId: req.params.name,
    details: result
  });
  res.status(202).json({
    ok: true,
    ...result,
    message: 'Restauración preparada. Reinicia el servidor para aplicarla.'
  });
}));

module.exports = router;
