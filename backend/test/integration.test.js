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
