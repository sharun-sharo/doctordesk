/**
 * Add clinic_settings table if missing (for existing DBs).
 * Run once: node scripts/ensureClinicSettings.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const dbName = process.env.DB_NAME || 'clinic_management';

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    multipleStatements: true,
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS clinic_settings (
      id int unsigned NOT NULL AUTO_INCREMENT,
      address text,
      phone varchar(50) DEFAULT NULL,
      email varchar(255) DEFAULT NULL,
      gstin varchar(50) DEFAULT NULL,
      updated_at datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [[{ count }]] = await conn.query('SELECT COUNT(*) AS count FROM clinic_settings');
  if (count === 0) {
    await conn.query('INSERT INTO clinic_settings (id) VALUES (1)');
    console.log('Inserted default clinic_settings row.');
  }
  console.log('clinic_settings table ready.');
  await conn.end();
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
