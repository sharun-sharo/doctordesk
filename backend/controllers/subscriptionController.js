const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');

/**
 * List all doctors (admin/doctor role) with their subscription info.
 * Super Admin only.
 */
async function list(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id AS doctor_id, u.name AS doctor_name, u.email AS doctor_email, u.phone AS doctor_phone,
        s.id AS subscription_id, s.amount, s.start_date, s.end_date,
        CASE WHEN s.end_date IS NULL THEN NULL WHEN s.end_date < CURDATE() THEN 'expired' ELSE 'active' END AS status
       FROM users u
       LEFT JOIN subscriptions s ON s.doctor_id = u.id
       WHERE u.role_id IN (?, ?) AND u.deleted_at IS NULL
       ORDER BY u.name`,
      [ROLES.ADMIN, ROLES.DOCTOR]
    );
    const list = rows.map((r) => ({
      doctorId: r.doctor_id,
      doctorName: r.doctor_name,
      doctorEmail: r.doctor_email,
      doctorPhone: r.doctor_phone || null,
      subscriptionId: r.subscription_id,
      amount: r.amount != null ? parseFloat(r.amount) : null,
      startDate: r.start_date,
      endDate: r.end_date,
      status: r.status ?? (r.end_date ? (r.end_date < new Date() ? 'expired' : 'active') : null),
    }));
    let subscriptionRevenue = 0;
    try {
      const [[revRow]] = await pool.execute(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM subscriptions WHERE end_date >= CURDATE()`
      );
      subscriptionRevenue = parseFloat(revRow?.total ?? 0);
    } catch (_) {
      // Subscriptions table may not exist
    }
    res.json({
      success: true,
      data: {
        doctors: list,
        subscriptionRevenue,
      },
    });
  } catch (err) {
    // If subscriptions table is missing, LEFT JOIN fails; return doctors from users only
    if (err.code === 'ER_NO_SUCH_TABLE' && err.message && err.message.includes('subscriptions')) {
      try {
        const [rows] = await pool.execute(
          `SELECT u.id AS doctor_id, u.name AS doctor_name, u.email AS doctor_email, u.phone AS doctor_phone
           FROM users u
           WHERE u.role_id IN (?, ?) AND u.deleted_at IS NULL
           ORDER BY u.name`,
          [ROLES.ADMIN, ROLES.DOCTOR]
        );
        const list = rows.map((r) => ({
          doctorId: r.doctor_id,
          doctorName: r.doctor_name,
          doctorEmail: r.doctor_email,
          doctorPhone: r.doctor_phone || null,
          subscriptionId: null,
          amount: null,
          startDate: null,
          endDate: null,
          status: null,
        }));
        return res.json({
          success: true,
          data: { doctors: list, subscriptionRevenue: 0 },
        });
      } catch (fallbackErr) {
        return next(fallbackErr);
      }
    }
    next(err);
  }
}

/**
 * Create or update subscription for a doctor.
 * Body: { doctor_id, amount, start_date, end_date }
 * Super Admin only.
 */
async function upsert(req, res, next) {
  try {
    const { doctor_id, amount, start_date, end_date } = req.body;
    if (!doctor_id || start_date === undefined || end_date === undefined) {
      return res.status(400).json({ success: false, message: 'doctor_id, start_date, and end_date are required' });
    }
    const amt = amount != null ? parseFloat(amount) : 0;
    const [existing] = await pool.execute('SELECT id FROM subscriptions WHERE doctor_id = ?', [doctor_id]);
    if (existing.length) {
      await pool.execute(
        'UPDATE subscriptions SET amount = ?, start_date = ?, end_date = ?, updated_at = NOW() WHERE doctor_id = ?',
        [amt, start_date, end_date, doctor_id]
      );
    } else {
      await pool.execute(
        'INSERT INTO subscriptions (doctor_id, amount, start_date, end_date) VALUES (?, ?, ?, ?)',
        [doctor_id, amt, start_date, end_date]
      );
    }
    const [[row]] = await pool.execute(
      `SELECT s.id, s.doctor_id, s.amount, s.start_date, s.end_date,
        CASE WHEN s.end_date < CURDATE() THEN 'expired' ELSE 'active' END AS status
       FROM subscriptions s WHERE s.doctor_id = ?`,
      [doctor_id]
    );
    res.json({ success: true, data: row });
  } catch (err) {
    next(err);
  }
}

/**
 * Get subscription revenue for super admin (e.g. for dashboard).
 * Sum of amount where end_date >= CURDATE().
 */
async function getRevenue(req, res, next) {
  try {
    const [[row]] = await pool.execute(
      'SELECT COALESCE(SUM(amount), 0) AS total FROM subscriptions WHERE end_date >= CURDATE()'
    );
    res.json({ success: true, data: { subscriptionRevenue: parseFloat(row?.total ?? 0) } });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, upsert, getRevenue };
