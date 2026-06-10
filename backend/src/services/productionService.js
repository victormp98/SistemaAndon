const db = require('../database/connection');
const { run, get, all, transaction } = require('../database/dbUtils');
const httpError = require('../utils/httpError');

const MAX_TICKETS_PER_ORDER = 500;

async function nextOrderCode() {
  return transaction(db, async () => {
    const row = await get(db, 'SELECT next_value FROM order_sequences WHERE id = 1');
    const value = row?.next_value || 1;
    await run(db, 'UPDATE order_sequences SET next_value = ? WHERE id = 1', [value + 1]);
    return `OP-${String(value).padStart(4, '0')}`;
  });
}

async function createOrder(payload, userId) {
  const quantity = Number(payload.target_quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_ORDER) {
    throw httpError(400, `La cantidad debe ser un entero entre 1 y ${MAX_TICKETS_PER_ORDER}.`);
  }

  const simulation = await get(db, 'SELECT * FROM simulations WHERE id = ?', [payload.simulation_id]);
  if (!simulation) throw httpError(404, 'Simulación no encontrada.');
  if (!['draft', 'ready'].includes(simulation.status)) {
    throw httpError(400, 'La simulación debe estar en borrador o preparada.');
  }

  const line = await get(
    db,
    'SELECT id FROM production_lines WHERE id = ? AND laboratory_id = ? AND is_active = 1',
    [payload.line_id, simulation.laboratory_id]
  );
  if (!line) throw httpError(400, 'La línea no pertenece al laboratorio o está inactiva.');

  const station = await get(db, 'SELECT id FROM stations WHERE line_id = ? AND is_active = 1 LIMIT 1', [line.id]);
  if (!station) throw httpError(400, 'La línea no tiene estaciones activas.');

  const priority = ['low', 'medium', 'high', 'urgent'].includes(payload.priority)
    ? payload.priority
    : 'medium';
  const code = await nextOrderCode();

  const result = await run(
    db,
    `INSERT INTO production_orders
      (simulation_id, line_id, code, product_name, target_quantity, priority, status, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
    [simulation.id, line.id, code, String(payload.product_name).trim(), quantity, priority, userId]
  );

  await logEvent({
    simulationId: simulation.id,
    orderId: result.lastID,
    userId,
    type: 'order_created',
    payload: { code, quantity }
  });

  return { id: result.lastID, code, product_name: payload.product_name, status: 'draft' };
}

async function generateTickets(orderId, userId) {
  return transaction(db, async () => {
    const order = await get(
      db,
      `SELECT o.*, s.status AS simulation_status
       FROM production_orders o
       JOIN simulations s ON s.id = o.simulation_id
       WHERE o.id = ?`,
      [orderId]
    );
    if (!order) throw httpError(404, 'Orden no encontrada.');
    if (!['draft', 'ready'].includes(order.simulation_status)) {
      throw httpError(400, 'La simulación ya no admite generar tickets.');
    }
    if (order.target_quantity > MAX_TICKETS_PER_ORDER) {
      throw httpError(400, `La orden excede el límite de ${MAX_TICKETS_PER_ORDER} tickets.`);
    }

    const existing = await get(db, 'SELECT COUNT(*) AS total FROM production_tickets WHERE order_id = ?', [order.id]);
    if (existing.total > 0) throw httpError(409, 'La orden ya tiene tickets generados.');

    const firstStation = await get(
      db,
      `SELECT id FROM stations
       WHERE line_id = ? AND is_active = 1
       ORDER BY sequence_order ASC, id ASC LIMIT 1`,
      [order.line_id]
    );
    if (!firstStation) throw httpError(400, 'La línea no tiene estaciones activas.');

    for (let index = 1; index <= order.target_quantity; index += 1) {
      const code = `${order.code}-T${String(index).padStart(3, '0')}`;
      await run(
        db,
        `INSERT INTO production_tickets
          (order_id, code, current_station_id, status, priority)
         VALUES (?, ?, ?, 'waiting', ?)`,
        [order.id, code, firstStation.id, order.priority]
      );
    }

    await logEvent({
      simulationId: order.simulation_id,
      orderId: order.id,
      userId,
      type: 'tickets_generated',
      payload: { quantity: order.target_quantity, first_station_id: firstStation.id }
    });

    return order.target_quantity;
  });
}

async function getOperatorContext(userId, runningOnly = true) {
  const statuses = runningOnly ? "('running')" : "('ready', 'running', 'paused')";
  return get(
    db,
    `SELECT sp.simulation_id, s.name AS simulation_name, s.status AS simulation_status,
            sp.simulation_role AS role, sp.line_id, l.name AS line_name,
            sp.station_id, st.name AS station_name, st.instructions AS station_instructions,
            st.target_cycle_time_seconds
     FROM simulation_participants sp
     JOIN simulations s ON s.id = sp.simulation_id
     LEFT JOIN production_lines l ON l.id = sp.line_id
     LEFT JOIN stations st ON st.id = sp.station_id
     WHERE sp.user_id = ? AND sp.simulation_role = 'operator'
       AND sp.station_id IS NOT NULL AND s.status IN ${statuses}
     ORDER BY s.starts_at DESC, s.id DESC LIMIT 1`,
    [userId]
  );
}

async function startTicket(ticketId, userId) {
  return transaction(db, async () => {
    const context = await getOperatorContext(userId, true);
    if (!context) throw httpError(403, 'No tienes una estación en una simulación activa.');

    const current = await get(
      db,
      "SELECT id FROM production_tickets WHERE current_operator_id = ? AND status = 'in_progress'",
      [userId]
    );
    if (current) throw httpError(409, 'Ya tienes un ticket en proceso.');

    const ticket = await get(
      db,
      `SELECT t.id, t.code, t.current_station_id, o.id AS order_id, o.simulation_id
       FROM production_tickets t
       JOIN production_orders o ON o.id = t.order_id
       WHERE t.id = ?`,
      [ticketId]
    );
    if (!ticket) throw httpError(404, 'Ticket no encontrado.');
    if (ticket.current_station_id !== context.station_id || ticket.simulation_id !== context.simulation_id) {
      throw httpError(403, 'El ticket no pertenece a tu estación activa.');
    }

    const now = new Date().toISOString();
    const claimed = await run(
      db,
      `UPDATE production_tickets
       SET status = 'in_progress', current_operator_id = ?, started_at = COALESCE(started_at, ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('waiting', 'available') AND current_operator_id IS NULL`,
      [userId, now, ticket.id]
    );
    if (claimed.changes !== 1) throw httpError(409, 'El ticket ya fue tomado por otro operador.');

    await run(
      db,
      `INSERT INTO ticket_station_logs
        (ticket_id, station_id, operator_user_id, started_at, status)
       VALUES (?, ?, ?, ?, 'in_progress')`,
      [ticket.id, context.station_id, userId, now]
    );
    await logEvent({
      simulationId: context.simulation_id,
      orderId: ticket.order_id,
      ticketId: ticket.id,
      stationId: context.station_id,
      userId,
      type: 'ticket_started',
      payload: { ticket_code: ticket.code }
    });

    return { ...ticket, status: 'in_progress', current_operator_id: userId };
  });
}

async function completeTicket(userId, notes) {
  return transaction(db, async () => {
    const context = await getOperatorContext(userId, true);
    if (!context) throw httpError(403, 'No tienes una estación en una simulación activa.');

    const ticket = await get(
      db,
      `SELECT t.*, o.simulation_id, o.line_id
       FROM production_tickets t
       JOIN production_orders o ON o.id = t.order_id
       WHERE t.current_operator_id = ? AND t.status = 'in_progress'`,
      [userId]
    );
    if (!ticket) throw httpError(400, 'No tienes un ticket en proceso.');
    if (ticket.current_station_id !== context.station_id || ticket.simulation_id !== context.simulation_id) {
      throw httpError(403, 'El ticket no pertenece a tu estación activa.');
    }

    const nextStation = await get(
      db,
      `SELECT id, name FROM stations
       WHERE line_id = ? AND is_active = 1
         AND (sequence_order > (SELECT sequence_order FROM stations WHERE id = ?)
           OR (sequence_order = (SELECT sequence_order FROM stations WHERE id = ?) AND id > ?))
       ORDER BY sequence_order ASC, id ASC LIMIT 1`,
      [ticket.line_id, context.station_id, context.station_id, context.station_id]
    );
    const now = new Date().toISOString();

    await run(
      db,
      `UPDATE ticket_station_logs
       SET finished_at = ?, status = 'completed', notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT id FROM ticket_station_logs
         WHERE ticket_id = ? AND operator_user_id = ? AND finished_at IS NULL
         ORDER BY id DESC LIMIT 1
       )`,
      [now, notes || null, ticket.id, userId]
    );

    if (nextStation) {
      await run(
        db,
        `UPDATE production_tickets
         SET status = 'waiting', current_station_id = ?, current_operator_id = NULL,
             updated_at = CURRENT_TIMESTAMP WHERE id = ? AND current_operator_id = ?`,
        [nextStation.id, ticket.id, userId]
      );
      await logEvent({
        simulationId: context.simulation_id,
        orderId: ticket.order_id,
        ticketId: ticket.id,
        stationId: context.station_id,
        userId,
        type: 'ticket_moved',
        payload: { to_station_id: nextStation.id }
      });
      return { result: 'moved_to_next_station', ticketId: ticket.id, nextStation };
    }

    await run(
      db,
      `UPDATE production_tickets
       SET status = 'completed', current_operator_id = NULL, completed_at = ?,
           updated_at = CURRENT_TIMESTAMP WHERE id = ? AND current_operator_id = ?`,
      [now, ticket.id, userId]
    );
    await logEvent({
      simulationId: context.simulation_id,
      orderId: ticket.order_id,
      ticketId: ticket.id,
      stationId: context.station_id,
      userId,
      type: 'ticket_completed',
      payload: { completed_at: now }
    });
    await updateOrderAndSimulationStatus(ticket.order_id, context.simulation_id);
    return { result: 'completed', ticketId: ticket.id };
  });
}

async function updateOrderAndSimulationStatus(orderId, simulationId) {
  const remainingOrder = await get(
    db,
    "SELECT COUNT(*) AS total FROM production_tickets WHERE order_id = ? AND status != 'completed'",
    [orderId]
  );
  if (remainingOrder.total === 0) {
    await run(
      db,
      "UPDATE production_orders SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [orderId]
    );
  }

  const remainingSimulation = await get(
    db,
    `SELECT COUNT(*) AS total
     FROM production_tickets t
     JOIN production_orders o ON o.id = t.order_id
     WHERE o.simulation_id = ? AND t.status != 'completed'`,
    [simulationId]
  );
  if (remainingSimulation.total === 0) {
    await run(
      db,
      `UPDATE simulations
       SET status = 'completed', ends_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'running'`,
      [simulationId]
    );
  }
}

async function availableTickets(userId) {
  const context = await getOperatorContext(userId, true);
  if (!context) throw httpError(403, 'No tienes una estación en una simulación activa.');
  return all(
    db,
    `SELECT t.id, t.code, o.code AS order_code, o.product_name, t.priority, t.status,
            t.current_station_id, st.name AS station_name, t.created_at
     FROM production_tickets t
     JOIN production_orders o ON o.id = t.order_id
     JOIN stations st ON st.id = t.current_station_id
     WHERE t.current_station_id = ? AND t.status IN ('waiting', 'available')
       AND o.simulation_id = ?
     ORDER BY CASE t.priority
       WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       t.created_at ASC`,
    [context.station_id, context.simulation_id]
  );
}

async function logEvent({ simulationId, orderId, ticketId, stationId, userId, type, payload }) {
  await run(
    db,
    `INSERT INTO production_events
      (simulation_id, order_id, ticket_id, station_id, user_id, event_type, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      simulationId || null,
      orderId || null,
      ticketId || null,
      stationId || null,
      userId || null,
      type,
      payload ? JSON.stringify(payload) : null
    ]
  );
}

module.exports = {
  MAX_TICKETS_PER_ORDER,
  createOrder,
  generateTickets,
  getOperatorContext,
  startTicket,
  completeTicket,
  availableTickets
};
