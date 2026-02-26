/**
 * Run schema.sql against the database.
 * Creates the database if it doesn't exist (local dev).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};
const dbName = process.env.DB_NAME || 'clinic_management';

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({ ...dbConfig, database: dbName });
  } catch (err) {
    if (err.code === 'ER_BAD_DB_ERROR' || (err.message && err.message.includes('Unknown database'))) {
      // Create database then reconnect
      const admin = await mysql.createConnection(dbConfig);
      await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await admin.end();
      conn = await mysql.createConnection({ ...dbConfig, database: dbName });
    } else {
      throw err;
    }
  }

  const schemaPath = path.join(__dirname, '../../database/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await conn.query(sql);
  console.log('Schema applied successfully.');
  await conn.end();
}

run().catch((err) => {
  console.error('Schema run failed:', err.message);
  process.exit(1);
});
