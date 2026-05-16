const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const config = require('../config/appConfig');
const { initSchema, seedInitialAdmin } = require('./schema');

const dbPath = path.join(__dirname, '../../../', config.database.path);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database at:', dbPath);
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(async () => {
    // 1. Create a basic metadata table as requested
    db.run(`CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    )`, (err) => {
      if (err) {
        console.error('Error creating app_metadata table:', err.message);
      } else {
        db.run(`INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('version', '1.0.0')`);
        db.run(`INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('initialized_at', ?)`, [new Date().toISOString()]);
        
        // 2. Initialize the full schema and seed data
        initSchema(db)
          .then(() => {
            console.log('Database schema initialized successfully.');
            return seedInitialAdmin(db);
          })
          .then(() => {
            console.log('Database ready.');
          })
          .catch((schemaErr) => {
            console.error('Error initializing database:', schemaErr);
          });
      }
    });
  });
}

module.exports = db;
