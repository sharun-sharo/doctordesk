const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: '+00:00', // UTC
  charset: 'utf8mb4',
});

// Test connection
const testConnection = async () => {
  if (!process.env.DB_USER || !process.env.DB_NAME) {
    console.error('Database connection failed: Missing DB_USER or DB_NAME in .env. Copy backend/.env.example to backend/.env and set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.');
    return false;
  }
  try {
    const conn = await pool.getConnection();
    conn.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err.message || err.code || String(err));
    return false;
  }
};

module.exports = { pool, testConnection };
