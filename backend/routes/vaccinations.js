const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vaccinations ORDER BY start_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vaccinations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider } = req.body;
    const result = await pool.query(
      `INSERT INTO vaccinations (vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider } = req.body;
    const result = await pool.query(
      `UPDATE vaccinations SET vaccine_name=$1, target_disease=$2, region=$3, doses_administered=$4, target_population=$5, coverage_pct=$6, start_date=$7, status=$8, provider=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [vaccine_name, target_disease, region, doses_administered, target_population, coverage_pct, start_date, status, provider, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM vaccinations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vaccinations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const vax = result.rows[0];
    const analysis = await queryAI(
      'You are a vaccination strategy AI expert. Analyze vaccination campaigns and provide insights on coverage optimization, supply chain, and equity considerations.',
      `Analyze this vaccination campaign:\nVaccine: ${vax.vaccine_name}\nTarget Disease: ${vax.target_disease}\nRegion: ${vax.region}\nDoses: ${vax.doses_administered}\nTarget Pop: ${vax.target_population}\nCoverage: ${vax.coverage_pct}%\nStatus: ${vax.status}`
    );
    res.json({ analysis, vaccination: vax });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/optimize-distribution', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vaccinations ORDER BY start_date DESC');
    const analysis = await queryAI(
      'You are a vaccination logistics AI. Optimize vaccine distribution strategies across regions. Consider population demographics, cold chain logistics, and equity.',
      `Optimize distribution for these campaigns:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
