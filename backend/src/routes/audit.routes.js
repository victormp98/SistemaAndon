const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { requireProfessor } = require('../middleware/roleMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const auditService = require('../services/auditService');

const router = express.Router();
router.use(authMiddleware, requireProfessor);

router.get('/', asyncHandler(async (req, res) => {
  const logs = await auditService.list({
    userId: req.query.user_id,
    action: req.query.action,
    simulationId: req.query.simulation_id,
    from: req.query.from,
    to: req.query.to,
    limit: req.query.limit,
    ownerId: req.user.is_admin ? null : req.user.id
  });
  res.json({ ok: true, logs });
}));

module.exports = router;
