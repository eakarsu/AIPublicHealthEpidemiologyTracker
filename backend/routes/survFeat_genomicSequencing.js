const express = require('express');
const pool = require('../db');
const { queryAI, parseAIJson } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const router = express.Router();

const TABLE = 'genomic_sequences';

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id SERIAL PRIMARY KEY,
      sample_id VARCHAR(100),
      pathogen VARCHAR(200),
      lineage VARCHAR(200),
      variant_name VARCHAR(200),
      collection_date DATE,
      region VARCHAR(200),
      country VARCHAR(100),
      accession_number VARCHAR(100),
      genome_coverage NUMERIC,
      sequencing_depth NUMERIC,
      quality_score NUMERIC,
      mutations TEXT,
      spike_mutations TEXT,
      nextstrain_clade VARCHAR(100),
      gisaid_clade VARCHAR(100),
      sequencing_platform VARCHAR(100),
      lab_id VARCHAR(100),
      is_novel_variant BOOLEAN DEFAULT FALSE,
      clinical_outcome VARCHAR(100),
      status VARCHAR(50) DEFAULT 'active',
      archived BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}
ensureTable().catch(e => console.error('genomic_sequences table init error:', e.message));

// ── CRUD ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} ORDER BY collection_date DESC LIMIT $1 OFFSET $2`, [limit, offset]),
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
      pool.query(`SELECT * FROM ${TABLE} WHERE pathogen ILIKE $1 OR lineage ILIKE $1 OR variant_name ILIKE $1 OR region ILIKE $1 ORDER BY collection_date DESC LIMIT $2 OFFSET $3`, [q, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE pathogen ILIKE $1 OR lineage ILIKE $1 OR variant_name ILIKE $1 OR region ILIKE $1`, [q]),
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
      pool.query(`SELECT * FROM ${TABLE} WHERE region=$1 ORDER BY collection_date DESC LIMIT $2 OFFSET $3`, [req.params.region, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE region=$1`, [req.params.region]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/by-lineage/:lineage', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countRes] = await Promise.all([
      pool.query(`SELECT * FROM ${TABLE} WHERE lineage=$1 ORDER BY collection_date DESC LIMIT $2 OFFSET $3`, [req.params.lineage, limit, offset]),
      pool.query(`SELECT COUNT(*) FROM ${TABLE} WHERE lineage=$1`, [req.params.lineage]),
    ]);
    res.json({ data: rows.rows, pagination: { page, limit, total: parseInt(countRes.rows[0].count), totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export/csv', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM ${TABLE} ORDER BY collection_date DESC`);
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
    const [byLineage, byRegion, byPathogen] = await Promise.all([
      pool.query(`SELECT lineage, COUNT(*) as count FROM ${TABLE} GROUP BY lineage ORDER BY count DESC LIMIT 20`),
      pool.query(`SELECT region, COUNT(*) as count FROM ${TABLE} GROUP BY region ORDER BY count DESC`),
      pool.query(`SELECT pathogen, COUNT(*) as count, AVG(quality_score) as avg_quality FROM ${TABLE} GROUP BY pathogen`),
    ]);
    res.json({ by_lineage: byLineage.rows, by_region: byRegion.rows, by_pathogen: byPathogen.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/batch-create', auth, async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });
    const created = [];
    for (const item of items) {
      const { sample_id, pathogen, lineage, variant_name, collection_date, region, country, accession_number, genome_coverage, sequencing_depth, quality_score, mutations, spike_mutations, nextstrain_clade, gisaid_clade, sequencing_platform, lab_id, is_novel_variant, clinical_outcome, notes } = item;
      const r = await pool.query(`INSERT INTO ${TABLE} (sample_id, pathogen, lineage, variant_name, collection_date, region, country, accession_number, genome_coverage, sequencing_depth, quality_score, mutations, spike_mutations, nextstrain_clade, gisaid_clade, sequencing_platform, lab_id, is_novel_variant, clinical_outcome, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`, [sample_id, pathogen, lineage, variant_name, collection_date, region, country, accession_number, genome_coverage, sequencing_depth, quality_score, mutations, spike_mutations, nextstrain_clade, gisaid_clade, sequencing_platform, lab_id, is_novel_variant, clinical_outcome, notes]);
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
    const { sample_id, pathogen, lineage, variant_name, collection_date, region, country, accession_number, genome_coverage, sequencing_depth, quality_score, mutations, spike_mutations, nextstrain_clade, gisaid_clade, sequencing_platform, lab_id, is_novel_variant, clinical_outcome, notes } = req.body;
    const result = await pool.query(`INSERT INTO ${TABLE} (sample_id, pathogen, lineage, variant_name, collection_date, region, country, accession_number, genome_coverage, sequencing_depth, quality_score, mutations, spike_mutations, nextstrain_clade, gisaid_clade, sequencing_platform, lab_id, is_novel_variant, clinical_outcome, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING *`, [sample_id, pathogen, lineage, variant_name, collection_date, region, country, accession_number, genome_coverage, sequencing_depth, quality_score, mutations, spike_mutations, nextstrain_clade, gisaid_clade, sequencing_platform, lab_id, is_novel_variant, clinical_outcome, notes]);
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
    const logs = await pool.query(`SELECT * FROM ai_analyses WHERE endpoint ILIKE $1 ORDER BY created_at DESC LIMIT 50`, [`%genomic%`]);
    res.json({ data: record.rows[0], history: logs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── AI VERBS ──────────────────────────────────────────────────────────────────

router.post('/ai/classify-variant', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, lineage, mutations, spike_mutations } = req.body;
    const analysis = await queryAI('You are a genomic epidemiologist. Classify pathogen variants based on genomic data. Return JSON only.', `Classify variant:\nPathogen: ${pathogen}\nLineage: ${lineage}\nMutations: ${mutations}\nSpike mutations: ${spike_mutations}\nReturn JSON: {"variant_class": "VOC|VOI|VUM|VBM|novel", "who_label": "...", "clinical_significance": "...", "immune_escape_potential": "low|moderate|high", "transmissibility_change": "decreased|neutral|increased", "confidence": "low|medium|high"}`);
    await persistAI(req.user?.id, 'genomic/classify-variant', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-emerging-lineage', auth, aiRateLimiter, async (req, res) => {
  try {
    const { recent_sequences, known_lineages, region } = req.body;
    const analysis = await queryAI('You are a genomic epidemiologist. Detect emerging novel lineages in sequencing data. Return JSON only.', `Detect emerging lineage:\nRecent sequences: ${JSON.stringify(recent_sequences)}\nKnown lineages: ${JSON.stringify(known_lineages)}\nRegion: ${region}\nReturn JSON: {"emerging_lineage_detected": bool, "candidate_lineages": ["..."], "novel_mutations": ["..."], "growth_rate": number, "geographic_distribution": ["..."], "surveillance_recommendation": "..."}`);
    await persistAI(req.user?.id, 'genomic/detect-emerging-lineage', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-immune-escape', auth, aiRateLimiter, async (req, res) => {
  try {
    const { variant_name, spike_mutations, neutralization_data } = req.body;
    const analysis = await queryAI('You are a viral immunologist. Predict immune escape potential from genomic mutations. Return JSON only.', `Predict immune escape:\nVariant: ${variant_name}\nSpike mutations: ${spike_mutations}\nNeutralization data: ${JSON.stringify(neutralization_data)}\nReturn JSON: {"immune_escape_score": 0-100, "escape_tier": "minimal|partial|substantial|complete", "affected_antibodies": ["..."], "vaccine_effectiveness_impact": "...", "natural_immunity_impact": "...", "monitoring_priority": "routine|elevated|urgent"}`);
    await persistAI(req.user?.id, 'genomic/predict-immune-escape', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-additional-sequencing', auth, aiRateLimiter, async (req, res) => {
  try {
    const { current_coverage, region, known_gaps, outbreak_signals } = req.body;
    const analysis = await queryAI('You are a genomic surveillance coordinator. Recommend additional sequencing to fill gaps. Return JSON only.', `Recommend additional sequencing:\nCurrent coverage: ${JSON.stringify(current_coverage)}\nRegion: ${region}\nKnown gaps: ${JSON.stringify(known_gaps)}\nOutbreak signals: ${JSON.stringify(outbreak_signals)}\nReturn JSON: {"sequencing_priority_sites": ["..."], "target_samples_per_week": number, "sample_selection_criteria": ["..."], "expected_turnaround_days": number, "rationale": "..."}`);
    await persistAI(req.user?.id, 'genomic/recommend-additional-sequencing', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-sequence-quality', auth, aiRateLimiter, async (req, res) => {
  try {
    const { sample_id, genome_coverage, sequencing_depth, quality_score, amplicon_dropout } = req.body;
    const analysis = await queryAI('You are a genomics lab scientist. Score sequencing quality and usability. Return JSON only.', `Score sequence quality:\nSample: ${sample_id}\nGenome coverage: ${genome_coverage}%\nDepth: ${sequencing_depth}x\nQuality score: ${quality_score}\nAmplicon dropout: ${JSON.stringify(amplicon_dropout)}\nReturn JSON: {"overall_quality_score": 0-100, "quality_tier": "poor|fair|good|excellent", "usable_for_lineage_calling": bool, "usable_for_phylogeny": bool, "quality_issues": ["..."], "recommended_actions": ["..."]}`);
    await persistAI(req.user?.id, 'genomic/score-sequence-quality', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-variant-report', auth, aiRateLimiter, async (req, res) => {
  try {
    const { variant_name, lineage, region, sequence_count, key_mutations } = req.body;
    const analysis = await queryAI('You are a genomic epidemiologist. Generate a variant surveillance report. Return JSON only.', `Generate variant report:\nVariant: ${variant_name}\nLineage: ${lineage}\nRegion: ${region}\nSequence count: ${sequence_count}\nKey mutations: ${JSON.stringify(key_mutations)}\nReturn JSON: {"report_title": "...", "executive_summary": "...", "variant_characterization": "...", "epidemiological_context": "...", "public_health_implications": "...", "recommendations": ["..."]}`);
    await persistAI(req.user?.id, 'genomic/generate-variant-report', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-lineage-distribution', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, lineage_counts, time_period } = req.body;
    const analysis = await queryAI('You are a genomic epidemiologist. Summarize the distribution of pathogen lineages. Return JSON only.', `Summarize lineage distribution:\nRegion: ${region}\nTime period: ${time_period}\nLineage counts: ${JSON.stringify(lineage_counts)}\nReturn JSON: {"dominant_lineage": "...", "lineage_diversity_index": number, "emerging_lineages": ["..."], "declining_lineages": ["..."], "co-circulation_status": "...", "public_health_priority": "..."}`);
    await persistAI(req.user?.id, 'genomic/summarize-lineage-distribution', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/validate-coverage-depth', auth, aiRateLimiter, async (req, res) => {
  try {
    const { sample_id, per_position_depth, minimum_depth_threshold } = req.body;
    const analysis = await queryAI('You are a bioinformatics scientist. Validate genome coverage depth for sequencing quality. Return JSON only.', `Validate coverage depth:\nSample: ${sample_id}\nPer-position depth: ${JSON.stringify(per_position_depth)}\nMinimum threshold: ${minimum_depth_threshold}x\nReturn JSON: {"coverage_valid": bool, "percent_above_threshold": number, "low_coverage_regions": ["..."], "average_depth": number, "usability_verdict": "exclude|use_with_caution|include", "remediation_options": ["..."]}`);
    await persistAI(req.user?.id, 'genomic/validate-coverage-depth', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/suggest-primer-update', auth, aiRateLimiter, async (req, res) => {
  try {
    const { current_primers, circulating_mutations, amplicon_dropout_rate } = req.body;
    const analysis = await queryAI('You are a molecular biologist. Suggest primer updates for pathogen sequencing. Return JSON only.', `Suggest primer updates:\nCurrent primers: ${JSON.stringify(current_primers)}\nCirculating mutations: ${JSON.stringify(circulating_mutations)}\nAmplicon dropout rate: ${amplicon_dropout_rate}%\nReturn JSON: {"primer_update_needed": bool, "affected_amplicons": ["..."], "suggested_new_primers": [{"target": "...", "sequence": "...", "rationale": "..."}], "urgency": "routine|elevated|urgent", "implementation_timeline": "..."}`);
    await persistAI(req.user?.id, 'genomic/suggest-primer-update', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/detect-amplicon-dropout', auth, aiRateLimiter, async (req, res) => {
  try {
    const { sample_id, amplicon_coverage, known_mutations } = req.body;
    const analysis = await queryAI('You are a genomics quality control expert. Detect amplicon dropout in sequencing data. Return JSON only.', `Detect amplicon dropout:\nSample: ${sample_id}\nAmplicon coverage: ${JSON.stringify(amplicon_coverage)}\nKnown mutations: ${JSON.stringify(known_mutations)}\nReturn JSON: {"dropout_detected": bool, "dropped_amplicons": ["..."], "likely_cause": "...", "impact_on_lineage_calling": "none|minimal|significant|critical", "recommended_actions": ["..."]}`);
    await persistAI(req.user?.id, 'genomic/detect-amplicon-dropout', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/classify-clinically-relevant-mutation', auth, aiRateLimiter, async (req, res) => {
  try {
    const { mutation, gene, protein_change, pathogen } = req.body;
    const analysis = await queryAI('You are a clinical genomicist. Classify the clinical relevance of a pathogen mutation. Return JSON only.', `Classify clinically relevant mutation:\nMutation: ${mutation}\nGene: ${gene}\nProtein change: ${protein_change}\nPathogen: ${pathogen}\nReturn JSON: {"clinical_significance": "benign|uncertain|likely_pathogenic|pathogenic", "functional_impact": "...", "drug_resistance": bool, "immune_escape": bool, "transmissibility_impact": "decreased|neutral|increased", "monitoring_recommended": bool}`);
    await persistAI(req.user?.id, 'genomic/classify-clinically-relevant-mutation', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/predict-transmission-advantage', auth, aiRateLimiter, async (req, res) => {
  try {
    const { variant_name, mutations, growth_rate_data, comparison_variant } = req.body;
    const analysis = await queryAI('You are a transmission biologist. Predict transmission advantage of a pathogen variant. Return JSON only.', `Predict transmission advantage:\nVariant: ${variant_name}\nMutations: ${mutations}\nGrowth rate data: ${JSON.stringify(growth_rate_data)}\nComparison variant: ${comparison_variant}\nReturn JSON: {"transmission_advantage": number, "advantage_confidence": "low|medium|high", "key_mutations_driving_advantage": ["..."], "competitive_displacement_timeline": "...", "public_health_risk": "low|moderate|high|critical"}`);
    await persistAI(req.user?.id, 'genomic/predict-transmission-advantage', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/recommend-vaccine-update-watch', auth, aiRateLimiter, async (req, res) => {
  try {
    const { variant_name, immune_escape_score, neutralization_titer_data, current_vaccine_strain } = req.body;
    const analysis = await queryAI('You are a vaccinologist. Assess whether a variant warrants vaccine composition update consideration. Return JSON only.', `Recommend vaccine update watch:\nVariant: ${variant_name}\nImmune escape score: ${immune_escape_score}\nNeutralization data: ${JSON.stringify(neutralization_titer_data)}\nCurrent vaccine strain: ${current_vaccine_strain}\nReturn JSON: {"vaccine_update_watch": "no_action|monitor|consider_update|urgent_update", "effectiveness_estimate": number, "key_concerns": ["..."], "recommended_data_collection": ["..."], "who_reporting_recommended": bool}`);
    await persistAI(req.user?.id, 'genomic/recommend-vaccine-update-watch', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/generate-phylogenetic-narrative', auth, aiRateLimiter, async (req, res) => {
  try {
    const { pathogen, phylogenetic_clusters, root_sequence, collection_period } = req.body;
    const analysis = await queryAI('You are a phylogenetic epidemiologist. Generate a narrative describing phylogenetic relationships in outbreak data. Return JSON only.', `Generate phylogenetic narrative:\nPathogen: ${pathogen}\nClusters: ${JSON.stringify(phylogenetic_clusters)}\nRoot: ${root_sequence}\nPeriod: ${collection_period}\nReturn JSON: {"narrative": "...", "transmission_chains": ["..."], "importation_events": number, "local_transmission_proportion": number, "evolutionary_rate": "...", "public_health_interpretation": "..."}`);
    await persistAI(req.user?.id, 'genomic/generate-phylogenetic-narrative', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/score-genomic-surveillance-coverage', auth, aiRateLimiter, async (req, res) => {
  try {
    const { region, sequences_per_week, total_cases, sequencing_labs } = req.body;
    const analysis = await queryAI('You are a genomic surveillance coordinator. Score the adequacy of genomic surveillance coverage. Return JSON only.', `Score genomic surveillance coverage:\nRegion: ${region}\nSequences/week: ${sequences_per_week}\nTotal cases: ${total_cases}\nLabs: ${JSON.stringify(sequencing_labs)}\nReturn JSON: {"coverage_score": 0-100, "coverage_percentage": number, "coverage_tier": "inadequate|minimal|adequate|robust", "representation_bias": ["..."], "recommended_target": number, "capacity_gaps": ["..."]}`);
    await persistAI(req.user?.id, 'genomic/score-genomic-surveillance-coverage', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/summarize-mutation-impact', auth, aiRateLimiter, async (req, res) => {
  try {
    const { mutations, pathogen, gene_targets } = req.body;
    const analysis = await queryAI('You are a molecular epidemiologist. Summarize the impact of a set of pathogen mutations. Return JSON only.', `Summarize mutation impact:\nMutations: ${JSON.stringify(mutations)}\nPathogen: ${pathogen}\nGene targets: ${JSON.stringify(gene_targets)}\nReturn JSON: {"mutation_summary": "...", "high_impact_mutations": ["..."], "combined_phenotype_prediction": "...", "diagnostic_impact": "...", "therapeutic_impact": "...", "surveillance_priority": "routine|elevated|urgent"}`);
    await persistAI(req.user?.id, 'genomic/summarize-mutation-impact', req.body, analysis);
    res.json({ result: parseAIJson(analysis) || analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
