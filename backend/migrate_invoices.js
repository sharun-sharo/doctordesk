const { pool } = require('./config/database');

async function migrate() {
  try {
    console.log('Adding doctor_id to invoices table...');
    await pool.execute(`
      ALTER TABLE invoices 
      ADD COLUMN doctor_id INT UNSIGNED DEFAULT NULL AFTER appointment_id,
      ADD INDEX idx_inv_doctor (doctor_id),
      ADD CONSTRAINT fk_invoice_doctor FOREIGN KEY (doctor_id) REFERENCES users (id) ON DELETE SET NULL ON UPDATE CASCADE
    `);
    console.log('Migration successful!');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_COLUMN_NAME') {
      console.log('Column already exists.');
      process.exit(0);
    }
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
