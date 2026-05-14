const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// GET /api/alerts/subscriptions
router.get('/subscriptions', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM alert_subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/subscriptions
router.post('/subscriptions', auth, [
  body('feature').trim().notEmpty().withMessage('Feature is required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { feature, threshold_field, threshold_value, email } = req.body;
    const result = await pool.query(
      `INSERT INTO alert_subscriptions (user_id, feature, threshold_field, threshold_value, email)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user.id, feature, threshold_field || null, threshold_value || null, email || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/alerts/subscriptions/:id
router.delete('/subscriptions/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM alert_subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ message: 'Subscription deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
