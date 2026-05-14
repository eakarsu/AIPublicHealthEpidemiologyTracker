/**
 * Adds pagination + CSV export to an existing router by wrapping the default GET /
 * This is used by all feature routes to avoid code duplication.
 */
const pool = require('../db');

function addPaginationAndExport(router, tableName, orderField) {
  const order = orderField || 'id';

  // Override GET / with paginated version
  router.get('/', async (req, res) => {
    // Check if export is requested
    if (req.query.format === 'csv') {
      try {
        const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY ${order} DESC`);
        const rows = result.rows;
        if (rows.length === 0) return res.status(204).send();
        const headers = Object.keys(rows[0]);
        const csv = [
          headers.join(','),
          ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(',')),
        ].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${tableName}.csv"`);
        return res.send(csv);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    try {
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, parseInt(req.query.limit) || 20);
      const offset = (page - 1) * limit;
      const [rows, countResult] = await Promise.all([
        pool.query(`SELECT * FROM ${tableName} ORDER BY ${order} DESC LIMIT $1 OFFSET $2`, [limit, offset]),
        pool.query(`SELECT COUNT(*) FROM ${tableName}`),
      ]);
      const total = parseInt(countResult.rows[0].count);
      res.json({ data: rows.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { addPaginationAndExport };
