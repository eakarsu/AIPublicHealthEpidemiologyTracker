const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./db');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.BACKEND_PORT || 4001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());

// Ensure ai_analyses and alert_subscriptions tables exist on startup
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      endpoint VARCHAR(200) NOT NULL,
      input_data JSONB,
      result TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      feature VARCHAR(100) NOT NULL,
      threshold_field VARCHAR(100),
      threshold_value NUMERIC,
      email VARCHAR(200),
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/outbreaks', require('./routes/outbreaks'));
app.use('/api/vaccinations', require('./routes/vaccinations'));
app.use('/api/contact-tracing', require('./routes/contactTracing'));
app.use('/api/surveillance', require('./routes/surveillance'));
app.use('/api/water-quality', require('./routes/waterQuality'));
app.use('/api/air-quality', require('./routes/airQuality'));
app.use('/api/hospital-capacity', require('./routes/hospitalCapacity'));
app.use('/api/mortality', require('./routes/mortality'));
app.use('/api/disease-reports', require('./routes/diseaseReports'));
app.use('/api/amr', require('./routes/amr'));
app.use('/api/vector-diseases', require('./routes/vectorDiseases'));
app.use('/api/health-equity', require('./routes/healthEquity'));
app.use('/api/ai-center', require('./routes/aiCenter'));
app.use('/api/ai', require('./routes/aiHistory'));
app.use('/api/alerts', require('./routes/alertSubscriptions'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Custom Views (Epi Views) - mounted before any 404 handler
app.use('/api/custom-views', require('./routes/customViews'));

ensureTables()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to create tables:', err.message);
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT} (table init may have failed)`);
    });
  });

// AI feature mount: nowcast
app.use('/api/ai/nowcast', require('./routes/ai-nowcast'));
// === Batch 07 Gaps & Frontend Mounts ===
app.use('/api/gap-no-outbreakprediction-spatialtemporal-modeli', require('./routes/gap-no-outbreakprediction-spatialtemporal-modeli'));
app.use('/api/gap-no-equitygapanalysis-disparities-by-demograp', require('./routes/gap-no-equitygapanalysis-disparities-by-demograp'));
app.use('/api/gap-no-interventionrecommendation-evidencebased', require('./routes/gap-no-interventionrecommendation-evidencebased'));
app.use('/api/gap-no-caseclustering-anomaly-detection', require('./routes/gap-no-caseclustering-anomaly-detection'));
app.use('/api/gap-no-vaccinationcoverageforecast', require('./routes/gap-no-vaccinationcoverageforecast'));
app.use('/api/gap-no-resourceallocation-ai', require('./routes/gap-no-resourceallocation-ai'));
app.use('/api/gap-no-realtime-outbreak-mapdashboard-route', require('./routes/gap-no-realtime-outbreak-mapdashboard-route'));
app.use('/api/gap-no-case-linelist-deduplication-workflow', require('./routes/gap-no-case-linelist-deduplication-workflow'));
app.use('/api/gap-no-syndromic-surveillance-ingestion-ed-otc-p', require('./routes/gap-no-syndromic-surveillance-ingestion-ed-otc-p'));
app.use('/api/gap-no-cdcstate-healthdepartment-api-integration', require('./routes/gap-no-cdcstate-healthdepartment-api-integration'));
app.use('/api/gap-no-contact-tracing-workflow-beyond-data-stor', require('./routes/gap-no-contact-tracing-workflow-beyond-data-stor'));
app.use('/api/gap-no-notificationssms-push-for-alerts', require('./routes/gap-no-notificationssms-push-for-alerts'));
app.use('/api/gap-no-reportingexport-csvpdf', require('./routes/gap-no-reportingexport-csvpdf'));
app.use('/api/gap-no-rbac-for-clinical-vs-admin-roles', require('./routes/gap-no-rbac-for-clinical-vs-admin-roles'));
// === End Batch 07 ===
