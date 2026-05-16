const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');

router.use(authMiddleware);
router.use(requireProfessor);

/**
 * GET /api/simulations
 * List simulations with participant count and lab name
 */
router.get('/', (req, res) => {
  const query = `
    SELECT s.*, l.name as laboratory_name,
      (SELECT COUNT(*) FROM simulation_participants WHERE simulation_id = s.id) as participant_count
    FROM simulations s
    JOIN laboratories l ON s.laboratory_id = l.id
    ORDER BY s.created_at DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, simulations: rows });
  });
});

/**
 * GET /api/simulations/:id
 * Detail of a simulation with participants
 */
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  const simQuery = `
    SELECT s.*, l.name as laboratory_name 
    FROM simulations s 
    JOIN laboratories l ON s.laboratory_id = l.id 
    WHERE s.id = ?
  `;
  
  db.get(simQuery, [id], (err, simulation) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!simulation) return res.status(404).json({ ok: false, error: 'Simulación no encontrada.' });

    const participantsQuery = `
      SELECT p.*, u.name as user_name, u.username, 
             pl.name as line_name, st.name as station_name
      FROM simulation_participants p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN production_lines pl ON p.line_id = pl.id
      LEFT JOIN stations st ON p.station_id = st.id
      WHERE p.simulation_id = ?
    `;

    db.all(participantsQuery, [id], (err, participants) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, simulation, participants });
    });
  });
});

/**
 * POST /api/simulations
 * Create a new simulation in draft state
 */
router.post('/', (req, res) => {
  const { laboratory_id, name, description, planned_duration_minutes } = req.body;
  
  if (!laboratory_id || !name) {
    return res.status(400).json({ ok: false, error: 'Laboratorio y nombre requeridos.' });
  }

  const query = `
    INSERT INTO simulations (laboratory_id, name, description, planned_duration_minutes, created_by_user_id, status) 
    VALUES (?, ?, ?, ?, ?, 'draft')
  `;
  
  db.run(query, [laboratory_id, name, description, planned_duration_minutes, req.user.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.status(201).json({ ok: true, simulationId: this.lastID });
  });
});

/**
 * PUT /api/simulations/:id
 * Update basic simulation data (only if draft)
 */
router.put('/:id', (req, res) => {
  const { name, description, planned_duration_minutes, status } = req.body;
  
  db.get("SELECT status FROM simulations WHERE id = ?", [req.params.id], (err, sim) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    if (!sim) return res.status(404).json({ ok: false, error: 'Simulación no encontrada.' });
    if (sim.status !== 'draft') {
      return res.status(400).json({ ok: false, error: 'Solo se pueden editar simulaciones en estado borrador.' });
    }

    const query = `
      UPDATE simulations 
      SET name = ?, description = ?, planned_duration_minutes = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    db.run(query, [name, description, planned_duration_minutes, status || 'draft', req.params.id], function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      res.json({ ok: true, message: 'Simulación actualizada.' });
    });
  });
});

/**
 * PATCH /api/simulations/:id/status
 * Change simulation status
 */
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['draft', 'cancelled'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Estado no permitido en esta etapa.' });
  }

  const query = "UPDATE simulations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?";
  db.run(query, [status, req.params.id], function(err) {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true, message: `Simulación ${status === 'cancelled' ? 'cancelada' : 'actualizada'}.` });
  });
});

/**
 * POST /api/simulations/:id/participants
 * Add or update a participant
 */
router.post('/:id/participants', (req, res) => {
  const { user_id, simulation_role, line_id, station_id } = req.body;
  const simulation_id = req.params.id;

  if (!user_id || !simulation_role) {
    return res.status(400).json({ ok: false, error: 'Usuario y rol requeridos.' });
  }

  // Validate simulation state
  db.get("SELECT status FROM simulations WHERE id = ?", [simulation_id], (err, sim) => {
    if (err || !sim) return res.status(404).json({ ok: false, error: 'Simulación no encontrada.' });
    if (sim.status !== 'draft') return res.status(400).json({ ok: false, error: 'No se pueden modificar participantes en este estado.' });

    // Validate station exclusivity for operators
    if (simulation_role === 'operator' && station_id) {
      const checkStation = "SELECT id FROM simulation_participants WHERE simulation_id = ? AND station_id = ? AND user_id != ?";
      db.get(checkStation, [simulation_id, station_id, user_id], (err, row) => {
        if (err) return res.status(500).json({ ok: false, error: err.message });
        if (row) return res.status(400).json({ ok: false, error: 'Esta estación ya tiene un operador asignado.' });
        
        upsertParticipant();
      });
    } else {
      upsertParticipant();
    }
  });

  function upsertParticipant() {
    // Check if participant already exists in this simulation
    db.get("SELECT id FROM simulation_participants WHERE simulation_id = ? AND user_id = ?", [simulation_id, user_id], (err, row) => {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      
      if (row) {
        // Update
        const query = `
          UPDATE simulation_participants 
          SET simulation_role = ?, line_id = ?, station_id = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;
        db.run(query, [simulation_role, line_id || null, station_id || null, row.id], function(err) {
          if (err) return res.status(500).json({ ok: false, error: err.message });
          res.json({ ok: true, message: 'Participante actualizado.' });
        });
      } else {
        // Insert
        const query = `
          INSERT INTO simulation_participants (simulation_id, user_id, simulation_role, line_id, station_id) 
          VALUES (?, ?, ?, ?, ?)
        `;
        db.run(query, [simulation_id, user_id, simulation_role, line_id || null, station_id || null], function(err) {
          if (err) return res.status(500).json({ ok: false, error: err.message });
          res.status(201).json({ ok: true, participantId: this.lastID });
        });
      }
    });
  }
});

/**
 * DELETE /api/simulations/:id/participants/:participantId
 * Remove a participant from a draft simulation
 */
router.delete('/:id/participants/:participantId', (req, res) => {
  const simulation_id = req.params.id;
  const participant_id = req.params.participantId;

  db.get("SELECT status FROM simulations WHERE id = ?", [simulation_id], (err, sim) => {
    if (err || !sim) return res.status(404).json({ ok: false, error: 'Simulación no encontrada.' });
    if (sim.status !== 'draft') return res.status(400).json({ ok: false, error: 'No se pueden quitar participantes en este estado.' });

    db.run("DELETE FROM simulation_participants WHERE id = ? AND simulation_id = ?", [participant_id, simulation_id], function(err) {
      if (err) return res.status(500).json({ ok: false, error: err.message });
      if (this.changes === 0) return res.status(404).json({ ok: false, error: 'Participante no encontrado.' });
      res.json({ ok: true, message: 'Participante removido.' });
    });
  });
});

module.exports = router;
