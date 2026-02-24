/**
 * Seed Super Admin, Admin, Receptionist, and Doctor for testing.
 * Run after schema: npm run seed
 * Re-running will add any missing users (e.g. Doctor) without duplicating existing ones.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const { ROLES } = require('../config/roles');

const USERS = [
  {
    email: process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@clinic.com',
    password: process.env.SEED_SUPER_ADMIN_PASSWORD || 'SuperAdmin@123',
    name: process.env.SEED_SUPER_ADMIN_NAME || 'Super Admin',
    role_id: ROLES.SUPER_ADMIN,
  },
  {
    email: 'admin@doctordesk.com',
    password: 'Admin@123',
    name: 'Clinic Admin',
    role_id: ROLES.ADMIN,
  },
  {
    email: 'reception@doctordesk.com',
    password: 'Receptionist@123',
    name: 'Reception',
    role_id: ROLES.RECEPTIONIST,
  },
  {
    email: 'doctor@doctordesk.com',
    password: 'Doctor@123',
    name: 'Clinic',
    role_id: ROLES.DOCTOR,
  },
  {
    email: 'doctor2@doctordesk.com',
    password: 'Doctor@123',
    name: 'Dr. Smith',
    role_id: ROLES.DOCTOR,
  },
];

async function seed() {
  const [superAdminExists] = await pool.execute('SELECT id FROM users WHERE role_id = ? LIMIT 1', [ROLES.SUPER_ADMIN]);
  if (superAdminExists.length > 0) {
    // Already seeded once; only insert users that don't exist (e.g. new Doctor)
    for (const u of USERS) {
      const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [u.email]);
      if (existing.length > 0) continue;
      const hashedPassword = await bcrypt.hash(u.password, 12);
      await pool.execute(
        `INSERT INTO users (email, password, name, role_id, is_active) VALUES (?, ?, ?, ?, 1)`,
        [u.email, hashedPassword, u.name, u.role_id]
      );
      console.log(`Created: ${u.name} – ${u.email}`);
    }
    console.log('Seed check complete.');
    process.exit(0);
    return;
  }

  for (const u of USERS) {
    const hashedPassword = await bcrypt.hash(u.password, 12);
    await pool.execute(
      `INSERT INTO users (email, password, name, role_id, is_active) VALUES (?, ?, ?, ?, 1)`,
      [u.email, hashedPassword, u.name, u.role_id]
    );
    console.log(`Created: ${u.name} – ${u.email}`);
  }
  console.log('\nLogin credentials:');
  console.log('  Super Admin:  admin@clinic.com / SuperAdmin@123');
  console.log('  Admin:        admin@doctordesk.com / Admin@123');
  console.log('  Receptionist: reception@doctordesk.com / Receptionist@123');
  console.log('  Doctors:      doctor@doctordesk.com, doctor2@doctordesk.com / Doctor@123');
  console.log('\nChange passwords after first login.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
