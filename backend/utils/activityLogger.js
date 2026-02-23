const { pool } = require('../config/database');

/**
 * Log user action for activity_logs (Super Admin view)
 */
async function logActivity({
  userId = null,
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
  req = null,
}) {
  const ip = req && req.ip ? req.ip : null;
  const ua = req && req.get ? req.get('user-agent') : null;
  try {
    await pool.execute(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entityType,
        entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ip,
        ua && ua.length > 500 ? ua.slice(0, 500) : ua,
      ]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
