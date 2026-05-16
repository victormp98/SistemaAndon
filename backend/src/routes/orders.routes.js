const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireProfessor);

// Helper: generate order code
function generateOrderCode(db, callback) {
  db.get("SELECT COUNT(*) as count FROM production_orders", [], (err, row) => {
    if (err) return callback(err);
    const code = `OP-${String(row.count + 1).padStart(4, '0')}`;
    callback(null, code);
  });
}

// Helper: log production event
function logEvent(db, payload) {
  const { simulation_id, order_id, ticket_id, event_type, payload_json, user_id } = payload;
  db.run(
    "INSERT INTO production_events (simulation_id, order_id, ticket_id, user_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, ?)",
    [simulation_id, order_id || null, ticket_id || null, user_id || null, event_type, payload_json ? JSON.stringify(payload_json) : null],
    () => {} // fire and forget
  );
}

/**
 * GET /api/orders?simulation_id=1
 */
router.get('/', (req, res) => {
  const { simulation_id } = req.query;
  let query = `
    SELECT o.*, s.name as simulation_name, pl.name as line_name,
      (SELECT COUNT(*) FROM production_tickets WHERE order_id = o.id) as ticket_count
    FROM production_orders o
    JOIN simulations s ON o.simulation_id = s.id
    JOIN production_lines pl ON o.line_id = pl.id
  `;
  const params = [];
  if (simulation_id) {
    query += " WHERE o.simulation_id = ?";
    params.push(simulation_id);
  }
  query += " ORDER BY o.created_at DESC";
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, orders: rows });
  });
});

/**
 * GET /api/orders/:id — Detail with tickets
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT o.*, s.name as simulation_name, pl.name as line_name 
     FROM production_orders o 
     JOIN simulations s ON o.simulation_id = s.id 
     JOIN production_lines pl ON o.line_id = pl.id 
     WHERE o.id = ?`,
    [id],
    (err, order) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      if (!order) return res.status(404).json({ ok: false, error: 'Orden no encontrada.' });

      db.all(
        `SELECT t.*, st.name as station_name 
         FROM production_tickets t 
         LEFT JOIN stations st ON t.current_station_id = st.id 
         WHERE t.order_id = ? 
         ORDER BY t.code ASC`,
        [id],
        (err, tickets) => {
          if (err) return res.status(500).json({ ok: false, error: err.message });
          res.json({ ok: true, order, tickets });
        }
      );
    }
  );
});

/**
 * POST /api/orders — Create order in draft
 */
router.post('/', (req, res) => {
  const { simulation_id, line_id, product_name, target_quantity, priority } = req.body;

  if (!simulation_id || !line_id || !product_name || !target_quantity) {
    return res.status(400).json({ ok: false, error: 'Faltan campos obligatorios: simulation_id, line_id, product_name, target_quantity.' });
  }
  if (!Number.isInteger(+target_quantity) || +target_quantity <= 0) {
    return res.status(400).json({ ok: false, error: 'target_quantity debe ser un entero positivo.' });
  }
  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  const finalPriority = validPriorities.includes(priority) ? priority : 'medium';

  // Validate simulation exists and is draft
  db.get("SELECT * FROM simulations WHERE id = ?", [simulation_id], (err, sim) => {
    if (err || !sim) return res.status(404).json({ ok: false, error: 'Simulación no encontrada.' });
    if (sim.status !== 'draft') return res.status(400).json({ ok: false, error: 'La simulación debe estar en estado borrador.' });

    // Validate line belongs to the simulation's laboratory
    db.get("SELECT * FROM production_lines WHERE id = ? AND laboratory_id = ?", [line_id, sim.laboratory_id], (err, line) => {
      if (err || !line) return res.status(400).json({ ok: false, error: 'La línea no pertenece al laboratorio de la simulación.' });

      // Validate line has at least one active station
      db.get("SELECT id FROM stations WHERE line_id = ? AND is_active = 1 LIMIT 1", [line_id], (err, station) => {
        if (err || !station) return res.status(400).json({ ok: false, error: 'La línea no tiene estaciones activas.' });

        generateOrderCode(db, (err, code) => {
          if (err) return res.status(500).json({ ok: false, error: err.message });

          db.run(
            `INSERT INTO production_orders (simulation_id, line_id, code, product_name, target_quantity, priority, status, created_by_user_id) 
             VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
            [simulation_id, line_id, code, product_name, target_quantity, finalPriority, req.user.id],
            function(err) {
              if (err) return res.status(500).json({ ok: false, error: err.message });
              const orderId = this.lastID;
              logEvent(db, {
                simulation_id, order_id: orderId, event_type: 'order_created',
                payload_json: { code, product_name, target_quantity },
                user_id: req.user.id
              });
              res.status(201).json({ ok: true, order: { id: orderId, code, product_name, status: 'draft' } });
            }
          );
        });
      });
    });
  });
});

/**
 * PUT /api/orders/:id — Update (only if draft and no tickets)
 */
router.put('/:id', (req, res) => {
  const { product_name, target_quantity, priority } = req.body;
  const { id } = req.params;

  db.get("SELECT * FROM production_orders WHERE id = ?", [id], (err, order) => {
    if (err || !order) return res.status(404).json({ ok: false, error: 'Orden no encontrada.' });
    if (order.status !== 'draft') return res.status(400).json({ ok: false, error: 'Solo se pueden editar órdenes en borrador.' });

    // If changing quantity, check no tickets exist
    if (target_quantity && target_quantity !== order.target_quantity) {
      db.get("SELECT COUNT(*) as cnt FROM production_tickets WHERE order_id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        if (row.cnt > 0) return res.status(400).json({ ok: false, error: 'No se puede cambiar la cantidad si ya hay tickets generados.' });
        doUpdate();
      });
    } else {
      doUpdate();
    }

    function doUpdate() {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      const finalPriority = validPriorities.includes(priority) ? priority : order.priority;
      db.run(
        "UPDATE production_orders SET product_name = ?, target_quantity = ?, priority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [product_name || order.product_name, target_quantity || order.target_quantity, finalPriority, id],
        function(err) {
          if (err) return res.status(500).json({ ok: false, error: err.message });
          res.json({ ok: true, message: 'Orden actualizada.' });
        }
      );
    }
  });
});

/**
 * PATCH /api/orders/:id/status
 */
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['draft', 'cancelled'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Estado no permitido en esta etapa.' });
  }
  db.run(
    "UPDATE production_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, message: `Orden ${status === 'cancelled' ? 'cancelada' : 'actualizada'}.` });
    }
  );
});

/**
 * POST /api/orders/:id/generate-tickets
 */
router.post('/:id/generate-tickets', (req, res) => {
  const { id } = req.params;

  db.get(
    `SELECT o.*, s.status as sim_status 
     FROM production_orders o 
     JOIN simulations s ON o.simulation_id = s.id 
     WHERE o.id = ?`,
    [id],
    (err, order) => {
      if (err || !order) return res.status(404).json({ ok: false, error: 'Orden no encontrada.' });
      if (order.status !== 'draft') return res.status(400).json({ ok: false, error: 'La orden debe estar en borrador.' });
      if (order.sim_status !== 'draft') return res.status(400).json({ ok: false, error: 'La simulación debe estar en borrador.' });

      // Check no tickets exist yet
      db.get("SELECT COUNT(*) as cnt FROM production_tickets WHERE order_id = ?", [id], (err, row) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        if (row.cnt > 0) return res.status(400).json({ ok: false, error: `Esta orden ya tiene ${row.cnt} tickets generados.` });

        // Get first active station by sequence_order
        db.get(
          "SELECT id FROM stations WHERE line_id = ? AND is_active = 1 ORDER BY sequence_order ASC, id ASC LIMIT 1",
          [order.line_id],
          (err, firstStation) => {
            if (err || !firstStation) return res.status(400).json({ ok: false, error: 'No se encontró una estación activa en la línea.' });

            // Generate tickets in a serialized fashion
            const qty = order.target_quantity;
            let inserted = 0;
            let hasError = false;

            for (let i = 1; i <= qty; i++) {
              const ticketCode = `${order.code}-T${String(i).padStart(3, '0')}`;
              db.run(
                `INSERT INTO production_tickets (order_id, code, current_station_id, status, priority) 
                 VALUES (?, ?, ?, 'available', ?)`,
                [id, ticketCode, firstStation.id, order.priority],
                function(err) {
                  if (err && !hasError) {
                    hasError = true;
                    return res.status(500).json({ ok: false, error: `Error al crear ticket: ${err.message}` });
                  }
                  inserted++;
                  if (inserted === qty && !hasError) {
                    logEvent(db, {
                      simulation_id: order.simulation_id,
                      order_id: order.id,
                      event_type: 'tickets_generated',
                      payload_json: { quantity: qty, first_station_id: firstStation.id },
                      user_id: req.user.id
                    });
                    res.status(201).json({ ok: true, message: `${qty} tickets generados exitosamente.`, ticket_count: qty });
                  }
                }
              );
            }
          }
        );
      });
    }
  );
});

module.exports = router;
