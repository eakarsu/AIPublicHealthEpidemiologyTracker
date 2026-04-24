const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antimicrobial_resistance ORDER BY test_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antimicrobial_resistance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
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

router.put('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM antimicrobial_resistance WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antimicrobial_resistance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are an antimicrobial resistance (AMR) AI expert. Analyze resistance patterns, recommend alternative treatments, and assess stewardship implications.',
      `Analyze this AMR result:\nOrganism: ${item.organism}\nAntibiotic: ${item.antibiotic}\nResistance Pattern: ${item.resistance_pattern}\nFacility: ${item.facility}\nSpecimen: ${item.specimen_type}\nMIC: ${item.mic_value}\nInterpretation: ${item.interpretation}`
    );
    res.json({ analysis, amr: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/resistance-trends', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM antimicrobial_resistance ORDER BY test_date DESC');
    const analysis = await queryAI(
      'You are an AMR surveillance AI. Identify resistance trends, emerging multi-drug resistant organisms, and recommend antimicrobial stewardship interventions.',
      `Analyze AMR trends:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
