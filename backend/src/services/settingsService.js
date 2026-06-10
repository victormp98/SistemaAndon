const db = require('../database/connection');
const { get, all, run } = require('../database/dbUtils');
const httpError = require('../utils/httpError');

const definitions = Object.freeze({
  organization_name: { defaultValue: 'Laboratorio Industrial', type: 'string', minLength: 2, maxLength: 100 },
  andon_refresh_seconds: { defaultValue: 15, type: 'integer', min: 5, max: 300 },
  max_ticket_quantity: { defaultValue: 500, type: 'integer', min: 1, max: 5000 },
  backup_retention: { defaultValue: 10, type: 'integer', min: 3, max: 100 }
});

function parseValue(key, raw) {
  const definition = definitions[key];
  if (!definition) throw httpError(400, `Configuración no permitida: ${key}.`);
  if (definition.type === 'integer') {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < definition.min || value > definition.max) {
      throw httpError(400, `${key} debe estar entre ${definition.min} y ${definition.max}.`);
    }
    return value;
  }
  const value = String(raw || '').trim();
  if (value.length < definition.minLength || value.length > definition.maxLength) {
    throw httpError(400, `${key} debe tener entre ${definition.minLength} y ${definition.maxLength} caracteres.`);
  }
  return value;
}

async function getValue(key) {
  const row = await get(db, 'SELECT value FROM app_settings WHERE key = ?', [key]);
  const definition = definitions[key];
  if (!definition) return null;
  return parseValue(key, row?.value ?? definition.defaultValue);
}

async function getAll() {
  const rows = await all(db, 'SELECT key, value, updated_at FROM app_settings ORDER BY key');
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return Object.entries(definitions).map(([key, definition]) => ({
    key,
    value: String(byKey.get(key)?.value ?? definition.defaultValue),
    updated_at: byKey.get(key)?.updated_at || null
  }));
}

async function update(values) {
  for (const [key, raw] of Object.entries(values || {})) {
    if (!definitions[key]) continue;
    const value = parseValue(key, raw);
    await run(
      db,
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
      [key, String(value)]
    );
  }
  return getAll();
}

module.exports = { definitions, getValue, getAll, update };
