const express = require('express');
const db = require('../database/connection');
const { run, get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const productionService = require('../services/productionService');
const settingsService = require('../services/settingsService');
const { isAdmin, assertOrder, assertSimulation } = require('../services/accessService');

const router = express.Router();
router.use(authMiddleware, requireProfessor);

router.get('/', asyncHandler(async (req, res) => {
  const params = [];
  const filters = [];
  if (req.query.simulation_id) {
    filters.push('o.simulation_id = ?');
    params.push(req.query.simulation_id);
  }
  if (!isAdmin(req.user)) {
    filters.push('s.created_by_user_id = ?');
    params.push(req.user.id);
  }
  const orders = await all(
    db,
    `SELECT o.*, s.name AS simulation_name, pl.name AS line_name,
       (SELECT COUNT(*) FROM production_tickets WHERE order_id = o.id) AS ticket_count,
       (SELECT COUNT(*) FROM production_tickets WHERE order_id = o.id AND status = 'completed') AS completed_count
     FROM production_orders o
     JOIN simulations s ON s.id = o.simulation_id
     JOIN production_lines pl ON pl.id = o.line_id
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY o.created_at DESC`,
    params
  );
  res.json({ ok: true, orders });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  await assertOrder(req.user, req.params.id);
  const order = await get(
    db,
    `SELECT o.*, s.name AS simulation_name, pl.name AS line_name
     FROM production_orders o
     JOIN simulations s ON s.id = o.simulation_id
     JOIN production_lines pl ON pl.id = o.line_id
     WHERE o.id = ?`,
    [req.params.id]
  );
  if (!order) throw httpError(404, 'Orden no encontrada.');
  const tickets = await all(
    db,
    `SELECT t.*, st.name AS station_name
     FROM production_tickets t
     LEFT JOIN stations st ON st.id = t.current_station_id
     WHERE t.order_id = ? ORDER BY t.code`,
    [order.id]
  );
  res.json({ ok: true, order, tickets });
}));

router.post('/', asyncHandler(async (req, res) => {
  if (!req.body.simulation_id || !req.body.line_id || !String(req.body.product_name || '').trim()) {
    throw httpError(400, 'Simulación, línea y producto son obligatorios.');
  }
  await assertSimulation(req.user, req.body.simulation_id, { professorWrite: true });
  const order = await productionService.createOrder(req.body, req.user.id);
  res.status(201).json({ ok: true, order });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const order = await assertOrder(req.user, req.params.id);
  if (order.status !== 'draft') throw httpError(400, 'Solo se editan órdenes en borrador.');

  const tickets = await get(db, 'SELECT COUNT(*) AS total FROM production_tickets WHERE order_id = ?', [order.id]);
  const quantity = Number(req.body.target_quantity || order.target_quantity);
  const maxTickets = await settingsService.getValue('max_ticket_quantity');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > maxTickets) {
    throw httpError(400, `La cantidad debe estar entre 1 y ${maxTickets}.`);
  }
  if (tickets.total > 0 && quantity !== order.target_quantity) {
    throw httpError(409, 'No puedes cambiar la cantidad después de generar tickets.');
  }

  const priority = ['low', 'medium', 'high', 'urgent'].includes(req.body.priority)
    ? req.body.priority
    : order.priority;
  await run(
    db,
    `UPDATE production_orders SET product_name = ?, target_quantity = ?, priority = ?,
     updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [String(req.body.product_name || order.product_name).trim(), quantity, priority, order.id]
  );
  res.json({ ok: true, message: 'Orden actualizada.' });
}));

router.patch('/:id/status', asyncHandler(async (req, res) => {
  await assertOrder(req.user, req.params.id);
  if (!['draft', 'cancelled'].includes(req.body.status)) throw httpError(400, 'Estado no permitido.');
  const result = await run(
    db,
    `UPDATE production_orders SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status != 'completed'`,
    [req.body.status, req.params.id]
  );
  if (!result.changes) throw httpError(404, 'Orden no encontrada o finalizada.');
  res.json({ ok: true, message: 'Estado actualizado.' });
}));

router.post('/:id/generate-tickets', asyncHandler(async (req, res) => {
  await assertOrder(req.user, req.params.id);
  const count = await productionService.generateTickets(Number(req.params.id), req.user.id);
  res.status(201).json({ ok: true, message: `${count} tickets generados.`, ticket_count: count });
}));

module.exports = router;
