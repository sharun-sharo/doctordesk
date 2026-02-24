/**
 * Seed demo data for admin@doctordesk.com: patients, appointments, prescriptions, invoices.
 * Run after schema and user seed: npm run seed:demo
 * Uses the Admin user (admin@doctordesk.com) as doctor_id so they see all demo data when logging in.
 */
require('dotenv').config();
const { pool } = require('../config/database');

const ADMIN_EMAIL = process.env.SEED_DEMO_ADMIN_EMAIL || 'admin@doctordesk.com';

const DEMO_PATIENTS = [
  { name: 'Demo Patient One', phone: '9876543210', email: 'demo1@example.com', gender: 'male' },
  { name: 'Demo Patient Two', phone: '9876543211', email: 'demo2@example.com', gender: 'female' },
  { name: 'Demo Patient Three', phone: '9876543212', email: null, gender: 'other' },
  { name: 'Ravi Kumar', phone: '9876543213', email: 'ravi@example.com', gender: 'male' },
  { name: 'Sneha Patel', phone: '9876543214', email: 'sneha@example.com', gender: 'female' },
];

async function seedDemoData() {
  const [adminRows] = await pool.execute(
    'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [ADMIN_EMAIL]
  );
  if (!adminRows.length) {
    console.error(`Admin user not found: ${ADMIN_EMAIL}. Run "npm run seed" first.`);
    process.exit(1);
  }
  const adminId = adminRows[0].id;
  console.log(`Using admin id ${adminId} (${ADMIN_EMAIL}) for demo data.\n`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const patientIds = [];
    for (const p of DEMO_PATIENTS) {
      const [r] = await conn.execute(
        `INSERT INTO patients (name, phone, email, gender, created_by) VALUES (?, ?, ?, ?, ?)`,
        [p.name, p.phone, p.email || null, p.gender || null, adminId]
      );
      patientIds.push(r.insertId);
    }
    console.log(`Created ${patientIds.length} demo patients.`);

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    const appointments = [
      { date: today, start: '09:00:00', end: '09:30:00', status: 'scheduled', patientIdx: 0 },
      { date: today, start: '10:00:00', end: '10:30:00', status: 'completed', patientIdx: 1 },
      { date: today, start: '11:00:00', end: '11:30:00', status: 'cancelled', patientIdx: 2 },
      { date: yesterday, start: '14:00:00', end: '14:30:00', status: 'completed', patientIdx: 0 },
      { date: yesterday, start: '15:00:00', end: '15:30:00', status: 'completed', patientIdx: 3 },
      { date: tomorrow, start: '09:30:00', end: '10:00:00', status: 'scheduled', patientIdx: 4 },
      { date: tomorrow, start: '16:00:00', end: '16:30:00', status: 'scheduled', patientIdx: 1 },
    ];

    const appointmentIds = [];
    for (const a of appointments) {
      const [r] = await conn.execute(
        `INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [patientIds[a.patientIdx], adminId, a.date, a.start, a.end, a.status, adminId]
      );
      appointmentIds.push(r.insertId);
    }
    console.log(`Created ${appointmentIds.length} demo appointments.`);

    const medicinesJson = JSON.stringify([
      { medicine_id: null, name: 'Paracetamol', dosage: '500mg', duration: '5 days', instructions: 'After food' },
      { medicine_id: null, name: 'Cetirizine', dosage: '10mg', duration: '3 days', instructions: 'At night' },
    ]);

    await conn.execute(
      `INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, diagnosis, notes, medicines)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patientIds[0], adminId, appointmentIds[1], 'Fever', 'Rest advised.', medicinesJson]
    );
    await conn.execute(
      `INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, diagnosis, notes, medicines)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [patientIds[1], adminId, appointmentIds[2], 'Cold', null, medicinesJson]
    );
    await conn.execute(
      `INSERT INTO prescriptions (patient_id, doctor_id, diagnosis, notes, medicines)
       VALUES (?, ?, ?, ?, ?)`,
      [patientIds[3], adminId, 'Follow-up', 'Routine check.', '[]']
    );
    console.log('Created 3 demo prescriptions.');

    const invoiceNumbers = ['INV-DEMO-001', 'INV-DEMO-002', 'INV-DEMO-003'];
    const invoiceIds = [];
    const totals = [];
    for (let i = 0; i < 3; i++) {
      const subtotal = [500, 1200, 350][i];
      const tax = Math.round(subtotal * 0.05);
      const total = subtotal + tax;
      totals.push(total);
      const status = i === 0 ? 'paid' : 'pending';
      const paidAmount = i === 0 ? total : 0;
      const [r] = await conn.execute(
        `INSERT INTO invoices (invoice_number, patient_id, appointment_id, subtotal, tax_percent, tax_amount, discount, total, payment_status, paid_amount, created_by)
         VALUES (?, ?, ?, ?, 5, ?, 0, ?, ?, ?, ?)`,
        [
          invoiceNumbers[i],
          patientIds[i],
          i === 0 ? appointmentIds[1] : null,
          subtotal,
          tax,
          total,
          status,
          paidAmount,
          adminId,
        ]
      );
      invoiceIds.push(r.insertId);
    }
    for (let i = 0; i < 3; i++) {
      await conn.execute(
        `INSERT INTO invoice_items (invoice_id, item_type, description, quantity, unit_price, total)
         VALUES (?, 'consultation', ?, 1, ?, ?)`,
        [invoiceIds[i], 'Consultation', [500, 1200, 350][i], [500, 1200, 350][i]]
      );
    }
    console.log('Created 3 demo invoices with items.');

    await conn.commit();
    console.log('\nDemo data seeded successfully.');
    console.log(`Log in as ${ADMIN_EMAIL} / Admin@123 to see the data.`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    process.exit(0);
  }
}

seedDemoData().catch((err) => {
  console.error('Seed demo failed:', err.message);
  process.exit(1);
});
