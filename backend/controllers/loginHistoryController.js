const { pool } = require('../config/database');

async function list(req, res, next) {
  try {
    const { user_id, page = 1, limit = 50 } = req.query;
    const perPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (Math.max(0, (Math.max(1, parseInt(page, 10) || 1) - 1)) * perPage) | 0;
    let where = '1=1';
    const params = [];
    if (user_id) {
      where = 'l.user_id = ?';
      params.push(user_id);
    }
    const [rows] = await pool.execute(
      `SELECT l.id, l.user_id, l.ip_address, l.logged_in_at, u.name AS user_name, u.email
       FROM login_history l
       LEFT JOIN users u ON l.user_id = u.id
       WHERE ${where}
       ORDER BY l.logged_in_at DESC
       LIMIT ${perPage} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM login_history l WHERE ${where}`,
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
