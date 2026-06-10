const express = require('express');
const db = require('../database/connection');
const { run, get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireStudent } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const { assertSimulation } = require('../services/accessService');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, requireStudent);

router.get('/assignments', asyncHandler(async (req, res) => {
  const assignments = await all(
    db,
    `SELECT sp.*, s.name AS simulation_name, s.status, l.name AS laboratory_name,
      pl.name AS line_name, st.name AS station_name
     FROM simulation_participants sp JOIN simulations s ON s.id = sp.simulation_id
     JOIN laboratories l ON l.id = s.laboratory_id
     LEFT JOIN production_lines pl ON pl.id = sp.line_id
     LEFT JOIN stations st ON st.id = sp.station_id
     WHERE sp.user_id = ? ORDER BY s.created_at DESC`,
    [req.user.id]
  );
  res.json({ ok: true, assignments });
}));

router.patch('/simulations/:id/complete', asyncHandler(async (req, res) => {
  const { simulation } = await assertSimulation(req.user, req.params.id, { studentRoles: ['manager'] });
  if (!['running', 'paused'].includes(simulation.status)) throw httpError(409, 'La simulación no puede completarse desde su estado actual.');
  const pending = await get(
    db,
    `SELECT COUNT(*) AS total FROM production_tickets t JOIN production_orders o ON o.id = t.order_id
     WHERE o.simulation_id = ? AND t.status != 'completed'`,
    [simulation.id]
  );
  if (pending.total) throw httpError(409, 'Todavía existen tickets pendientes.');
  await run(db, `UPDATE simulations SET status = 'completed', ends_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [simulation.id]);
  await auditService.record({ req, action: 'simulation.completed_by_manager', entityType: 'simulation', entityId: simulation.id, simulationId: simulation.id });
  res.json({ ok: true, message: 'Simulación completada.' });
}));

router.patch('/orders/:id/priority', asyncHandler(async (req, res) => {
  const priority = req.body.priority;
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) throw httpError(400, 'Prioridad inválida.');
  const order = await get(db, 'SELECT * FROM production_orders WHERE id = ?', [req.params.id]);
  if (!order) throw httpError(404, 'Orden no encontrada.');
  await assertSimulation(req.user, order.simulation_id, { studentRoles: ['supervisor'] });
  await run(db, 'UPDATE production_orders SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [priority, order.id]);
  await run(db, "UPDATE production_tickets SET priority = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ? AND status IN ('waiting', 'available')", [priority, order.id]);
  await auditService.record({ req, action: 'order.priority_changed', entityType: 'order', entityId: order.id, simulationId: order.simulation_id, details: { priority } });
  res.json({ ok: true });
}));

module.exports = router;
