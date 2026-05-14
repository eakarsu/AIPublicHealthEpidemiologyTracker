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
      const result = await pool.query('SELECT * FROM antimicrobial_resistance ORDER BY test_date DESC');
      const rows = result.rows;
      if (!rows.length) return res.status(204).send();
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="antimicrobial_resistance.csv"`);
      return res.send(csv);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      pool.query('SELECT * FROM antimicrobial_resistance ORDER BY test_date DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM antimicrobial_resistance'),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antimicrobial_resistance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { organism, antibiotic, resistance_pattern, facility, specimen_type, mic_value, interpretation, test_date, patient_age } = req.body;
    const result = await pool.query(
      `INSERT INTO antimicrobial_resistance (organism, antibiotic, resistance_pattern, facility, specimen_type, mic_value, interpretation, test_date, patient_age)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [organism, antibiotic, resistance_pattern, facility, specimen_type, mic_value, interpretation, test_date, patient_age]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { organism, antibiotic, resistance_pattern, facility, specimen_type, mic_value, interpretation, test_date, patient_age } = req.body;
    const result = await pool.query(
      `UPDATE antimicrobial_resistance SET organism=$1, antibiotic=$2, resistance_pattern=$3, facility=$4, specimen_type=$5, mic_value=$6, interpretation=$7, test_date=$8, patient_age=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [organism, antibiotic, resistance_pattern, facility, specimen_type, mic_value, interpretation, test_date, patient_age, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM antimicrobial_resistance WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antimicrobial_resistance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are an antimicrobial resistance (AMR) AI expert. Analyze resistance patterns, recommend alternative treatments, and assess stewardship implications.',
      `Analyze this AMR result:\nOrganism: ${item.organism}\nAntibiotic: ${item.antibiotic}\nResistance Pattern: ${item.resistance_pattern}\nFacility: ${item.facility}\nSpecimen: ${item.specimen_type}\nMIC: ${item.mic_value}\nInterpretation: ${item.interpretation}`
    );
    await persistAI(req.user?.id, 'antimicrobial_resistance/ai', {}, analysis);
    res.json({ analysis, amr: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/resistance-trends', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antimicrobial_resistance ORDER BY test_date DESC');
    const analysis = await queryAI(
      'You are an AMR surveillance AI. Identify resistance trends, emerging multi-drug resistant organisms, and recommend antimicrobial stewardship interventions.',
      `Analyze AMR trends:\n${JSON.stringify(result.rows, null, 2)}`
    );
    await persistAI(req.user?.id, 'antimicrobial_resistance/ai', {}, analysis);
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
