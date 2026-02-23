/**
 * Create the subscriptions table if it doesn't exist.
 * Run from project root: node backend/scripts/runSubscriptionsMigration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
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
  });

  const sqlPath = path.join(__dirname, '../../database/migrations/add_subscriptions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await conn.query(sql);
  console.log('Subscriptions table created successfully.');
  await conn.end();
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
