const { Pool } = require('pg');
const logger = require('../utils/logger');

// Database connection pool configuration
// Optimized for 300 votes/sec spike (see USAGE_CONTEXT.md)
const dbHost = process.env.DATABASE_HOST || '127.0.0.1';
const isUnixSocket = dbHost.startsWith('/cloudsql/');

const pool = new Pool({
  host: dbHost,
  // For Unix socket connections (Cloud Run), don't specify port (uses default 5432)
  // For TCP connections (local dev), use port 5433
  port: isUnixSocket ? undefined : (parseInt(process.env.DATABASE_PORT) || 5433),
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

// Pool error handler (graceful degradation)
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', {
    error: err.message,
    code: err.code,
    timestamp: new Date().toISOString()
  });

  // Let pool handle transient errors - removes bad connections automatically
  // Only exit for unrecoverable errors (database completely down)
  if (err.code === 'ECONNREFUSED' || err.code === '57P03') {
    // Database is unreachable - exit and let Cloud Run restart with backoff
    logger.error('[FATAL] Database unreachable, exiting...');
    setTimeout(() => process.exit(1), 1000); // Give time to flush logs
  }

  // For other errors (network blips, idle connection timeouts, etc.):
  // - Pool will automatically remove bad connections
  // - New connections will be created on demand
  // - Service continues serving requests
  // - Cloud Run health checks will catch if pool completely fails
});

// Pool connection handler (log in development)
pool.on('connect', (client) => {
  logger.debug('[DB] New connection established');
});

// Pool remove handler (log in development)
pool.on('remove', (client) => {
  logger.debug('[DB] Connection removed from pool');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[DB] SIGTERM received, closing pool...');
  await pool.end();
  logger.info('[DB] Pool closed');
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('[DB] SIGINT received, closing pool...');
  await pool.end();
  logger.info('[DB] Pool closed');
  process.exit(0);
});

// Test connection on startup
pool.query('SELECT NOW() as current_time', (err, res) => {
  if (err) {
    logger.error('[DB] Failed to connect to database', {
      error: err.message,
    });
    process.exit(1);
  }
  logger.info('[DB] Successfully connected to database', {
    schema: 'elections',
    pool_min: pool.options.min,
    pool_max: pool.options.max,
    current_time: res.rows[0].current_time
  });
});

module.exports = pool;
