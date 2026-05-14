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
      const result = await pool.query('SELECT * FROM syndromic_surveillance ORDER BY report_date DESC');
      const rows = result.rows;
      if (!rows.length) return res.status(204).send();
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="syndromic_surveillance.csv"`);
      return res.send(csv);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      pool.query('SELECT * FROM syndromic_surveillance ORDER BY report_date DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM syndromic_surveillance'),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM syndromic_surveillance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
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

router.put('/:id', auth, async (req, res) => {
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

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM syndromic_surveillance WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM syndromic_surveillance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are a syndromic surveillance AI. Analyze symptom patterns, detect anomalies, and provide early warning assessments for potential outbreaks.',
      `Analyze this surveillance report:\nSyndrome: ${item.syndrome}\nFacility: ${item.facility}\nRegion: ${item.region}\nCases: ${item.case_count}\nBaseline: ${item.baseline_count}\nAlert Level: ${item.alert_level}\nSymptoms: ${item.symptoms_description}\nAge Group: ${item.age_group}`
    );
    await persistAI(req.user?.id, 'syndromic_surveillance/ai', {}, analysis);
    res.json({ analysis, surveillance: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/early-warning', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM syndromic_surveillance ORDER BY report_date DESC');
    const analysis = await queryAI(
      'You are an early warning detection AI. Analyze syndromic surveillance data to identify emerging threats, unusual patterns, and potential outbreaks requiring immediate attention.',
      `Analyze surveillance data for early warnings:\n${JSON.stringify(result.rows, null, 2)}`
    );
    await persistAI(req.user?.id, 'syndromic_surveillance/ai', {}, analysis);
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/syndromic-surveillance/ai/case-clustering — anomaly detection in spatial/temporal patterns
router.post('/ai/case-clustering', auth, aiRateLimiter, async (req, res) => {
  try {
    const { window_days, region } = req.body;
    const days = Math.min(Math.max(parseInt(window_days || 30, 10), 1), 365);

    const params = [];
    let where = `WHERE report_date >= CURRENT_DATE - INTERVAL '${days} days'`;
    if (region) {
      params.push(region);
      where += ` AND region = $1`;
    }
    const result = await pool.query(
      `SELECT id, region, syndrome, report_date, count, geo_lat, geo_lng FROM syndromic_surveillance ${where} ORDER BY report_date DESC LIMIT 1000`,
      params
    );

    const analysis = await queryAI(
      'You are a public-health spatiotemporal-clustering AI. Identify likely clusters from syndromic surveillance reports, score each by suspicion, and recommend public-health responses. Return JSON only.',
      `Window: last ${days} days
Region filter: ${region || 'all'}
Reports (${result.rows.length}):
${JSON.stringify(result.rows).slice(0, 12000)}

Return JSON only:
{
  "clusters": [{"region": "string", "syndrome": "string", "suspicion_score": 0, "case_count": 0, "time_window": "string", "spatial_radius_estimate_km": 0, "rationale": "string", "recommended_response": "string"}],
  "non_clustered_signal": [{"region": "string", "syndrome": "string", "note": "string"}],
  "summary": "string"
}`
    );

    await persistAI(req.user?.id, 'syndromic_surveillance/case-clustering', { window_days: days, region }, analysis);
    res.json({ analysis, reports_analyzed: result.rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
