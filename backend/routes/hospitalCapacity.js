const express = require('express');
const pool = require('../db');
const { queryAI } = require('../aiHelper');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hospital_capacity ORDER BY report_date DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hospital_capacity WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { hospital_name, region, total_beds, occupied_beds, icu_total, icu_occupied, ventilators_total, ventilators_in_use, status, report_date } = req.body;
    const result = await pool.query(
      `INSERT INTO hospital_capacity (hospital_name, region, total_beds, occupied_beds, icu_total, icu_occupied, ventilators_total, ventilators_in_use, status, report_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [hospital_name, region, total_beds, occupied_beds, icu_total, icu_occupied, ventilators_total, ventilators_in_use, status, report_date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { hospital_name, region, total_beds, occupied_beds, icu_total, icu_occupied, ventilators_total, ventilators_in_use, status, report_date } = req.body;
    const result = await pool.query(
      `UPDATE hospital_capacity SET hospital_name=$1, region=$2, total_beds=$3, occupied_beds=$4, icu_total=$5, icu_occupied=$6, ventilators_total=$7, ventilators_in_use=$8, status=$9, report_date=$10, updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [hospital_name, region, total_beds, occupied_beds, icu_total, icu_occupied, ventilators_total, ventilators_in_use, status, report_date, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM hospital_capacity WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/ai-analyze', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hospital_capacity WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const item = result.rows[0];
    const analysis = await queryAI(
      'You are a hospital capacity management AI. Analyze hospital resource utilization, predict demand surges, and recommend capacity optimization strategies.',
      `Analyze this hospital capacity report:\nHospital: ${item.hospital_name}\nRegion: ${item.region}\nBeds: ${item.occupied_beds}/${item.total_beds}\nICU: ${item.icu_occupied}/${item.icu_total}\nVentilators: ${item.ventilators_in_use}/${item.ventilators_total}\nStatus: ${item.status}`
    );
    res.json({ analysis, hospital: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/ai/demand-forecast', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM hospital_capacity ORDER BY report_date DESC');
    const analysis = await queryAI(
      'You are a healthcare demand forecasting AI. Predict hospital bed and ICU demand, identify capacity bottlenecks, and recommend surge planning strategies.',
      `Forecast demand from this capacity data:\n${JSON.stringify(result.rows, null, 2)}`
    );
    res.json({ analysis, data: result.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
