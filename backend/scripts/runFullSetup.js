/**
 * Run full database setup: schema.sql + prescription_attachments table.
 * Use for fresh DB (e.g. Railway MySQL). Requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in env.
 *
 * Usage (from repo root):
 *   cd backend && node scripts/runFullSetup.js
 * Or with Railway DB vars:
 *   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=... node backend/scripts/runFullSetup.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PRESCRIPTION_ATTACHMENTS_SQL = `
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
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    console.error('Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (e.g. from Railway MySQL Variables).');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await conn.query(schemaSql);
    console.log('Schema applied.');

    await conn.query(PRESCRIPTION_ATTACHMENTS_SQL);
    console.log('prescription_attachments table OK.');

    console.log('Full setup done.');
  } finally {
    await conn.end();
  }
}

run().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
