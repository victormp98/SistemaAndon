const express = require('express');
const db = require('../database/connection');
const { get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();
router.use(authMiddleware);

router.get('/dashboard', asyncHandler(async (req, res) => {
  const summary = await get(
    db,
    `SELECT
      (SELECT COUNT(*) FROM laboratories WHERE is_active = 1) AS active_laboratories,
      (SELECT COUNT(*) FROM users WHERE user_type = 'student' AND is_active = 1) AS active_students,
      (SELECT COUNT(*) FROM simulations WHERE status = 'running') AS running_simulations,
      (SELECT COUNT(*) FROM production_tickets WHERE status = 'in_progress') AS tickets_in_progress,
      (SELECT COUNT(*) FROM incidents WHERE status != 'resolved') AS open_incidents,
      (SELECT COUNT(*) FROM downtime_events WHERE status = 'open') AS active_downtimes`
  );
  const recentSimulations = await all(
    db,
    `SELECT s.id, s.name, s.status, l.name AS laboratory_name, s.starts_at, s.ends_at
     FROM simulations s JOIN laboratories l ON l.id = s.laboratory_id
     ORDER BY s.created_at DESC LIMIT 8`
  );
  res.json({ ok: true, summary, recent_simulations: recentSimulations });
}));

router.get('/andon', asyncHandler(async (req, res) => {
  const simulations = await all(
    db,
    `SELECT s.id, s.name, s.status, l.name AS laboratory_name
     FROM simulations s JOIN laboratories l ON l.id = s.laboratory_id
     WHERE s.status IN ('ready', 'running', 'paused')
     ORDER BY s.starts_at DESC`
  );
  const stations = await all(
    db,
    `SELECT s.id AS simulation_id, st.id AS station_id, st.name AS station_name,
       pl.name AS line_name,
       SUM(CASE WHEN t.status IN ('waiting', 'available') THEN 1 ELSE 0 END) AS queued,
       SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
       EXISTS(SELECT 1 FROM downtime_events d
         WHERE d.simulation_id = s.id AND d.station_id = st.id AND d.status = 'open') AS is_down,
       EXISTS(SELECT 1 FROM incidents i
         WHERE i.simulation_id = s.id AND i.station_id = st.id AND i.status != 'resolved') AS has_incident
     FROM simulations s
     JOIN production_orders o ON o.simulation_id = s.id
     JOIN production_lines pl ON pl.id = o.line_id
     JOIN stations st ON st.line_id = pl.id
     LEFT JOIN production_tickets t ON t.order_id = o.id AND t.current_station_id = st.id
     WHERE s.status IN ('ready', 'running', 'paused')
     GROUP BY s.id, st.id, st.name, pl.name
     ORDER BY s.id, pl.name, st.sequence_order, st.id`
  );
  res.json({ ok: true, simulations, stations });
}));

router.get('/reports', asyncHandler(async (req, res) => {
  const simulationId = req.query.simulation_id || null;
  const params = simulationId ? [simulationId] : [];
  const filter = simulationId ? 'WHERE s.id = ?' : '';
  const rows = await all(
    db,
    `SELECT s.id, s.name, s.status, s.starts_at, s.ends_at,
       COUNT(DISTINCT o.id) AS orders,
       COUNT(t.id) AS tickets,
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
       ROUND(AVG(CASE WHEN t.completed_at IS NOT NULL
         THEN (julianday(t.completed_at) - julianday(t.started_at)) * 86400 END), 1) AS avg_cycle_seconds,
       (SELECT COUNT(*) FROM incidents i WHERE i.simulation_id = s.id) AS incidents,
       (SELECT COUNT(*) FROM downtime_events d WHERE d.simulation_id = s.id) AS downtimes
     FROM simulations s
     LEFT JOIN production_orders o ON o.simulation_id = s.id
     LEFT JOIN production_tickets t ON t.order_id = o.id
     ${filter}
     GROUP BY s.id ORDER BY s.created_at DESC`,
    params
  );
  res.json({ ok: true, reports: rows });
}));

module.exports = router;
