const express = require('express');
const pool = require('../db');
const { queryAI, parseAIJson } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const router = express.Router();

const TABLE = 'who_ihr_reports';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      event_id VARCHAR(100),
      event_title TEXT,
      country_reporting VARCHAR(100),
      region VARCHAR(200),
      pathogen VARCHAR(200),
      disease_name VARCHAR(200),
      event_type VARCHAR(100),
      detection_date DATE,
      notification_date DATE,
      report_date DATE,
      ihr_article_involved VARCHAR(50),
      annex2_assessment_done BOOLEAN DEFAULT FALSE,
      pheic_likelihood VARCHAR(50),
      international_spread_risk VARCHAR(50),
      human_health_risk VARCHAR(50),
      event_description TEXT,
      case_count INTEGER,
      death_count INTEGER,
      affected_areas TEXT,
      control_measures TEXT,
      notification_status VARCHAR(100) DEFAULT 'draft',
      notification_completeness_score NUMERIC,
      reporter_credibility_score NUMERIC,
      verified BOOLEAN DEFAULT FALSE,
      status VARCHAR(50) DEFAULT 'active',
      archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureTable().catch(e => console.error('who_ihr_reports table init error:', e.message));

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ORDER BY detection_date DESC LIMIT $1 OFFSET $2`, [limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE}`),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/count', async (req, res) => {
  try {
    const where = []; const params = [];
    if (req.query.region) { params.push(req.query.region); where.push(`region=$${params.length}`); }
    if (req.query.notification_status) { params.push(req.query.notification_status); where.push(`notification_status=$${params.length}`); }
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
      pool.query(`SELECT * FROM ${TABLE} WHERE event_title ILIKE $1 OR pathogen ILIKE $1 OR country_reporting ILIKE $1 OR disease_name ILIKE $1 ORDER BY detection_date DESC LIMIT $2 OFFSET $3`, [q, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE event_title ILIKE $1 OR pathogen ILIKE $1 OR country_reporting ILIKE $1 OR disease_name ILIKE $1`, [q]),
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
      pool.query(`SELECT * FROM ${TABLE} WHERE region=$1 ORDER BY detection_date DESC LIMIT $2 OFFSET $3`, [req.params.region, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE region=$1`, [req.params.region]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-event/:event_id', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} WHERE event_id=$1`, [req.params.event_id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ data: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY detection_date DESC`);
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
    const [byStatus, byRisk, byCountry] = await Promise.all([
      pool.query(`SELECT notification_status, COUNT(*) as count FROM ${TABLE} GROUP BY notification_status`),
      pool.query(`SELECT pheic_likelihood, COUNT(*) as count FROM ${TABLE} GROUP BY pheic_likelihood`),
      pool.query(`SELECT country_reporting, COUNT(*) as count FROM ${TABLE} GROUP BY country_reporting ORDER BY count DESC LIMIT 10`),
    ]);
    res.json({ by_notification_status: byStatus.rows, by_pheic_likelihood: byRisk.rows, top_reporting_countries: byCountry.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch-create', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { event_id, event_title, country_reporting, region, pathogen, disease_name, event_type, detection_date, notification_date, report_date, ihr_article_involved, annex2_assessment_done, pheic_likelihood, international_spread_risk, human_health_risk, event_description, case_count, death_count, affected_areas, control_measures, notification_status, notes } = item;
      const r = await pool.query(`INSERT INTO ${TABLE} (event_id, event_title, country_reporting, region, pathogen, disease_name, event_type, detection_date, notification_date, report_date, ihr_article_involved, annex2_assessment_done, pheic_likelihood, international_spread_risk, human_health_risk, event_description, case_count, death_count, affected_areas, control_measures, notification_status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`, [event_id, event_title, country_reporting, region, pathogen, disease_name, event_type, detection_date, notification_date, report_date, ihr_article_involved, annex2_assessment_done, pheic_likelihood, international_spread_risk, human_health_risk, event_description, case_count, death_count, affected_areas, control_measures, notification_status, notes]);
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
    const { event_id, event_title, country_reporting, region, pathogen, disease_name, event_type, detection_date, notification_date, report_date, ihr_article_involved, annex2_assessment_done, pheic_likelihood, international_spread_risk, human_health_risk, event_description, case_count, death_count, affected_areas, control_measures, notification_status, notes } = req.body;
    const result = await pool.query(`INSERT INTO ${TABLE} (event_id, event_title, country_reporting, region, pathogen, disease_name, event_type, detection_date, notification_date, report_date, ihr_article_involved, annex2_assessment_done, pheic_likelihood, international_spread_risk, human_health_risk, event_description, case_count, death_count, affected_areas, control_measures, notification_status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`, [event_id, event_title, country_reporting, region, pathogen, disease_name, event_type, detection_date, notification_date, report_date, ihr_article_involved, annex2_assessment_done, pheic_likelihood, international_spread_risk, human_health_risk, event_description, case_count, death_count, affected_areas, control_measures, notification_status, notes]);
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
    const logs = await pool.query(`SELECT * FROM ai_analyses WHERE endpoint ILIKE $1 ORDER BY created_at DESC LIMIT 50`, [`%ihr%`]);
    res.json({ data: record.rows[0], history: logs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI VERBS ──────────────────────────────────────────────────────────────────

router.post('/ai/classify-ihr-event-priority', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_title, pathogen, case_count, death_count, international_spread_risk } = req.body;
    const analysis = await queryAI('You are a WHO IHR expert. Classify the priority level of a potential IHR event. Return JSON only.', `Classify IHR event priority:\nEvent: ${event_title}\nPathogen: ${pathogen}\nCases: ${case_count}\nDeaths: ${death_count}\nInternational spread risk: ${international_spread_risk}\nReturn JSON: {"priority_level": "low|moderate|high|emergency", "ihr_relevance": bool, "notification_required": bool, "rationale": "...", "urgency_score": 0-100}`);
    await persistAI(req.user?.id, 'ihr/classify-ihr-event-priority', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/suggest-notifiable-disease-match', auth, aiRateLimiter, async (req, res) => {
  try {
    const { clinical_description, pathogen, laboratory_results, geographic_context } = req.body;
    const analysis = await queryAI('You are a WHO IHR expert. Match the event to notifiable disease categories under IHR 2005. Return JSON only.', `Suggest notifiable disease match:\nClinical description: ${clinical_description}\nPathogen: ${pathogen}\nLab results: ${JSON.stringify(laboratory_results)}\nGeographic context: ${geographic_context}\nReturn JSON: {"primary_match": "...", "confidence": "low|medium|high", "ihr_annex2_diseases": ["..."], "notifiable_per_annex1": bool, "always_notifiable": bool, "notifiable_under_criteria": bool, "recommended_action": "..."}`);
    await persistAI(req.user?.id, 'ihr/suggest-notifiable-disease-match', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-event-threshold-crossing', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_metrics, ihr_thresholds, disease_category } = req.body;
    const analysis = await queryAI('You are a WHO IHR expert. Determine whether IHR notification thresholds have been crossed. Return JSON only.', `Detect IHR threshold crossing:\nEvent metrics: ${JSON.stringify(event_metrics)}\nIHR thresholds: ${JSON.stringify(ihr_thresholds)}\nDisease category: ${disease_category}\nReturn JSON: {"threshold_crossed": bool, "thresholds_met": ["..."], "notification_obligation": bool, "time_to_notify_hours": number, "justification": "...", "escalation_recommended": bool}`);
    await persistAI(req.user?.id, 'ihr/detect-event-threshold-crossing', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-international-spread', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, origin_country, travel_connectivity, case_count, pathogen_characteristics } = req.body;
    const analysis = await queryAI('You are a WHO risk assessment expert. Predict the likelihood of international spread of a pathogen event. Return JSON only.', `Predict international spread:\nPathogen: ${pathogen}\nOrigin country: ${origin_country}\nTravel connectivity: ${JSON.stringify(travel_connectivity)}\nCase count: ${case_count}\nPathogen characteristics: ${JSON.stringify(pathogen_characteristics)}\nReturn JSON: {"spread_probability": 0-1, "spread_risk": "low|moderate|high|very_high", "high_risk_destinations": ["..."], "time_to_international_detection_days": number, "factors_driving_risk": ["..."]}`);
    await persistAI(req.user?.id, 'ihr/predict-international-spread', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-notification-timing', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_id, detection_date, verification_status, ihr_article, urgency } = req.body;
    const analysis = await queryAI('You are a WHO IHR focal point advisor. Recommend optimal notification timing under IHR 2005. Return JSON only.', `Recommend notification timing:\nEvent: ${event_id}\nDetection date: ${detection_date}\nVerification status: ${verification_status}\nIHR article: ${ihr_article}\nUrgency: ${urgency}\nReturn JSON: {"recommended_notification_date": "...", "hours_remaining": number, "notification_window": "...", "ihrf_contact_recommended": bool, "rationale": "...", "pre_notification_steps": ["..."]}`);
    await persistAI(req.user?.id, 'ihr/recommend-notification-timing', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-ihr-notification-draft', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_details, country_context, control_measures } = req.body;
    const analysis = await queryAI('You are a WHO IHR expert. Draft a formal IHR notification to WHO. Return JSON only.', `Generate IHR notification draft:\nEvent details: ${JSON.stringify(event_details)}\nCountry context: ${country_context}\nControl measures: ${JSON.stringify(control_measures)}\nReturn JSON: {"notification_draft": "...", "ihr_article_invoked": "...", "key_information_included": ["..."], "missing_information": ["..."], "review_checklist": ["..."], "ready_to_submit": bool}`);
    await persistAI(req.user?.id, 'ihr/generate-ihr-notification-draft', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-event-context', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_id, event_description, case_data, environmental_context } = req.body;
    const analysis = await queryAI('You are a WHO event management expert. Summarize the context of a potential IHR event. Return JSON only.', `Summarize event context:\nEvent: ${event_id}\nDescription: ${event_description}\nCase data: ${JSON.stringify(case_data)}\nEnvironmental context: ${environmental_context}\nReturn JSON: {"context_summary": "...", "key_unknowns": ["..."], "risk_factors": ["..."], "protective_factors": ["..."], "information_completeness": "...", "next_information_priorities": ["..."]}`);
    await persistAI(req.user?.id, 'ihr/summarize-event-context', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-notification-completeness', auth, aiRateLimiter, async (req, res) => {
  try {
    const { notification_fields, event_id } = req.body;
    const analysis = await queryAI('You are a WHO IHR focal point. Score the completeness of an IHR notification. Return JSON only.', `Score notification completeness:\nEvent: ${event_id}\nNotification fields: ${JSON.stringify(notification_fields)}\nReturn JSON: {"completeness_score": 0-100, "completeness_tier": "incomplete|partial|mostly_complete|complete", "missing_required_fields": ["..."], "missing_recommended_fields": ["..."], "quality_issues": ["..."], "submission_ready": bool}`);
    await persistAI(req.user?.id, 'ihr/score-notification-completeness', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/validate-annex2-decision-instrument', auth, aiRateLimiter, async (req, res) => {
  try {
    const { disease_category, criteria_responses, pathogen } = req.body;
    const analysis = await queryAI('You are a WHO IHR expert. Validate the Annex 2 decision instrument assessment. Return JSON only.', `Validate Annex 2 assessment:\nDisease category: ${disease_category}\nPathogen: ${pathogen}\nCriteria responses: ${JSON.stringify(criteria_responses)}\nReturn JSON: {"notification_required": bool, "annex2_pathway": "annex1_disease|criteria_based|both|neither", "criteria_triggered": ["..."], "assessment_valid": bool, "assessment_gaps": ["..."], "final_recommendation": "..."}`);
    await persistAI(req.user?.id, 'ihr/validate-annex2-decision-instrument', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/suggest-additional-context', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_id, current_information, who_questions } = req.body;
    const analysis = await queryAI('You are a WHO IHR expert. Suggest additional context to strengthen an IHR notification. Return JSON only.', `Suggest additional context:\nEvent: ${event_id}\nCurrent info: ${JSON.stringify(current_information)}\nWHO questions: ${JSON.stringify(who_questions)}\nReturn JSON: {"additional_context_needed": ["..."], "priority_information_gaps": ["..."], "data_sources_to_consult": ["..."], "suggested_expert_consultations": ["..."]}`);
    await persistAI(req.user?.id, 'ihr/suggest-additional-context', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-rumor-vs-verified', auth, aiRateLimiter, async (req, res) => {
  try {
    const { information_source, event_details, verification_attempts } = req.body;
    const analysis = await queryAI('You are a WHO event management expert. Assess whether event information is rumor or verified. Return JSON only.', `Detect rumor vs verified:\nSource: ${information_source}\nEvent details: ${JSON.stringify(event_details)}\nVerification attempts: ${JSON.stringify(verification_attempts)}\nReturn JSON: {"verification_status": "unverified_rumor|partially_verified|verified|false_alarm", "verification_confidence": 0-1, "verification_gaps": ["..."], "recommended_verification_steps": ["..."], "action_before_verification": "..."}`);
    await persistAI(req.user?.id, 'ihr/detect-rumor-vs-verified', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-pheic-likelihood', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_id, pheic_criteria_assessment, historical_analogues } = req.body;
    const analysis = await queryAI('You are a WHO IHR expert. Classify the likelihood that an event warrants PHEIC declaration. Return JSON only.', `Classify PHEIC likelihood:\nEvent: ${event_id}\nPHEIC criteria assessment: ${JSON.stringify(pheic_criteria_assessment)}\nHistorical analogues: ${JSON.stringify(historical_analogues)}\nReturn JSON: {"pheic_likelihood": "unlikely|possible|probable|highly_probable", "criteria_met": ["..."], "criteria_not_met": ["..."], "committee_convening_recommended": bool, "rationale": "..."}`);
    await persistAI(req.user?.id, 'ihr/classify-pheic-likelihood', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-who-followup-questions', auth, aiRateLimiter, async (req, res) => {
  try {
    const { notification_draft, event_type, disease_category } = req.body;
    const analysis = await queryAI('You are a WHO IHR focal point. Predict the follow-up questions WHO is likely to ask. Return JSON only.', `Predict WHO follow-up questions:\nNotification draft: ${notification_draft}\nEvent type: ${event_type}\nDisease category: ${disease_category}\nReturn JSON: {"predicted_questions": ["..."], "information_to_prepare": ["..."], "response_timeline_hours": number, "technical_experts_to_engage": ["..."]}`);
    await persistAI(req.user?.id, 'ihr/predict-who-followup-questions', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-multi-source-corroboration', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_id, primary_source, event_type, region } = req.body;
    const analysis = await queryAI('You are a WHO event management expert. Recommend sources to corroborate event information. Return JSON only.', `Recommend corroboration sources:\nEvent: ${event_id}\nPrimary source: ${primary_source}\nEvent type: ${event_type}\nRegion: ${region}\nReturn JSON: {"recommended_sources": [{"source": "...", "source_type": "...", "query": "...", "priority": "high|medium|low"}], "minimum_sources_for_confidence": number, "corroboration_timeline": "..."}`);
    await persistAI(req.user?.id, 'ihr/recommend-multi-source-corroboration', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-followup-report', auth, aiRateLimiter, async (req, res) => {
  try {
    const { event_id, initial_notification, situation_update, control_measures_update } = req.body;
    const analysis = await queryAI('You are a WHO IHR focal point. Generate a follow-up report for an ongoing IHR event. Return JSON only.', `Generate follow-up report:\nEvent: ${event_id}\nInitial notification: ${JSON.stringify(initial_notification)}\nSituation update: ${situation_update}\nControl measures update: ${JSON.stringify(control_measures_update)}\nReturn JSON: {"report_title": "...", "report_body": "...", "situation_summary": "...", "changes_since_last_report": ["..."], "remaining_unknowns": ["..."], "projected_trajectory": "..."}`);
    await persistAI(req.user?.id, 'ihr/generate-followup-report', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-reporter-credibility', auth, aiRateLimiter, async (req, res) => {
  try {
    const { reporter_type, past_accuracy, verification_details, source_independence } = req.body;
    const analysis = await queryAI('You are a WHO intelligence analyst. Score the credibility of an event reporter or information source. Return JSON only.', `Score reporter credibility:\nReporter type: ${reporter_type}\nPast accuracy: ${JSON.stringify(past_accuracy)}\nVerification details: ${verification_details}\nSource independence: ${source_independence}\nReturn JSON: {"credibility_score": 0-100, "credibility_tier": "unreliable|low|moderate|high|very_high", "credibility_factors": ["..."], "credibility_concerns": ["..."], "verification_weight": "high|medium|low"}`);
    await persistAI(req.user?.id, 'ihr/score-reporter-credibility', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
