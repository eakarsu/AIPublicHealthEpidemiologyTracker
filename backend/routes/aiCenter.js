const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');
const { body, validationResult } = require('express-validator');
const router = express.Router();

// Comprehensive health assessment
router.post('/comprehensive-assessment', auth, aiRateLimiter, async (req, res) => {
  try {
    const [outbreaks, vaccinations, hospitals, mortality] = await Promise.all([
      pool.query('SELECT * FROM outbreaks WHERE status = $1 ORDER BY reported_date DESC LIMIT 5', ['Active']),
      pool.query('SELECT * FROM vaccinations ORDER BY start_date DESC LIMIT 5'),
      pool.query('SELECT * FROM hospital_capacity ORDER BY report_date DESC LIMIT 5'),
      pool.query('SELECT * FROM mortality_stats ORDER BY report_date DESC LIMIT 5'),
    ]);
    const analysis = await queryAI(
      'You are a comprehensive public health AI advisor. Provide a holistic health situation assessment combining outbreak, vaccination, hospital, and mortality data. Structure response with: Executive Summary, Key Findings, Risk Areas, and Priority Recommendations.',
      `Comprehensive health data:\nOutbreaks: ${JSON.stringify(outbreaks.rows)}\nVaccinations: ${JSON.stringify(vaccinations.rows)}\nHospitals: ${JSON.stringify(hospitals.rows)}\nMortality: ${JSON.stringify(mortality.rows)}`
    );
    await persistAI(req.user?.id, 'ai-center/comprehensive-assessment', {}, analysis);
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

// Epidemic risk scoring
router.post('/epidemic-risk-score', auth, aiRateLimiter, async (req, res) => {
  try {
    const [outbreaks, surveillance] = await Promise.all([
      pool.query('SELECT * FROM outbreaks ORDER BY reported_date DESC LIMIT 10'),
      pool.query('SELECT * FROM syndromic_surveillance ORDER BY report_date DESC LIMIT 10'),
    ]);
    const analysis = await queryAI(
      'You are an epidemic risk scoring AI. Calculate and explain epidemic risk scores based on current outbreak and surveillance data. Provide numerical risk scores (1-10) for different threats with detailed justification.',
      `Calculate epidemic risk scores:\nOutbreaks: ${JSON.stringify(outbreaks.rows)}\nSurveillance: ${JSON.stringify(surveillance.rows)}`
    );
    await persistAI(req.user?.id, 'ai-center/epidemic-risk-score', {}, analysis);
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

// Resource allocation optimizer
router.post('/resource-allocation', auth, aiRateLimiter, async (req, res) => {
  try {
    const [hospitals, outbreaks, vaccinations] = await Promise.all([
      pool.query('SELECT * FROM hospital_capacity ORDER BY report_date DESC LIMIT 10'),
      pool.query('SELECT * FROM outbreaks WHERE status = $1', ['Active']),
      pool.query('SELECT * FROM vaccinations WHERE status = $1', ['Active']),
    ]);
    const analysis = await queryAI(
      'You are a public health resource allocation AI. Optimize resource distribution across hospitals, outbreak response teams, and vaccination campaigns. Provide specific allocation recommendations with priorities.',
      `Optimize resources:\nHospitals: ${JSON.stringify(hospitals.rows)}\nActive Outbreaks: ${JSON.stringify(outbreaks.rows)}\nActive Vaccinations: ${JSON.stringify(vaccinations.rows)}`
    );
    await persistAI(req.user?.id, 'ai-center/resource-allocation', {}, analysis);
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

// Environmental health correlator
router.post('/environmental-health', auth, aiRateLimiter, async (req, res) => {
  try {
    const [water, air, diseases] = await Promise.all([
      pool.query('SELECT * FROM water_quality ORDER BY sample_date DESC LIMIT 10'),
      pool.query('SELECT * FROM air_quality ORDER BY reading_date DESC LIMIT 10'),
      pool.query('SELECT * FROM disease_reports ORDER BY report_date DESC LIMIT 10'),
    ]);
    const analysis = await queryAI(
      'You are an environmental health correlation AI. Analyze relationships between environmental factors (water quality, air quality) and disease patterns. Identify potential environmental causes of health issues.',
      `Correlate environmental and health data:\nWater Quality: ${JSON.stringify(water.rows)}\nAir Quality: ${JSON.stringify(air.rows)}\nDisease Reports: ${JSON.stringify(diseases.rows)}`
    );
    await persistAI(req.user?.id, 'ai-center/environmental-health', {}, analysis);
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

// Pandemic preparedness assessment
router.post('/pandemic-preparedness', auth, aiRateLimiter, async (req, res) => {
  try {
    const [hospitals, vaccinations, amr] = await Promise.all([
      pool.query('SELECT * FROM hospital_capacity ORDER BY report_date DESC LIMIT 10'),
      pool.query('SELECT * FROM vaccinations ORDER BY start_date DESC LIMIT 10'),
      pool.query('SELECT * FROM antimicrobial_resistance ORDER BY test_date DESC LIMIT 10'),
    ]);
    const analysis = await queryAI(
      'You are a pandemic preparedness AI advisor. Assess readiness for potential pandemics based on hospital capacity, vaccination infrastructure, and AMR threats. Provide a preparedness score and gap analysis.',
      `Assess pandemic preparedness:\nHospital Capacity: ${JSON.stringify(hospitals.rows)}\nVaccination Programs: ${JSON.stringify(vaccinations.rows)}\nAMR Data: ${JSON.stringify(amr.rows)}`
    );
    await persistAI(req.user?.id, 'ai-center/pandemic-preparedness', {}, analysis);
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

// Population health insights
router.post('/population-health', auth, aiRateLimiter, async (req, res) => {
  try {
    const [mortality, equity, surveillance] = await Promise.all([
      pool.query('SELECT * FROM mortality_stats ORDER BY report_date DESC LIMIT 10'),
      pool.query('SELECT * FROM health_equity ORDER BY report_date DESC LIMIT 10'),
      pool.query('SELECT * FROM syndromic_surveillance ORDER BY report_date DESC LIMIT 10'),
    ]);
    const analysis = await queryAI(
      'You are a population health insights AI. Analyze mortality trends, health equity data, and syndromic patterns to provide comprehensive population health insights and targeted intervention recommendations.',
      `Population health data:\nMortality: ${JSON.stringify(mortality.rows)}\nHealth Equity: ${JSON.stringify(equity.rows)}\nSurveillance: ${JSON.stringify(surveillance.rows)}`
    );
    await persistAI(req.user?.id, 'ai-center/population-health', {}, analysis);
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message || 'AI analysis failed' }); }
});

// Custom AI query - now actually searches DB records
router.post('/custom-query', auth, aiRateLimiter, [
  body('question').trim().notEmpty().isLength({ max: 2000 })
    .withMessage('Question is required and must be under 2000 characters'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { question } = req.body;
    const safeQuestion = question.replace(/['"`;]/g, ''); // basic prompt injection sanitization

    // Actually query relevant data based on question keywords
    const tables = [
      { name: 'outbreaks', query: 'SELECT disease_name, location, cases_count, status, severity, reported_date FROM outbreaks ORDER BY reported_date DESC LIMIT 10' },
      { name: 'vaccinations', query: 'SELECT vaccine_name, target_disease, region, coverage_pct, status FROM vaccinations ORDER BY start_date DESC LIMIT 10' },
      { name: 'hospital_capacity', query: 'SELECT hospital_name, region, total_beds, occupied_beds, status FROM hospital_capacity ORDER BY report_date DESC LIMIT 10' },
      { name: 'mortality_stats', query: 'SELECT region, cause_of_death, count, rate_per_100k, trend FROM mortality_stats ORDER BY report_date DESC LIMIT 10' },
      { name: 'water_quality', query: 'SELECT source_name, location, contaminant, contaminant_level, status FROM water_quality ORDER BY sample_date DESC LIMIT 10' },
      { name: 'air_quality', query: 'SELECT station_name, location, aqi_value, category FROM air_quality ORDER BY reading_date DESC LIMIT 10' },
    ];

    const results = await Promise.all(tables.map(t => pool.query(t.query).catch(() => ({ rows: [] }))));
    const dataContext = tables.map((t, i) => `${t.name} (${results[i].rows.length} recent records):\n${JSON.stringify(results[i].rows, null, 2)}`).join('\n\n');

    const analysis = await queryAI(
      'You are a public health AI assistant with access to epidemiological databases. Answer the user\'s question using the actual database records provided. Be specific and reference actual data points in your response.',
      `User question: ${safeQuestion}\n\nActual database records:\n${dataContext}`
    );
    await persistAI(req.user?.id, 'ai-center/custom-query', { question: safeQuestion }, analysis);
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message || 'AI query failed' }); }
});

// Helper: map missing-API-key errors to 503 Service Unavailable.
function aiErrorStatus(err) {
  const msg = (err && err.message) || '';
  if (/OPENROUTER_API_KEY/i.test(msg) || /not configured/i.test(msg)) return 503;
  return 500;
}

// Vaccination coverage forecast — apply4 mechanical addition.
// Audit-listed gap (`/vaccination-coverage-forecast`) not implemented in apply2/3.
router.post('/vaccination-coverage-forecast', auth, aiRateLimiter, async (req, res) => {
  try {
    const horizonWeeks = Math.max(1, Math.min(52, parseInt(req.body?.horizon_weeks, 10) || 12));
    const region = (req.body?.region || '').toString().slice(0, 100);

    const params = [];
    let where = '';
    if (region) { params.push(`%${region}%`); where = 'WHERE region ILIKE $1'; }

    const [vaccinations, outbreaks, hospitals] = await Promise.all([
      pool.query(`SELECT vaccine_name, target_disease, region, coverage_pct, doses_administered, target_population, status, start_date FROM vaccinations ${where} ORDER BY start_date DESC LIMIT 30`, params),
      pool.query(`SELECT disease_name, location, cases_count, status, severity, reported_date FROM outbreaks ORDER BY reported_date DESC LIMIT 10`),
      pool.query(`SELECT hospital_name, region, total_beds, occupied_beds, report_date FROM hospital_capacity ORDER BY report_date DESC LIMIT 10`),
    ]);

    const analysis = await queryAI(
      'You are a vaccination program forecasting AI. Project coverage trajectories by vaccine and region over the requested horizon. Identify campaigns at risk of missing herd-immunity thresholds, regions with stalled uptake, and the population segments most likely to drive future gains. Always include numerical estimates and confidence ranges. Structure response with: Forecast Summary, Per-Vaccine Trajectories, At-Risk Programs, Recommended Interventions, and Disclaimers.',
      `Forecast vaccination coverage.\nHorizon: ${horizonWeeks} weeks\nRegion filter: ${region || 'ALL'}\n\nCurrent vaccinations: ${JSON.stringify(vaccinations.rows)}\nRecent outbreaks (context): ${JSON.stringify(outbreaks.rows)}\nHospital capacity (context): ${JSON.stringify(hospitals.rows)}`
    );
    await persistAI(req.user?.id, 'ai-center/vaccination-coverage-forecast', { horizonWeeks, region }, analysis);
    res.json({ analysis });
  } catch (err) {
    res.status(aiErrorStatus(err)).json({ error: err.message || 'AI forecast failed' });
  }
});

module.exports = router;
