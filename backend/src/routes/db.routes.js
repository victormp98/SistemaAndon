const express = require('express');
const router = express.Router();
const config = require('../config/appConfig');
const db = require('../database/connection');
const path = require('path');

router.get('/status', (req, res) => {
  const dbPath = path.resolve(__dirname, '../../../', config.database.path);

  // Query to get all tables
  const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        ok: false,
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }

    const tables = rows.map(row => row.name);

    res.status(200).json({
      ok: true,
      service: "Database Inspector",
      databasePath: dbPath,
      tables: tables,
      tableCount: tables.length,
      timestamp: new Date().toISOString()
    });
  });
});

module.exports = router;
