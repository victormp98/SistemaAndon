const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const db = require('../database/connection');
const { get, all } = require('../database/dbUtils');
const httpError = require('../utils/httpError');

async function listReports(filter = '1=1', params = []) {
  return all(
    db,
    `SELECT s.id, s.name, s.status, s.starts_at, s.ends_at,
       COUNT(DISTINCT o.id) AS orders, COUNT(t.id) AS tickets,
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed,
       (SELECT COUNT(*) FROM incidents ix WHERE ix.simulation_id = s.id AND ix.type = 'defect') AS defects,
       ROUND(AVG(CASE WHEN t.completed_at IS NOT NULL AND t.started_at IS NOT NULL
         THEN (julianday(t.completed_at) - julianday(t.started_at)) * 86400 END), 1) AS avg_cycle_seconds,
       ROUND(CASE WHEN COUNT(t.id) > 0 THEN 100.0 * SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) / COUNT(t.id) ELSE 0 END, 1) AS completion_percent,
       (SELECT COUNT(*) FROM incidents ix WHERE ix.simulation_id = s.id) AS incidents,
       (SELECT COUNT(*) FROM downtime_events d WHERE d.simulation_id = s.id) AS downtimes,
       (SELECT ROUND(SUM((julianday(COALESCE(d.ended_at, CURRENT_TIMESTAMP)) - julianday(d.started_at)) * 1440), 1)
        FROM downtime_events d WHERE d.simulation_id = s.id) AS downtime_minutes
     FROM simulations s
     LEFT JOIN production_orders o ON o.simulation_id = s.id
     LEFT JOIN production_tickets t ON t.order_id = o.id
     WHERE ${filter}
     GROUP BY s.id ORDER BY s.created_at DESC`,
    params
  );
}

async function getDetailedReport(simulationId) {
  const simulation = await get(
    db,
    `SELECT s.*, l.name AS laboratory_name, u.name AS owner_name
     FROM simulations s JOIN laboratories l ON l.id = s.laboratory_id
     LEFT JOIN users u ON u.id = s.created_by_user_id WHERE s.id = ?`,
    [simulationId]
  );
  if (!simulation) throw httpError(404, 'Simulación no encontrada.');
  const [summary] = await listReports('s.id = ?', [simulationId]);
  const [orders, tickets, events, incidents, downtimes, participants, stations, defectsByStation, defectsByOperator, defectsByOrder, participantRanking] = await Promise.all([
    all(db, 'SELECT * FROM production_orders WHERE simulation_id = ? ORDER BY created_at', [simulationId]),
    all(db, `SELECT t.*, o.code AS order_code, o.product_name, st.name AS station_name,
      u.name AS operator_name FROM production_tickets t
      JOIN production_orders o ON o.id = t.order_id
      LEFT JOIN stations st ON st.id = t.current_station_id
      LEFT JOIN users u ON u.id = t.current_operator_id
      WHERE o.simulation_id = ? ORDER BY t.code`, [simulationId]),
    all(db, `SELECT e.*, u.name AS user_name, t.code AS ticket_code, st.name AS station_name
      FROM production_events e LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN production_tickets t ON t.id = e.ticket_id
      LEFT JOIN stations st ON st.id = e.station_id
      WHERE e.simulation_id = ? ORDER BY e.created_at`, [simulationId]),
    all(db, `SELECT i.*, st.name AS station_name, u.name AS reported_by_name
      FROM incidents i LEFT JOIN stations st ON st.id = i.station_id
      LEFT JOIN users u ON u.id = i.reported_by_user_id WHERE i.simulation_id = ? ORDER BY i.created_at`, [simulationId]),
    all(db, `SELECT d.*, st.name AS station_name, u.name AS reported_by_name
      FROM downtime_events d LEFT JOIN stations st ON st.id = d.station_id
      LEFT JOIN users u ON u.id = d.reported_by_user_id WHERE d.simulation_id = ? ORDER BY d.created_at`, [simulationId]),
    all(db, `SELECT sp.*, u.name, u.username, pl.name AS line_name, st.name AS station_name
      FROM simulation_participants sp JOIN users u ON u.id = sp.user_id
      LEFT JOIN production_lines pl ON pl.id = sp.line_id LEFT JOIN stations st ON st.id = sp.station_id
      WHERE sp.simulation_id = ? ORDER BY sp.simulation_role, u.name`, [simulationId]),
    all(db, `SELECT st.id, st.name, pl.name AS line_name, st.target_cycle_time_seconds,
      COUNT(l.id) AS operations,
      ROUND(AVG(CASE WHEN l.finished_at IS NOT NULL THEN (julianday(l.finished_at)-julianday(l.started_at))*86400 END), 1) AS avg_cycle_seconds,
      SUM(CASE WHEN l.status = 'completed' THEN 1 ELSE 0 END) AS completed_operations
      FROM stations st JOIN production_lines pl ON pl.id = st.line_id
      JOIN production_orders o ON o.line_id = pl.id AND o.simulation_id = ?
      LEFT JOIN production_tickets t ON t.order_id = o.id
      LEFT JOIN ticket_station_logs l ON l.ticket_id = t.id AND l.station_id = st.id
      GROUP BY st.id ORDER BY pl.name, st.sequence_order`, [simulationId]),
    all(db, `SELECT COALESCE(st.name, 'Sin estación') AS label, COUNT(*) AS total
      FROM incidents i LEFT JOIN stations st ON st.id = i.station_id
      WHERE i.simulation_id = ? AND i.type = 'defect' GROUP BY i.station_id ORDER BY total DESC`, [simulationId]),
    all(db, `SELECT COALESCE(u.name, 'Sin operador') AS label, COUNT(*) AS total
      FROM incidents i LEFT JOIN users u ON u.id = i.reported_by_user_id
      WHERE i.simulation_id = ? AND i.type = 'defect' GROUP BY i.reported_by_user_id ORDER BY total DESC`, [simulationId]),
    all(db, `SELECT COALESCE(o.code, 'Sin orden') AS label, COUNT(*) AS total
      FROM incidents i LEFT JOIN production_tickets t ON t.id = i.ticket_id
      LEFT JOIN production_orders o ON o.id = t.order_id
      WHERE i.simulation_id = ? AND i.type = 'defect' GROUP BY o.id ORDER BY total DESC`, [simulationId]),
    all(db, `SELECT u.id, u.name, sp.simulation_role,
      COUNT(CASE WHEN l.status = 'completed' THEN 1 END) AS completed_operations,
      ROUND(AVG(CASE WHEN l.finished_at IS NOT NULL THEN (julianday(l.finished_at)-julianday(l.started_at))*86400 END), 1) AS avg_cycle_seconds,
      (SELECT COUNT(*) FROM incidents i WHERE i.simulation_id = sp.simulation_id AND i.reported_by_user_id = u.id) AS reported_incidents
      FROM simulation_participants sp JOIN users u ON u.id = sp.user_id
      LEFT JOIN ticket_station_logs l ON l.operator_user_id = u.id
        AND l.ticket_id IN (SELECT t.id FROM production_tickets t JOIN production_orders o ON o.id = t.order_id WHERE o.simulation_id = sp.simulation_id)
      WHERE sp.simulation_id = ? GROUP BY u.id, sp.simulation_role
      ORDER BY completed_operations DESC, avg_cycle_seconds ASC`, [simulationId])
  ]);
  const effectiveEnd = simulation.ends_at ? new Date(simulation.ends_at).getTime() : Date.now();
  const throughput = simulation.starts_at
    ? Number(summary.completed || 0) / Math.max((effectiveEnd - new Date(simulation.starts_at).getTime()) / 3_600_000, 1 / 60)
    : 0;
  const bottleneck = [...stations].filter((item) => item.avg_cycle_seconds !== null)
    .sort((a, b) => Number(b.avg_cycle_seconds) - Number(a.avg_cycle_seconds))[0] || null;
  const leadTimeMinutes = simulation.starts_at ? Math.max(0, (effectiveEnd - new Date(simulation.starts_at).getTime()) / 60_000) : 0;
  const responseTimes = incidents
    .filter((incident) => incident.response_started_at)
    .map((incident) => (new Date(`${incident.response_started_at}Z`) - new Date(`${incident.created_at}Z`)) / 1000)
    .filter((value) => Number.isFinite(value) && value >= 0);
  return {
    simulation,
    summary: {
      ...summary,
      wip: tickets.filter((ticket) => ['waiting', 'available', 'in_progress'].includes(ticket.status)).length,
      throughput_per_hour: Number(throughput.toFixed(2)),
      scrap: incidents.filter((incident) => incident.type === 'defect').length,
      bottleneck_station: bottleneck?.name || null,
      lead_time_minutes: Number(leadTimeMinutes.toFixed(1)),
      avg_supervisor_response_seconds: responseTimes.length
        ? Number((responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length).toFixed(1))
        : 0
    },
    orders, tickets, events, incidents, downtimes, participants, stations,
    defects_by_station: defectsByStation,
    defects_by_operator: defectsByOperator,
    defects_by_order: defectsByOrder,
    participant_ranking: participantRanking
  };
}

function safeFileName(value) {
  return `Sistema-Andon-${String(value || 'reporte').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-')}`;
}

function writePdf(report, stream) {
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  doc.pipe(stream);
  doc.fontSize(20).text('Sistema Andon - Reporte de simulación');
  doc.moveDown(0.4).fontSize(14).text(report.simulation.name);
  doc.fontSize(9).fillColor('#555').text(`Laboratorio: ${report.simulation.laboratory_name} | Estado: ${report.simulation.status}`);
  doc.moveDown().fillColor('#000').fontSize(12).text('Indicadores');
  Object.entries({
    'Órdenes': report.summary.orders,
    'Tickets': report.summary.tickets,
    'Completados': report.summary.completed,
    'Avance (%)': report.summary.completion_percent,
    'WIP': report.summary.wip,
    'Ciclo promedio (s)': report.summary.avg_cycle_seconds || 0,
    'Throughput/h': report.summary.throughput_per_hour,
    'Lead time (min)': report.summary.lead_time_minutes,
    'Defectos/Scrap': report.summary.scrap,
    'Respuesta supervisor (s)': report.summary.avg_supervisor_response_seconds,
    'Paros': report.summary.downtimes,
    'Tiempo muerto (min)': report.summary.downtime_minutes || 0,
    'Cuello de botella': report.summary.bottleneck_station || 'Sin datos'
  }).forEach(([label, value]) => doc.fontSize(9).text(`${label}: ${value}`));
  const sections = [
    ['Participantes', report.participants, (r) => `${r.name} | ${r.simulation_role} | ${r.station_name || r.line_name || '-'}`],
    ['Órdenes', report.orders, (r) => `${r.code} | ${r.product_name} | ${r.status} | ${r.target_quantity}`],
    ['Incidentes', report.incidents, (r) => `${r.created_at} | ${r.type}/${r.severity} | ${r.status} | ${r.description}`],
    ['Paros', report.downtimes, (r) => `${r.started_at} | ${r.station_name || '-'} | ${r.status} | ${r.reason}`],
    ['Eventos principales', report.events.slice(-100), (r) => `${r.created_at} | ${r.event_type} | ${r.ticket_code || '-'} | ${r.user_name || '-'}`]
  ];
  sections.forEach(([title, rows, format]) => {
    doc.addPage().fontSize(14).text(title).moveDown(0.5);
    if (!rows.length) doc.fontSize(9).fillColor('#666').text('Sin registros.');
    rows.forEach((row) => doc.fontSize(8).fillColor('#000').text(format(row), { paragraphGap: 4 }));
  });
  doc.end();
}

async function writeExcel(report, stream) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema Andon';
  addSheet(workbook, 'Resumen', Object.entries(report.summary).map(([indicador, valor]) => ({ indicador, valor })));
  addSheet(workbook, 'Tickets', report.tickets);
  addSheet(workbook, 'Eventos', report.events);
  addSheet(workbook, 'Incidencias', report.incidents);
  addSheet(workbook, 'Paros', report.downtimes);
  addSheet(workbook, 'Estaciones', report.stations);
  addSheet(workbook, 'Ordenes', report.orders);
  addSheet(workbook, 'Participantes', report.participants);
  addSheet(workbook, 'Ranking', report.participant_ranking);
  addSheet(workbook, 'Defectos Estacion', report.defects_by_station);
  addSheet(workbook, 'Defectos Operador', report.defects_by_operator);
  addSheet(workbook, 'Defectos Orden', report.defects_by_order);
  await workbook.xlsx.write(stream);
}

function addSheet(workbook, name, rows) {
  const sheet = workbook.addWorksheet(name);
  const keys = rows.length ? Object.keys(rows[0]) : ['sin_datos'];
  sheet.columns = keys.map((key) => ({ header: key, key, width: Math.min(Math.max(key.length + 3, 14), 35) }));
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
}

module.exports = { listReports, getDetailedReport, safeFileName, writePdf, writeExcel };
