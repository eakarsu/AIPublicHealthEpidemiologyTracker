const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');



router.get('/', async (req, res) => {
  if (req.query.format === 'csv') {
    try {
      const result = await pool.query('SELECT * FROM water_quality ORDER BY sample_date DESC');
      const rows = result.rows;
      if (!rows.length) return res.status(204).send();
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="water_quality.csv"`);
      return res.send(csv);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      pool.query('SELECT * FROM water_quality ORDER BY sample_date DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM water_quality'),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM water_quality WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { source_name, location, ph_level, turbidity, contaminant, contaminant_level, safe_limit, status, sample_date } = req.body;
    const result = await pool.query(
      `INSERT INTO water_quality (source_name, location, ph_level, turbidity, contaminant, contaminant_level, safe_limit, status, sample_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [source_name, location, ph_level, turbidity, contaminant, contaminant_level, safe_limit, status, sample_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { source_name, location, ph_level, turbidity, contaminant, contaminant_level, safe_limit, status, sample_date } = req.body;
    const result = await pool.query(
      `UPDATE water_quality SET source_name=$1, location=$2, ph_level=$3, turbidity=$4, contaminant=$5, contaminant_level=$6, safe_limit=$7, status=$8, sample_date=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [source_name, location, ph_level, turbidity, contaminant, contaminant_level, safe_limit, status, sample_date, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM water_quality WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM water_quality WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are a water quality and environmental health AI. Analyze water quality data, assess contamination risks, and recommend remediation actions.',
      `Analyze this water quality sample:\nSource: ${item.source_name}\nLocation: ${item.location}\npH: ${item.ph_level}\nTurbidity: ${item.turbidity}\nContaminant: ${item.contaminant}\nLevel: ${item.contaminant_level}\nSafe Limit: ${item.safe_limit}\nStatus: ${item.status}`
    );
    await persistAI(req.user?.id, 'water_quality/ai', {}, analysis);
    res.json({ analysis, waterQuality: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/contamination-risk', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM water_quality ORDER BY sample_date DESC');
    const analysis = await queryAI(
      'You are a water contamination prediction AI. Analyze historical water quality data to predict contamination risks, identify vulnerable sources, and recommend preventive measures.',
      `Predict contamination risks from this data:\n${JSON.stringify(result.rows, null, 2)}`
    );
    await persistAI(req.user?.id, 'water_quality/ai', {}, analysis);
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
