const pool = require('../db');

async function persistAI(userId, endpoint, inputData, result) {
  try {
    await pool.query(
      `INSERT INTO ai_analyses (user_id, endpoint, input_data, result) VALUES ($1,$2,$3,$4)`,
      [userId || null, endpoint, JSON.stringify(inputData), result]
    );
  } catch (err) {
    // Non-fatal: log but don't throw
    console.error('Failed to persist AI result:', err.message);
  }
}

module.exports = persistAI;
