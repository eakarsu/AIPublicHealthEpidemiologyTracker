const express = require('express');
const pool = require('../db');
const { queryAI, parseAIJson } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const router = express.Router();

const TABLE = 'wastewater_signals';

// Ensure table exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      site_id VARCHAR(100),
      treatment_plant VARCHAR(200),
      region VARCHAR(200),
      sample_date DATE,
      pathogen VARCHAR(200),
      concentration NUMERIC,
      concentration_unit VARCHAR(50) DEFAULT 'copies/L',
      flow_rate NUMERIC,
      population_served INTEGER,
      pmmov_value NUMERIC,
      normalized_value NUMERIC,
      sample_quality_score NUMERIC,
      collection_method VARCHAR(100),
      lab_id VARCHAR(100),
      status VARCHAR(50) DEFAULT 'active',
      archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureTable().catch(e => console.error('wastewater_signals table init error:', e.message));

// ── CRUD ──────────────────────────────────────────────────────────────────────

// 1. GET / — list with pagination
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const where = req.query.status ? `WHERE status=$3` : '';
    const params = req.query.status ? [limit, offset, req.query.status] : [limit, offset];
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ${where} ORDER BY sample_date DESC LIMIT $1 OFFSET $2`, params),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} ${where}`, req.query.status ? [req.query.status] : []),
    ]);
    const total = parseInt(countRes.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. GET /count
router.get('/count', async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.region) { params.push(req.query.region); where.push(`region=$${params.length}`); }
    if (req.query.pathogen) { params.push(req.query.pathogen); where.push(`pathogen=$${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const result = await pool.query(`SELECT COUNT(*) FROM ${TABLE} ${clause}`, params);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. GET /search
router.get('/search', async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE treatment_plant ILIKE $1 OR pathogen ILIKE $1 OR region ILIKE $1 ORDER BY sample_date DESC LIMIT $2 OFFSET $3`, [q, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE treatment_plant ILIKE $1 OR pathogen ILIKE $1 OR region ILIKE $1`, [q]),
    ]);
    const total = parseInt(countRes.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. GET /by-region/:region
router.get('/by-region/:region', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE region=$1 ORDER BY sample_date DESC LIMIT $2 OFFSET $3`, [req.params.region, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE region=$1`, [req.params.region]),
    ]);
    const total = parseInt(countRes.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. GET /by-pathogen/:pathogen
router.get('/by-pathogen/:pathogen', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE pathogen=$1 ORDER BY sample_date DESC LIMIT $2 OFFSET $3`, [req.params.pathogen, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE pathogen=$1`, [req.params.pathogen]),
    ]);
    const total = parseInt(countRes.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. GET /export/csv
router.get('/export/csv', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY sample_date DESC`);
    const rows = result.rows;
    if (rows.length === 0) return res.status(204).send();
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${TABLE}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. GET /stats/summary
router.get('/stats/summary', async (req, res) => {
  try {
    const [byPathogen, byRegion, avgConc] = await Promise.all([
      pool.query(`SELECT pathogen, COUNT(*) as count, AVG(concentration) as avg_concentration FROM ${TABLE} GROUP BY pathogen ORDER BY count DESC`),
      pool.query(`SELECT region, COUNT(*) as count FROM ${TABLE} GROUP BY region ORDER BY count DESC`),
      pool.query(`SELECT AVG(concentration) as avg_concentration, MAX(concentration) as max_concentration, MIN(concentration) as min_concentration FROM ${TABLE}`),
    ]);
    res.json({ by_pathogen: byPathogen.rows, by_region: byRegion.rows, overall_stats: avgConc.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. POST /batch-create
router.post('/batch-create', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { site_id, treatment_plant, region, sample_date, pathogen, concentration, flow_rate, population_served, pmmov_value, normalized_value, sample_quality_score, collection_method, lab_id, notes } = item;
      const r = await pool.query(`INSERT INTO ${TABLE} (site_id, treatment_plant, region, sample_date, pathogen, concentration, flow_rate, population_served, pmmov_value, normalized_value, sample_quality_score, collection_method, lab_id, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [site_id, treatment_plant, region, sample_date, pathogen, concentration, flow_rate, population_served, pmmov_value, normalized_value, sample_quality_score, collection_method, lab_id, notes]);
      created.push(r.rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 9. PUT /batch-update
router.put('/batch-update', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const updated = [];
    for (const { id, ...fields } of items) {
      if (!id) continue;
      const keys = Object.keys(fields);
      if (keys.length === 0) continue;
      const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
      const vals = keys.map(k => fields[k]);
      vals.push(id);
      const r = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rows[0]) updated.push(r.rows[0]);
    }
    res.json({ data: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 10. DELETE /batch-delete
router.delete('/batch-delete', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    await pool.query(`UPDATE ${TABLE} SET status='deleted', updated_at=NOW() WHERE id=ANY($1)`, [ids]);
    res.json({ updated: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 11. POST /import/csv
router.post('/import/csv', auth, async (req, res) => {
  try {
    const { csv } = req.body;
    if (!csv) return res.status(400).json({ error: 'csv field required' });
    const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return res.status(400).json({ error: 'CSV must have header + at least one row' });
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const created = [];
    for (const line of lines.slice(1)) {
      const values = line.match(/(".*?"|[^,]+)/g) || [];
      const obj = {};
      headers.forEach((h, i) => { obj[h] = values[i] ? values[i].replace(/^"|"$/g, '').replace(/""/g, '"') : null; });
      const keys = Object.keys(obj).filter(k => obj[k] !== null);
      if (keys.length === 0) continue;
      const cols = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const r = await pool.query(`INSERT INTO ${TABLE} (${cols}) VALUES (${placeholders}) RETURNING *`, keys.map(k => obj[k]));
      created.push(r.rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 12. GET /:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE id=$1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 13. POST / — create
router.post('/', auth, async (req, res) => {
  try {
    const { site_id, treatment_plant, region, sample_date, pathogen, concentration, flow_rate, population_served, pmmov_value, normalized_value, sample_quality_score, collection_method, lab_id, notes } = req.body;
    const result = await pool.query(`INSERT INTO ${TABLE} (site_id, treatment_plant, region, sample_date, pathogen, concentration, flow_rate, population_served, pmmov_value, normalized_value, sample_quality_score, collection_method, lab_id, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [site_id, treatment_plant, region, sample_date, pathogen, concentration, flow_rate, population_served, pmmov_value, normalized_value, sample_quality_score, collection_method, lab_id, notes]);
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 14. PUT /:id — update
router.put('/:id', auth, async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
    const vals = keys.map(k => fields[k]);
    vals.push(req.params.id);
    const result = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 15. DELETE /:id — soft-delete
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`UPDATE ${TABLE} SET status='deleted', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 16. POST /:id/archive
router.post('/:id/archive', auth, async (req, res) => {
  try {
    const result = await pool.query(`UPDATE ${TABLE} SET archived=TRUE, updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 17. POST /:id/restore
router.post('/:id/restore', auth, async (req, res) => {
  try {
    const result = await pool.query(`UPDATE ${TABLE} SET archived=FALSE, status='active', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 18. GET /:id/history
router.get('/:id/history', async (req, res) => {
  try {
    const record = await pool.query(`SELECT * FROM ${TABLE} WHERE id=$1`, [req.params.id]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const logs = await pool.query(`SELECT * FROM ai_analyses WHERE endpoint ILIKE $1 ORDER BY created_at DESC LIMIT 50`, [`%wastewater%`]);
    res.json({ data: record.rows[0], history: logs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI VERBS ──────────────────────────────────────────────────────────────────

router.post('/ai/detect-signal-anomaly', auth, aiRateLimiter, async (req, res) => {
  try {
    const { signal_id, region, pathogen, recent_values } = req.body;
    const analysis = await queryAI('You are a wastewater epidemiologist. Detect anomalies in wastewater pathogen concentration signals. Return JSON only.', `Detect anomalies in this wastewater signal:\nSignal ID: ${signal_id}\nRegion: ${region}\nPathogen: ${pathogen}\nRecent values: ${JSON.stringify(recent_values)}\nReturn JSON: {"anomaly_detected": bool, "anomaly_type": "...", "severity": "low|moderate|high|critical", "baseline_value": number, "current_value": number, "percent_deviation": number, "recommended_actions": ["..."], "confidence": "low|medium|high"}`);
    await persistAI(req.user?.id, 'wastewater/detect-signal-anomaly', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-pathogen-pattern', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, time_series, region } = req.body;
    const analysis = await queryAI('You are a wastewater epidemiologist. Classify pathogen concentration patterns in wastewater. Return JSON only.', `Classify this pathogen pattern:\nPathogen: ${pathogen}\nRegion: ${region}\nTime series: ${JSON.stringify(time_series)}\nReturn JSON: {"pattern_type": "rising|falling|stable|cyclic|sporadic", "trend_direction": "...", "seasonality_detected": bool, "outbreak_risk": "low|moderate|high", "pattern_description": "...", "comparable_historical_events": ["..."]}`);
    await persistAI(req.user?.id, 'wastewater/classify-pathogen-pattern', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-clinical-cases-lag', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, concentration, region, lag_days } = req.body;
    const analysis = await queryAI('You are a wastewater epidemiologist. Predict clinical case counts based on wastewater signals with lag adjustment. Return JSON only.', `Predict clinical cases from wastewater signal:\nPathogen: ${pathogen}\nCurrent concentration: ${concentration}\nRegion: ${region}\nLag days: ${lag_days || 7}\nReturn JSON: {"predicted_cases_7day": number, "predicted_cases_14day": number, "confidence_interval_low": number, "confidence_interval_high": number, "lag_adjusted": true, "model_assumptions": ["..."], "caveats": "..."}`);
    await persistAI(req.user?.id, 'wastewater/predict-clinical-cases-lag', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-sampling-frequency', auth, aiRateLimiter, async (req, res) => {
  try {
    const { site_id, current_frequency, signal_volatility, outbreak_risk } = req.body;
    const analysis = await queryAI('You are a wastewater surveillance expert. Recommend optimal sampling frequency for wastewater monitoring sites. Return JSON only.', `Recommend sampling frequency:\nSite: ${site_id}\nCurrent frequency: ${current_frequency}\nSignal volatility: ${signal_volatility}\nOutbreak risk: ${outbreak_risk}\nReturn JSON: {"recommended_frequency": "...", "frequency_rationale": "...", "cost_impact": "low|medium|high", "implementation_steps": ["..."], "review_trigger_conditions": ["..."]}`);
    await persistAI(req.user?.id, 'wastewater/recommend-sampling-frequency', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-signal-quality', auth, aiRateLimiter, async (req, res) => {
  try {
    const { signal_id, pmmov_value, concentration, collection_method, lab_id } = req.body;
    const analysis = await queryAI('You are a wastewater lab quality expert. Score the quality of a wastewater signal. Return JSON only.', `Score signal quality:\nSignal: ${signal_id}\nPMMoV: ${pmmov_value}\nConcentration: ${concentration}\nCollection method: ${collection_method}\nLab: ${lab_id}\nReturn JSON: {"quality_score": 0-100, "quality_tier": "poor|fair|good|excellent", "quality_issues": ["..."], "normalization_status": "...", "usability": "exclude|use_with_caution|include", "recommendations": ["..."]}`);
    await persistAI(req.user?.id, 'wastewater/score-signal-quality', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-trend-narrative', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, pathogen, time_series, audience } = req.body;
    const analysis = await queryAI('You are a public health communicator. Generate a clear trend narrative from wastewater data. Return JSON only.', `Generate trend narrative:\nRegion: ${region}\nPathogen: ${pathogen}\nAudience: ${audience || 'public health officials'}\nTime series: ${JSON.stringify(time_series)}\nReturn JSON: {"narrative": "...", "key_findings": ["..."], "trend_summary": "...", "public_health_implications": "...", "recommended_next_steps": ["..."]}`);
    await persistAI(req.user?.id, 'wastewater/generate-trend-narrative', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-treatment-plant', auth, aiRateLimiter, async (req, res) => {
  try {
    const { treatment_plant, signals } = req.body;
    const analysis = await queryAI('You are a wastewater epidemiologist. Summarize surveillance findings for a treatment plant. Return JSON only.', `Summarize treatment plant surveillance:\nPlant: ${treatment_plant}\nSignals: ${JSON.stringify(signals)}\nReturn JSON: {"plant_summary": "...", "dominant_pathogens": ["..."], "trend_overview": "...", "alert_level": "green|yellow|orange|red", "catchment_population_risk": "...", "recommended_actions": ["..."]}`);
    await persistAI(req.user?.id, 'wastewater/summarize-treatment-plant', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/validate-normalization', auth, aiRateLimiter, async (req, res) => {
  try {
    const { raw_concentration, pmmov_value, flow_rate, normalization_method } = req.body;
    const analysis = await queryAI('You are a wastewater lab scientist. Validate normalization of wastewater pathogen concentrations. Return JSON only.', `Validate normalization:\nRaw concentration: ${raw_concentration}\nPMMoV: ${pmmov_value}\nFlow rate: ${flow_rate}\nMethod: ${normalization_method}\nReturn JSON: {"normalization_valid": bool, "normalized_value": number, "method_appropriateness": "...", "alternative_methods": ["..."], "validation_issues": ["..."], "confidence": "low|medium|high"}`);
    await persistAI(req.user?.id, 'wastewater/validate-normalization', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/suggest-pmmov-correction', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pmmov_values, site_id, season } = req.body;
    const analysis = await queryAI('You are a wastewater surveillance scientist. Suggest PMMoV correction factors for wastewater normalization. Return JSON only.', `Suggest PMMoV correction:\nSite: ${site_id}\nPMMoV values: ${JSON.stringify(pmmov_values)}\nSeason: ${season}\nReturn JSON: {"correction_factor": number, "correction_method": "...", "expected_pmmov_range": {"min": number, "max": number}, "outlier_samples": ["..."], "seasonal_adjustment": "...", "confidence": "low|medium|high"}`);
    await persistAI(req.user?.id, 'wastewater/suggest-pmmov-correction', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-sample-degradation', auth, aiRateLimiter, async (req, res) => {
  try {
    const { sample_id, collection_time, analysis_time, storage_temp, concentration_pattern } = req.body;
    const analysis = await queryAI('You are a wastewater lab expert. Detect sample degradation from collection and storage parameters. Return JSON only.', `Detect sample degradation:\nSample: ${sample_id}\nCollection time: ${collection_time}\nAnalysis time: ${analysis_time}\nStorage temp: ${storage_temp}\nConcentration pattern: ${JSON.stringify(concentration_pattern)}\nReturn JSON: {"degradation_detected": bool, "degradation_severity": "none|mild|moderate|severe", "degradation_factors": ["..."], "sample_usability": "exclude|use_with_caution|include", "recommended_corrective_actions": ["..."]}`);
    await persistAI(req.user?.id, 'wastewater/detect-sample-degradation', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-shedding-rate', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, concentration, population_served, clinical_cases } = req.body;
    const analysis = await queryAI('You are a wastewater epidemiologist. Classify pathogen shedding rates from wastewater data. Return JSON only.', `Classify shedding rate:\nPathogen: ${pathogen}\nConcentration: ${concentration}\nPopulation: ${population_served}\nClinical cases: ${clinical_cases}\nReturn JSON: {"shedding_rate_category": "low|moderate|high|very_high", "estimated_infected_fraction": number, "shedding_per_case": number, "transmission_implications": "...", "confidence": "low|medium|high"}`);
    await persistAI(req.user?.id, 'wastewater/classify-shedding-rate', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-outbreak-pressure', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, pathogen, signal_trend, clinical_lag } = req.body;
    const analysis = await queryAI('You are a wastewater epidemiologist. Predict outbreak pressure based on wastewater signals. Return JSON only.', `Predict outbreak pressure:\nRegion: ${region}\nPathogen: ${pathogen}\nSignal trend: ${JSON.stringify(signal_trend)}\nClinical lag days: ${clinical_lag}\nReturn JSON: {"outbreak_pressure_score": 0-100, "pressure_tier": "low|elevated|high|critical", "pressure_trajectory": "increasing|stable|decreasing", "predicted_peak_days": number, "population_at_risk": number, "early_warning_signals": ["..."]}`);
    await persistAI(req.user?.id, 'wastewater/predict-outbreak-pressure', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-confirmatory-testing', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, signal_strength, anomaly_detected, region } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Recommend confirmatory testing strategies for wastewater signals. Return JSON only.', `Recommend confirmatory testing:\nPathogen: ${pathogen}\nSignal strength: ${signal_strength}\nAnomaly detected: ${anomaly_detected}\nRegion: ${region}\nReturn JSON: {"recommended_tests": ["..."], "testing_priority": "routine|urgent|emergency", "sample_types": ["..."], "testing_labs": ["..."], "expected_turnaround_days": number, "decision_criteria": "..."}`);
    await persistAI(req.user?.id, 'wastewater/recommend-confirmatory-testing', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-public-bulletin', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, pathogen, signal_summary, alert_level } = req.body;
    const analysis = await queryAI('You are a public health communicator. Generate a public bulletin based on wastewater surveillance data. Return JSON only.', `Generate public bulletin:\nRegion: ${region}\nPathogen: ${pathogen}\nSignal summary: ${signal_summary}\nAlert level: ${alert_level}\nReturn JSON: {"bulletin_title": "...", "bulletin_body": "...", "key_messages": ["..."], "recommended_public_actions": ["..."], "tone": "informational|cautionary|urgent", "release_approval_needed": bool}`);
    await persistAI(req.user?.id, 'wastewater/generate-public-bulletin', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-catchment-coverage', auth, aiRateLimiter, async (req, res) => {
  try {
    const { site_id, population_served, total_region_population, catchment_demographics } = req.body;
    const analysis = await queryAI('You are a wastewater epidemiologist. Score catchment area coverage for wastewater surveillance sites. Return JSON only.', `Score catchment coverage:\nSite: ${site_id}\nPopulation served: ${population_served}\nTotal population: ${total_region_population}\nDemographics: ${JSON.stringify(catchment_demographics)}\nReturn JSON: {"coverage_percentage": number, "coverage_score": 0-100, "coverage_gaps": ["..."], "demographic_representativeness": "...", "recommended_new_sites": ["..."], "equity_assessment": "..."}`);
    await persistAI(req.user?.id, 'wastewater/score-catchment-coverage', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-multi-pathogen-trend', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, pathogen_signals, time_period } = req.body;
    const analysis = await queryAI('You are a wastewater epidemiologist. Summarize multi-pathogen trends in wastewater surveillance. Return JSON only.', `Summarize multi-pathogen trends:\nRegion: ${region}\nTime period: ${time_period}\nPathogen signals: ${JSON.stringify(pathogen_signals)}\nReturn JSON: {"overall_burden_level": "low|moderate|high|critical", "dominant_pathogen": "...", "co-circulation_detected": bool, "pathogen_summaries": [{"pathogen": "...", "trend": "...", "risk": "..."}], "combined_public_health_risk": "...", "priority_actions": ["..."]}`);
    await persistAI(req.user?.id, 'wastewater/summarize-multi-pathogen-trend', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
