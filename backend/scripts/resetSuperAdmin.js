/**
 * Create or reset Super Admin login (prod/local).
 * Run with Railway MySQL env vars from your machine:
 *
 *   cd backend
 *   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... \
 *   SEED_SUPER_ADMIN_EMAIL=admin@clinic.com \
 *   SEED_SUPER_ADMIN_PASSWORD=SuperAdmin@123 \
 *   node scripts/resetSuperAdmin.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');

const email = (process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@clinic.com').trim().toLowerCase();
const password = process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123';
const name = process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin';

async function main() {
  const hashedPassword = await bcrypt.hash(password, 12);
  const [existing] = await pool.execute('SELECT id, email FROM users WHERE email = ?', [email]);

  if (existing.length > 0) {
    await pool.execute(
      `UPDATE users SET password = ?, name = ?, role_id = ?, is_active = 1, deleted_at = NULL WHERE id = ?`,
      [hashedPassword, name, ROLES.SUPER_ADMIN, existing[0].id]
    );
    console.log(`Updated Super Admin: ${email}`);
  } else {
    await pool.execute(
      `INSERT INTO users (email, password, name, role_id, is_active) VALUES (?, ?, ?, ?, 1)`,
      [email, hashedPassword, name, ROLES.SUPER_ADMIN]
    );
    console.log(`Created Super Admin: ${email}`);
  }

  console.log('You can sign in with the email and SEED_SUPER_ADMIN_PASSWORD you set.');
  process.exit(0);
}

main().catch((err) => {
  console.error('resetSuperAdmin failed:', err.message);
  process.exit(1);
});
