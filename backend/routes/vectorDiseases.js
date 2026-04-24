const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vector_diseases ORDER BY report_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vector_diseases WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { disease_name, vector_type, location, cases_count, season, habitat_risk, control_measures, report_date, status } = req.body;
    const result = await pool.query(
      `INSERT INTO vector_diseases (disease_name, vector_type, location, cases_count, season, habitat_risk, control_measures, report_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [disease_name, vector_type, location, cases_count, season, habitat_risk, control_measures, report_date, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { disease_name, vector_type, location, cases_count, season, habitat_risk, control_measures, report_date, status } = req.body;
    const result = await pool.query(
      `UPDATE vector_diseases SET disease_name=$1, vector_type=$2, location=$3, cases_count=$4, season=$5, habitat_risk=$6, control_measures=$7, report_date=$8, status=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [disease_name, vector_type, location, cases_count, season, habitat_risk, control_measures, report_date, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM vector_diseases WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vector_diseases WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are a vector-borne disease AI specialist. Analyze vector disease data, assess habitat risks, and recommend vector control strategies.',
      `Analyze this vector-borne disease report:\nDisease: ${item.disease_name}\nVector: ${item.vector_type}\nLocation: ${item.location}\nCases: ${item.cases_count}\nSeason: ${item.season}\nHabitat Risk: ${item.habitat_risk}\nControl Measures: ${item.control_measures}\nStatus: ${item.status}`
    );
    res.json({ analysis, vectorDisease: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/habitat-risk', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vector_diseases ORDER BY report_date DESC');
    const analysis = await queryAI(
      'You are a vector ecology and habitat risk AI. Map vector habitats, predict seasonal risk, and recommend integrated vector management strategies.',
      `Analyze habitat risks from this data:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
