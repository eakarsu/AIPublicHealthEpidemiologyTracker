const express = require('express');
const pool = require('../db');
const { queryAI, parseAIJson } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const router = express.Router();

const TABLE = 'r0_estimates';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      pathogen VARCHAR(200),
      region VARCHAR(200),
      estimate_date DATE,
      r_effective NUMERIC,
      r_effective_lower NUMERIC,
      r_effective_upper NUMERIC,
      r_zero NUMERIC,
      serial_interval_mean NUMERIC,
      serial_interval_sd NUMERIC,
      generation_time NUMERIC,
      estimation_method VARCHAR(200),
      data_window_days INTEGER,
      case_count_window INTEGER,
      reporting_delay_adjusted BOOLEAN DEFAULT FALSE,
      import_fraction NUMERIC,
      transmission_regime VARCHAR(100),
      doubling_time NUMERIC,
      halving_time NUMERIC,
      intervention_context TEXT,
      data_quality_score NUMERIC,
      status VARCHAR(50) DEFAULT 'active',
      archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureTable().catch(e => console.error('r0_estimates table init error:', e.message));

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ORDER BY estimate_date DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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

router.get('/search', async (req, res) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE pathogen ILIKE $1 OR region ILIKE $1 OR estimation_method ILIKE $1 ORDER BY estimate_date DESC LIMIT $2 OFFSET $3`, [q, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE pathogen ILIKE $1 OR region ILIKE $1 OR estimation_method ILIKE $1`, [q]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-region/:region', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE region=$1 ORDER BY estimate_date DESC LIMIT $2 OFFSET $3`, [req.params.region, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE region=$1`, [req.params.region]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-pathogen/:pathogen', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE pathogen=$1 ORDER BY estimate_date DESC LIMIT $2 OFFSET $3`, [req.params.pathogen, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE pathogen=$1`, [req.params.pathogen]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY estimate_date DESC`);
    const rows = result.rows;
    if (rows.length === 0) return res.status(204).send();
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${TABLE}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const [byPathogen, byRegion, recent] = await Promise.all([
      pool.query(`SELECT pathogen, AVG(r_effective) as avg_r, MAX(r_effective) as max_r, MIN(r_effective) as min_r FROM ${TABLE} GROUP BY pathogen`),
      pool.query(`SELECT region, AVG(r_effective) as avg_r, COUNT(*) as estimate_count FROM ${TABLE} GROUP BY region ORDER BY avg_r DESC`),
      pool.query(`SELECT * FROM ${TABLE} WHERE estimate_date >= NOW() - INTERVAL '30 days' ORDER BY estimate_date DESC LIMIT 20`),
    ]);
    res.json({ by_pathogen: byPathogen.rows, by_region: byRegion.rows, recent_estimates: recent.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch-create', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { pathogen, region, estimate_date, r_effective, r_effective_lower, r_effective_upper, r_zero, serial_interval_mean, serial_interval_sd, generation_time, estimation_method, data_window_days, case_count_window, reporting_delay_adjusted, import_fraction, transmission_regime, doubling_time, halving_time, intervention_context, data_quality_score, notes } = item;
      const r = await pool.query(`INSERT INTO ${TABLE} (pathogen, region, estimate_date, r_effective, r_effective_lower, r_effective_upper, r_zero, serial_interval_mean, serial_interval_sd, generation_time, estimation_method, data_window_days, case_count_window, reporting_delay_adjusted, import_fraction, transmission_regime, doubling_time, halving_time, intervention_context, data_quality_score, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`, [pathogen, region, estimate_date, r_effective, r_effective_lower, r_effective_upper, r_zero, serial_interval_mean, serial_interval_sd, generation_time, estimation_method, data_window_days, case_count_window, reporting_delay_adjusted, import_fraction, transmission_regime, doubling_time, halving_time, intervention_context, data_quality_score, notes]);
      created.push(r.rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
      const vals = [...keys.map(k => fields[k]), id];
      const r = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
      if (r.rows[0]) updated.push(r.rows[0]);
    }
    res.json({ data: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/batch-delete', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    await pool.query(`UPDATE ${TABLE} SET status='deleted', updated_at=NOW() WHERE id=ANY($1)`, [ids]);
    res.json({ updated: ids.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
      headers.forEach((h, i) => { obj[h] = values[i] ? values[i].replace(/^"|"$/g, '') : null; });
      const keys = Object.keys(obj).filter(k => obj[k] !== null);
      if (keys.length === 0) continue;
      const r = await pool.query(`INSERT INTO ${TABLE} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, keys.map(k => obj[k]));
      created.push(r.rows[0]);
    }
    res.status(201).json({ data: created, count: created.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE id=$1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { pathogen, region, estimate_date, r_effective, r_effective_lower, r_effective_upper, r_zero, serial_interval_mean, serial_interval_sd, generation_time, estimation_method, data_window_days, case_count_window, reporting_delay_adjusted, import_fraction, transmission_regime, doubling_time, halving_time, intervention_context, data_quality_score, notes } = req.body;
    const result = await pool.query(`INSERT INTO ${TABLE} (pathogen, region, estimate_date, r_effective, r_effective_lower, r_effective_upper, r_zero, serial_interval_mean, serial_interval_sd, generation_time, estimation_method, data_window_days, case_count_window, reporting_delay_adjusted, import_fraction, transmission_regime, doubling_time, halving_time, intervention_context, data_quality_score, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`, [pathogen, region, estimate_date, r_effective, r_effective_lower, r_effective_upper, r_zero, serial_interval_mean, serial_interval_sd, generation_time, estimation_method, data_window_days, case_count_window, reporting_delay_adjusted, import_fraction, transmission_regime, doubling_time, halving_time, intervention_context, data_quality_score, notes]);
    res.status(201).json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const fields = req.body;
    const keys = Object.keys(fields);
    if (keys.length === 0) return res.status(400).json({ error: 'No fields to update' });
    const sets = keys.map((k, i) => `${k}=$${i + 1}`).join(', ');
    const vals = [...keys.map(k => fields[k]), req.params.id];
    const result = await pool.query(`UPDATE ${TABLE} SET ${sets}, updated_at=NOW() WHERE id=$${vals.length} RETURNING *`, vals);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(`UPDATE ${TABLE} SET status='deleted', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/archive', auth, async (req, res) => {
  try {
    const result = await pool.query(`UPDATE ${TABLE} SET archived=TRUE, updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/restore', auth, async (req, res) => {
  try {
    const result = await pool.query(`UPDATE ${TABLE} SET archived=FALSE, status='active', updated_at=NOW() WHERE id=$1 RETURNING *`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id/history', async (req, res) => {
  try {
    const record = await pool.query(`SELECT * FROM ${TABLE} WHERE id=$1`, [req.params.id]);
    if (record.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const logs = await pool.query(`SELECT * FROM ai_analyses WHERE endpoint ILIKE $1 ORDER BY created_at DESC LIMIT 50`, [`%r0%`]);
    res.json({ data: record.rows[0], history: logs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI VERBS ──────────────────────────────────────────────────────────────────

router.post('/ai/estimate-r-effective', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, region, case_series, serial_interval_mean, serial_interval_sd, method } = req.body;
    const analysis = await queryAI('You are an epidemiologist specializing in transmission dynamics. Estimate the effective reproduction number Rt. Return JSON only.', `Estimate Rt:\nPathogen: ${pathogen}\nRegion: ${region}\nCase series: ${JSON.stringify(case_series)}\nSerial interval mean: ${serial_interval_mean}\nSerial interval SD: ${serial_interval_sd}\nMethod: ${method || 'EpiEstim'}\nReturn JSON: {"r_effective": number, "r_effective_lower_95ci": number, "r_effective_upper_95ci": number, "estimation_date": "...", "method_used": "...", "interpretation": "...", "uncertainty_sources": ["..."]}`);
    await persistAI(req.user?.id, 'r0/estimate-r-effective', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-r-shift', auth, aiRateLimiter, async (req, res) => {
  try {
    const { r_time_series, intervention_dates, pathogen } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Detect significant shifts in the effective reproduction number over time. Return JSON only.', `Detect Rt shift:\nPathogen: ${pathogen}\nRt time series: ${JSON.stringify(r_time_series)}\nIntervention dates: ${JSON.stringify(intervention_dates)}\nReturn JSON: {"shift_detected": bool, "shift_dates": ["..."], "shift_magnitude": [number], "direction": ["increasing|decreasing"], "associated_interventions": ["..."], "confidence": "low|medium|high"}`);
    await persistAI(req.user?.id, 'r0/detect-r-shift', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-transmission-regime', auth, aiRateLimiter, async (req, res) => {
  try {
    const { r_effective, r_trend, herd_immunity_threshold } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Classify the current transmission regime based on Rt. Return JSON only.', `Classify transmission regime:\nRt: ${r_effective}\nRt trend: ${r_trend}\nHerd immunity threshold: ${herd_immunity_threshold}\nReturn JSON: {"transmission_regime": "sub_critical|critical|super_critical", "epidemic_phase": "declining|stable|growing|exponential", "herd_immunity_gap": number, "intervention_urgency": "none|monitor|act|emergency", "narrative": "..."}`);
    await persistAI(req.user?.id, 'r0/classify-transmission-regime', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-r-trajectory', auth, aiRateLimiter, async (req, res) => {
  try {
    const { r_time_series, planned_interventions, seasonality_factor } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Predict the future trajectory of the effective reproduction number. Return JSON only.', `Predict Rt trajectory:\nRt time series: ${JSON.stringify(r_time_series)}\nPlanned interventions: ${JSON.stringify(planned_interventions)}\nSeasonality factor: ${seasonality_factor}\nReturn JSON: {"predicted_rt_7day": number, "predicted_rt_14day": number, "predicted_rt_30day": number, "trajectory": "rising|falling|stable|oscillating", "confidence_intervals": [{"day": number, "lower": number, "upper": number}], "key_assumptions": ["..."]}`);
    await persistAI(req.user?.id, 'r0/predict-r-trajectory', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-intervention-strength', auth, aiRateLimiter, async (req, res) => {
  try {
    const { r_effective, target_r, population_immunity, healthcare_capacity } = req.body;
    const analysis = await queryAI('You are a public health epidemiologist. Recommend intervention intensity needed to reduce Rt. Return JSON only.', `Recommend intervention strength:\nCurrent Rt: ${r_effective}\nTarget Rt: ${target_r}\nPopulation immunity: ${population_immunity}%\nHealthcare capacity: ${healthcare_capacity}\nReturn JSON: {"required_transmission_reduction": number, "intervention_package": ["..."], "estimated_effectiveness": "...", "implementation_timeline": "...", "equity_considerations": ["..."], "monitoring_metrics": ["..."]}`);
    await persistAI(req.user?.id, 'r0/recommend-intervention-strength', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-estimate-uncertainty', auth, aiRateLimiter, async (req, res) => {
  try {
    const { r_effective, ci_width, case_count, reporting_completeness, method } = req.body;
    const analysis = await queryAI('You are a biostatistician. Score the uncertainty around an Rt estimate. Return JSON only.', `Score estimate uncertainty:\nRt: ${r_effective}\nCI width: ${ci_width}\nCase count: ${case_count}\nReporting completeness: ${reporting_completeness}\nMethod: ${method}\nReturn JSON: {"uncertainty_score": 0-100, "uncertainty_tier": "low|moderate|high|very_high", "primary_uncertainty_sources": ["..."], "data_requirements_to_reduce": ["..."], "usability": "use|use_with_caution|do_not_use"}`);
    await persistAI(req.user?.id, 'r0/score-estimate-uncertainty', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-r-narrative', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, region, r_effective, r_trend, context } = req.body;
    const analysis = await queryAI('You are a public health communicator. Generate a clear narrative about the effective reproduction number. Return JSON only.', `Generate Rt narrative:\nPathogen: ${pathogen}\nRegion: ${region}\nRt: ${r_effective}\nTrend: ${r_trend}\nContext: ${context}\nReturn JSON: {"narrative": "...", "plain_language_summary": "...", "public_health_implication": "...", "citizen_action_items": ["..."], "media_key_message": "..."}`);
    await persistAI(req.user?.id, 'r0/generate-r-narrative', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-r-by-region', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, regional_estimates, national_estimate } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Summarize Rt variation across regions. Return JSON only.', `Summarize Rt by region:\nPathogen: ${pathogen}\nRegional estimates: ${JSON.stringify(regional_estimates)}\nNational estimate: ${national_estimate}\nReturn JSON: {"highest_rt_region": "...", "lowest_rt_region": "...", "national_average": number, "geographic_heterogeneity": "low|moderate|high", "hotspot_regions": ["..."], "priority_response_areas": ["..."], "summary": "..."}`);
    await persistAI(req.user?.id, 'r0/summarize-r-by-region', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/validate-serial-interval-assumption', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, assumed_si_mean, assumed_si_sd, observed_pairs, literature_estimates } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Validate serial interval assumptions used in Rt estimation. Return JSON only.', `Validate serial interval assumption:\nPathogen: ${pathogen}\nAssumed SI mean: ${assumed_si_mean}\nAssumed SI SD: ${assumed_si_sd}\nObserved pairs: ${JSON.stringify(observed_pairs)}\nLiterature: ${JSON.stringify(literature_estimates)}\nReturn JSON: {"assumption_valid": bool, "recommended_si_mean": number, "recommended_si_sd": number, "literature_concordance": "...", "bias_direction": "overestimating_rt|underestimating_rt|unbiased", "sensitivity_analysis_recommended": bool}`);
    await persistAI(req.user?.id, 'r0/validate-serial-interval-assumption', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/suggest-method-comparison', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, available_data, current_method, data_quality } = req.body;
    const analysis = await queryAI('You are a transmission dynamics methodologist. Suggest complementary methods for Rt estimation. Return JSON only.', `Suggest method comparison:\nPathogen: ${pathogen}\nAvailable data: ${JSON.stringify(available_data)}\nCurrent method: ${current_method}\nData quality: ${data_quality}\nReturn JSON: {"recommended_methods": [{"method": "...", "suitability": "high|medium|low", "data_requirements": ["..."], "advantages": ["..."], "limitations": ["..."]}], "preferred_method": "...", "ensemble_approach": bool}`);
    await persistAI(req.user?.id, 'r0/suggest-method-comparison', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-reporting-delay-bias', auth, aiRateLimiter, async (req, res) => {
  try {
    const { onset_to_report_distribution, case_series_by_report_date, case_series_by_onset_date } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Detect and quantify bias from reporting delays in Rt estimation. Return JSON only.', `Detect reporting delay bias:\nOnset to report distribution: ${JSON.stringify(onset_to_report_distribution)}\nBy report date: ${JSON.stringify(case_series_by_report_date)}\nBy onset date: ${JSON.stringify(case_series_by_onset_date)}\nReturn JSON: {"bias_detected": bool, "bias_direction": "rt_overestimated|rt_underestimated|unbiased", "bias_magnitude": number, "corrected_rt_estimate": number, "correction_method": "...", "recommended_data_collection": ["..."]}`);
    await persistAI(req.user?.id, 'r0/detect-reporting-delay-bias', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-superspreading-event', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_type, case_count_linked, setting, pathogen, dispersion_parameter } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Classify whether an event constitutes a superspreading event. Return JSON only.', `Classify superspreading event:\nEvent type: ${event_type}\nLinked cases: ${case_count_linked}\nSetting: ${setting}\nPathogen: ${pathogen}\nDispersion k: ${dispersion_parameter}\nReturn JSON: {"superspreading_event": bool, "reproduction_number_event": number, "classification": "ordinary|amplifying|superspreading", "contributing_factors": ["..."], "public_health_implications": "...", "prevention_lessons": ["..."]}`);
    await persistAI(req.user?.id, 'r0/classify-superspreading-event', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-doubling-time', auth, aiRateLimiter, async (req, res) => {
  try {
    const { r_effective, generation_time, current_case_count } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Predict epidemic doubling time based on transmission parameters. Return JSON only.', `Predict doubling time:\nRt: ${r_effective}\nGeneration time: ${generation_time} days\nCurrent cases: ${current_case_count}\nReturn JSON: {"doubling_time_days": number, "doubling_time_lower_ci": number, "doubling_time_upper_ci": number, "projected_cases_14_days": number, "projected_cases_30_days": number, "exponential_growth_rate": number, "interpretation": "..."}`);
    await persistAI(req.user?.id, 'r0/predict-doubling-time', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-data-quality-improvement', auth, aiRateLimiter, async (req, res) => {
  try {
    const { current_data_sources, case_completeness, lab_positivity_rate, reporting_timeliness } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Recommend improvements to data quality for Rt estimation. Return JSON only.', `Recommend data quality improvement:\nData sources: ${JSON.stringify(current_data_sources)}\nCase completeness: ${case_completeness}%\nLab positivity: ${lab_positivity_rate}%\nReporting timeliness: ${reporting_timeliness}\nReturn JSON: {"priority_improvements": ["..."], "quick_wins": ["..."], "expected_rt_estimate_improvement": "...", "resource_requirements": "...", "implementation_timeline": "..."}`);
    await persistAI(req.user?.id, 'r0/recommend-data-quality-improvement', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-policy-brief', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, region, r_effective, r_trend, proposed_interventions } = req.body;
    const analysis = await queryAI('You are a public health policy advisor. Generate a policy brief based on Rt estimates. Return JSON only.', `Generate policy brief:\nPathogen: ${pathogen}\nRegion: ${region}\nRt: ${r_effective}\nTrend: ${r_trend}\nProposed interventions: ${JSON.stringify(proposed_interventions)}\nReturn JSON: {"brief_title": "...", "executive_summary": "...", "situation_assessment": "...", "policy_options": [{"option": "...", "expected_impact": "...", "feasibility": "...", "recommendation_level": "..."}], "recommended_action": "...", "monitoring_framework": "..."}`);
    await persistAI(req.user?.id, 'r0/generate-policy-brief', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-method-fit', auth, aiRateLimiter, async (req, res) => {
  try {
    const { method, data_type, case_count, time_period, assumptions_met } = req.body;
    const analysis = await queryAI('You are a biostatistician. Score how well an Rt estimation method fits the available data. Return JSON only.', `Score method fit:\nMethod: ${method}\nData type: ${data_type}\nCase count: ${case_count}\nTime period: ${time_period}\nAssumptions met: ${JSON.stringify(assumptions_met)}\nReturn JSON: {"method_fit_score": 0-100, "fit_tier": "poor|fair|good|excellent", "violated_assumptions": ["..."], "goodness_of_fit": "...", "alternative_methods": ["..."], "recommendation": "..."}`);
    await persistAI(req.user?.id, 'r0/score-method-fit', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
