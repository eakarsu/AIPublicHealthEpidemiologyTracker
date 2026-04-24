const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM syndromic_surveillance ORDER BY report_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM syndromic_surveillance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { syndrome, facility, region, case_count, baseline_count, alert_level, report_date, symptoms_description, age_group } = req.body;
    const result = await pool.query(
      `INSERT INTO syndromic_surveillance (syndrome, facility, region, case_count, baseline_count, alert_level, report_date, symptoms_description, age_group)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [syndrome, facility, region, case_count, baseline_count, alert_level, report_date, symptoms_description, age_group]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { syndrome, facility, region, case_count, baseline_count, alert_level, report_date, symptoms_description, age_group } = req.body;
    const result = await pool.query(
      `UPDATE syndromic_surveillance SET syndrome=$1, facility=$2, region=$3, case_count=$4, baseline_count=$5, alert_level=$6, report_date=$7, symptoms_description=$8, age_group=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [syndrome, facility, region, case_count, baseline_count, alert_level, report_date, symptoms_description, age_group, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM syndromic_surveillance WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM syndromic_surveillance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are a syndromic surveillance AI. Analyze symptom patterns, detect anomalies, and provide early warning assessments for potential outbreaks.',
      `Analyze this surveillance report:\nSyndrome: ${item.syndrome}\nFacility: ${item.facility}\nRegion: ${item.region}\nCases: ${item.case_count}\nBaseline: ${item.baseline_count}\nAlert Level: ${item.alert_level}\nSymptoms: ${item.symptoms_description}\nAge Group: ${item.age_group}`
    );
    res.json({ analysis, surveillance: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/early-warning', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM syndromic_surveillance ORDER BY report_date DESC');
    const analysis = await queryAI(
      'You are an early warning detection AI. Analyze syndromic surveillance data to identify emerging threats, unusual patterns, and potential outbreaks requiring immediate attention.',
      `Analyze surveillance data for early warnings:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
