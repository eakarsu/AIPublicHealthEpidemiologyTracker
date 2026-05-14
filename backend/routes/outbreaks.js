const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const TABLE = 'outbreaks';

// GET / with pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ORDER BY reported_date DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET one
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET export CSV
router.get('/export', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY reported_date DESC`);
    const rows = result.rows;
    if (rows.length === 0) return res.status(204).send();
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${TABLE}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create with validation
router.post('/', auth, [
  body('disease_name').trim().notEmpty(),
  body('location').trim().notEmpty(),
  body('cases_count').isInt({ min: 0 }),
  body('deaths_count').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['Active', 'Contained', 'Monitoring']),
  body('severity').optional().isIn(['Low', 'Medium', 'High', 'Critical']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { disease_name, location, cases_count, deaths_count, status, severity, reported_date, description } = req.body;
    const result = await pool.query(
      `INSERT INTO ${TABLE} (disease_name, location, cases_count, deaths_count, status, severity, reported_date, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [disease_name, location, cases_count, deaths_count, status, severity, reported_date, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update with validation
router.put('/:id', auth, [
  body('disease_name').optional().trim().notEmpty(),
  body('cases_count').optional().isInt({ min: 0 }),
  body('deaths_count').optional().isInt({ min: 0 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const { disease_name, location, cases_count, deaths_count, status, severity, reported_date, description } = req.body;
    const result = await pool.query(
      `UPDATE ${TABLE} SET disease_name=$1, location=$2, cases_count=$3, deaths_count=$4, status=$5, severity=$6, reported_date=$7, description=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [disease_name, location, cases_count, deaths_count, status, severity, reported_date, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Analyze single outbreak
router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const outbreak = result.rows[0];
    const analysis = await queryAI(
      'You are an epidemiologist AI assistant. Analyze disease outbreaks and provide professional insights. Structure your response with clear sections: Risk Assessment, Spread Prediction, Recommended Interventions, and Resource Allocation.',
      `Analyze this outbreak:\nDisease: ${outbreak.disease_name}\nLocation: ${outbreak.location}\nCases: ${outbreak.cases_count}\nDeaths: ${outbreak.deaths_count}\nStatus: ${outbreak.status}\nSeverity: ${outbreak.severity}\nDescription: ${outbreak.description}`
    );
    await persistAI(req.user?.id, 'outbreaks/ai-analyze', { id: req.params.id, disease: outbreak.disease_name }, analysis);
    res.json({ analysis, outbreak });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

// AI: Predict spread
router.post('/ai/predict-spread', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY reported_date DESC LIMIT 20`);
    const analysis = await queryAI(
      'You are an epidemiologist AI. Analyze outbreak data and predict potential disease spread patterns. Provide geographic risk zones, timeline predictions, and containment recommendations.',
      `Analyze these recent outbreaks and predict spread patterns:\n${JSON.stringify(result.rows, null, 2)}`
    );
    await persistAI(req.user?.id, 'outbreaks/predict-spread', { count: result.rows.length }, analysis);
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

// AI: Intervention recommendation for an outbreak
router.post('/:id/ai-intervention', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const outbreak = result.rows[0];

    const analysis = await queryAI(
      'You are a public-health intervention AI. Recommend evidence-based public-health interventions ranked by expected impact, feasibility, and equity. Return JSON only.',
      `Outbreak:
Disease: ${outbreak.disease_name}
Location: ${outbreak.location}
Cases: ${outbreak.cases_count}
Deaths: ${outbreak.deaths_count}
Status: ${outbreak.status}
Severity: ${outbreak.severity}
Description: ${outbreak.description || 'n/a'}

Return JSON only:
{
  "ranked_interventions": [{"intervention": "string", "evidence_strength": "low|moderate|strong", "expected_impact": "string", "feasibility": "low|moderate|high", "equity_considerations": "string", "estimated_cost_tier": "low|medium|high", "timeframe": "string"}],
  "communication_messaging": ["string"],
  "monitoring_metrics": ["string"],
  "summary": "string"
}`
    );

    await persistAI(req.user?.id, 'outbreaks/intervention', { id: req.params.id, disease: outbreak.disease_name }, analysis);
    res.json({ analysis, outbreak });
  } catch (err) { res.status(500).json({ error: err.message || 'AI intervention failed' }); }
});

module.exports = router;
