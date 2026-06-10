const express = require('express');
const db = require('../database/connection');
const { run, get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');

const router = express.Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => {
  const simulationId = req.query.simulation_id;
  const params = simulationId ? [simulationId] : [];
  const filter = simulationId ? 'WHERE i.simulation_id = ?' : '';
  const incidents = await all(
    db,
    `SELECT i.*, s.name AS simulation_name, st.name AS station_name,
       u.name AS reported_by_name
     FROM incidents i
     JOIN simulations s ON s.id = i.simulation_id
     LEFT JOIN stations st ON st.id = i.station_id
     LEFT JOIN users u ON u.id = i.reported_by_user_id
     ${filter} ORDER BY i.created_at DESC`,
    params
  );
  const downtimes = await all(
    db,
    `SELECT d.*, s.name AS simulation_name, st.name AS station_name
     FROM downtime_events d
     JOIN simulations s ON s.id = d.simulation_id
     LEFT JOIN stations st ON st.id = d.station_id
     ${simulationId ? 'WHERE d.simulation_id = ?' : ''}
     ORDER BY d.created_at DESC`,
    params
  );
  res.json({ ok: true, incidents, downtimes });
}));

router.post('/', asyncHandler(async (req, res) => {
  const description = String(req.body.description || '').trim();
  if (!req.body.simulation_id || description.length < 3) {
    throw httpError(400, 'Simulación y descripción son obligatorias.');
  }
  const simulation = await get(db, "SELECT id FROM simulations WHERE id = ? AND status IN ('running', 'paused')", [req.body.simulation_id]);
  if (!simulation) throw httpError(409, 'La simulación no está activa.');
  const result = await run(
    db,
    `INSERT INTO incidents
      (simulation_id, line_id, station_id, ticket_id, reported_by_user_id, type, severity, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      simulation.id, req.body.line_id || null, req.body.station_id || null,
      req.body.ticket_id || null, req.user.id,
      ['defect', 'quality', 'safety', 'material', 'other'].includes(req.body.type) ? req.body.type : 'other',
      ['low', 'medium', 'high', 'critical'].includes(req.body.severity) ? req.body.severity : 'medium',
      description
    ]
  );
  req.app.get('io')?.to(`simulation:${simulation.id}`).emit('incident:created', { id: result.lastID });
  res.status(201).json({ ok: true, incidentId: result.lastID });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  if (!['open', 'in_progress', 'resolved'].includes(req.body.status)) throw httpError(400, 'Estado inválido.');
  const resolved = req.body.status === 'resolved' ? 'CURRENT_TIMESTAMP' : 'NULL';
  const result = await run(
    db,
    `UPDATE incidents SET status = ?, resolved_at = ${resolved}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [req.body.status, req.params.id]
  );
  if (!result.changes) throw httpError(404, 'Incidente no encontrado.');
  res.json({ ok: true });
}));

router.post('/downtime', asyncHandler(async (req, res) => {
  if (!req.body.simulation_id || !req.body.station_id || !String(req.body.reason || '').trim()) {
    throw httpError(400, 'Simulación, estación y motivo son obligatorios.');
  }
  const existing = await get(
    db,
    "SELECT id FROM downtime_events WHERE simulation_id = ? AND station_id = ? AND status = 'open'",
    [req.body.simulation_id, req.body.station_id]
  );
  if (existing) throw httpError(409, 'La estación ya tiene un paro abierto.');
  const result = await run(
    db,
    `INSERT INTO downtime_events
      (simulation_id, station_id, ticket_id, reported_by_user_id, reason, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
    [req.body.simulation_id, req.body.station_id, req.body.ticket_id || null, req.user.id, req.body.reason.trim()]
  );
  req.app.get('io')?.to(`simulation:${req.body.simulation_id}`).emit('downtime:created', { id: result.lastID });
  res.status(201).json({ ok: true, downtimeId: result.lastID });
}));

router.patch('/downtime/:id/close', asyncHandler(async (req, res) => {
  const result = await run(
    db,
    `UPDATE downtime_events SET status = 'closed', ended_at = CURRENT_TIMESTAMP,
     updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'open'`,
    [req.params.id]
  );
  if (!result.changes) throw httpError(404, 'Paro abierto no encontrado.');
  res.json({ ok: true });
}));

module.exports = router;
