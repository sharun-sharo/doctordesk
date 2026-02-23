/**
 * Run schema.sql against the database.
 * Set DB_NAME in .env; create the database manually in cPanel if needed.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

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
