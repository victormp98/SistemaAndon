const db = require('../database/connection');
const { run, all } = require('../database/dbUtils');

function clientIp(req) {
  return String(req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').slice(0, 100);
}

async function record({
  req,
  userId,
  action,
  entityType = null,
  entityId = null,
  simulationId = null,
  success = true,
  details = null
}) {
  try {
    await run(
      db,
      `INSERT INTO audit_logs
       (user_id, action, entity_type, entity_id, simulation_id, success, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId ?? req?.user?.id ?? null,
        action,
        entityType,
        entityId === null ? null : String(entityId),
        simulationId,
        success ? 1 : 0,
        details ? JSON.stringify(details) : null,
        clientIp(req)
      ]
    );
  } catch (error) {
    console.error('Audit write failed:', error.message);
  }
}

async function list({ userId, action, simulationId, from, to, limit = 250, ownerId = null } = {}) {
  const filters = [];
  const params = [];
  if (userId) { filters.push('a.user_id = ?'); params.push(userId); }
  if (action) { filters.push('a.action LIKE ?'); params.push(`%${action}%`); }
  if (simulationId) { filters.push('a.simulation_id = ?'); params.push(simulationId); }
  if (from) { filters.push('a.created_at >= ?'); params.push(from); }
  if (to) { filters.push('a.created_at <= ?'); params.push(to); }
  if (ownerId) {
    filters.push(`(a.user_id = ? OR EXISTS (
      SELECT 1 FROM users owned_user WHERE owned_user.id = a.user_id AND owned_user.owner_user_id = ?
    ) OR EXISTS (
      SELECT 1 FROM simulations owned_sim WHERE owned_sim.id = a.simulation_id AND owned_sim.created_by_user_id = ?
    ))`);
    params.push(ownerId, ownerId, ownerId);
  }
  params.push(Math.min(Math.max(Number(limit) || 250, 1), 1000));
  return all(
    db,
    `SELECT a.*, u.name AS user_name, u.username
     FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
     ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
     ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
    params
  );
}

module.exports = { record, list };
