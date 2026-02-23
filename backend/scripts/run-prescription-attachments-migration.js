/**
 * Run prescription_attachments table migration.
 * Usage: node scripts/run-prescription-attachments-migration.js
 * (run from backend directory, or with path from project root)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../config/database');

const SQL = `
CREATE TABLE IF NOT EXISTS prescription_attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  original_name VARCHAR(512),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prescription_attachments_prescription_id (prescription_id)
);
`.trim();

async function run() {
  try {
    await pool.execute(SQL);
    console.log('prescription_attachments table created or already exists.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
