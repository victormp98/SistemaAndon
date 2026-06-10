const fs = require('fs');
const path = require('path');
const db = require('../database/connection');
const { run } = require('../database/dbUtils');
const config = require('../config/appConfig');
const httpError = require('../utils/httpError');

const backupDir = path.resolve(__dirname, '../../../backups');

async function createBackup(prefix = 'database') {
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `${prefix}-${stamp}.sqlite`;
  await run(db, 'VACUUM INTO ?', [path.join(backupDir, file)]);
  return file;
}

async function ensureDailyBackup(retention = 10) {
  fs.mkdirSync(backupDir, { recursive: true });
  const day = new Date().toISOString().slice(0, 10);
  const existing = fs.readdirSync(backupDir).find((name) => name.startsWith(`auto-${day}`));
  if (!existing) await createBackup(`auto-${day}`);

  const files = fs.readdirSync(backupDir)
    .filter((name) => name.endsWith('.sqlite'))
    .map((name) => ({ name, time: fs.statSync(path.join(backupDir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  files.slice(retention).forEach(({ name }) => fs.rmSync(path.join(backupDir, name)));
}

function safeBackupPath(name) {
  const normalized = path.basename(String(name || ''));
  if (!normalized.endsWith('.sqlite') || normalized !== name) throw httpError(400, 'Nombre de respaldo inválido.');
  const filePath = path.join(backupDir, normalized);
  if (!fs.existsSync(filePath)) throw httpError(404, 'Respaldo no encontrado.');
  return filePath;
}

async function validateBackup(name) {
  const source = safeBackupPath(name);
  const sqlite3 = require('sqlite3').verbose();
  const candidate = new sqlite3.Database(source, sqlite3.OPEN_READONLY);
  const tables = await new Promise((resolve, reject) => {
    candidate.all(
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name IN ('users', 'simulations', 'production_orders', 'schema_migrations')`,
      [],
      (error, rows) => error ? reject(error) : resolve(rows)
    );
  }).finally(() => new Promise((resolve) => candidate.close(resolve)));
  if (tables.length < 4) throw httpError(400, 'El archivo no es un respaldo válido de Sistema Andon.');
  return source;
}

async function scheduleRestore(name) {
  const source = await validateBackup(name);
  const safetyBackup = await createBackup('pre-restore');
  const databasePath = path.resolve(__dirname, '../../../', config.database.path);
  const pendingPath = `${databasePath}.restore-pending`;
  const markerPath = `${databasePath}.restore.json`;
  fs.copyFileSync(source, pendingPath);
  fs.writeFileSync(markerPath, JSON.stringify({
    requested_at: new Date().toISOString(),
    source_backup: path.basename(source),
    safety_backup: safetyBackup
  }, null, 2));
  return { source_backup: path.basename(source), safety_backup: safetyBackup, restart_required: true };
}

function listBackups() {
  fs.mkdirSync(backupDir, { recursive: true });
  return fs.readdirSync(backupDir)
    .filter((name) => name.endsWith('.sqlite'))
    .map((name) => {
      const stats = fs.statSync(path.join(backupDir, name));
      return { name, size: stats.size, created_at: stats.birthtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

module.exports = { createBackup, ensureDailyBackup, listBackups, scheduleRestore, validateBackup };
