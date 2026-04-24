const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM health_equity ORDER BY report_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM health_equity WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { indicator, region, demographic_group, value, benchmark, disparity_ratio, data_source, report_date, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO health_equity (indicator, region, demographic_group, value, benchmark, disparity_ratio, data_source, report_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [indicator, region, demographic_group, value, benchmark, disparity_ratio, data_source, report_date, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { indicator, region, demographic_group, value, benchmark, disparity_ratio, data_source, report_date, notes } = req.body;
    const result = await pool.query(
      `UPDATE health_equity SET indicator=$1, region=$2, demographic_group=$3, value=$4, benchmark=$5, disparity_ratio=$6, data_source=$7, report_date=$8, notes=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [indicator, region, demographic_group, value, benchmark, disparity_ratio, data_source, report_date, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM health_equity WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM health_equity WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are a health equity AI analyst. Analyze health disparities, identify root causes, and recommend evidence-based interventions to promote equity.',
      `Analyze this health equity indicator:\nIndicator: ${item.indicator}\nRegion: ${item.region}\nDemographic: ${item.demographic_group}\nValue: ${item.value}\nBenchmark: ${item.benchmark}\nDisparity Ratio: ${item.disparity_ratio}\nSource: ${item.data_source}\nNotes: ${item.notes}`
    );
    res.json({ analysis, equity: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/disparity-analysis', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM health_equity ORDER BY report_date DESC');
    const analysis = await queryAI(
      'You are a health equity and social determinants AI. Identify the most significant health disparities, their root causes, and recommend targeted policy interventions.',
      `Analyze health equity data for disparities:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
