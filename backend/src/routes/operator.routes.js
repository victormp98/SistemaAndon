const express = require('express');
const db = require('../database/connection');
const { get } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const { requireStudent } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const productionService = require('../services/productionService');

const router = express.Router();
router.use(authMiddleware, requireStudent);

router.get('/context', asyncHandler(async (req, res) => {
  const assignment = await productionService.getOperatorContext(req.user.id, false);
  res.json({ ok: true, assignment: assignment || null });
}));

router.get('/tickets', asyncHandler(async (req, res) => {
  const tickets = await productionService.availableTickets(req.user.id);
  res.json({ ok: true, tickets });
}));

router.get('/current-ticket', asyncHandler(async (req, res) => {
  const ticket = await get(
    db,
    `SELECT t.id, t.code, o.code AS order_code, o.product_name, t.priority, t.status,
            t.current_station_id, st.name AS station_name, t.started_at
     FROM production_tickets t
     JOIN production_orders o ON o.id = t.order_id
     JOIN stations st ON st.id = t.current_station_id
     WHERE t.current_operator_id = ? AND t.status = 'in_progress' LIMIT 1`,
    [req.user.id]
  );
  res.json({ ok: true, ticket: ticket || null });
}));

router.post('/tickets/:ticketId/start', asyncHandler(async (req, res) => {
  const ticket = await productionService.startTicket(Number(req.params.ticketId), req.user.id);
  req.app.get('io')?.to(`simulation:${ticket.simulation_id}`).emit('ticket:updated', ticket);
  res.json({ ok: true, ticket });
}));

router.post('/current-ticket/complete', asyncHandler(async (req, res) => {
  const result = await productionService.completeTicket(req.user.id, req.body.notes);
  req.app.get('io')?.emit('ticket:updated', result);
  res.json({ ok: true, ...result });
}));

module.exports = router;
