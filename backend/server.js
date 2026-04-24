const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.BACKEND_PORT || 4001;

app.use(cors());
app.use(express.json());

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
