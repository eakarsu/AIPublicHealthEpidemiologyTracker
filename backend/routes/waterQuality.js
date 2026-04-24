const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM water_quality ORDER BY sample_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM water_quality WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
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

router.put('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM water_quality WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM water_quality WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are a water quality and environmental health AI. Analyze water quality data, assess contamination risks, and recommend remediation actions.',
      `Analyze this water quality sample:\nSource: ${item.source_name}\nLocation: ${item.location}\npH: ${item.ph_level}\nTurbidity: ${item.turbidity}\nContaminant: ${item.contaminant}\nLevel: ${item.contaminant_level}\nSafe Limit: ${item.safe_limit}\nStatus: ${item.status}`
    );
    res.json({ analysis, waterQuality: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/contamination-risk', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM water_quality ORDER BY sample_date DESC');
    const analysis = await queryAI(
      'You are a water contamination prediction AI. Analyze historical water quality data to predict contamination risks, identify vulnerable sources, and recommend preventive measures.',
      `Predict contamination risks from this data:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
