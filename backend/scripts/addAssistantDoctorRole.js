/**
 * Add Assistant doctor role (id 5) to the roles table.
 * Run once against production if you get: foreign key constraint fails (role_id references roles.id)
 *
 * From project root (with backend/.env or env vars set to your DB):
 *   node backend/scripts/addAssistantDoctorRole.js
 *
 * For Railway prod: set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and DB_PORT if needed)
 * to your Railway MySQL credentials, then run the command above.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const SQL = `
INSERT IGNORE INTO roles (id, name, description) VALUES
(5, 'assistant_doctor', 'Assistant doctor - same as receptionist');
`;

async function run() {
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    console.error('Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and DB_PORT if needed) in backend/.env or environment.');
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [result] = await conn.query(SQL);
  const affected = result.affectedRows;
  await conn.end();

  if (affected > 0) {
    console.log('Assistant doctor role (id 5) added to roles table.');
  } else {
    console.log('Role id 5 already exists. No change needed.');
  }
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
