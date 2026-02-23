const { pool } = require('../config/database');
const { superAdminOnly } = require('../middleware/rbac');

async function list(req, res, next) {
  try {
    const { user_id, entity_type, action, page = 1, limit = 50 } = req.query;
    const perPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (Math.max(0, (Math.max(1, parseInt(page, 10) || 1) - 1)) * perPage) | 0;
    const conditions = ['1=1'];
    const params = [];
    if (user_id) {
      conditions.push('a.user_id = ?');
      params.push(user_id);
    }
    if (entity_type) {
      conditions.push('a.entity_type = ?');
      params.push(entity_type);
    }
    if (action) {
      conditions.push('a.action = ?');
      params.push(action);
    }
    const where = conditions.join(' AND ');

    const [rows] = await pool.execute(
      `SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.ip_address, a.created_at,
        u.name AS user_name, u.email AS user_email
       FROM activity_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE ${where}
       ORDER BY a.created_at DESC
       LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM activity_logs a WHERE ${where}`,
      params
    );
    res.json({
      success: true,
      data: { logs: rows, pagination: { page: parseInt(page, 10), limit: perPage, total } },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list };
