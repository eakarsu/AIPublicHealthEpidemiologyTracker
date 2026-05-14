const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const persistAI = require('../middleware/persistAI');



router.get('/', async (req, res) => {
  if (req.query.format === 'csv') {
    try {
      const result = await pool.query('SELECT * FROM air_quality ORDER BY reading_date DESC');
      const rows = result.rows;
      if (!rows.length) return res.status(204).send();
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="air_quality.csv"`);
      return res.send(csv);
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const [rows, countResult] = await Promise.all([
      pool.query('SELECT * FROM air_quality ORDER BY reading_date DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM air_quality'),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM air_quality WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    const { station_name, location, aqi_value, pm25, pm10, ozone, co_level, category, reading_date } = req.body;
    const result = await pool.query(
      `INSERT INTO air_quality (station_name, location, aqi_value, pm25, pm10, ozone, co_level, category, reading_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [station_name, location, aqi_value, pm25, pm10, ozone, co_level, category, reading_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { station_name, location, aqi_value, pm25, pm10, ozone, co_level, category, reading_date } = req.body;
    const result = await pool.query(
      `UPDATE air_quality SET station_name=$1, location=$2, aqi_value=$3, pm25=$4, pm10=$5, ozone=$6, co_level=$7, category=$8, reading_date=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [station_name, location, aqi_value, pm25, pm10, ozone, co_level, category, reading_date, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM air_quality WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM air_quality WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are an air quality and respiratory health AI. Analyze air quality metrics, assess health impacts, and provide recommendations for vulnerable populations.',
      `Analyze this air quality reading:\nStation: ${item.station_name}\nLocation: ${item.location}\nAQI: ${item.aqi_value}\nPM2.5: ${item.pm25}\nPM10: ${item.pm10}\nOzone: ${item.ozone}\nCO: ${item.co_level}\nCategory: ${item.category}`
    );
    await persistAI(req.user?.id, 'air_quality/ai', {}, analysis);
    res.json({ analysis, airQuality: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/health-impact', auth, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM air_quality ORDER BY reading_date DESC');
    const analysis = await queryAI(
      'You are a public health air quality AI. Assess the health impact of air quality trends on populations, identify at-risk areas, and recommend public health advisories.',
      `Assess health impact from this air quality data:\n${JSON.stringify(result.rows, null, 2)}`
    );
    await persistAI(req.user?.id, 'air_quality/ai', {}, analysis);
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
