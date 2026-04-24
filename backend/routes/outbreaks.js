const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

// Get all
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM outbreaks ORDER BY reported_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get one
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM outbreaks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create
router.post('/', async (req, res) => {
  try {
    const { disease_name, location, cases_count, deaths_count, status, severity, reported_date, description } = req.body;
    const result = await pool.query(
      `INSERT INTO outbreaks (disease_name, location, cases_count, deaths_count, status, severity, reported_date, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [disease_name, location, cases_count, deaths_count, status, severity, reported_date, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update
router.put('/:id', async (req, res) => {
  try {
    const { disease_name, location, cases_count, deaths_count, status, severity, reported_date, description } = req.body;
    const result = await pool.query(
      `UPDATE outbreaks SET disease_name=$1, location=$2, cases_count=$3, deaths_count=$4, status=$5, severity=$6, reported_date=$7, description=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [disease_name, location, cases_count, deaths_count, status, severity, reported_date, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM outbreaks WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Analyze outbreak
router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM outbreaks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const outbreak = result.rows[0];
    const analysis = await queryAI(
      'You are an epidemiologist AI assistant. Analyze disease outbreaks and provide professional insights. Structure your response with clear sections: Risk Assessment, Spread Prediction, Recommended Interventions, and Resource Allocation.',
      `Analyze this outbreak:\nDisease: ${outbreak.disease_name}\nLocation: ${outbreak.location}\nCases: ${outbreak.cases_count}\nDeaths: ${outbreak.deaths_count}\nStatus: ${outbreak.status}\nSeverity: ${outbreak.severity}\nDescription: ${outbreak.description}`
    );
    res.json({ analysis, outbreak });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// AI: Predict spread
router.post('/ai/predict-spread', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM outbreaks ORDER BY reported_date DESC LIMIT 20');
    const analysis = await queryAI(
      'You are an epidemiologist AI. Analyze outbreak data and predict potential disease spread patterns. Provide geographic risk zones, timeline predictions, and containment recommendations.',
      `Analyze these recent outbreaks and predict spread patterns:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
