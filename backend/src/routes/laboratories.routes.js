const express = require('express');
const db = require('../database/connection');
const { run, get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const { isAdmin, assertLaboratory } = require('../services/accessService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, requireProfessor);

router.get('/', asyncHandler(async (req, res) => {
  const filter = isAdmin(req.user) ? { sql: '1=1', params: [] } : { sql: 'l.created_by_user_id = ?', params: [req.user.id] };
  const laboratories = await all(
    db,
    `SELECT l.*, owner.name AS owner_name,
      (SELECT COUNT(*) FROM production_lines WHERE laboratory_id = l.id) AS line_count,
      (SELECT COUNT(*) FROM stations st JOIN production_lines pl ON st.line_id = pl.id WHERE pl.laboratory_id = l.id) AS station_count
     FROM laboratories l LEFT JOIN users owner ON owner.id = l.created_by_user_id
     WHERE ${filter.sql} ORDER BY l.name`,
    filter.params
  );
  res.json({ ok: true, laboratories });
}));

router.post('/', asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) throw httpError(400, 'Nombre de laboratorio requerido.');
  const result = await run(
    db,
    'INSERT INTO laboratories (name, description, created_by_user_id) VALUES (?, ?, ?)',
    [name, req.body.description || null, req.user.id]
  );
  await auditService.record({ req, action: 'laboratory.created', entityType: 'laboratory', entityId: result.lastID });
  res.status(201).json({ ok: true, laboratory: { id: result.lastID, name, description: req.body.description, is_active: 1 } });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const laboratory = await assertLaboratory(req.user, req.params.id);
  const name = String(req.body.name || '').trim();
  if (!name) throw httpError(400, 'Nombre de laboratorio requerido.');
  await run(
    db,
    `UPDATE laboratories SET name = ?, description = ?, is_active = ?,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, req.body.description || null, req.body.is_active ? 1 : 0, laboratory.id]
  );
  await auditService.record({ req, action: 'laboratory.updated', entityType: 'laboratory', entityId: laboratory.id });
  res.json({ ok: true, message: 'Laboratorio actualizado.' });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  const laboratory = await assertLaboratory(req.user, req.params.id);
  await run(db, 'UPDATE laboratories SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.body.is_active ? 1 : 0, laboratory.id]);
  await auditService.record({ req, action: 'laboratory.status_changed', entityType: 'laboratory', entityId: laboratory.id, details: { is_active: Boolean(req.body.is_active) } });
  res.json({ ok: true, message: 'Estado actualizado.' });
}));

router.get('/:labId/lines', asyncHandler(async (req, res) => {
  await assertLaboratory(req.user, req.params.labId);
  const lines = await all(db, 'SELECT * FROM production_lines WHERE laboratory_id = ? ORDER BY sequence_order, name', [req.params.labId]);
  res.json({ ok: true, lines });
}));

router.post('/:labId/lines', asyncHandler(async (req, res) => {
  await assertLaboratory(req.user, req.params.labId);
  const name = String(req.body.name || '').trim();
  if (!name) throw httpError(400, 'Nombre de línea requerido.');
  const result = await run(
    db,
    'INSERT INTO production_lines (laboratory_id, name, description, sequence_order) VALUES (?, ?, ?, ?)',
    [req.params.labId, name, req.body.description || null, Number(req.body.sequence_order) || 0]
  );
  await auditService.record({ req, action: 'line.created', entityType: 'production_line', entityId: result.lastID });
  res.status(201).json({ ok: true, line: { id: result.lastID, name, description: req.body.description, sequence_order: Number(req.body.sequence_order) || 0 } });
}));

async function ownedLine(req, id) {
  const line = await get(
    db,
    `SELECT pl.*, l.created_by_user_id FROM production_lines pl
     JOIN laboratories l ON l.id = pl.laboratory_id WHERE pl.id = ?`,
    [id]
  );
  if (!line) throw httpError(404, 'Línea no encontrada.');
  if (!isAdmin(req.user) && line.created_by_user_id !== req.user.id) throw httpError(403, 'No tienes acceso a esta línea.');
  return line;
}

router.put('/lines/:id', asyncHandler(async (req, res) => {
  const line = await ownedLine(req, req.params.id);
  await run(
    db,
    `UPDATE production_lines SET name = ?, description = ?, sequence_order = ?, is_active = ?,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [String(req.body.name || '').trim(), req.body.description || null, Number(req.body.sequence_order) || 0, req.body.is_active ? 1 : 0, line.id]
  );
  await auditService.record({ req, action: 'line.updated', entityType: 'production_line', entityId: line.id });
  res.json({ ok: true, message: 'Línea actualizada.' });
}));

router.patch('/lines/:id/status', asyncHandler(async (req, res) => {
  const line = await ownedLine(req, req.params.id);
  await run(db, 'UPDATE production_lines SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.body.is_active ? 1 : 0, line.id]);
  res.json({ ok: true, message: 'Estado de línea actualizado.' });
}));

router.get('/lines/:lineId/stations', asyncHandler(async (req, res) => {
  await ownedLine(req, req.params.lineId);
  const stations = await all(db, 'SELECT * FROM stations WHERE line_id = ? ORDER BY sequence_order, name', [req.params.lineId]);
  res.json({ ok: true, stations });
}));

router.post('/lines/:lineId/stations', asyncHandler(async (req, res) => {
  const line = await ownedLine(req, req.params.lineId);
  const name = String(req.body.name || '').trim();
  if (!name) throw httpError(400, 'Nombre de estación requerido.');
  const result = await run(
    db,
    `INSERT INTO stations
     (line_id, name, description, instructions, sequence_order, target_cycle_time_seconds, allows_defects, allows_downtime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [line.id, name, req.body.description || null, req.body.instructions || null, Number(req.body.sequence_order) || 0,
      Math.max(0, Number(req.body.target_cycle_time_seconds) || 0), req.body.allows_defects ? 1 : 0, req.body.allows_downtime ? 1 : 0]
  );
  await auditService.record({ req, action: 'station.created', entityType: 'station', entityId: result.lastID });
  res.status(201).json({ ok: true, station: { id: result.lastID, name } });
}));

async function ownedStation(req, id) {
  const station = await get(
    db,
    `SELECT st.*, l.created_by_user_id FROM stations st
     JOIN production_lines pl ON pl.id = st.line_id
     JOIN laboratories l ON l.id = pl.laboratory_id WHERE st.id = ?`,
    [id]
  );
  if (!station) throw httpError(404, 'Estación no encontrada.');
  if (!isAdmin(req.user) && station.created_by_user_id !== req.user.id) throw httpError(403, 'No tienes acceso a esta estación.');
  return station;
}

router.put('/stations/:id', asyncHandler(async (req, res) => {
  const station = await ownedStation(req, req.params.id);
  await run(
    db,
    `UPDATE stations SET name = ?, description = ?, instructions = ?, sequence_order = ?,
     target_cycle_time_seconds = ?, allows_defects = ?, allows_downtime = ?, is_active = ?,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [String(req.body.name || '').trim(), req.body.description || null, req.body.instructions || null,
      Number(req.body.sequence_order) || 0, Math.max(0, Number(req.body.target_cycle_time_seconds) || 0),
      req.body.allows_defects ? 1 : 0, req.body.allows_downtime ? 1 : 0, req.body.is_active ? 1 : 0, station.id]
  );
  await auditService.record({ req, action: 'station.updated', entityType: 'station', entityId: station.id });
  res.json({ ok: true, message: 'Estación actualizada.' });
}));

router.patch('/stations/:id/status', asyncHandler(async (req, res) => {
  const station = await ownedStation(req, req.params.id);
  await run(db, 'UPDATE stations SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.body.is_active ? 1 : 0, station.id]);
  res.json({ ok: true, message: 'Estado de estación actualizado.' });
}));

module.exports = router;
