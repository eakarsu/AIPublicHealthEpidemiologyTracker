const express = require('express');
const pool = require('../db');
const { queryAI, parseAIJson } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const router = express.Router();

const TABLE = 'outbreak_clusters';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      cluster_id VARCHAR(100),
      pathogen VARCHAR(200),
      region VARCHAR(200),
      sub_region VARCHAR(200),
      latitude NUMERIC,
      longitude NUMERIC,
      radius_km NUMERIC,
      case_count INTEGER,
      expected_count NUMERIC,
      scan_statistic NUMERIC,
      p_value NUMERIC,
      cluster_start DATE,
      cluster_end DATE,
      cluster_type VARCHAR(100),
      source_hypothesis TEXT,
      investigation_status VARCHAR(100) DEFAULT 'pending',
      confidence_score NUMERIC,
      priority_score NUMERIC,
      control_measures TEXT,
      status VARCHAR(50) DEFAULT 'active',
      archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureTable().catch(e => console.error('outbreak_clusters table init error:', e.message));

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ORDER BY cluster_start DESC LIMIT $1 OFFSET $2`, [limit, offset]),
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
      pool.query(`SELECT * FROM ${TABLE} WHERE pathogen ILIKE $1 OR region ILIKE $1 OR cluster_id ILIKE $1 OR cluster_type ILIKE $1 ORDER BY cluster_start DESC LIMIT $2 OFFSET $3`, [q, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE pathogen ILIKE $1 OR region ILIKE $1 OR cluster_id ILIKE $1 OR cluster_type ILIKE $1`, [q]),
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
      pool.query(`SELECT * FROM ${TABLE} WHERE region=$1 ORDER BY cluster_start DESC LIMIT $2 OFFSET $3`, [req.params.region, limit, offset]),
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
      pool.query(`SELECT * FROM ${TABLE} WHERE pathogen=$1 ORDER BY cluster_start DESC LIMIT $2 OFFSET $3`, [req.params.pathogen, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE pathogen=$1`, [req.params.pathogen]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY cluster_start DESC`);
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
    const [byPathogen, byRegion, byStatus] = await Promise.all([
      pool.query(`SELECT pathogen, COUNT(*) as count, AVG(case_count) as avg_cases FROM ${TABLE} GROUP BY pathogen ORDER BY count DESC`),
      pool.query(`SELECT region, COUNT(*) as count FROM ${TABLE} GROUP BY region ORDER BY count DESC`),
      pool.query(`SELECT investigation_status, COUNT(*) as count FROM ${TABLE} GROUP BY investigation_status`),
    ]);
    res.json({ by_pathogen: byPathogen.rows, by_region: byRegion.rows, by_investigation_status: byStatus.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch-create', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { cluster_id, pathogen, region, sub_region, latitude, longitude, radius_km, case_count, expected_count, scan_statistic, p_value, cluster_start, cluster_end, cluster_type, source_hypothesis, investigation_status, confidence_score, priority_score, control_measures, notes } = item;
      const r = await pool.query(`INSERT INTO ${TABLE} (cluster_id, pathogen, region, sub_region, latitude, longitude, radius_km, case_count, expected_count, scan_statistic, p_value, cluster_start, cluster_end, cluster_type, source_hypothesis, investigation_status, confidence_score, priority_score, control_measures, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`, [cluster_id, pathogen, region, sub_region, latitude, longitude, radius_km, case_count, expected_count, scan_statistic, p_value, cluster_start, cluster_end, cluster_type, source_hypothesis, investigation_status, confidence_score, priority_score, control_measures, notes]);
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
    const { cluster_id, pathogen, region, sub_region, latitude, longitude, radius_km, case_count, expected_count, scan_statistic, p_value, cluster_start, cluster_end, cluster_type, source_hypothesis, investigation_status, confidence_score, priority_score, control_measures, notes } = req.body;
    const result = await pool.query(`INSERT INTO ${TABLE} (cluster_id, pathogen, region, sub_region, latitude, longitude, radius_km, case_count, expected_count, scan_statistic, p_value, cluster_start, cluster_end, cluster_type, source_hypothesis, investigation_status, confidence_score, priority_score, control_measures, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`, [cluster_id, pathogen, region, sub_region, latitude, longitude, radius_km, case_count, expected_count, scan_statistic, p_value, cluster_start, cluster_end, cluster_type, source_hypothesis, investigation_status, confidence_score, priority_score, control_measures, notes]);
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
    const logs = await pool.query(`SELECT * FROM ai_analyses WHERE endpoint ILIKE $1 ORDER BY created_at DESC LIMIT 50`, [`%cluster%`]);
    res.json({ data: record.rows[0], history: logs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI VERBS ──────────────────────────────────────────────────────────────────

router.post('/ai/detect-spatial-cluster', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, case_locations, time_period, population_data } = req.body;
    const analysis = await queryAI('You are a spatial epidemiologist. Detect spatial clusters in outbreak case data. Return JSON only.', `Detect spatial clusters:\nPathogen: ${pathogen}\nCase locations: ${JSON.stringify(case_locations)}\nTime period: ${time_period}\nPopulation data: ${JSON.stringify(population_data)}\nReturn JSON: {"clusters_detected": bool, "cluster_count": number, "clusters": [{"centroid": {"lat": number, "lng": number}, "radius_km": number, "case_count": number, "p_value": number, "significance": "..."}], "scan_statistic_used": "...", "overall_assessment": "..."}`);
    await persistAI(req.user?.id, 'cluster/detect-spatial-cluster', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-cluster-significance', auth, aiRateLimiter, async (req, res) => {
  try {
    const { cluster_id, case_count, expected_count, p_value, relative_risk } = req.body;
    const analysis = await queryAI('You are a spatial epidemiologist. Classify the statistical and public health significance of a cluster. Return JSON only.', `Classify cluster significance:\nCluster: ${cluster_id}\nCase count: ${case_count}\nExpected: ${expected_count}\nP-value: ${p_value}\nRelative risk: ${relative_risk}\nReturn JSON: {"statistical_significance": bool, "public_health_significance": "negligible|minor|moderate|major|critical", "significance_tier": "A|B|C|D", "action_threshold_met": bool, "rationale": "..."}`);
    await persistAI(req.user?.id, 'cluster/classify-cluster-significance', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-cluster-growth', auth, aiRateLimiter, async (req, res) => {
  try {
    const { cluster_id, case_timeline, current_size, demographic_data } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Predict cluster growth trajectory. Return JSON only.', `Predict cluster growth:\nCluster: ${cluster_id}\nCase timeline: ${JSON.stringify(case_timeline)}\nCurrent size: ${current_size}\nDemographics: ${JSON.stringify(demographic_data)}\nReturn JSON: {"predicted_size_7day": number, "predicted_size_14day": number, "growth_rate": number, "doubling_time_days": number, "peak_prediction": "...", "confidence": "low|medium|high"}`);
    await persistAI(req.user?.id, 'cluster/predict-cluster-growth', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-investigation', auth, aiRateLimiter, async (req, res) => {
  try {
    const { cluster_id, pathogen, region, case_count, cluster_type } = req.body;
    const analysis = await queryAI('You are a field epidemiologist. Recommend an investigation plan for a detected cluster. Return JSON only.', `Recommend cluster investigation:\nCluster: ${cluster_id}\nPathogen: ${pathogen}\nRegion: ${region}\nCase count: ${case_count}\nType: ${cluster_type}\nReturn JSON: {"investigation_priority": "low|routine|urgent|emergency", "immediate_steps": ["..."], "case_interviews": ["..."], "environmental_sampling": ["..."], "lab_testing": ["..."], "team_composition": ["..."], "expected_duration_days": number}`);
    await persistAI(req.user?.id, 'cluster/recommend-investigation', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-cluster-confidence', auth, aiRateLimiter, async (req, res) => {
  try {
    const { case_count, p_value, data_quality, case_ascertainment } = req.body;
    const analysis = await queryAI('You are a spatial epidemiologist. Score the confidence level of a cluster detection. Return JSON only.', `Score cluster confidence:\nCase count: ${case_count}\nP-value: ${p_value}\nData quality: ${data_quality}\nCase ascertainment: ${case_ascertainment}\nReturn JSON: {"confidence_score": 0-100, "confidence_tier": "low|moderate|high|very_high", "confidence_limiting_factors": ["..."], "recommended_validation_steps": ["..."]}`);
    await persistAI(req.user?.id, 'cluster/score-cluster-confidence', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-investigation-summary', auth, aiRateLimiter, async (req, res) => {
  try {
    const { cluster_id, investigation_findings, case_interviews, lab_results } = req.body;
    const analysis = await queryAI('You are a field epidemiologist. Generate an investigation summary for a cluster. Return JSON only.', `Generate investigation summary:\nCluster: ${cluster_id}\nFindings: ${JSON.stringify(investigation_findings)}\nCase interviews: ${JSON.stringify(case_interviews)}\nLab results: ${JSON.stringify(lab_results)}\nReturn JSON: {"summary": "...", "source_identified": bool, "source_hypothesis": "...", "attack_rate": number, "exposure_vehicle": "...", "control_measures_implemented": ["..."], "recommendations": ["..."]}`);
    await persistAI(req.user?.id, 'cluster/generate-investigation-summary', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-cluster-timeline', auth, aiRateLimiter, async (req, res) => {
  try {
    const { cluster_id, case_dates, exposure_dates, intervention_dates } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Summarize the timeline of a disease cluster. Return JSON only.', `Summarize cluster timeline:\nCluster: ${cluster_id}\nCase dates: ${JSON.stringify(case_dates)}\nExposure dates: ${JSON.stringify(exposure_dates)}\nIntervention dates: ${JSON.stringify(intervention_dates)}\nReturn JSON: {"timeline_summary": "...", "epidemic_curve_shape": "point_source|propagated|continuous", "incubation_period_estimate": "...", "peak_date": "...", "declining_since": "...", "key_events": ["..."]}`);
    await persistAI(req.user?.id, 'cluster/summarize-cluster-timeline', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/validate-scan-statistic', auth, aiRateLimiter, async (req, res) => {
  try {
    const { scan_statistic, p_value, method, simulation_runs, population_density } = req.body;
    const analysis = await queryAI('You are a biostatistician. Validate the scan statistic used for cluster detection. Return JSON only.', `Validate scan statistic:\nScan statistic: ${scan_statistic}\nP-value: ${p_value}\nMethod: ${method}\nSimulations: ${simulation_runs}\nPopulation density: ${population_density}\nReturn JSON: {"validation_result": "valid|questionable|invalid", "method_appropriateness": "...", "power_assessment": "...", "alternative_methods": ["..."], "limitations": ["..."], "recommendation": "..."}`);
    await persistAI(req.user?.id, 'cluster/validate-scan-statistic', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/suggest-buffer-radius', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, transmission_route, population_density, geographic_context } = req.body;
    const analysis = await queryAI('You are a spatial epidemiologist. Suggest optimal buffer radius for cluster analysis. Return JSON only.', `Suggest buffer radius:\nPathogen: ${pathogen}\nTransmission route: ${transmission_route}\nPopulation density: ${population_density}\nGeographic context: ${geographic_context}\nReturn JSON: {"recommended_radius_km": number, "minimum_radius_km": number, "maximum_radius_km": number, "rationale": "...", "sensitivity_considerations": "..."}`);
    await persistAI(req.user?.id, 'cluster/suggest-buffer-radius', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-pseudo-cluster', auth, aiRateLimiter, async (req, res) => {
  try {
    const { cluster_id, case_locations, reporting_patterns, facility_density } = req.body;
    const analysis = await queryAI('You are a spatial epidemiologist. Assess whether a detected cluster may be a pseudo-cluster due to reporting artifacts. Return JSON only.', `Detect pseudo-cluster:\nCluster: ${cluster_id}\nCase locations: ${JSON.stringify(case_locations)}\nReporting patterns: ${JSON.stringify(reporting_patterns)}\nFacility density: ${facility_density}\nReturn JSON: {"pseudo_cluster_likely": bool, "artifact_probability": 0-1, "artifact_types": ["..."], "genuine_cluster_probability": 0-1, "recommended_validation": ["..."]}`);
    await persistAI(req.user?.id, 'cluster/detect-pseudo-cluster', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-source-of-cluster', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, exposure_data, environmental_data, case_interviews } = req.body;
    const analysis = await queryAI('You are a field epidemiologist. Classify the most likely source of a disease cluster. Return JSON only.', `Classify cluster source:\nPathogen: ${pathogen}\nExposure data: ${JSON.stringify(exposure_data)}\nEnvironmental data: ${JSON.stringify(environmental_data)}\nCase interviews: ${JSON.stringify(case_interviews)}\nReturn JSON: {"primary_source_hypothesis": "...", "source_type": "foodborne|waterborne|airborne|person-to-person|zoonotic|environmental|unknown", "supporting_evidence": ["..."], "confidence": "low|medium|high", "alternative_hypotheses": ["..."]}`);
    await persistAI(req.user?.id, 'cluster/classify-source-of-cluster', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-spread-direction', auth, aiRateLimiter, async (req, res) => {
  try {
    const { cluster_centroid, mobility_data, wind_patterns, population_connectivity } = req.body;
    const analysis = await queryAI('You are a spatial epidemiologist. Predict the likely direction of cluster spread. Return JSON only.', `Predict spread direction:\nCluster centroid: ${JSON.stringify(cluster_centroid)}\nMobility data: ${JSON.stringify(mobility_data)}\nWind patterns: ${JSON.stringify(wind_patterns)}\nPopulation connectivity: ${JSON.stringify(population_connectivity)}\nReturn JSON: {"primary_spread_direction": "...", "high_risk_areas": ["..."], "spread_velocity_km_per_day": number, "predicted_new_cases_7day": number, "barrier_effectiveness": "..."}`);
    await persistAI(req.user?.id, 'cluster/predict-spread-direction', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-control-measures', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, cluster_size, source_hypothesis, population_at_risk } = req.body;
    const analysis = await queryAI('You are a public health epidemiologist. Recommend control measures for a disease cluster. Return JSON only.', `Recommend control measures:\nPathogen: ${pathogen}\nCluster size: ${cluster_size}\nSource hypothesis: ${source_hypothesis}\nPopulation at risk: ${population_at_risk}\nReturn JSON: {"immediate_measures": ["..."], "short_term_measures": ["..."], "long_term_measures": ["..."], "communication_actions": ["..."], "expected_effectiveness": "...", "resource_requirements": "..."}`);
    await persistAI(req.user?.id, 'cluster/recommend-control-measures', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-cluster-narrative', auth, aiRateLimiter, async (req, res) => {
  try {
    const { cluster_id, pathogen, region, timeline, investigation_status } = req.body;
    const analysis = await queryAI('You are a public health communicator. Generate a cluster narrative for reporting purposes. Return JSON only.', `Generate cluster narrative:\nCluster: ${cluster_id}\nPathogen: ${pathogen}\nRegion: ${region}\nTimeline: ${JSON.stringify(timeline)}\nInvestigation status: ${investigation_status}\nReturn JSON: {"narrative": "...", "key_facts": ["..."], "current_status": "...", "actions_taken": ["..."], "next_steps": ["..."]}`);
    await persistAI(req.user?.id, 'cluster/generate-cluster-narrative', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-cluster-priority', auth, aiRateLimiter, async (req, res) => {
  try {
    const { case_count, pathogen_severity, population_vulnerability, growth_rate, investigation_status } = req.body;
    const analysis = await queryAI('You are a public health epidemiologist. Score the investigation priority of a disease cluster. Return JSON only.', `Score cluster priority:\nCase count: ${case_count}\nPathogen severity: ${pathogen_severity}\nPopulation vulnerability: ${population_vulnerability}\nGrowth rate: ${growth_rate}\nInvestigation status: ${investigation_status}\nReturn JSON: {"priority_score": 0-100, "priority_tier": "low|medium|high|critical", "priority_drivers": ["..."], "response_timeline": "...", "resource_allocation": "..."}`);
    await persistAI(req.user?.id, 'cluster/score-cluster-priority', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-multi-cluster-pattern', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, clusters, time_period } = req.body;
    const analysis = await queryAI('You are a spatial epidemiologist. Summarize patterns across multiple concurrent clusters. Return JSON only.', `Summarize multi-cluster pattern:\nRegion: ${region}\nTime period: ${time_period}\nClusters: ${JSON.stringify(clusters)}\nReturn JSON: {"overall_situation": "...", "dominant_pathogen": "...", "geographic_spread": "localized|regional|widespread", "common_features": ["..."], "distinct_features": ["..."], "coordinated_response_needed": bool, "priority_actions": ["..."]}`);
    await persistAI(req.user?.id, 'cluster/summarize-multi-cluster-pattern', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
