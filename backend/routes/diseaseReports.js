const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disease_reports ORDER BY report_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disease_reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { disease_name, icd_code, reporting_facility, patient_age, patient_gender, diagnosis_date, report_date, severity, lab_confirmed, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO disease_reports (disease_name, icd_code, reporting_facility, patient_age, patient_gender, diagnosis_date, report_date, severity, lab_confirmed, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [disease_name, icd_code, reporting_facility, patient_age, patient_gender, diagnosis_date, report_date, severity, lab_confirmed, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { disease_name, icd_code, reporting_facility, patient_age, patient_gender, diagnosis_date, report_date, severity, lab_confirmed, notes } = req.body;
    const result = await pool.query(
      `UPDATE disease_reports SET disease_name=$1, icd_code=$2, reporting_facility=$3, patient_age=$4, patient_gender=$5, diagnosis_date=$6, report_date=$7, severity=$8, lab_confirmed=$9, notes=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [disease_name, icd_code, reporting_facility, patient_age, patient_gender, diagnosis_date, report_date, severity, lab_confirmed, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM disease_reports WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disease_reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are an infectious disease classification AI. Classify disease reports, assess severity, and provide clinical and public health recommendations.',
      `Analyze this disease report:\nDisease: ${item.disease_name}\nICD Code: ${item.icd_code}\nFacility: ${item.reporting_facility}\nPatient Age: ${item.patient_age}\nGender: ${item.patient_gender}\nSeverity: ${item.severity}\nLab Confirmed: ${item.lab_confirmed}\nNotes: ${item.notes}`
    );
    res.json({ analysis, report: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classification', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disease_reports ORDER BY report_date DESC');
    const analysis = await queryAI(
      'You are a disease classification and surveillance AI. Classify reported diseases by urgency, identify clusters, and recommend reporting priorities.',
      `Classify and analyze these disease reports:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
