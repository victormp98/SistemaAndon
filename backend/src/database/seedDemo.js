const bcrypt = require('bcryptjs');
const db = require('./connection');
const { run, get, transaction } = require('./dbUtils');

const users = [
  ['admin', 'Administrador Global', 'admin@andon.test', 'admin123', 'professor', 1, null],
  ['prof1', 'Profesor Uno', 'prof1@andon.test', 'prof123', 'professor', 0, null],
  ['prof2', 'Profesor Dos', 'prof2@andon.test', 'prof123', 'professor', 0, null],
  ['juanp', 'Juan Pérez', 'juanp@andon.test', 'juanp123', 'student', 0, 'A-101'],
  ['anag', 'Ana García', 'anag@andon.test', 'anag123', 'student', 0, 'A-102'],
  ['carlosm', 'Carlos Martínez', 'carlosm@andon.test', 'carlos123', 'student', 0, 'A-103'],
  ['mariag', 'María Gómez', 'mariag@andon.test', 'mariag123', 'student', 0, 'B-201'],
  ['luisr', 'Luis Rodríguez', 'luisr@andon.test', 'luis123', 'student', 0, 'B-202'],
  ['sofial', 'Sofía López', 'sofial@andon.test', 'sofia123', 'student', 0, 'B-203']
];

async function upsertUser([username, name, email, password, type, admin, studentCode], ownerId) {
  const hash = await bcrypt.hash(password, 12);
  await run(
    db,
    `INSERT INTO users
     (name, email, username, password_hash, user_type, is_admin, student_code, group_name,
      owner_user_id, is_active, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
     ON CONFLICT(username) DO UPDATE SET name = excluded.name, email = excluded.email,
       password_hash = excluded.password_hash, user_type = excluded.user_type,
       is_admin = excluded.is_admin, student_code = excluded.student_code,
       group_name = excluded.group_name, owner_user_id = excluded.owner_user_id,
       is_active = 1, must_change_password = 0, updated_at = CURRENT_TIMESTAMP`,
    [name, email, username, hash, type, admin, studentCode, type === 'student' ? (studentCode.startsWith('A') ? 'Grupo A TEST' : 'Grupo B TEST') : null, ownerId]
  );
  return get(db, 'SELECT id FROM users WHERE username = ?', [username]);
}

async function seed() {
  await db.ready;
  const ids = {};
  ids.admin = (await upsertUser(users[0], null)).id;
  ids.prof1 = (await upsertUser(users[1], null)).id;
  ids.prof2 = (await upsertUser(users[2], null)).id;
  for (const item of users.slice(3)) {
    const owner = ['mariag', 'luisr', 'sofial'].includes(item[0]) ? ids.prof2 : ids.prof1;
    ids[item[0]] = (await upsertUser(item, owner)).id;
  }

  await transaction(db, async () => {
    const simulations = await get(db, `SELECT GROUP_CONCAT(id) AS ids FROM simulations WHERE name LIKE '% TEST'`);
    const simulationIds = String(simulations?.ids || '').split(',').filter(Boolean);
    if (simulationIds.length) {
      const marks = simulationIds.map(() => '?').join(',');
      const orders = await get(db, `SELECT GROUP_CONCAT(id) AS ids FROM production_orders WHERE simulation_id IN (${marks})`, simulationIds);
      const orderIds = String(orders?.ids || '').split(',').filter(Boolean);
      if (orderIds.length) {
        const orderMarks = orderIds.map(() => '?').join(',');
        const tickets = await get(db, `SELECT GROUP_CONCAT(id) AS ids FROM production_tickets WHERE order_id IN (${orderMarks})`, orderIds);
        const ticketIds = String(tickets?.ids || '').split(',').filter(Boolean);
        if (ticketIds.length) {
          const ticketMarks = ticketIds.map(() => '?').join(',');
          await run(db, `DELETE FROM ticket_station_logs WHERE ticket_id IN (${ticketMarks})`, ticketIds);
        }
        await run(db, `DELETE FROM production_events WHERE simulation_id IN (${marks})`, simulationIds);
        await run(db, `DELETE FROM incidents WHERE simulation_id IN (${marks})`, simulationIds);
        await run(db, `DELETE FROM downtime_events WHERE simulation_id IN (${marks})`, simulationIds);
        await run(db, `DELETE FROM production_tickets WHERE order_id IN (${orderMarks})`, orderIds);
      }
      await run(db, `DELETE FROM production_events WHERE simulation_id IN (${marks})`, simulationIds);
      await run(db, `DELETE FROM incidents WHERE simulation_id IN (${marks})`, simulationIds);
      await run(db, `DELETE FROM downtime_events WHERE simulation_id IN (${marks})`, simulationIds);
      await run(db, `DELETE FROM kpi_snapshots WHERE simulation_id IN (${marks})`, simulationIds);
      await run(db, `DELETE FROM simulation_participants WHERE simulation_id IN (${marks})`, simulationIds);
      await run(db, `DELETE FROM production_orders WHERE simulation_id IN (${marks})`, simulationIds);
      await run(db, `DELETE FROM simulations WHERE id IN (${marks})`, simulationIds);
    }
    await run(db, `DELETE FROM stations WHERE line_id IN (
      SELECT pl.id FROM production_lines pl JOIN laboratories l ON l.id = pl.laboratory_id WHERE l.name LIKE '% TEST'
    )`);
    await run(db, `DELETE FROM production_lines WHERE laboratory_id IN (SELECT id FROM laboratories WHERE name LIKE '% TEST')`);
    await run(db, `DELETE FROM laboratories WHERE name LIKE '% TEST'`);
  });

  const labEnsamble = await insertLab('Laboratorio Ensamble TEST', ids.prof1);
  const labCalidad = await insertLab('Laboratorio Calidad TEST', ids.prof2);
  const labMixta = await insertLab('Laboratorio Producción Mixta TEST', ids.admin);
  const lineEnsamble = await insertLine(labEnsamble, 'Línea Ensamble TEST', 1);
  const lineCalidad = await insertLine(labCalidad, 'Línea Calidad TEST', 1);
  const lineRetrabajo = await insertLine(labMixta, 'Línea Retrabajo Demo TEST', 1);
  const ensambleStations = [
    await insertStation(lineEnsamble, 'Preparación TEST', 1, 40),
    await insertStation(lineEnsamble, 'Ensamble TEST', 2, 60),
    await insertStation(lineEnsamble, 'Inspección TEST', 3, 30)
  ];
  const qualityStations = [
    await insertStation(lineCalidad, 'Recepción Calidad TEST', 1, 35),
    await insertStation(lineCalidad, 'Validación Calidad TEST', 2, 50)
  ];
  await insertStation(lineRetrabajo, 'Retrabajo TEST', 1, 75);

  const running = await insertSimulation(labEnsamble, 'Simulación Ensamble Turno A TEST', 'running', ids.prof1, -45);
  const ready = await insertSimulation(labCalidad, 'Simulación Calidad Turno B TEST', 'ready', ids.prof2);
  const paused = await insertSimulation(labMixta, 'Simulación Pausada TEST', 'paused', ids.admin, -90);
  const completed = await insertSimulation(labEnsamble, 'Simulación Finalizada TEST', 'completed', ids.prof1, -240, -60);

  await addParticipant(running, ids.juanp, 'operator', lineEnsamble, ensambleStations[0]);
  await addParticipant(running, ids.anag, 'supervisor', lineEnsamble, null);
  await addParticipant(running, ids.carlosm, 'observer', null, null);
  await addParticipant(running, ids.mariag, 'manager', null, null);
  await addParticipant(ready, ids.mariag, 'operator', lineCalidad, qualityStations[0]);
  await addParticipant(ready, ids.luisr, 'supervisor', lineCalidad, null);
  await addParticipant(paused, ids.sofial, 'manager', null, null);
  await addParticipant(completed, ids.juanp, 'operator', lineEnsamble, ensambleStations[2]);

  const runningOrder = await insertOrder(running, lineEnsamble, 'OP-TEST-ENS-001', 'Ensamble educativo TEST', 6, 'high', ids.prof1, 'released');
  const qualityOrder = await insertOrder(ready, lineCalidad, 'OP-TEST-CAL-001', 'Inspección educativa TEST', 4, 'medium', ids.prof2, 'draft');
  const completedOrder = await insertOrder(completed, lineEnsamble, 'OP-TEST-FIN-001', 'Producto final TEST', 3, 'urgent', ids.prof1, 'completed');

  const runningTickets = [];
  for (let i = 1; i <= 6; i += 1) {
    runningTickets.push(await insertTicket(runningOrder, `OP-TEST-ENS-001-T${String(i).padStart(3, '0')}`, ensambleStations[0], i === 1 ? 'in_progress' : 'available', 'high', i === 1 ? ids.juanp : null));
  }
  for (let i = 1; i <= 4; i += 1) await insertTicket(qualityOrder, `OP-TEST-CAL-001-T${String(i).padStart(3, '0')}`, qualityStations[0], 'waiting', 'medium');
  for (let i = 1; i <= 3; i += 1) await insertTicket(completedOrder, `OP-TEST-FIN-001-T${String(i).padStart(3, '0')}`, ensambleStations[2], 'completed', 'urgent', null, -180 + i * 10, -170 + i * 10);

  await run(db, `INSERT INTO ticket_station_logs
    (ticket_id, station_id, operator_user_id, started_at, status)
    VALUES (?, ?, ?, datetime('now','-5 minutes'), 'in_progress')`, [runningTickets[0], ensambleStations[0], ids.juanp]);
  await run(db, `INSERT INTO incidents
    (simulation_id, line_id, station_id, ticket_id, reported_by_user_id, type, severity, status, description)
    VALUES (?, ?, ?, ?, ?, 'defect', 'high', 'open', 'Defecto dimensional TEST')`,
  [running, lineEnsamble, ensambleStations[0], runningTickets[0], ids.juanp]);
  await run(db, `INSERT INTO downtime_events
    (simulation_id, station_id, reported_by_user_id, reason, status, started_at)
    VALUES (?, ?, ?, 'Falta de material TEST', 'open', datetime('now','-3 minutes'))`,
  [running, ensambleStations[1], ids.anag]);
  await run(db, `INSERT INTO production_events
    (simulation_id, order_id, ticket_id, station_id, user_id, event_type, payload_json, notes)
    VALUES (?, ?, ?, ?, ?, 'demo_event', '{"source":"seed"}', 'Evento TEST')`,
  [running, runningOrder, runningTickets[0], ensambleStations[0], ids.juanp]);

  console.log('Datos demo TEST creados correctamente.');
}

async function insertLab(name, owner) {
  const result = await run(db, 'INSERT INTO laboratories (name, description, created_by_user_id) VALUES (?, ?, ?)', [name, 'Datos de demostración TEST', owner]);
  return result.lastID;
}
async function insertLine(lab, name, order) {
  return (await run(db, 'INSERT INTO production_lines (laboratory_id, name, description, sequence_order) VALUES (?, ?, ?, ?)', [lab, name, 'Línea TEST', order])).lastID;
}
async function insertStation(line, name, order, cycle) {
  return (await run(db, `INSERT INTO stations
    (line_id, name, description, instructions, sequence_order, target_cycle_time_seconds, allows_defects, allows_downtime)
    VALUES (?, ?, 'Estación TEST', 'Seguir instrucciones de práctica TEST', ?, ?, 1, 1)`, [line, name, order, cycle])).lastID;
}
async function insertSimulation(lab, name, status, owner, startMinutes = null, endMinutes = null) {
  return (await run(db, `INSERT INTO simulations
    (laboratory_id, name, description, status, starts_at, ends_at, planned_duration_minutes, created_by_user_id)
    VALUES (?, ?, 'Simulación de demostración TEST', ?,
      CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ? || ' minutes') END,
      CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ? || ' minutes') END, 120, ?)`,
  [lab, name, status, startMinutes, startMinutes, endMinutes, endMinutes, owner])).lastID;
}
async function addParticipant(sim, user, role, line, station) {
  await run(db, `INSERT INTO simulation_participants
    (simulation_id, user_id, simulation_role, line_id, station_id) VALUES (?, ?, ?, ?, ?)`, [sim, user, role, line, station]);
}
async function insertOrder(sim, line, code, product, qty, priority, owner, status) {
  return (await run(db, `INSERT INTO production_orders
    (simulation_id, line_id, code, product_name, target_quantity, priority, status, created_by_user_id, released_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'released' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
  [sim, line, code, product, qty, priority, status, owner, status])).lastID;
}
async function insertTicket(order, code, station, status, priority, operator = null, startMinutes = null, endMinutes = null) {
  return (await run(db, `INSERT INTO production_tickets
    (order_id, code, current_station_id, current_operator_id, status, priority, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?,
      CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ? || ' minutes') END,
      CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', ? || ' minutes') END)`,
  [order, code, station, operator, status, priority, startMinutes, startMinutes, endMinutes, endMinutes])).lastID;
}

seed()
  .then(() => new Promise((resolve) => db.close(resolve)))
  .catch((error) => {
    console.error(error);
    db.close(() => process.exit(1));
  });
