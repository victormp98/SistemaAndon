const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireProfessor);

// --- LABORATORIES ---

// GET /api/laboratories
router.get('/', (req, res) => {
  const query = `
    SELECT l.*, 
      (SELECT COUNT(*) FROM production_lines WHERE laboratory_id = l.id) as line_count,
      (SELECT COUNT(*) FROM stations s JOIN production_lines pl ON s.line_id = pl.id WHERE pl.laboratory_id = l.id) as station_count
    FROM laboratories l
    ORDER BY l.name ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, laboratories: rows });
  });
});

// POST /api/laboratories
router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'Nombre de laboratorio requerido.' });

  const query = "INSERT INTO laboratories (name, description, created_by_user_id) VALUES (?, ?, ?)";
  db.run(query, [name, description, req.user.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.status(201).json({ ok: true, laboratory: { id: this.lastID, name, description, is_active: 1 } });
  });
});

// PUT /api/laboratories/:id
router.put('/:id', (req, res) => {
  const { name, description, is_active } = req.body;
  const query = "UPDATE laboratories SET name = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
  db.run(query, [name, description, is_active, req.params.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Laboratorio no encontrado.' });
    res.json({ ok: true, message: 'Laboratorio actualizado.' });
  });
});

// PATCH /api/laboratories/:id/status
router.patch('/:id/status', (req, res) => {
  const { is_active } = req.body;
  const query = "UPDATE laboratories SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
  db.run(query, [is_active ? 1 : 0, req.params.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, message: 'Estado actualizado.' });
  });
});

// --- PRODUCTION LINES ---

// GET /api/laboratories/:labId/lines
router.get('/:labId/lines', (req, res) => {
  const query = "SELECT * FROM production_lines WHERE laboratory_id = ? ORDER BY sequence_order ASC, name ASC";
  db.all(query, [req.params.labId], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, lines: rows });
  });
});

// POST /api/laboratories/:labId/lines
router.post('/:labId/lines', (req, res) => {
  const { name, description, sequence_order } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'Nombre de línea requerido.' });

  const query = "INSERT INTO production_lines (laboratory_id, name, description, sequence_order) VALUES (?, ?, ?, ?)";
  db.run(query, [req.params.labId, name, description, sequence_order || 0], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.status(201).json({ ok: true, line: { id: this.lastID, name, description, sequence_order } });
  });
});

// PUT /api/lines/:id
router.put('/lines/:id', (req, res) => {
  const { name, description, sequence_order, is_active } = req.body;
  const query = "UPDATE production_lines SET name = ?, description = ?, sequence_order = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
  db.run(query, [name, description, sequence_order, is_active, req.params.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, message: 'Línea actualizada.' });
  });
});

// PATCH /api/lines/:id/status
router.patch('/lines/:id/status', (req, res) => {
  const { is_active } = req.body;
  const query = "UPDATE production_lines SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
  db.run(query, [is_active ? 1 : 0, req.params.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, message: 'Estado de línea actualizado.' });
  });
});

// --- STATIONS ---

// GET /api/lines/:lineId/stations
router.get('/lines/:lineId/stations', (req, res) => {
  const query = "SELECT * FROM stations WHERE line_id = ? ORDER BY sequence_order ASC, name ASC";
  db.all(query, [req.params.lineId], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, stations: rows });
  });
});

// POST /api/lines/:lineId/stations
router.post('/lines/:lineId/stations', (req, res) => {
  const { name, description, instructions, sequence_order, target_cycle_time_seconds, allows_defects, allows_downtime } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'Nombre de estación requerido.' });

  const query = `
    INSERT INTO stations (line_id, name, description, instructions, sequence_order, target_cycle_time_seconds, allows_defects, allows_downtime) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.run(query, [
    req.params.lineId, 
    name, 
    description, 
    instructions, 
    sequence_order || 0, 
    target_cycle_time_seconds || 0, 
    allows_defects ? 1 : 0, 
    allows_downtime ? 1 : 0
  ], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.status(201).json({ ok: true, station: { id: this.lastID, name } });
  });
});

// PUT /api/stations/:id
router.put('/stations/:id', (req, res) => {
  const { name, description, instructions, sequence_order, target_cycle_time_seconds, allows_defects, allows_downtime, is_active } = req.body;
  const query = `
    UPDATE stations SET 
      name = ?, description = ?, instructions = ?, sequence_order = ?, 
      target_cycle_time_seconds = ?, allows_defects = ?, allows_downtime = ?, 
      is_active = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `;
  db.run(query, [
    name, description, instructions, sequence_order, 
    target_cycle_time_seconds, allows_defects ? 1 : 0, allows_downtime ? 1 : 0, 
    is_active, req.params.id
  ], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, message: 'Estación actualizada.' });
  });
});

// PATCH /api/stations/:id/status
router.patch('/stations/:id/status', (req, res) => {
  const { is_active } = req.body;
  const query = "UPDATE stations SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
  db.run(query, [is_active ? 1 : 0, req.params.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, message: 'Estado de estación actualizado.' });
  });
});

module.exports = router;
