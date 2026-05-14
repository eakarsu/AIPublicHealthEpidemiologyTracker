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
      const result = await pool.query('SELECT * FROM contact_tracing ORDER BY exposure_date DESC');
      const rows = result.rows;
      if (!rows.length) return res.status(204).send();
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="contact_tracing.csv"`);
      return res.send(csv);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      pool.query('SELECT * FROM contact_tracing ORDER BY exposure_date DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM contact_tracing'),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contact_tracing WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { case_id, contact_name, relationship, exposure_date, exposure_location, risk_level, status, symptoms, phone } = req.body;
    const result = await pool.query(
      `INSERT INTO contact_tracing (case_id, contact_name, relationship, exposure_date, exposure_location, risk_level, status, symptoms, phone)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [case_id, contact_name, relationship, exposure_date, exposure_location, risk_level, status, symptoms, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { case_id, contact_name, relationship, exposure_date, exposure_location, risk_level, status, symptoms, phone } = req.body;
    const result = await pool.query(
      `UPDATE contact_tracing SET case_id=$1, contact_name=$2, relationship=$3, exposure_date=$4, exposure_location=$5, risk_level=$6, status=$7, symptoms=$8, phone=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [case_id, contact_name, relationship, exposure_date, exposure_location, risk_level, status, symptoms, phone, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM contact_tracing WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contact_tracing WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const contact = result.rows[0];
    const analysis = await queryAI(
      'You are a contact tracing AI specialist. Assess exposure risk, recommend quarantine protocols, and suggest follow-up actions.',
      `Analyze this contact trace:\nCase ID: ${contact.case_id}\nContact: ${contact.contact_name}\nRelationship: ${contact.relationship}\nExposure Date: ${contact.exposure_date}\nLocation: ${contact.exposure_location}\nRisk Level: ${contact.risk_level}\nSymptoms: ${contact.symptoms}`
    );
    await persistAI(req.user?.id, 'contact_tracing/ai', {}, analysis);
    res.json({ analysis, contact });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/network-analysis', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contact_tracing ORDER BY exposure_date DESC');
    const analysis = await queryAI(
      'You are an epidemiological network analysis AI. Identify clusters, super-spreader events, and transmission chains from contact tracing data.',
      `Analyze this contact tracing network:\n${JSON.stringify(result.rows, null, 2)}`
    );
    await persistAI(req.user?.id, 'contact_tracing/ai', {}, analysis);
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
