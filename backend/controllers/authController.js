const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

function generateAccessToken(userId) {
  return jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

function generateRefreshToken(userId) {
  return jwt.sign({ userId, jti: uuidv4() }, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
}

async function saveRefreshToken(userId, token) {
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);
  await pool.execute(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, token, expiresAt]
  );
}

async function login(req, res, next) {
  try {
    if (!ACCESS_SECRET || !REFRESH_SECRET) {
      return res.status(503).json({
        success: false,
        message: 'Server misconfigured: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in .env',
      });
    }
    const { email, password } = req.body;
    const [rows] = await pool.execute(
      `SELECT u.id, u.email, u.password, u.name, u.role_id, u.assigned_admin_id, u.is_active, u.deleted_at, r.name AS role_name
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?`,
      [email]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    const user = rows[0];
    if (user.deleted_at) {
      return res.status(401).json({ success: false, message: 'Account deactivated' });
    }
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);
    await saveRefreshToken(user.id, refreshToken);

    await pool.execute(
      'INSERT INTO login_history (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
      [user.id, req.ip || null, req.get('user-agent') || null]
    );
    await logActivity({
      userId: user.id,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
      req,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.role_id,
          roleName: user.role_name,
          assignedAdminId: user.assigned_admin_id || null,
        },
        accessToken,
        refreshToken,
        expiresIn: ACCESS_EXPIRY,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).json({
        success: false,
        message: `Login error: ${err.message}`,
      });
    }
    next(err);
  }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token required' });
    }
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const [rows] = await pool.execute(
      'SELECT id FROM refresh_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()',
      [decoded.userId, refreshToken]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ? AND token = ?', [
      decoded.userId,
      refreshToken,
    ]);
    const accessToken = generateAccessToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);
    await saveRefreshToken(decoded.userId, newRefreshToken);
    res.json({
      success: true,
      data: { accessToken, refreshToken: newRefreshToken, expiresIn: ACCESS_EXPIRY },
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
    }
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.userId) {
          await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [decoded.userId]);
        }
      } catch (_) {}
    }
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const [rows] = await pool.execute('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL', [
      email,
    ]);
    if (!rows.length) {
      return res.json({ success: true, message: 'If email exists, reset link will be sent' });
    }
    const resetToken = uuidv4();
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await pool.execute(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [resetToken, expires, rows[0].id]
    );
    // In production, send email with link containing resetToken
    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
    if (process.env.SMTP_USER) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: 'Password Reset - Doctor Desk',
        text: `Reset link: ${resetLink}. Valid for 1 hour.`,
      });
    }
    res.json({
      success: true,
      message: 'If email exists, reset link will be sent',
      ...(process.env.NODE_ENV === 'development' && { resetLink }),
    });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()',
      [token]
    );
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }
    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.execute(
      'UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [hashed, rows[0].id]
    );
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    res.json({ success: true, data: { user: req.user } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  me,
};
