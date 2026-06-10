const express = require('express');
const db = require('../database/connection');
const { get, all } = require('../database/dbUtils');
const authMiddleware = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const httpError = require('../utils/httpError');
const { isAdmin, assertSimulation } = require('../services/accessService');
const settingsService = require('../services/settingsService');
const reportService = require('../services/reportService');

const router = express.Router();
router.use(authMiddleware);

function simulationScope(req, alias = 's', roles = []) {
  if (req.user.user_type === 'professor') {
    return isAdmin(req.user)
      ? { sql: '1=1', params: [] }
      : { sql: `${alias}.created_by_user_id = ?`, params: [req.user.id] };
  }
  const roleSql = roles.length ? ` AND sp.simulation_role IN (${roles.map(() => '?').join(',')})` : '';
  return {
    sql: `EXISTS (SELECT 1 FROM simulation_participants sp
      WHERE sp.simulation_id = ${alias}.id AND sp.user_id = ?${roleSql})`,
    params: [req.user.id, ...roles]
  };
}

async function requireStudentRole(req, roles) {
  if (req.user.user_type !== 'student') return;
  const row = await get(
    db,
    `SELECT 1 FROM simulation_participants
     WHERE user_id = ? AND simulation_role IN (${roles.map(() => '?').join(',')}) LIMIT 1`,
    [req.user.id, ...roles]
  );
  if (!row) throw httpError(403, 'Tu rol no permite consultar esta información.');
}

router.get('/dashboard', asyncHandler(async (req, res) => {
  await requireStudentRole(req, ['supervisor', 'observer', 'manager']);
  const scope = simulationScope(req, 's', ['supervisor', 'observer', 'manager']);
  const summary = await get(
    db,
    `SELECT
      (SELECT COUNT(DISTINCT s.laboratory_id) FROM simulations s WHERE ${scope.sql}) AS active_laboratories,
      (SELECT COUNT(DISTINCT sp.user_id) FROM simulation_participants sp JOIN simulations s ON s.id = sp.simulation_id WHERE ${scope.sql}) AS active_students,
      (SELECT COUNT(*) FROM simulations s WHERE s.status = 'running' AND ${scope.sql}) AS running_simulations,
      (SELECT COUNT(*) FROM production_tickets t JOIN production_orders o ON o.id = t.order_id JOIN simulations s ON s.id = o.simulation_id WHERE t.status = 'in_progress' AND ${scope.sql}) AS tickets_in_progress,
      (SELECT COUNT(*) FROM incidents i JOIN simulations s ON s.id = i.simulation_id WHERE i.status != 'resolved' AND ${scope.sql}) AS open_incidents,
      (SELECT COUNT(*) FROM downtime_events d JOIN simulations s ON s.id = d.simulation_id WHERE d.status = 'open' AND ${scope.sql}) AS active_downtimes`,
    [...scope.params, ...scope.params, ...scope.params, ...scope.params, ...scope.params, ...scope.params]
  );
  const recentSimulations = await all(
    db,
    `SELECT s.id, s.name, s.status, l.name AS laboratory_name, s.starts_at, s.ends_at
     FROM simulations s JOIN laboratories l ON l.id = s.laboratory_id
     WHERE ${scope.sql} ORDER BY s.created_at DESC LIMIT 8`,
    scope.params
  );
  res.json({ ok: true, summary, recent_simulations: recentSimulations });
}));

router.get('/andon', asyncHandler(async (req, res) => {
  const scope = simulationScope(req, 's');
  const simulationFilter = req.query.simulation_id ? 'AND s.id = ?' : '';
  const params = req.query.simulation_id ? [...scope.params, req.query.simulation_id] : scope.params;
  const simulations = await all(
    db,
    `SELECT s.id, s.name, s.status, l.name AS laboratory_name
     FROM simulations s JOIN laboratories l ON l.id = s.laboratory_id
     WHERE s.status IN ('ready', 'running', 'paused') AND ${scope.sql} ${simulationFilter}
     ORDER BY s.starts_at DESC, s.id DESC`,
    params
  );
  const ids = simulations.map((item) => item.id);
  const stations = ids.length ? await all(
    db,
    `SELECT s.id AS simulation_id, st.id AS station_id, st.name AS station_name,
       pl.id AS line_id, pl.name AS line_name,
       SUM(CASE WHEN t.status IN ('waiting', 'available') THEN 1 ELSE 0 END) AS queued,
       SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
       EXISTS(SELECT 1 FROM downtime_events d WHERE d.simulation_id = s.id AND d.station_id = st.id AND d.status = 'open') AS is_down,
       EXISTS(SELECT 1 FROM incidents i WHERE i.simulation_id = s.id AND i.station_id = st.id AND i.status != 'resolved') AS has_incident
     FROM simulations s
     JOIN production_orders o ON o.simulation_id = s.id
     JOIN production_lines pl ON pl.id = o.line_id
     JOIN stations st ON st.line_id = pl.id
     LEFT JOIN production_tickets t ON t.order_id = o.id AND t.current_station_id = st.id
     WHERE s.id IN (${ids.map(() => '?').join(',')})
     GROUP BY s.id, st.id, st.name, pl.id, pl.name
     ORDER BY s.id, pl.name, st.sequence_order, st.id`,
    ids
  ) : [];
  res.json({
    ok: true,
    simulations,
    stations,
    refresh_seconds: await settingsService.getValue('andon_refresh_seconds')
  });
}));

router.get('/reports', asyncHandler(async (req, res) => {
  await requireStudentRole(req, ['supervisor', 'observer', 'manager']);
  const scope = simulationScope(req, 's', ['supervisor', 'observer', 'manager']);
  const filters = [scope.sql];
  const params = [...scope.params];
  if (req.query.simulation_id) { filters.push('s.id = ?'); params.push(req.query.simulation_id); }
  const reports = await reportService.listReports(filters.join(' AND '), params);
  res.json({ ok: true, reports });
}));

router.get('/reports/:id', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.id, { studentRoles: ['supervisor', 'observer', 'manager'] });
  res.json({ ok: true, report: await reportService.getDetailedReport(Number(req.params.id)) });
}));

router.get('/reports/:id/pdf', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.id, { studentRoles: ['supervisor', 'observer', 'manager'] });
  const report = await reportService.getDetailedReport(Number(req.params.id));
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${reportService.safeFileName(report.simulation.name)}.pdf"`);
  reportService.writePdf(report, res);
}));

router.get('/reports/:id/xlsx', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.id, { studentRoles: ['supervisor', 'observer', 'manager'] });
  const report = await reportService.getDetailedReport(Number(req.params.id));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${reportService.safeFileName(report.simulation.name)}.xlsx"`);
  await reportService.writeExcel(report, res);
}));

router.get('/events/:simulationId', asyncHandler(async (req, res) => {
  await assertSimulation(req.user, req.params.simulationId, { studentRoles: ['supervisor', 'observer', 'manager'] });
  const events = await all(
    db,
    `SELECT e.*, u.name AS user_name, t.code AS ticket_code, st.name AS station_name
     FROM production_events e
     LEFT JOIN users u ON u.id = e.user_id
     LEFT JOIN production_tickets t ON t.id = e.ticket_id
     LEFT JOIN stations st ON st.id = e.station_id
     WHERE e.simulation_id = ? ORDER BY e.created_at DESC, e.id DESC`,
    [req.params.simulationId]
  );
  res.json({ ok: true, events });
}));

module.exports = router;
