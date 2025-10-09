const { Pool } = require('pg');

/**
 * Database Configuration
 * Cloud SQL PostgreSQL 15 (ekklesia-db)
 */

const pool = new Pool({
  host: process.env.DATABASE_HOST || '34.147.159.80',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'postgres',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,

  // Connection pool settings
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection cannot be established
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✓ Connected to Cloud SQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Query helper with error logging
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error: error.message });
    throw error;
  }
}

module.exports = {
  pool,
  query
};
