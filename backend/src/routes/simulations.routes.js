const express = require('express');
const db = require('../database/connection');
const { run, get, all, transaction } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const { canTransition } = require('../domain/simulationLifecycle');
const { isAdmin, assertLaboratory, assertSimulation } = require('../services/accessService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, requireProfessor);

router.get('/', asyncHandler(async (req, res) => {
  const scope = isAdmin(req.user) ? { sql: '1=1', params: [] } : { sql: 's.created_by_user_id = ?', params: [req.user.id] };
  const simulations = await all(
    db,
    `SELECT s.*, l.name AS laboratory_name,
       (SELECT COUNT(*) FROM simulation_participants WHERE simulation_id = s.id) AS participant_count,
       (SELECT COUNT(*) FROM production_orders WHERE simulation_id = s.id) AS order_count
     FROM simulations s
     JOIN laboratories l ON l.id = s.laboratory_id
     WHERE ${scope.sql}
     ORDER BY s.created_at DESC`
    , scope.params
  );
  res.json({ ok: true, simulations });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.id, { professorWrite: true });
  const simulation = await get(
    db,
    `SELECT s.*, l.name AS laboratory_name
     FROM simulations s JOIN laboratories l ON l.id = s.laboratory_id WHERE s.id = ?`,
    [req.params.id]
  );
  if (!simulation) throw httpError(404, 'Simulación no encontrada.');
  const participants = await all(
    db,
    `SELECT p.*, u.name AS user_name, u.username, pl.name AS line_name, st.name AS station_name
     FROM simulation_participants p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN production_lines pl ON pl.id = p.line_id
     LEFT JOIN stations st ON st.id = p.station_id
     WHERE p.simulation_id = ? ORDER BY u.name`,
    [simulation.id]
  );
  res.json({ ok: true, simulation, participants });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (!req.body.laboratory_id || !String(req.body.name || '').trim()) {
    throw httpError(400, 'Laboratorio y nombre son obligatorios.');
  }
  await assertLaboratory(req.user, req.body.laboratory_id);
  const lab = await get(db, 'SELECT id FROM laboratories WHERE id = ? AND is_active = 1', [req.body.laboratory_id]);
  if (!lab) throw httpError(400, 'Laboratorio inválido o inactivo.');
  const duration = Number(req.body.planned_duration_minutes || 60);
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
    throw httpError(400, 'La duración debe estar entre 1 y 1440 minutos.');
  }
  const result = await run(
    db,
    `INSERT INTO simulations
      (laboratory_id, name, description, planned_duration_minutes, created_by_user_id, status)
     VALUES (?, ?, ?, ?, ?, 'draft')`,
    [lab.id, String(req.body.name).trim(), req.body.description || null, duration, req.user.id]
  );
  await auditService.record({ req, action: 'simulation.created', entityType: 'simulation', entityId: result.lastID, simulationId: result.lastID });
  res.status(201).json({ ok: true, simulationId: result.lastID });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.id, { professorWrite: true });
  const simulation = await get(db, 'SELECT * FROM simulations WHERE id = ?', [req.params.id]);
  if (!simulation) throw httpError(404, 'Simulación no encontrada.');
  if (simulation.status !== 'draft') throw httpError(409, 'Solo se edita una simulación en borrador.');
  await run(
    db,
    `UPDATE simulations SET name = ?, description = ?, planned_duration_minutes = ?,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [
      String(req.body.name || simulation.name).trim(),
      req.body.description ?? simulation.description,
      Number(req.body.planned_duration_minutes || simulation.planned_duration_minutes),
      simulation.id
    ]
  );
  await auditService.record({ req, action: 'simulation.updated', entityType: 'simulation', entityId: simulation.id, simulationId: simulation.id });
  res.json({ ok: true, message: 'Simulación actualizada.' });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.id, { professorWrite: true });
  const target = req.body.status;
  const simulation = await get(db, 'SELECT * FROM simulations WHERE id = ?', [req.params.id]);
  if (!simulation) throw httpError(404, 'Simulación no encontrada.');
  if (!canTransition(simulation.status, target)) {
    throw httpError(409, `No se permite cambiar de ${simulation.status} a ${target}.`);
  }

  if (target === 'ready') await validateReady(simulation.id);
  if (target === 'running' && simulation.status === 'ready') await validateReady(simulation.id);
  if (target === 'completed') {
    const pending = await get(
      db,
      `SELECT COUNT(*) AS total FROM production_tickets t
       JOIN production_orders o ON o.id = t.order_id
       WHERE o.simulation_id = ? AND t.status != 'completed'`,
      [simulation.id]
    );
    if (pending.total > 0) throw httpError(409, 'Todavía existen tickets sin completar.');
  }

  await transaction(db, async () => {
    const timestamps = target === 'running'
      ? "starts_at = COALESCE(starts_at, CURRENT_TIMESTAMP), ends_at = NULL,"
      : ['completed', 'cancelled'].includes(target)
        ? 'ends_at = CURRENT_TIMESTAMP,'
        : '';
    await run(
      db,
      `UPDATE simulations SET status = ?, ${timestamps} updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [target, simulation.id]
    );

    if (target === 'running') {
      await run(
        db,
        `UPDATE production_orders SET status = 'released',
         released_at = COALESCE(released_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE simulation_id = ? AND status = 'draft'`,
        [simulation.id]
      );
      await run(
        db,
        `UPDATE production_tickets SET status = 'available', updated_at = CURRENT_TIMESTAMP
         WHERE order_id IN (SELECT id FROM production_orders WHERE simulation_id = ?)
           AND status = 'waiting'`,
        [simulation.id]
      );
    }
  });

  req.app.get('io')?.to(`simulation:${simulation.id}`).emit('simulation:status', {
    simulationId: simulation.id,
    status: target
  });
  await auditService.record({
    req,
    action: `simulation.${target}`,
    entityType: 'simulation',
    entityId: simulation.id,
    simulationId: simulation.id,
    details: { previous_status: simulation.status }
  });
  res.json({ ok: true, message: `Simulación actualizada a ${target}.` });
}));

router.post('/:id/participants', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.id, { professorWrite: true });
  const simulation = await get(db, 'SELECT * FROM simulations WHERE id = ?', [req.params.id]);
  if (!simulation) throw httpError(404, 'Simulación no encontrada.');
  if (simulation.status !== 'draft') throw httpError(409, 'Solo se asignan participantes en borrador.');

  const role = req.body.simulation_role;
  if (!['operator', 'supervisor', 'observer', 'manager'].includes(role)) {
    throw httpError(400, 'Rol inválido.');
  }
  const ownerFilter = isAdmin(req.user) ? '' : 'AND owner_user_id = ?';
  const userParams = isAdmin(req.user) ? [req.body.user_id] : [req.body.user_id, req.user.id];
  const user = await get(db, `SELECT id FROM users WHERE id = ? AND user_type = 'student' AND is_active = 1 ${ownerFilter}`, userParams);
  if (!user) throw httpError(400, 'Alumno inválido o inactivo.');

  let lineId = req.body.line_id || null;
  let stationId = req.body.station_id || null;
  if (role === 'operator') {
    const station = await get(
      db,
      `SELECT st.id, st.line_id
       FROM stations st JOIN production_lines pl ON pl.id = st.line_id
       WHERE st.id = ? AND st.is_active = 1 AND pl.laboratory_id = ?`,
      [stationId, simulation.laboratory_id]
    );
    if (!station) throw httpError(400, 'Estación inválida para el laboratorio.');
    lineId = station.line_id;
  } else if (role === 'supervisor') {
    const line = await get(
      db,
      'SELECT id FROM production_lines WHERE id = ? AND laboratory_id = ? AND is_active = 1',
      [lineId, simulation.laboratory_id]
    );
    if (!line) throw httpError(400, 'Línea inválida para el laboratorio.');
    stationId = null;
  } else {
    lineId = null;
    stationId = null;
  }

  await run(
    db,
    `INSERT INTO simulation_participants
      (simulation_id, user_id, simulation_role, line_id, station_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(simulation_id, user_id) DO UPDATE SET
       simulation_role = excluded.simulation_role,
       line_id = excluded.line_id,
       station_id = excluded.station_id,
       updated_at = CURRENT_TIMESTAMP`,
    [simulation.id, user.id, role, lineId, stationId]
  );
  await auditService.record({ req, action: 'simulation.participant_assigned', entityType: 'simulation', entityId: simulation.id, simulationId: simulation.id, details: { user_id: user.id, role } });
  res.status(201).json({ ok: true, message: 'Participante asignado.' });
}));

router.delete('/:id/participants/:participantId', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.id, { professorWrite: true });
  const simulation = await get(db, 'SELECT status FROM simulations WHERE id = ?', [req.params.id]);
  if (!simulation) throw httpError(404, 'Simulación no encontrada.');
  if (simulation.status !== 'draft') throw httpError(409, 'Solo se quitan participantes en borrador.');
  const result = await run(
    db,
    'DELETE FROM simulation_participants WHERE id = ? AND simulation_id = ?',
    [req.params.participantId, req.params.id]
  );
  if (!result.changes) throw httpError(404, 'Participante no encontrado.');
  res.json({ ok: true, message: 'Participante eliminado.' });
}));

async function validateReady(simulationId) {
  const operators = await get(
    db,
    `SELECT COUNT(*) AS total FROM simulation_participants
     WHERE simulation_id = ? AND simulation_role = 'operator' AND station_id IS NOT NULL`,
    [simulationId]
  );
  if (operators.total < 1) throw httpError(409, 'Asigna al menos un operador con estación.');

  const orders = await get(db, 'SELECT COUNT(*) AS total FROM production_orders WHERE simulation_id = ?', [simulationId]);
  if (orders.total < 1) throw httpError(409, 'Crea al menos una orden.');

  const withoutTickets = await get(
    db,
    `SELECT COUNT(*) AS total FROM production_orders o
     WHERE o.simulation_id = ?
       AND NOT EXISTS (SELECT 1 FROM production_tickets t WHERE t.order_id = o.id)`,
    [simulationId]
  );
  if (withoutTickets.total > 0) throw httpError(409, 'Todas las órdenes deben tener tickets.');
}

module.exports = router;
