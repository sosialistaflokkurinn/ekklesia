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

// Pool error handler (graceful degradation)
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', {
    error: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });

  // Let pool handle transient errors - removes bad connections automatically
  // Only exit for unrecoverable errors (database completely down)
  if (err.code === 'ECONNREFUSED' || err.code === '57P03') {
    // Database is unreachable - exit and let Cloud Run restart with backoff
    console.error('[FATAL] Database unreachable, exiting...');
    setTimeout(() => process.exit(1), 1000); // Give time to flush logs
  }

  // For other errors (network blips, idle connection timeouts, etc.):
  // - Pool will automatically remove bad connections
  // - New connections will be created on demand
  // - Service continues serving requests
  // - Cloud Run health checks will catch if pool completely fails
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
