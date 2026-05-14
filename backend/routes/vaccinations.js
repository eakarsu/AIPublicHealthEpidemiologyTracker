const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const router = express.Router();

const TABLE = 'vaccinations';
const ORDER = 'start_date';

router.get('/', async (req, res) => {
  if (req.query.format === 'csv') {
    try {
      const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY ${ORDER} DESC`);
      const rows = result.rows;
      if (!rows.length) return res.status(204).send();
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${TABLE}.csv"`);
      return res.send(csv);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ORDER BY ${ORDER} DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider } = req.body;
    const result = await pool.query(
      `INSERT INTO ${TABLE} (vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider } = req.body;
    const result = await pool.query(
      `UPDATE ${TABLE} SET vaccine_name=$1, target_disease=$2, region=$3, doses_administered=$4, target_population=$5, coverage_pct=$6, start_date=$7, status=$8, provider=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(`DELETE FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const vax = result.rows[0];
    const analysis = await queryAI(
      'You are a vaccination strategy AI expert. Analyze vaccination campaigns and provide insights on coverage optimization, supply chain, and equity considerations.',
      `Analyze this vaccination campaign:\nVaccine: ${vax.vaccine_name}\nTarget Disease: ${vax.target_disease}\nRegion: ${vax.region}\nDoses: ${vax.doses_administered}\nTarget Pop: ${vax.target_population}\nCoverage: ${vax.coverage_pct}%\nStatus: ${vax.status}`
    );
    await persistAI(req.user?.id, `${TABLE}/ai-analyze`, { id: req.params.id }, analysis);
    res.json({ analysis, vaccination: vax });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

router.post('/ai/optimize-distribution', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY ${ORDER} DESC`);
    const analysis = await queryAI(
      'You are a vaccination logistics AI. Optimize vaccine distribution strategies across regions. Consider population demographics, cold chain logistics, and equity.',
      `Optimize distribution for these campaigns:\n${JSON.stringify(result.rows, null, 2)}`
    );
    await persistAI(req.user?.id, `${TABLE}/optimize-distribution`, { count: result.rows.length }, analysis);
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

module.exports = router;
