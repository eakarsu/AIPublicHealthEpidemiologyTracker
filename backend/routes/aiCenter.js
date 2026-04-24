const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

// Comprehensive health assessment
router.post('/comprehensive-assessment', async (req, res) => {
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
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Epidemic risk scoring
router.post('/epidemic-risk-score', async (req, res) => {
  try {
    const [outbreaks, surveillance] = await Promise.all([
      pool.query('SELECT * FROM outbreaks ORDER BY reported_date DESC LIMIT 10'),
      pool.query('SELECT * FROM syndromic_surveillance ORDER BY report_date DESC LIMIT 10'),
    ]);
    const analysis = await queryAI(
      'You are an epidemic risk scoring AI. Calculate and explain epidemic risk scores based on current outbreak and surveillance data. Provide numerical risk scores (1-10) for different threats with detailed justification.',
      `Calculate epidemic risk scores:\nOutbreaks: ${JSON.stringify(outbreaks.rows)}\nSurveillance: ${JSON.stringify(surveillance.rows)}`
    );
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Resource allocation optimizer
router.post('/resource-allocation', async (req, res) => {
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
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Environmental health correlator
router.post('/environmental-health', async (req, res) => {
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
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Pandemic preparedness assessment
router.post('/pandemic-preparedness', async (req, res) => {
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
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Population health insights
router.post('/population-health', async (req, res) => {
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
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Custom AI query
router.post('/custom-query', async (req, res) => {
  try {
    const { question } = req.body;
    const tables = ['outbreaks', 'vaccinations', 'hospital_capacity', 'mortality_stats', 'water_quality', 'air_quality'];
    const summaries = await Promise.all(
      tables.map(t => pool.query(`SELECT COUNT(*) as count FROM ${t}`))
    );
    const analysis = await queryAI(
      'You are a public health AI assistant with access to epidemiological databases. Answer questions about disease outbreaks, vaccinations, hospital capacity, environmental health, and population health using your expertise.',
      `User question: ${question}\n\nDatabase summary: ${tables.map((t, i) => `${t}: ${summaries[i].rows[0].count} records`).join(', ')}`
    );
    res.json({ analysis });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
