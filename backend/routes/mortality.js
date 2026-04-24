const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mortality_stats ORDER BY report_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mortality_stats WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { region, cause_of_death, age_group, gender, count, population, rate_per_100k, report_date, trend } = req.body;
    const result = await pool.query(
      `INSERT INTO mortality_stats (region, cause_of_death, age_group, gender, count, population, rate_per_100k, report_date, trend)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [region, cause_of_death, age_group, gender, count, population, rate_per_100k, report_date, trend]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { region, cause_of_death, age_group, gender, count, population, rate_per_100k, report_date, trend } = req.body;
    const result = await pool.query(
      `UPDATE mortality_stats SET region=$1, cause_of_death=$2, age_group=$3, gender=$4, count=$5, population=$6, rate_per_100k=$7, report_date=$8, trend=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [region, cause_of_death, age_group, gender, count, population, rate_per_100k, report_date, trend, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM mortality_stats WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mortality_stats WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are a mortality and vital statistics AI analyst. Analyze mortality data, identify trends, detect anomalies, and provide public health recommendations.',
      `Analyze this mortality record:\nRegion: ${item.region}\nCause: ${item.cause_of_death}\nAge Group: ${item.age_group}\nGender: ${item.gender}\nCount: ${item.count}\nPopulation: ${item.population}\nRate/100k: ${item.rate_per_100k}\nTrend: ${item.trend}`
    );
    res.json({ analysis, mortality: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/trend-analysis', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mortality_stats ORDER BY report_date DESC');
    const analysis = await queryAI(
      'You are a mortality trend analysis AI. Identify mortality trends, excess deaths, and anomalies. Provide insights on leading causes and recommend public health interventions.',
      `Analyze mortality trends:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
