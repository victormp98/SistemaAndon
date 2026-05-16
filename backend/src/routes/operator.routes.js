const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authMiddleware = require('../middleware/authMiddleware');
const { requireStudent } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireStudent);

// GET /api/operator/context
// Devuelve el contexto operativo del alumno autenticado.
router.get('/context', (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT 
      sp.simulation_id, s.name as simulation_name, s.status as simulation_status,
      sp.simulation_role as role,
      sp.line_id, l.name as line_name,
      sp.station_id, st.name as station_name, st.instructions as station_instructions, st.target_cycle_time_seconds
    FROM simulation_participants sp
    JOIN simulations s ON sp.simulation_id = s.id
    LEFT JOIN production_lines l ON sp.line_id = l.id
    LEFT JOIN stations st ON sp.station_id = st.id
    WHERE sp.user_id = ? AND sp.simulation_role = 'operator' AND sp.station_id IS NOT NULL
    AND s.status IN ('draft', 'running')
    LIMIT 1
  `;

  db.get(query, [userId], (err, row) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    
    if (!row) {
      return res.json({
        ok: true,
        assignment: null,
        message: "No tienes una estación asignada en una simulación activa o preparada."
      });
    }

    res.json({ ok: true, assignment: row });
  });
});

// GET /api/operator/tickets
// Lista tickets disponibles para la estación del operador.
router.get('/tickets', (req, res) => {
  const userId = req.user.id;

  // Primero obtener el contexto para saber el station_id y simulation_id
  const contextQuery = `
    SELECT station_id, simulation_id 
    FROM simulation_participants 
    WHERE user_id = ? AND simulation_role = 'operator' AND station_id IS NOT NULL 
    LIMIT 1
  `;

  db.get(contextQuery, [userId], (err, context) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!context) return res.status(403).json({ ok: false, error: 'No tienes estación asignada.' });

    const ticketsQuery = `
      SELECT t.id, t.code, o.code as order_code, o.product_name, t.priority, t.status, 
             t.current_station_id, st.name as station_name, t.created_at
      FROM production_tickets t
      JOIN production_orders o ON t.order_id = o.id
      JOIN stations st ON t.current_station_id = st.id
      WHERE t.current_station_id = ? AND t.status = 'available' AND o.simulation_id = ?
      ORDER BY t.priority DESC, t.created_at ASC
    `;

    db.all(ticketsQuery, [context.station_id, context.simulation_id], (err, tickets) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, tickets });
    });
  });
});

// GET /api/operator/current-ticket
// Devuelve el ticket en proceso del operador autenticado
router.get('/current-ticket', (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT t.id, t.code, o.code as order_code, o.product_name, t.priority, t.status, 
           t.current_station_id, st.name as station_name, t.started_at
    FROM production_tickets t
    JOIN production_orders o ON t.order_id = o.id
    JOIN stations st ON t.current_station_id = st.id
    WHERE t.current_operator_id = ? AND t.status = 'in_progress'
    LIMIT 1
  `;

  db.get(query, [userId], (err, ticket) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, ticket: ticket || null });
  });
});

// POST /api/operator/tickets/:ticketId/start
// Permite tomar/iniciar un ticket.
router.post('/tickets/:ticketId/start', (req, res) => {
  const userId = req.user.id;
  const { ticketId } = req.params;

  // 1. Obtener contexto del operador
  const contextQuery = `
    SELECT station_id, simulation_id 
    FROM simulation_participants 
    WHERE user_id = ? AND simulation_role = 'operator' AND station_id IS NOT NULL 
    LIMIT 1
  `;

  db.get(contextQuery, [userId], (err, context) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!context) return res.status(403).json({ ok: false, error: 'No tienes estación asignada como operador.' });

    // 2. Verificar que no tenga ya un ticket en proceso
    db.get("SELECT id FROM production_tickets WHERE current_operator_id = ? AND status = 'in_progress'", [userId], (err, currentTicket) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      if (currentTicket) return res.status(400).json({ ok: false, error: 'Ya tienes un ticket en proceso.' });

      // 3. Verificar el ticket que quiere tomar
      const ticketQuery = `
        SELECT t.id, t.code, t.status, t.current_station_id, o.simulation_id, o.id as order_id
        FROM production_tickets t
        JOIN production_orders o ON t.order_id = o.id
        WHERE t.id = ?
      `;

      db.get(ticketQuery, [ticketId], (err, ticket) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket no encontrado.' });
        if (ticket.status !== 'available') return res.status(400).json({ ok: false, error: 'El ticket no está disponible.' });
        if (ticket.current_station_id !== context.station_id) return res.status(403).json({ ok: false, error: 'El ticket no está en tu estación.' });
        if (ticket.simulation_id !== context.simulation_id) return res.status(403).json({ ok: false, error: 'El ticket no pertenece a tu simulación.' });

        // 4. Actualizar ticket y registrar logs
        const startedAt = new Date().toISOString().replace('T', ' ').slice(0, 19); // SQLite datetime format
        
        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          // Update ticket
          db.run(
            "UPDATE production_tickets SET status = 'in_progress', current_operator_id = ?, started_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [userId, startedAt, ticketId],
            function(err) {
              if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ ok: false, error: err.message });
              }
            }
          );

          // Create ticket_station_logs
          db.run(
            "INSERT INTO ticket_station_logs (ticket_id, station_id, operator_user_id, started_at, status) VALUES (?, ?, ?, ?, 'in_progress')",
            [ticketId, context.station_id, userId, startedAt],
            function(err) {
              if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ ok: false, error: err.message });
              }
            }
          );

          // Create production_events
          const payloadJson = JSON.stringify({ ticket_code: ticket.code, status: 'in_progress' });
          db.run(
            "INSERT INTO production_events (simulation_id, order_id, ticket_id, station_id, user_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, 'ticket_started', ?)",
            [context.simulation_id, ticket.order_id, ticketId, context.station_id, userId, payloadJson],
            function(err) {
              if (err) {
                db.run("ROLLBACK");
                return res.status(500).json({ ok: false, error: err.message });
              }

              db.run("COMMIT", (err) => {
                if (err) return res.status(500).json({ ok: false, error: err.message });
                
                // Emit socket event
                const io = req.app.get('io');
                if (io) {
                  io.emit('ticket:updated', { ticketId, status: 'in_progress', stationId: context.station_id });
                }

                res.json({
                  ok: true,
                  ticket: {
                    id: ticketId,
                    code: ticket.code,
                    status: 'in_progress',
                    current_operator_id: userId
                  }
                });
              });
            }
          );
        });
      });
    });
  });
});

// POST /api/operator/current-ticket/complete
// Permite terminar el ticket en progreso y moverlo a la siguiente estación o completarlo.
router.post('/current-ticket/complete', (req, res) => {
  const userId = req.user.id;
  const notes = req.body.notes || null;

  // 1. Obtener contexto del operador
  const contextQuery = `
    SELECT sp.station_id, st.line_id, sp.simulation_id 
    FROM simulation_participants sp
    JOIN stations st ON sp.station_id = st.id
    WHERE sp.user_id = ? AND sp.simulation_role = 'operator' AND sp.station_id IS NOT NULL 
    LIMIT 1
  `;

  db.get(contextQuery, [userId], (err, context) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!context) return res.status(403).json({ ok: false, error: 'No tienes asignación operativa.' });

    // 2. Verificar que exista un ticket en proceso para este operador
    const ticketQuery = `
      SELECT t.id, t.code, t.status, t.current_station_id, o.simulation_id, o.id as order_id
      FROM production_tickets t
      JOIN production_orders o ON t.order_id = o.id
      WHERE t.current_operator_id = ? AND t.status = 'in_progress'
    `;

    db.get(ticketQuery, [userId], (err, ticket) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      if (!ticket) return res.status(400).json({ ok: false, error: 'No tienes ningún ticket en proceso.' });
      if (ticket.current_station_id !== context.station_id) return res.status(403).json({ ok: false, error: 'El ticket no está en tu estación.' });
      if (ticket.simulation_id !== context.simulation_id) return res.status(403).json({ ok: false, error: 'El ticket no pertenece a tu simulación.' });

      // 3. Buscar la siguiente estación en la línea
      const nextStationQuery = `
        SELECT id, name FROM stations 
        WHERE line_id = ? AND is_active = 1 
          AND sequence_order > (SELECT sequence_order FROM stations WHERE id = ?)
        ORDER BY sequence_order ASC, id ASC
        LIMIT 1
      `;

      db.get(nextStationQuery, [context.line_id, context.station_id], (err, nextStation) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });

        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          // Cerrar el log de la estación actual
          db.run(
            `UPDATE ticket_station_logs 
             SET finished_at = ?, status = 'completed', notes = ?, updated_at = CURRENT_TIMESTAMP 
             WHERE ticket_id = ? AND station_id = ? AND operator_user_id = ? AND finished_at IS NULL`,
            [now, notes, ticket.id, context.station_id, userId],
            function(err) {
              if (err) { db.run("ROLLBACK"); return res.status(500).json({ ok: false, error: err.message }); }
            }
          );

          // Evento de fin de estación
          db.run(
            "INSERT INTO production_events (simulation_id, order_id, ticket_id, station_id, user_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, 'ticket_finished_station', ?)",
            [context.simulation_id, ticket.order_id, ticket.id, context.station_id, userId, JSON.stringify({ from_station_id: context.station_id, operator_user_id: userId, finished_at: now })],
            function(err) {
              if (err) { db.run("ROLLBACK"); return res.status(500).json({ ok: false, error: err.message }); }
            }
          );

          if (nextStation) {
            // Mover a la siguiente estación
            db.run(
              "UPDATE production_tickets SET status = 'available', current_station_id = ?, current_operator_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [nextStation.id, ticket.id],
              function(err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ ok: false, error: err.message }); }
              }
            );

            db.run(
              "INSERT INTO production_events (simulation_id, order_id, ticket_id, station_id, user_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, 'ticket_moved', ?)",
              [context.simulation_id, ticket.order_id, ticket.id, context.station_id, userId, JSON.stringify({ from_station_id: context.station_id, to_station_id: nextStation.id })],
              function(err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ ok: false, error: err.message }); }

                db.run("COMMIT", (err) => {
                  if (err) return res.status(500).json({ ok: false, error: err.message });
                  emitSocketEvents('available', nextStation.id, 'moved_to_next_station');
                  res.json({
                    ok: true,
                    result: "moved_to_next_station",
                    ticket: { id: ticket.id, code: ticket.code, status: "available", current_station_id: nextStation.id, current_operator_id: null },
                    next_station: nextStation
                  });
                });
              }
            );
          } else {
            // Última estación: Completar ticket
            db.run(
              "UPDATE production_tickets SET status = 'completed', current_operator_id = NULL, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [now, ticket.id],
              function(err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ ok: false, error: err.message }); }
              }
            );

            db.run(
              "INSERT INTO production_events (simulation_id, order_id, ticket_id, station_id, user_id, event_type, payload_json) VALUES (?, ?, ?, ?, ?, 'ticket_completed', ?)",
              [context.simulation_id, ticket.order_id, ticket.id, context.station_id, userId, JSON.stringify({ final_station_id: context.station_id, completed_at: now })],
              function(err) {
                if (err) { db.run("ROLLBACK"); return res.status(500).json({ ok: false, error: err.message }); }

                db.run("COMMIT", (err) => {
                  if (err) return res.status(500).json({ ok: false, error: err.message });
                  emitSocketEvents('completed', null, 'completed');
                  res.json({
                    ok: true,
                    result: "completed",
                    ticket: { id: ticket.id, code: ticket.code, status: "completed", completed_at: now }
                  });
                });
              }
            );
          }

          function emitSocketEvents(newStatus, toStationId, resultType) {
            const io = req.app.get('io');
            if (io) {
              io.emit('ticket:updated', { ticketId: ticket.id, status: newStatus, fromStationId: context.station_id, toStationId });
              io.emit('operator:ticket_completed', { ticketId: ticket.id, operatorId: userId, result: resultType });
              if (toStationId) {
                io.emit('station:queue_updated', { stationId: toStationId });
              }
            }
          }
        });
      });
    });
  });
});

module.exports = router;
