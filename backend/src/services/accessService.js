const db = require('../database/connection');
const { get } = require('../database/dbUtils');
const httpError = require('../utils/httpError');

function isAdmin(user) {
  return Boolean(user?.is_admin);
}

function professorScope(user, alias, column = 'created_by_user_id') {
  return isAdmin(user) ? { sql: '1=1', params: [] } : { sql: `${alias}.${column} = ?`, params: [user.id] };
}

async function assertLaboratory(user, laboratoryId) {
  const row = await get(
    db,
    `SELECT id, created_by_user_id FROM laboratories WHERE id = ?`,
    [laboratoryId]
  );
  if (!row) throw httpError(404, 'Laboratorio no encontrado.');
  if (!isAdmin(user) && row.created_by_user_id !== user.id) throw httpError(403, 'No tienes acceso a este laboratorio.');
  return row;
}

async function assertSimulation(user, simulationId, { studentRoles = [], professorWrite = false } = {}) {
  const simulation = await get(db, 'SELECT * FROM simulations WHERE id = ?', [simulationId]);
  if (!simulation) throw httpError(404, 'Simulación no encontrada.');
  if (user.user_type === 'professor') {
    if (!isAdmin(user) && simulation.created_by_user_id !== user.id) {
      throw httpError(403, 'No tienes acceso a esta simulación.');
    }
    return { simulation, participant: null };
  }
  if (professorWrite) throw httpError(403, 'Esta operación requiere un profesor.');
  const participant = await get(
    db,
    'SELECT * FROM simulation_participants WHERE simulation_id = ? AND user_id = ?',
    [simulationId, user.id]
  );
  if (!participant || (studentRoles.length && !studentRoles.includes(participant.simulation_role))) {
    throw httpError(403, 'No tienes acceso a esta simulación.');
  }
  return { simulation, participant };
}

async function assertOrder(user, orderId) {
  const order = await get(
    db,
    `SELECT o.*, s.created_by_user_id AS simulation_owner_id
     FROM production_orders o JOIN simulations s ON s.id = o.simulation_id WHERE o.id = ?`,
    [orderId]
  );
  if (!order) throw httpError(404, 'Orden no encontrada.');
  if (!isAdmin(user) && order.simulation_owner_id !== user.id) throw httpError(403, 'No tienes acceso a esta orden.');
  return order;
}

module.exports = { isAdmin, professorScope, assertLaboratory, assertSimulation, assertOrder };
