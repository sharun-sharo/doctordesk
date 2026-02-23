const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

/**
 * Verify JWT and attach user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.name, u.phone, u.whatsapp_phone, u.role_id, u.assigned_admin_id, u.is_active, u.deleted_at, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.userId]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const user = rows[0];
    if (user.deleted_at) {
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || null,
      whatsappPhone: user.whatsapp_phone || null,
      roleId: user.role_id,
      roleName: user.role_name,
      assignedAdminId: user.assigned_admin_id || null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    next(err);
  }
};

/**
 * Optional auth: attach user if token present, don't fail if missing
 */
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return next();
  }
  return authenticate(req, res, next);
};

module.exports = { authenticate, optionalAuth };
