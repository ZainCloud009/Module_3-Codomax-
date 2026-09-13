const { Pool } = require('pg');
const logger = require('./logger');

// All credentials come from environment variables - never hardcoded.
// In production these are injected via AWS Secrets Manager / Parameter Store,
// not committed to this repo (see .env.example).
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle DB client', { error: err.message });
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      file_url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  logger.info('Database schema verified/created');
}

module.exports = { pool, initSchema };
