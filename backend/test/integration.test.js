const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');

const testDb = path.resolve(__dirname, '../../data/integration-test.sqlite');
process.env.DATABASE_PATH = 'data/integration-test.sqlite';
process.env.JWT_SECRET = 'integration-test-secret-that-is-long-enough';

if (fs.existsSync(testDb)) fs.rmSync(testDb);

const db = require('../src/database/connection');
const createApp = require('../src/app');

const app = createApp();
const binaryParser = (res, callback) => {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};

let professorToken;
let studentToken;
let simulationId;
let ticketId;

test.before(async () => {
  await db.ready;
});

test.after(async () => {
  await new Promise((resolve) => db.close(resolve));
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(`${testDb}${suffix}`)) {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          fs.rmSync(`${testDb}${suffix}`);
          break;
        } catch (error) {
          if (attempt === 4) throw error;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }
  }
  for (const suffix of ['.restore-pending', '.restore.json']) {
    if (fs.existsSync(`${testDb}${suffix}`)) fs.rmSync(`${testDb}${suffix}`);
  }
});

test('health endpoint reports database connection', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.database, 'connected');
});

test('complete production workflow is consistent and rejects concurrent claims', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'admin', password: 'admin123' })
    .expect(200);
  professorToken = login.body.token;
  assert.equal(login.body.user.must_change_password, 1);

  await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${professorToken}`)
    .send({ current_password: 'admin123', new_password: 'AdminSeguro2026' })
    .expect(200);

  const relogin = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'admin', password: 'AdminSeguro2026' })
    .expect(200);
  professorToken = relogin.body.token;

  const lab = await request(app)
    .post('/api/laboratories')
    .set('Authorization', `Bearer ${professorToken}`)
    .send({ name: 'Laboratorio de integración', description: 'Prueba' })
    .expect(201);

  const line = await request(app)
    .post(`/api/laboratories/${lab.body.laboratory.id}/lines`)
    .set('Authorization', `Bearer ${professorToken}`)
    .send({ name: 'Línea A', sequence_order: 1 })
    .expect(201);

  const station = await request(app)
    .post(`/api/laboratories/lines/${line.body.line.id}/stations`)
    .set('Authorization', `Bearer ${professorToken}`)
    .send({
      name: 'Estación 1',
      sequence_order: 1,
      target_cycle_time_seconds: 30,
      allows_defects: true,
      allows_downtime: true
    })
    .expect(201);

  const student = await request(app)
    .post('/api/students')
    .set('Authorization', `Bearer ${professorToken}`)
    .send({
      name: 'Operador Prueba',
      username: 'operador',
      email: 'operador@test.local',
      temporary_password: 'Temporal2026'
    })
    .expect(201);

  const simulation = await request(app)
    .post('/api/simulations')
    .set('Authorization', `Bearer ${professorToken}`)
    .send({
      laboratory_id: lab.body.laboratory.id,
      name: 'Simulación integración',
      planned_duration_minutes: 30
    })
    .expect(201);
  simulationId = simulation.body.simulationId;

  await request(app)
    .post(`/api/simulations/${simulationId}/participants`)
    .set('Authorization', `Bearer ${professorToken}`)
    .send({
      user_id: student.body.student.id,
      simulation_role: 'operator',
      station_id: station.body.station.id
    })
    .expect(201);

  const order = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${professorToken}`)
    .send({
      simulation_id: simulationId,
      line_id: line.body.line.id,
      product_name: 'Producto prueba',
      target_quantity: 1,
      priority: 'high'
    })
    .expect(201);

  await request(app)
    .post(`/api/orders/${order.body.order.id}/generate-tickets`)
    .set('Authorization', `Bearer ${professorToken}`)
    .send({})
    .expect(201);

  await request(app)
    .patch(`/api/simulations/${simulationId}/status`)
    .set('Authorization', `Bearer ${professorToken}`)
    .send({ status: 'ready' })
    .expect(200);
  await request(app)
    .patch(`/api/simulations/${simulationId}/status`)
    .set('Authorization', `Bearer ${professorToken}`)
    .send({ status: 'running' })
    .expect(200);

  const studentLogin = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'operador', password: 'Temporal2026' })
    .expect(200);
  studentToken = studentLogin.body.token;

  await request(app)
    .post('/api/auth/change-password')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ current_password: 'Temporal2026', new_password: 'Operador2026' })
    .expect(200);
  const studentRelogin = await request(app)
    .post('/api/auth/login')
    .send({ identifier: 'operador', password: 'Operador2026' })
    .expect(200);
  studentToken = studentRelogin.body.token;

  const tickets = await request(app)
    .get('/api/operator/tickets')
    .set('Authorization', `Bearer ${studentToken}`)
    .expect(200);
  assert.equal(tickets.body.tickets.length, 1);
  ticketId = tickets.body.tickets[0].id;

  const incident = await request(app)
    .post('/api/incidents')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      simulation_id: simulationId,
      station_id: station.body.station.id,
      ticket_id: ticketId,
      type: 'quality',
      severity: 'medium',
      description: 'Incidente de integración'
    })
    .expect(201);
  await request(app)
    .patch(`/api/incidents/${incident.body.incidentId}/status`)
    .set('Authorization', `Bearer ${professorToken}`)
    .send({ status: 'resolved' })
    .expect(200);

  const downtime = await request(app)
    .post('/api/incidents/downtime')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({
      simulation_id: simulationId,
      station_id: station.body.station.id,
      ticket_id: ticketId,
      reason: 'Paro de integración'
    })
    .expect(201);
  await request(app)
    .patch(`/api/incidents/downtime/${downtime.body.downtimeId}/close`)
    .set('Authorization', `Bearer ${professorToken}`)
    .send({})
    .expect(200);

  const claims = await Promise.all([
    request(app).post(`/api/operator/tickets/${ticketId}/start`)
      .set('Authorization', `Bearer ${studentToken}`).send({}),
    request(app).post(`/api/operator/tickets/${ticketId}/start`)
      .set('Authorization', `Bearer ${studentToken}`).send({})
  ]);
  assert.deepEqual(claims.map((response) => response.status).sort(), [200, 409]);

  const completion = await request(app)
    .post('/api/operator/current-ticket/complete')
    .set('Authorization', `Bearer ${studentToken}`)
    .send({ notes: 'Finalizado en prueba' })
    .expect(200);
  assert.equal(completion.body.result, 'completed');

  const simulationResult = await request(app)
    .get(`/api/simulations/${simulationId}`)
    .set('Authorization', `Bearer ${professorToken}`)
    .expect(200);
  assert.equal(simulationResult.body.simulation.status, 'completed');

  const dashboard = await request(app)
    .get('/api/analytics/dashboard')
    .set('Authorization', `Bearer ${professorToken}`)
    .expect(200);
  assert.equal(dashboard.body.ok, true);

  const reports = await request(app)
    .get(`/api/analytics/reports?simulation_id=${simulationId}`)
    .set('Authorization', `Bearer ${professorToken}`)
    .expect(200);
  assert.equal(reports.body.reports[0].completed, 1);

  const backup = await request(app)
    .post('/api/settings/backup')
    .set('Authorization', `Bearer ${professorToken}`)
    .send({})
    .expect(201);
  assert.match(backup.body.file, /^database-.+\.sqlite$/);
  const backupPath = path.resolve(__dirname, '../../backups', backup.body.file);
  assert.equal(fs.existsSync(backupPath), true);
  fs.rmSync(backupPath);
});

test('ownership, role permissions, exports, settings and restore scheduling are enforced', async () => {
  const createProfessor = async (username, password) => {
    await request(app)
      .post('/api/professors')
      .set('Authorization', `Bearer ${professorToken}`)
      .send({ name: username, username, email: `${username}@test.local`, temporary_password: password })
      .expect(201);
    const login = await request(app).post('/api/auth/login').send({ identifier: username, password }).expect(200);
    await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ current_password: password, new_password: `${username}Seguro2026` })
      .expect(200);
    return (await request(app).post('/api/auth/login')
      .send({ identifier: username, password: `${username}Seguro2026` }).expect(200)).body.token;
  };
  const prof1Token = await createProfessor('prof_test_1', 'TemporalProf1');
  const prof2Token = await createProfessor('prof_test_2', 'TemporalProf2');

  const lab1 = await request(app).post('/api/laboratories')
    .set('Authorization', `Bearer ${prof1Token}`).send({ name: 'Lab propiedad 1' }).expect(201);
  const lab2 = await request(app).post('/api/laboratories')
    .set('Authorization', `Bearer ${prof2Token}`).send({ name: 'Lab propiedad 2' }).expect(201);

  const prof1Labs = await request(app).get('/api/laboratories')
    .set('Authorization', `Bearer ${prof1Token}`).expect(200);
  assert.deepEqual(prof1Labs.body.laboratories.map((item) => item.id), [lab1.body.laboratory.id]);
  await request(app).put(`/api/laboratories/${lab2.body.laboratory.id}`)
    .set('Authorization', `Bearer ${prof1Token}`).send({ name: 'Ataque', is_active: true }).expect(403);
  const adminLabs = await request(app).get('/api/laboratories')
    .set('Authorization', `Bearer ${professorToken}`).expect(200);
  assert.equal(adminLabs.body.laboratories.some((item) => item.id === lab1.body.laboratory.id), true);
  assert.equal(adminLabs.body.laboratories.some((item) => item.id === lab2.body.laboratory.id), true);

  const createStudent = async (username, role) => {
    const created = await request(app).post('/api/students')
      .set('Authorization', `Bearer ${prof1Token}`)
      .send({ name: username, username, email: `${username}@test.local`, temporary_password: 'AlumnoTemporal1' })
      .expect(201);
    const login = await request(app).post('/api/auth/login')
      .send({ identifier: username, password: 'AlumnoTemporal1' }).expect(200);
    await request(app).post('/api/auth/change-password')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ current_password: 'AlumnoTemporal1', new_password: `${username}Seguro1` }).expect(200);
    const token = (await request(app).post('/api/auth/login')
      .send({ identifier: username, password: `${username}Seguro1` }).expect(200)).body.token;
    return { id: created.body.student.id, token, role };
  };
  const observer = await createStudent('observer_test', 'observer');
  const supervisor = await createStudent('supervisor_test', 'supervisor');
  const manager = await createStudent('manager_test', 'manager');
  const operatorOnly = await createStudent('operator_only_test', 'operator');

  const line = await request(app).post(`/api/laboratories/${lab1.body.laboratory.id}/lines`)
    .set('Authorization', `Bearer ${prof1Token}`).send({ name: 'Línea ownership', sequence_order: 1 }).expect(201);
  const station = await request(app).post(`/api/laboratories/lines/${line.body.line.id}/stations`)
    .set('Authorization', `Bearer ${prof1Token}`).send({ name: 'Estación ownership', sequence_order: 1, allows_defects: true, allows_downtime: true }).expect(201);
  const simulation = await request(app).post('/api/simulations')
    .set('Authorization', `Bearer ${prof1Token}`)
    .send({ laboratory_id: lab1.body.laboratory.id, name: 'Simulación ownership', planned_duration_minutes: 60 })
    .expect(201);
  for (const participant of [observer, supervisor, manager]) {
    await request(app).post(`/api/simulations/${simulation.body.simulationId}/participants`)
      .set('Authorization', `Bearer ${prof1Token}`)
      .send({
        user_id: participant.id,
        simulation_role: participant.role,
        line_id: participant.role === 'supervisor' ? line.body.line.id : undefined
      }).expect(201);
  }
  await request(app).post(`/api/simulations/${simulation.body.simulationId}/participants`)
    .set('Authorization', `Bearer ${prof1Token}`)
    .send({ user_id: operatorOnly.id, simulation_role: 'operator', station_id: station.body.station.id }).expect(201);
  const roleOrder = await request(app).post('/api/orders')
    .set('Authorization', `Bearer ${prof1Token}`)
    .send({ simulation_id: simulation.body.simulationId, line_id: line.body.line.id, product_name: 'Producto roles', target_quantity: 1 })
    .expect(201);

  await request(app).get(`/api/analytics/reports/${simulation.body.simulationId}`)
    .set('Authorization', `Bearer ${observer.token}`).expect(200);
  await request(app).get('/api/analytics/dashboard')
    .set('Authorization', `Bearer ${operatorOnly.token}`).expect(403);
  await request(app).patch(`/api/participant/orders/${roleOrder.body.order.id}/priority`)
    .set('Authorization', `Bearer ${observer.token}`).send({ priority: 'urgent' }).expect(403);
  await request(app).patch(`/api/participant/orders/${roleOrder.body.order.id}/priority`)
    .set('Authorization', `Bearer ${supervisor.token}`).send({ priority: 'urgent' }).expect(200);
  await request(app).patch(`/api/participant/simulations/${simulation.body.simulationId}/complete`)
    .set('Authorization', `Bearer ${manager.token}`).send({}).expect(409);

  await request(app).put('/api/settings')
    .set('Authorization', `Bearer ${prof1Token}`).send({ max_ticket_quantity: 25 }).expect(403);
  const settings = await request(app).put('/api/settings')
    .set('Authorization', `Bearer ${professorToken}`)
    .send({ max_ticket_quantity: 25, andon_refresh_seconds: 7 }).expect(200);
  assert.equal(settings.body.settings.find((item) => item.key === 'max_ticket_quantity').value, '25');
  const andon = await request(app).get('/api/analytics/andon')
    .set('Authorization', `Bearer ${professorToken}`).expect(200);
  assert.equal(andon.body.refresh_seconds, 7);

  const pdf = await request(app).get(`/api/analytics/reports/${simulation.body.simulationId}/pdf`)
    .set('Authorization', `Bearer ${prof1Token}`).expect(200);
  assert.match(pdf.headers['content-type'], /application\/pdf/);
  assert.equal(pdf.body.subarray(0, 4).toString(), '%PDF');
  const xlsx = await request(app).get(`/api/analytics/reports/${simulation.body.simulationId}/xlsx`)
    .set('Authorization', `Bearer ${prof1Token}`).buffer(true).parse(binaryParser).expect(200);
  assert.match(xlsx.headers['content-type'], /spreadsheetml/);
  assert.equal(xlsx.body.subarray(0, 2).toString(), 'PK');

  const backup = await request(app).post('/api/settings/backup')
    .set('Authorization', `Bearer ${professorToken}`).send({}).expect(201);
  const restore = await request(app)
    .post(`/api/settings/backups/${encodeURIComponent(backup.body.file)}/restore`)
    .set('Authorization', `Bearer ${professorToken}`).send({}).expect(202);
  assert.equal(restore.body.restart_required, true);
  assert.equal(fs.existsSync(`${testDb}.restore-pending`), true);
  for (const name of [backup.body.file, restore.body.safety_backup]) {
    const file = path.resolve(__dirname, '../../backups', name);
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  const sessionLogin = await request(app).post('/api/auth/login')
    .send({ identifier: 'prof_test_2', password: 'prof_test_2Seguro2026' }).expect(200);
  await request(app).post('/api/auth/logout')
    .set('Authorization', `Bearer ${sessionLogin.body.token}`).send({}).expect(200);
  await request(app).get('/api/auth/me')
    .set('Authorization', `Bearer ${sessionLogin.body.token}`).expect(401);
});
