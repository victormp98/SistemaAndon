const express = require('express');
const router = express.Router();
const config = require('../config/appConfig');
const db = require('../database/connection');

router.get('/health', (req, res) => {
  // Check if DB is connected
  // Since sqlite3 doesn't have an easy "isConnected" property, 
  // we assume it's connected if the object exists and we can run a simple query.
  db.get('SELECT 1', [], (err) => {
    res.status(200).json({
      ok: true,
      service: config.app.name + " API",
      mode: config.app.mode,
      database: err ? "error" : "connected"
    });
  });
});

module.exports = router;
