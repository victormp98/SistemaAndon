const express = require('express');
const db = require('../database/connection');
const { run, get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const { assertSimulation } = require('../services/accessService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware);

router.get('/', asyncHandler(async (req, res) => {
  if (!req.query.simulation_id && req.user.user_type === 'student') {
    throw httpError(400, 'Selecciona una simulación.');
  }
  if (req.query.simulation_id) {
    await assertSimulation(req.user, req.query.simulation_id, { studentRoles: ['operator', 'supervisor', 'observer', 'manager'] });
  }
  const filters = [];
  const params = [];
  if (req.query.simulation_id) { filters.push('i.simulation_id = ?'); params.push(req.query.simulation_id); }
  if (req.user.user_type === 'professor' && !req.user.is_admin) {
    filters.push('s.created_by_user_id = ?'); params.push(req.user.id);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const incidents = await all(
    db,
    `SELECT i.*, s.name AS simulation_name, st.name AS station_name, u.name AS reported_by_name
     FROM incidents i JOIN simulations s ON s.id = i.simulation_id
     LEFT JOIN stations st ON st.id = i.station_id LEFT JOIN users u ON u.id = i.reported_by_user_id
     ${where} ORDER BY i.created_at DESC`,
    params
  );
  const downtimeWhere = where.replaceAll('i.', 'd.');
  const downtimes = await all(
    db,
    `SELECT d.*, s.name AS simulation_name, st.name AS station_name, u.name AS reported_by_name
     FROM downtime_events d JOIN simulations s ON s.id = d.simulation_id
     LEFT JOIN stations st ON st.id = d.station_id LEFT JOIN users u ON u.id = d.reported_by_user_id
     ${downtimeWhere} ORDER BY d.created_at DESC`,
    params
  );
  res.json({ ok: true, incidents, downtimes });
}));

router.post('/', asyncHandler(async (req, res) => {
  const description = String(req.body.description || '').trim();
  if (!req.body.simulation_id || description.length < 3 || description.length > 1000) {
    throw httpError(400, 'Simulación y descripción de 3 a 1000 caracteres son obligatorias.');
  }
  const access = await assertSimulation(req.user, req.body.simulation_id, { studentRoles: ['operator', 'supervisor'] });
  if (!['running', 'paused'].includes(access.simulation.status)) throw httpError(409, 'La simulación no está activa.');
  const type = ['defect', 'quality', 'safety', 'material', 'other'].includes(req.body.type) ? req.body.type : 'other';
  const severity = ['low', 'medium', 'high', 'critical'].includes(req.body.severity) ? req.body.severity : 'medium';
  const result = await run(
    db,
    `INSERT INTO incidents
     (simulation_id, line_id, station_id, ticket_id, reported_by_user_id, type, severity, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [access.simulation.id, req.body.line_id || null, req.body.station_id || null, req.body.ticket_id || null, req.user.id, type, severity, description]
  );
  await auditService.record({ req, action: 'incident.created', entityType: 'incident', entityId: result.lastID, simulationId: access.simulation.id, details: { type, severity } });
  req.app.get('io')?.to(`simulation:${access.simulation.id}`).emit('incident:created', { id: result.lastID });
  res.status(201).json({ ok: true, incidentId: result.lastID });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  if (!['open', 'in_progress', 'resolved'].includes(req.body.status)) throw httpError(400, 'Estado inválido.');
  const incident = await get(db, 'SELECT * FROM incidents WHERE id = ?', [req.params.id]);
  if (!incident) throw httpError(404, 'Incidente no encontrado.');
  await assertSimulation(req.user, incident.simulation_id, { studentRoles: ['supervisor'] });
  const responseStarted = req.body.status === 'in_progress' ? 'COALESCE(response_started_at, CURRENT_TIMESTAMP)' : 'response_started_at';
  const resolved = req.body.status === 'resolved' ? 'CURRENT_TIMESTAMP' : 'NULL';
  await run(
    db,
    `UPDATE incidents SET status = ?, assigned_to_user_id = COALESCE(assigned_to_user_id, ?),
     response_started_at = ${responseStarted}, resolved_at = ${resolved}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [req.body.status, req.user.id, incident.id]
  );
  await auditService.record({ req, action: `incident.${req.body.status}`, entityType: 'incident', entityId: incident.id, simulationId: incident.simulation_id });
  res.json({ ok: true });
}));

router.post('/downtime', asyncHandler(async (req, res) => {
  const reason = String(req.body.reason || '').trim();
  if (!req.body.simulation_id || !req.body.station_id || reason.length < 3 || reason.length > 500) {
    throw httpError(400, 'Simulación, estación y motivo de 3 a 500 caracteres son obligatorios.');
  }
  const access = await assertSimulation(req.user, req.body.simulation_id, { studentRoles: ['operator', 'supervisor'] });
  if (!['running', 'paused'].includes(access.simulation.status)) throw httpError(409, 'La simulación no está activa.');
  if (access.participant?.simulation_role === 'operator' && access.participant.station_id !== Number(req.body.station_id)) {
    throw httpError(403, 'Sólo puedes reportar un paro en tu estación.');
  }
  const existing = await get(db, "SELECT id FROM downtime_events WHERE simulation_id = ? AND station_id = ? AND status = 'open'", [access.simulation.id, req.body.station_id]);
  if (existing) throw httpError(409, 'La estación ya tiene un paro abierto.');
  const result = await run(
    db,
    `INSERT INTO downtime_events
     (simulation_id, station_id, ticket_id, reported_by_user_id, reason, status)
     VALUES (?, ?, ?, ?, ?, 'open')`,
    [access.simulation.id, req.body.station_id, req.body.ticket_id || null, req.user.id, reason]
  );
  await auditService.record({ req, action: 'downtime.created', entityType: 'downtime', entityId: result.lastID, simulationId: access.simulation.id });
  req.app.get('io')?.to(`simulation:${access.simulation.id}`).emit('downtime:created', { id: result.lastID });
  res.status(201).json({ ok: true, downtimeId: result.lastID });
}));

router.patch('/downtime/:id/close', asyncHandler(async (req, res) => {
  const downtime = await get(db, 'SELECT * FROM downtime_events WHERE id = ? AND status = ?', [req.params.id, 'open']);
  if (!downtime) throw httpError(404, 'Paro abierto no encontrado.');
  const access = await assertSimulation(req.user, downtime.simulation_id, { studentRoles: ['operator', 'supervisor'] });
  if (access.participant?.simulation_role === 'operator' && access.participant.station_id !== downtime.station_id) {
    throw httpError(403, 'Sólo puedes cerrar el paro de tu estación.');
  }
  await run(db, `UPDATE downtime_events SET status = 'closed', ended_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [downtime.id]);
  await auditService.record({ req, action: 'downtime.closed', entityType: 'downtime', entityId: downtime.id, simulationId: downtime.simulation_id });
  res.json({ ok: true });
}));

module.exports = router;
