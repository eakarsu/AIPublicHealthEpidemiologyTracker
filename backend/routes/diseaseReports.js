const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');



router.get('/', async (req, res) => {
  if (req.query.format === 'csv') {
    try {
      const result = await pool.query('SELECT * FROM disease_reports ORDER BY report_date DESC');
      const rows = result.rows;
      if (!rows.length) return res.status(204).send();
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="disease_reports.csv"`);
      return res.send(csv);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      pool.query('SELECT * FROM disease_reports ORDER BY report_date DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM disease_reports'),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disease_reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
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

router.put('/:id', auth, async (req, res) => {
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

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM disease_reports WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disease_reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are an infectious disease classification AI. Classify disease reports, assess severity, and provide clinical and public health recommendations.',
      `Analyze this disease report:\nDisease: ${item.disease_name}\nICD Code: ${item.icd_code}\nFacility: ${item.reporting_facility}\nPatient Age: ${item.patient_age}\nGender: ${item.patient_gender}\nSeverity: ${item.severity}\nLab Confirmed: ${item.lab_confirmed}\nNotes: ${item.notes}`
    );
    await persistAI(req.user?.id, 'disease_reports/ai', {}, analysis);
    res.json({ analysis, report: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classification', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disease_reports ORDER BY report_date DESC');
    const analysis = await queryAI(
      'You are a disease classification and surveillance AI. Classify reported diseases by urgency, identify clusters, and recommend reporting priorities.',
      `Classify and analyze these disease reports:\n${JSON.stringify(result.rows, null, 2)}`
    );
    await persistAI(req.user?.id, 'disease_reports/ai', {}, analysis);
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
