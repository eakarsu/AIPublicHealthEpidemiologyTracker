const express = require('express');
const pool = require('../db');
const { queryAI, parseAIJson } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const router = express.Router();

const TABLE = 'syndromic_surveillance';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      facility_id VARCHAR(100),
      facility_name VARCHAR(200),
      facility_type VARCHAR(100),
      region VARCHAR(200),
      report_date DATE,
      syndrome_category VARCHAR(200),
      chief_complaint_text TEXT,
      icd10_codes TEXT,
      age_group VARCHAR(50),
      sex VARCHAR(20),
      visit_count INTEGER DEFAULT 1,
      total_ed_visits INTEGER,
      percent_syndrome NUMERIC,
      signal_strength_score NUMERIC,
      data_timeliness_score NUMERIC,
      status VARCHAR(50) DEFAULT 'active',
      archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureTable().catch(e => console.error('syndromic_surveillance table init error:', e.message));

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ORDER BY report_date DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/count', async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.region) { params.push(req.query.region); where.push(`region=$${params.length}`); }
    if (req.query.syndrome_category) { params.push(req.query.syndrome_category); where.push(`syndrome_category=$${params.length}`); }
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
      pool.query(`SELECT * FROM ${TABLE} WHERE syndrome_category ILIKE $1 OR facility_name ILIKE $1 OR region ILIKE $1 OR chief_complaint_text ILIKE $1 ORDER BY report_date DESC LIMIT $2 OFFSET $3`, [q, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE syndrome_category ILIKE $1 OR facility_name ILIKE $1 OR region ILIKE $1 OR chief_complaint_text ILIKE $1`, [q]),
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
      pool.query(`SELECT * FROM ${TABLE} WHERE region=$1 ORDER BY report_date DESC LIMIT $2 OFFSET $3`, [req.params.region, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE region=$1`, [req.params.region]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-facility/:facility_id', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE facility_id=$1 ORDER BY report_date DESC LIMIT $2 OFFSET $3`, [req.params.facility_id, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE facility_id=$1`, [req.params.facility_id]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY report_date DESC`);
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
    const [bySyndrome, byRegion, byFacility] = await Promise.all([
      pool.query(`SELECT syndrome_category, COUNT(*) as count, SUM(visit_count) as total_visits FROM ${TABLE} GROUP BY syndrome_category ORDER BY total_visits DESC`),
      pool.query(`SELECT region, COUNT(*) as count FROM ${TABLE} GROUP BY region ORDER BY count DESC`),
      pool.query(`SELECT facility_name, COUNT(*) as count FROM ${TABLE} GROUP BY facility_name ORDER BY count DESC LIMIT 10`),
    ]);
    res.json({ by_syndrome: bySyndrome.rows, by_region: byRegion.rows, top_facilities: byFacility.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch-create', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { facility_id, facility_name, facility_type, region, report_date, syndrome_category, chief_complaint_text, icd10_codes, age_group, sex, visit_count, total_ed_visits, percent_syndrome, notes } = item;
      const r = await pool.query(`INSERT INTO ${TABLE} (facility_id, facility_name, facility_type, region, report_date, syndrome_category, chief_complaint_text, icd10_codes, age_group, sex, visit_count, total_ed_visits, percent_syndrome, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [facility_id, facility_name, facility_type, region, report_date, syndrome_category, chief_complaint_text, icd10_codes, age_group, sex, visit_count, total_ed_visits, percent_syndrome, notes]);
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
      const cols = keys.join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const r = await pool.query(`INSERT INTO ${TABLE} (${cols}) VALUES (${placeholders}) RETURNING *`, keys.map(k => obj[k]));
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
    const { facility_id, facility_name, facility_type, region, report_date, syndrome_category, chief_complaint_text, icd10_codes, age_group, sex, visit_count, total_ed_visits, percent_syndrome, notes } = req.body;
    const result = await pool.query(`INSERT INTO ${TABLE} (facility_id, facility_name, facility_type, region, report_date, syndrome_category, chief_complaint_text, icd10_codes, age_group, sex, visit_count, total_ed_visits, percent_syndrome, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`, [facility_id, facility_name, facility_type, region, report_date, syndrome_category, chief_complaint_text, icd10_codes, age_group, sex, visit_count, total_ed_visits, percent_syndrome, notes]);
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
    const logs = await pool.query(`SELECT * FROM ai_analyses WHERE endpoint ILIKE $1 ORDER BY created_at DESC LIMIT 50`, [`%syndromic%`]);
    res.json({ data: record.rows[0], history: logs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI VERBS ──────────────────────────────────────────────────────────────────

router.post('/ai/detect-syndrome-anomaly', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, syndrome_category, recent_counts, baseline } = req.body;
    const analysis = await queryAI('You are a syndromic surveillance epidemiologist. Detect anomalies in syndrome visit counts. Return JSON only.', `Detect syndrome anomaly:\nRegion: ${region}\nSyndrome: ${syndrome_category}\nRecent counts: ${JSON.stringify(recent_counts)}\nBaseline: ${JSON.stringify(baseline)}\nReturn JSON: {"anomaly_detected": bool, "anomaly_score": 0-100, "method_used": "...", "p_value": number, "excess_cases": number, "severity": "low|moderate|high|critical", "recommended_actions": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/detect-syndrome-anomaly', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-symptom-cluster', auth, aiRateLimiter, async (req, res) => {
  try {
    const { chief_complaints, icd10_codes, facility_type } = req.body;
    const analysis = await queryAI('You are a syndromic surveillance epidemiologist. Classify symptom clusters from ED chief complaints. Return JSON only.', `Classify symptom cluster:\nChief complaints: ${JSON.stringify(chief_complaints)}\nICD-10 codes: ${JSON.stringify(icd10_codes)}\nFacility type: ${facility_type}\nReturn JSON: {"syndrome_category": "...", "confidence": "low|medium|high", "differential_syndromes": ["..."], "clinical_significance": "...", "icd10_mapping": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/classify-symptom-cluster', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-disease-causing-syndrome', auth, aiRateLimiter, async (req, res) => {
  try {
    const { syndrome_category, age_distribution, season, region } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Predict the most likely diseases causing a syndrome pattern. Return JSON only.', `Predict disease causation:\nSyndrome: ${syndrome_category}\nAge distribution: ${JSON.stringify(age_distribution)}\nSeason: ${season}\nRegion: ${region}\nReturn JSON: {"top_diseases": [{"disease": "...", "probability": 0-1, "rationale": "..."}], "differential_diagnoses": ["..."], "seasonal_fit": "...", "age_group_match": "..."}`);
    await persistAI(req.user?.id, 'syndromic/predict-disease-causing-syndrome', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-investigation', auth, aiRateLimiter, async (req, res) => {
  try {
    const { anomaly_details, syndrome_category, region } = req.body;
    const analysis = await queryAI('You are a public health investigator. Recommend investigation steps for a syndromic surveillance alert. Return JSON only.', `Recommend investigation:\nAnomaly: ${JSON.stringify(anomaly_details)}\nSyndrome: ${syndrome_category}\nRegion: ${region}\nReturn JSON: {"investigation_priority": "low|routine|urgent|emergency", "immediate_actions": ["..."], "data_collection_steps": ["..."], "laboratory_testing": ["..."], "stakeholders_to_notify": ["..."], "timeline": "..."}`);
    await persistAI(req.user?.id, 'syndromic/recommend-investigation', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-signal-strength', auth, aiRateLimiter, async (req, res) => {
  try {
    const { visit_count, total_ed_visits, baseline_percent, current_percent, trend } = req.body;
    const analysis = await queryAI('You are a syndromic surveillance analyst. Score the signal strength of a syndromic alert. Return JSON only.', `Score signal strength:\nVisit count: ${visit_count}\nTotal ED visits: ${total_ed_visits}\nBaseline %: ${baseline_percent}\nCurrent %: ${current_percent}\nTrend: ${JSON.stringify(trend)}\nReturn JSON: {"signal_strength_score": 0-100, "signal_tier": "weak|moderate|strong|very_strong", "statistical_significance": "...", "actionability": "monitor|alert|investigate|emergency_response", "contributing_factors": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/score-signal-strength', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-alert-narrative', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, syndrome_category, alert_level, key_findings } = req.body;
    const analysis = await queryAI('You are a public health communicator. Generate a clear alert narrative for a syndromic surveillance signal. Return JSON only.', `Generate alert narrative:\nRegion: ${region}\nSyndrome: ${syndrome_category}\nAlert level: ${alert_level}\nKey findings: ${JSON.stringify(key_findings)}\nReturn JSON: {"alert_title": "...", "narrative": "...", "situation_summary": "...", "action_required": "...", "distribution_list": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/generate-alert-narrative', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-ed-visits', auth, aiRateLimiter, async (req, res) => {
  try {
    const { facility_name, date_range, visit_data } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Summarize ED visit patterns for syndromic surveillance. Return JSON only.', `Summarize ED visits:\nFacility: ${facility_name}\nDate range: ${JSON.stringify(date_range)}\nVisit data: ${JSON.stringify(visit_data)}\nReturn JSON: {"summary": "...", "total_visits": number, "top_syndromes": ["..."], "notable_patterns": ["..."], "baseline_comparison": "...", "recommendations": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/summarize-ed-visits', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/validate-chief-complaint-coding', auth, aiRateLimiter, async (req, res) => {
  try {
    const { chief_complaint_text, assigned_syndrome, icd10_codes } = req.body;
    const analysis = await queryAI('You are a clinical coder and syndromic surveillance expert. Validate chief complaint coding. Return JSON only.', `Validate chief complaint coding:\nChief complaint: ${chief_complaint_text}\nAssigned syndrome: ${assigned_syndrome}\nICD-10 codes: ${JSON.stringify(icd10_codes)}\nReturn JSON: {"coding_valid": bool, "suggested_syndrome": "...", "suggested_icd10": ["..."], "coding_issues": ["..."], "confidence": "low|medium|high"}`);
    await persistAI(req.user?.id, 'syndromic/validate-chief-complaint-coding', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/suggest-syndrome-definition-refinement', auth, aiRateLimiter, async (req, res) => {
  try {
    const { syndrome_category, current_definition, false_positive_rate, sensitivity } = req.body;
    const analysis = await queryAI('You are a syndromic surveillance methodologist. Suggest refinements to syndrome definitions. Return JSON only.', `Suggest syndrome definition refinement:\nSyndrome: ${syndrome_category}\nCurrent definition: ${current_definition}\nFalse positive rate: ${false_positive_rate}\nSensitivity: ${sensitivity}\nReturn JSON: {"refined_definition": "...", "inclusion_criteria": ["..."], "exclusion_criteria": ["..."], "expected_sensitivity": number, "expected_specificity": number, "implementation_notes": "..."}`);
    await persistAI(req.user?.id, 'syndromic/suggest-syndrome-definition-refinement', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-bias-by-facility', auth, aiRateLimiter, async (req, res) => {
  try {
    const { facilities, syndrome_rates, demographic_data } = req.body;
    const analysis = await queryAI('You are a public health equity analyst. Detect reporting bias across surveillance facilities. Return JSON only.', `Detect facility bias:\nFacilities: ${JSON.stringify(facilities)}\nSyndrome rates: ${JSON.stringify(syndrome_rates)}\nDemographics: ${JSON.stringify(demographic_data)}\nReturn JSON: {"bias_detected": bool, "biased_facilities": ["..."], "bias_types": ["..."], "equity_concerns": ["..."], "recommended_corrections": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/detect-bias-by-facility', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-age-group-pattern', auth, aiRateLimiter, async (req, res) => {
  try {
    const { syndrome_category, age_group_counts, expected_distribution } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Classify age-group patterns in syndromic surveillance data. Return JSON only.', `Classify age group pattern:\nSyndrome: ${syndrome_category}\nAge group counts: ${JSON.stringify(age_group_counts)}\nExpected distribution: ${JSON.stringify(expected_distribution)}\nReturn JSON: {"predominant_age_group": "...", "pattern_type": "...", "age_shift_detected": bool, "disease_implications": ["..."], "targeted_interventions": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/classify-age-group-pattern', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-seasonal-shift', auth, aiRateLimiter, async (req, res) => {
  try {
    const { syndrome_category, historical_seasonal_data, current_data } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Predict seasonal shifts in syndromic surveillance patterns. Return JSON only.', `Predict seasonal shift:\nSyndrome: ${syndrome_category}\nHistorical seasonal data: ${JSON.stringify(historical_seasonal_data)}\nCurrent data: ${JSON.stringify(current_data)}\nReturn JSON: {"shift_detected": bool, "shift_direction": "earlier|later|none", "shift_weeks": number, "likely_causes": ["..."], "preparedness_recommendations": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/predict-seasonal-shift', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-data-source-addition', auth, aiRateLimiter, async (req, res) => {
  try {
    const { current_data_sources, coverage_gaps, surveillance_goals } = req.body;
    const analysis = await queryAI('You are a syndromic surveillance systems expert. Recommend additional data sources to improve coverage. Return JSON only.', `Recommend data source additions:\nCurrent sources: ${JSON.stringify(current_data_sources)}\nCoverage gaps: ${JSON.stringify(coverage_gaps)}\nSurveillance goals: ${JSON.stringify(surveillance_goals)}\nReturn JSON: {"recommended_sources": [{"source": "...", "data_type": "...", "expected_benefit": "...", "implementation_complexity": "low|medium|high"}], "priority_order": ["..."], "implementation_timeline": "..."}`);
    await persistAI(req.user?.id, 'syndromic/recommend-data-source-addition', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-weekly-report', auth, aiRateLimiter, async (req, res) => {
  try {
    const { week_ending, region, syndrome_data, alerts } = req.body;
    const analysis = await queryAI('You are a syndromic surveillance epidemiologist. Generate a weekly surveillance report. Return JSON only.', `Generate weekly report:\nWeek ending: ${week_ending}\nRegion: ${region}\nSyndrome data: ${JSON.stringify(syndrome_data)}\nAlerts: ${JSON.stringify(alerts)}\nReturn JSON: {"report_title": "...", "executive_summary": "...", "key_findings": ["..."], "alert_summary": "...", "trend_analysis": "...", "next_week_watch": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/generate-weekly-report', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-data-timeliness', auth, aiRateLimiter, async (req, res) => {
  try {
    const { facility_id, report_date, event_date, expected_lag_hours } = req.body;
    const analysis = await queryAI('You are a syndromic surveillance data quality analyst. Score data timeliness for surveillance reporting. Return JSON only.', `Score data timeliness:\nFacility: ${facility_id}\nReport date: ${report_date}\nEvent date: ${event_date}\nExpected lag: ${expected_lag_hours} hours\nReturn JSON: {"timeliness_score": 0-100, "actual_lag_hours": number, "timeliness_tier": "excellent|good|fair|poor", "impact_on_detection": "...", "improvement_recommendations": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/score-data-timeliness', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-spatial-pattern', auth, aiRateLimiter, async (req, res) => {
  try {
    const { syndrome_category, geographic_units, case_counts } = req.body;
    const analysis = await queryAI('You are a spatial epidemiologist. Summarize the spatial distribution pattern of a syndrome. Return JSON only.', `Summarize spatial pattern:\nSyndrome: ${syndrome_category}\nGeographic units: ${JSON.stringify(geographic_units)}\nCase counts: ${JSON.stringify(case_counts)}\nReturn JSON: {"spatial_pattern": "clustered|dispersed|random", "hotspot_areas": ["..."], "coldspot_areas": ["..."], "spatial_autocorrelation": "...", "likely_transmission_mode": "...", "geographic_risk_stratification": ["..."]}`);
    await persistAI(req.user?.id, 'syndromic/summarize-spatial-pattern', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
