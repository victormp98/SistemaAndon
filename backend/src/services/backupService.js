const fs = require('fs');
const path = require('path');
const db = require('../database/connection');
const { run } = require('../database/dbUtils');

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

module.exports = { createBackup, ensureDailyBackup, listBackups };
