const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const config = require('../config/appConfig');
const { initSchema, seedInitialAdmin } = require('./schema');
const { run } = require('./dbUtils');

const dbPath = path.resolve(__dirname, '../../../', config.database.path);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath);

const ready = (async () => {
  await run(db, 'PRAGMA foreign_keys = ON');
  await run(db, 'PRAGMA journal_mode = WAL');
  await run(db, 'PRAGMA busy_timeout = 5000');
  await run(db, 'PRAGMA synchronous = NORMAL');
  await initSchema(db);
  await seedInitialAdmin(db);
  return db;
})().catch((error) => {
  console.error('Database initialization failed:', error);
  throw error;
});

db.ready = ready;
db.path = dbPath;

module.exports = db;
