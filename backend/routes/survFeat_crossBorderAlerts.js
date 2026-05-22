const express = require('express');
const pool = require('../db');
const { queryAI, parseAIJson } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const router = express.Router();

const TABLE = 'cross_border_alerts';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      alert_id VARCHAR(100),
      alert_title TEXT,
      origin_country VARCHAR(100),
      destination_country VARCHAR(100),
      corridor VARCHAR(200),
      pathogen VARCHAR(200),
      threat_type VARCHAR(100),
      imported_cases INTEGER DEFAULT 0,
      local_cases INTEGER DEFAULT 0,
      detection_date DATE,
      alert_date DATE,
      threat_imminence_score NUMERIC,
      cooperation_readiness_score NUMERIC,
      poe_readiness VARCHAR(100),
      traveler_advisory_issued BOOLEAN DEFAULT FALSE,
      joint_investigation_status VARCHAR(100) DEFAULT 'not_started',
      bilateral_communication_status VARCHAR(100) DEFAULT 'pending',
      vector_shared BOOLEAN DEFAULT FALSE,
      risk_by_corridor VARCHAR(100),
      importation_likelihood NUMERIC,
      screening_measures TEXT,
      alert_level VARCHAR(50) DEFAULT 'informational',
      status VARCHAR(50) DEFAULT 'active',
      archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureTable().catch(e => console.error('cross_border_alerts table init error:', e.message));

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ORDER BY alert_date DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/count', async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.origin_country) { params.push(req.query.origin_country); where.push(`origin_country=$${params.length}`); }
    if (req.query.destination_country) { params.push(req.query.destination_country); where.push(`destination_country=$${params.length}`); }
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
      pool.query(`SELECT * FROM ${TABLE} WHERE alert_title ILIKE $1 OR pathogen ILIKE $1 OR origin_country ILIKE $1 OR destination_country ILIKE $1 OR corridor ILIKE $1 ORDER BY alert_date DESC LIMIT $2 OFFSET $3`, [q, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE alert_title ILIKE $1 OR pathogen ILIKE $1 OR origin_country ILIKE $1 OR destination_country ILIKE $1 OR corridor ILIKE $1`, [q]),
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
      pool.query(`SELECT * FROM ${TABLE} WHERE corridor ILIKE $1 ORDER BY alert_date DESC LIMIT $2 OFFSET $3`, [`%${req.params.region}%`, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE corridor ILIKE $1`, [`%${req.params.region}%`]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-corridor/:corridor', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE corridor=$1 ORDER BY alert_date DESC LIMIT $2 OFFSET $3`, [req.params.corridor, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE corridor=$1`, [req.params.corridor]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY alert_date DESC`);
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
    const [byThreat, byCorridor, byAlert] = await Promise.all([
      pool.query(`SELECT threat_type, COUNT(*) as count FROM ${TABLE} GROUP BY threat_type ORDER BY count DESC`),
      pool.query(`SELECT corridor, COUNT(*) as count FROM ${TABLE} GROUP BY corridor ORDER BY count DESC LIMIT 10`),
      pool.query(`SELECT alert_level, COUNT(*) as count FROM ${TABLE} GROUP BY alert_level`),
    ]);
    res.json({ by_threat_type: byThreat.rows, by_corridor: byCorridor.rows, by_alert_level: byAlert.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch-create', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { alert_id, alert_title, origin_country, destination_country, corridor, pathogen, threat_type, imported_cases, local_cases, detection_date, alert_date, threat_imminence_score, cooperation_readiness_score, poe_readiness, traveler_advisory_issued, joint_investigation_status, bilateral_communication_status, vector_shared, risk_by_corridor, importation_likelihood, screening_measures, alert_level, notes } = item;
      const r = await pool.query(`INSERT INTO ${TABLE} (alert_id, alert_title, origin_country, destination_country, corridor, pathogen, threat_type, imported_cases, local_cases, detection_date, alert_date, threat_imminence_score, cooperation_readiness_score, poe_readiness, traveler_advisory_issued, joint_investigation_status, bilateral_communication_status, vector_shared, risk_by_corridor, importation_likelihood, screening_measures, alert_level, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`, [alert_id, alert_title, origin_country, destination_country, corridor, pathogen, threat_type, imported_cases, local_cases, detection_date, alert_date, threat_imminence_score, cooperation_readiness_score, poe_readiness, traveler_advisory_issued, joint_investigation_status, bilateral_communication_status, vector_shared, risk_by_corridor, importation_likelihood, screening_measures, alert_level, notes]);
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
    const { alert_id, alert_title, origin_country, destination_country, corridor, pathogen, threat_type, imported_cases, local_cases, detection_date, alert_date, threat_imminence_score, cooperation_readiness_score, poe_readiness, traveler_advisory_issued, joint_investigation_status, bilateral_communication_status, vector_shared, risk_by_corridor, importation_likelihood, screening_measures, alert_level, notes } = req.body;
    const result = await pool.query(`INSERT INTO ${TABLE} (alert_id, alert_title, origin_country, destination_country, corridor, pathogen, threat_type, imported_cases, local_cases, detection_date, alert_date, threat_imminence_score, cooperation_readiness_score, poe_readiness, traveler_advisory_issued, joint_investigation_status, bilateral_communication_status, vector_shared, risk_by_corridor, importation_likelihood, screening_measures, alert_level, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) RETURNING *`, [alert_id, alert_title, origin_country, destination_country, corridor, pathogen, threat_type, imported_cases, local_cases, detection_date, alert_date, threat_imminence_score, cooperation_readiness_score, poe_readiness, traveler_advisory_issued, joint_investigation_status, bilateral_communication_status, vector_shared, risk_by_corridor, importation_likelihood, screening_measures, alert_level, notes]);
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
    const logs = await pool.query(`SELECT * FROM ai_analyses WHERE endpoint ILIKE $1 ORDER BY created_at DESC LIMIT 50`, [`%cross-border%`]);
    res.json({ data: record.rows[0], history: logs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI VERBS ──────────────────────────────────────────────────────────────────

router.post('/ai/classify-cross-border-threat', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, origin_country, destination_country, travel_volume, threat_characteristics } = req.body;
    const analysis = await queryAI('You are a cross-border health security expert. Classify a cross-border health threat. Return JSON only.', `Classify cross-border threat:\nPathogen: ${pathogen}\nOrigin: ${origin_country}\nDestination: ${destination_country}\nTravel volume: ${travel_volume}\nThreat characteristics: ${JSON.stringify(threat_characteristics)}\nReturn JSON: {"threat_category": "biological|chemical|radiological|unknown", "threat_level": "low|moderate|high|critical", "cross_border_risk": "low|moderate|high|very_high", "ihr_relevance": bool, "priority_interventions": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/classify-cross-border-threat', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-imported-case', auth, aiRateLimiter, async (req, res) => {
  try {
    const { case_details, travel_history, local_epidemiology, pathogen } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Assess whether a case represents an imported infection. Return JSON only.', `Detect imported case:\nCase details: ${JSON.stringify(case_details)}\nTravel history: ${JSON.stringify(travel_history)}\nLocal epidemiology: ${JSON.stringify(local_epidemiology)}\nPathogen: ${pathogen}\nReturn JSON: {"imported_case": bool, "confidence": "low|medium|high", "probable_exposure_country": "...", "exposure_window": "...", "local_transmission_risk": "low|moderate|high", "contact_tracing_priority": "routine|urgent|emergency"}`);
    await persistAI(req.user?.id, 'cross-border/detect-imported-case', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-importation-likelihood', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, origin_country, destination_country, daily_travelers, pathogen_prevalence } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Predict the likelihood of pathogen importation via travel. Return JSON only.', `Predict importation likelihood:\nPathogen: ${pathogen}\nOrigin: ${origin_country}\nDestination: ${destination_country}\nDaily travelers: ${daily_travelers}\nPathogen prevalence: ${pathogen_prevalence}\nReturn JSON: {"importation_probability_7day": 0-1, "importation_probability_30day": 0-1, "expected_imported_cases_monthly": number, "confidence": "low|medium|high", "key_risk_factors": ["..."], "mitigation_effect_of_screening": number}`);
    await persistAI(req.user?.id, 'cross-border/predict-importation-likelihood', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-border-screening', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, threat_level, poe_type, available_resources } = req.body;
    const analysis = await queryAI('You are a border health expert. Recommend border screening measures for a health threat. Return JSON only.', `Recommend border screening:\nPathogen: ${pathogen}\nThreat level: ${threat_level}\nPOE type: ${poe_type}\nAvailable resources: ${JSON.stringify(available_resources)}\nReturn JSON: {"screening_measures": ["..."], "screening_intensity": "passive|active|enhanced", "target_travelers": ["..."], "screening_tools": ["..."], "expected_case_detection_rate": number, "resource_requirements": "...", "implementation_timeline": "..."}`);
    await persistAI(req.user?.id, 'cross-border/recommend-border-screening', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-threat-imminence', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, origin_outbreak_status, travel_patterns, detection_capability } = req.body;
    const analysis = await queryAI('You are a health security analyst. Score the imminence of a cross-border health threat. Return JSON only.', `Score threat imminence:\nPathogen: ${pathogen}\nOrigin outbreak status: ${origin_outbreak_status}\nTravel patterns: ${JSON.stringify(travel_patterns)}\nDetection capability: ${detection_capability}\nReturn JSON: {"imminence_score": 0-100, "imminence_tier": "distant|emerging|imminent|present", "time_to_first_case_days": number, "confidence": "low|medium|high", "driver_factors": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/score-threat-imminence', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-alert-narrative', auth, aiRateLimiter, async (req, res) => {
  try {
    const { alert_id, pathogen, origin_country, destination_country, threat_level, key_facts } = req.body;
    const analysis = await queryAI('You are a cross-border health security communicator. Generate an alert narrative. Return JSON only.', `Generate alert narrative:\nAlert: ${alert_id}\nPathogen: ${pathogen}\nOrigin: ${origin_country}\nDestination: ${destination_country}\nThreat level: ${threat_level}\nKey facts: ${JSON.stringify(key_facts)}\nReturn JSON: {"alert_title": "...", "narrative": "...", "key_messages": ["..."], "traveler_guidance": "...", "public_health_actions": ["..."], "partner_notification": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/generate-alert-narrative', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-bilateral-coordination', auth, aiRateLimiter, async (req, res) => {
  try {
    const { country_a, country_b, coordination_activities, shared_data } = req.body;
    const analysis = await queryAI('You are a cross-border health security coordinator. Summarize bilateral health coordination activities. Return JSON only.', `Summarize bilateral coordination:\nCountry A: ${country_a}\nCountry B: ${country_b}\nCoordination activities: ${JSON.stringify(coordination_activities)}\nShared data: ${JSON.stringify(shared_data)}\nReturn JSON: {"coordination_summary": "...", "active_mechanisms": ["..."], "gaps_identified": ["..."], "effectiveness_assessment": "...", "recommended_next_steps": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/summarize-bilateral-coordination', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/validate-poe-readiness', auth, aiRateLimiter, async (req, res) => {
  try {
    const { poe_name, poe_type, available_resources, ihr_core_capacities } = req.body;
    const analysis = await queryAI('You are an IHR port health expert. Validate the readiness of a point of entry for health event response. Return JSON only.', `Validate POE readiness:\nPOE: ${poe_name}\nType: ${poe_type}\nResources: ${JSON.stringify(available_resources)}\nIHR core capacities: ${JSON.stringify(ihr_core_capacities)}\nReturn JSON: {"readiness_score": 0-100, "readiness_tier": "inadequate|developing|functional|advanced", "capacity_gaps": ["..."], "priority_improvements": ["..."], "ihr_compliance": "partial|substantial|full", "recommended_actions": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/validate-poe-readiness', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/suggest-traveler-advisory', auth, aiRateLimiter, async (req, res) => {
  try {
    const { destination_country, pathogen, risk_level, traveler_types } = req.body;
    const analysis = await queryAI('You are a travel health expert. Suggest traveler advisory content for a health threat. Return JSON only.', `Suggest traveler advisory:\nDestination: ${destination_country}\nPathogen: ${pathogen}\nRisk level: ${risk_level}\nTraveler types: ${JSON.stringify(traveler_types)}\nReturn JSON: {"advisory_level": "routine|watch|warning|do_not_travel", "advisory_text": "...", "recommended_precautions": ["..."], "vaccine_requirements": ["..."], "health_monitoring_period_days": number, "emergency_contacts": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/suggest-traveler-advisory', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-shared-vector', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, countries, vector_distribution, climatic_data } = req.body;
    const analysis = await queryAI('You are a vector-borne disease epidemiologist. Assess shared vector risk across borders. Return JSON only.', `Detect shared vector:\nPathogen: ${pathogen}\nCountries: ${JSON.stringify(countries)}\nVector distribution: ${JSON.stringify(vector_distribution)}\nClimatic data: ${JSON.stringify(climatic_data)}\nReturn JSON: {"shared_vector_detected": bool, "vector_species": ["..."], "affected_corridor": "...", "range_overlap_percentage": number, "cross_border_amplification_risk": "low|moderate|high", "coordinated_control_recommended": bool}`);
    await persistAI(req.user?.id, 'cross-border/detect-shared-vector', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-risk-by-corridor', auth, aiRateLimiter, async (req, res) => {
  try {
    const { corridors, pathogen, trade_flows, travel_volumes } = req.body;
    const analysis = await queryAI('You are a cross-border health security analyst. Classify health risk by travel and trade corridor. Return JSON only.', `Classify risk by corridor:\nCorridors: ${JSON.stringify(corridors)}\nPathogen: ${pathogen}\nTrade flows: ${JSON.stringify(trade_flows)}\nTravel volumes: ${JSON.stringify(travel_volumes)}\nReturn JSON: {"corridor_risk_rankings": [{"corridor": "...", "risk_level": "low|moderate|high|critical", "primary_risk_drivers": ["..."], "recommended_measures": ["..."]}], "highest_risk_corridor": "...", "strategic_priorities": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/classify-risk-by-corridor', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-cross-border-cases', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, origin_cases, travel_volume, screening_effectiveness, incubation_period } = req.body;
    const analysis = await queryAI('You are an epidemiologist. Predict cross-border case importation. Return JSON only.', `Predict cross-border cases:\nPathogen: ${pathogen}\nOrigin cases: ${origin_cases}\nTravel volume: ${travel_volume}\nScreening effectiveness: ${screening_effectiveness}%\nIncubation period: ${incubation_period} days\nReturn JSON: {"predicted_imported_cases_30day": number, "predicted_imported_cases_90day": number, "detection_rate": number, "undetected_importations": number, "confidence_interval": {"lower": number, "upper": number}, "key_assumptions": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/predict-cross-border-cases', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-joint-investigation', auth, aiRateLimiter, async (req, res) => {
  try {
    const { alert_id, countries_involved, pathogen, case_clusters } = req.body;
    const analysis = await queryAI('You are a cross-border health security coordinator. Recommend a joint investigation plan. Return JSON only.', `Recommend joint investigation:\nAlert: ${alert_id}\nCountries: ${JSON.stringify(countries_involved)}\nPathogen: ${pathogen}\nCase clusters: ${JSON.stringify(case_clusters)}\nReturn JSON: {"investigation_structure": "...", "lead_country": "...", "team_composition": ["..."], "data_sharing_protocol": "...", "joint_activities": ["..."], "coordination_mechanism": "...", "timeline": "..."}`);
    await persistAI(req.user?.id, 'cross-border/recommend-joint-investigation', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-bilateral-brief', auth, aiRateLimiter, async (req, res) => {
  try {
    const { country_a, country_b, alert_summary, coordination_history } = req.body;
    const analysis = await queryAI('You are a cross-border health security communicator. Generate a bilateral brief for partner countries. Return JSON only.', `Generate bilateral brief:\nCountry A: ${country_a}\nCountry B: ${country_b}\nAlert summary: ${alert_summary}\nCoordination history: ${JSON.stringify(coordination_history)}\nReturn JSON: {"brief_title": "...", "situation_summary": "...", "shared_risk_assessment": "...", "coordinated_actions_requested": ["..."], "data_exchange_requests": ["..."], "meeting_recommendation": bool}`);
    await persistAI(req.user?.id, 'cross-border/generate-bilateral-brief', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-cooperation-readiness', auth, aiRateLimiter, async (req, res) => {
  try {
    const { country_a, country_b, existing_agreements, communication_channels, past_cooperation } = req.body;
    const analysis = await queryAI('You are a cross-border health security expert. Score bilateral cooperation readiness. Return JSON only.', `Score cooperation readiness:\nCountry A: ${country_a}\nCountry B: ${country_b}\nExisting agreements: ${JSON.stringify(existing_agreements)}\nCommunication channels: ${JSON.stringify(communication_channels)}\nPast cooperation: ${JSON.stringify(past_cooperation)}\nReturn JSON: {"cooperation_readiness_score": 0-100, "readiness_tier": "poor|developing|functional|strong", "strengths": ["..."], "gaps": ["..."], "quick_win_improvements": ["..."], "capacity_building_needs": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/score-cooperation-readiness', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-cross-border-history', auth, aiRateLimiter, async (req, res) => {
  try {
    const { country_a, country_b, historical_alerts, coordination_outcomes } = req.body;
    const analysis = await queryAI('You are a cross-border health security analyst. Summarize historical cross-border health events between countries. Return JSON only.', `Summarize cross-border history:\nCountry A: ${country_a}\nCountry B: ${country_b}\nHistorical alerts: ${JSON.stringify(historical_alerts)}\nCoordination outcomes: ${JSON.stringify(coordination_outcomes)}\nReturn JSON: {"summary": "...", "total_historical_events": number, "most_common_threats": ["..."], "coordination_effectiveness": "...", "lessons_learned": ["..."], "strategic_priorities": ["..."]}`);
    await persistAI(req.user?.id, 'cross-border/summarize-cross-border-history', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
