const { Pool } = require('pg');

// Database connection pool configuration
// Optimized for 300 votes/sec spike (see USAGE_CONTEXT.md)
const pool = new Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT) || 5433,
  database: process.env.DATABASE_NAME || 'postgres',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,

  // Connection pool settings (critical for load spike)
  min: parseInt(process.env.DATABASE_POOL_MIN) || 2,        // Keep 2 connections warm
  max: parseInt(process.env.DATABASE_POOL_MAX) || 5,        // Max 5 per instance (2 per instance recommended)
  idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DATABASE_POOL_CONNECTION_TIMEOUT) || 2000,  // Fail fast

  // Always use elections schema
  options: '-c search_path=elections,public',

  // SSL configuration (disabled for Cloud SQL Unix socket)
  // Unix socket connections are already secure and don't support SSL
  ssl: false
});

// Pool error handler
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Pool connection handler (log in development)
pool.on('connect', (client) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DB] New connection established');
  }
});

// Pool remove handler (log in development)
pool.on('remove', (client) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[DB] Connection removed from pool');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[DB] SIGTERM received, closing pool...');
  await pool.end();
  console.log('[DB] Pool closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[DB] SIGINT received, closing pool...');
  await pool.end();
  console.log('[DB] Pool closed');
  process.exit(0);
});

// Test connection on startup
pool.query('SELECT NOW() as current_time', (err, res) => {
  if (err) {
    console.error('[DB] Failed to connect to database:', err.message);
    process.exit(1);
  }
  console.log('[DB] Successfully connected to database');
  console.log(`[DB] Schema: elections`);
  console.log(`[DB] Pool: min=${pool.options.min}, max=${pool.options.max}`);
  console.log(`[DB] Current time: ${res.rows[0].current_time}`);
});

module.exports = pool;
