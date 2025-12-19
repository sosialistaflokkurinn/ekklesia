const { Pool } = require('pg');
const logger = require('../utils/util-logger');

/**
 * Database Configuration
 * Cloud SQL PostgreSQL 15 (ekklesia-db)
 */

const pool = new Pool({
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT || '5433'),
  database: process.env.DATABASE_NAME || 'postgres',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD,

  // Connection pool settings (configurable via environment)
  min: parseInt(process.env.DATABASE_POOL_MIN || '2'),  // Keep connections warm
  max: parseInt(process.env.DATABASE_POOL_MAX || '25'), // Max connections per instance
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection cannot be established

  // Statement timeout to prevent long-running queries
  statement_timeout: 30000,
});

// Test connection on startup
pool.on('connect', () => {
  logger.info('Connected to Cloud SQL database', {
    operation: 'database_connect',
    host: process.env.DATABASE_HOST,
    database: process.env.DATABASE_NAME
  });
});

// Pool error handler (graceful degradation)
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle database client', {
    operation: 'database_pool_error',
    error: err.message,
    code: err.code,
    stack: err.stack
  });

  // Let pool handle transient errors - removes bad connections automatically
  // Only exit for unrecoverable errors (database completely down)
  if (err.code === 'ECONNREFUSED' || err.code === '57P03') {
    // Database is unreachable - exit and let Cloud Run restart with backoff
    logger.error('FATAL: Database unreachable, exiting', {
      operation: 'database_fatal_error',
      error: err.message,
      code: err.code
    });
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
    logger.debug('Executed database query', {
      operation: 'database_query',
      duration_ms: duration,
      rows: res.rowCount
    });
    return res;
  } catch (error) {
    logger.error('Database query failed', {
      operation: 'database_query',
      error: error.message,
      stack: error.stack,
      code: error.code
    });
    throw error;
  }
}

/**
 * Get pool metrics for monitoring
 * @returns {Object} Pool statistics
 */
function getPoolMetrics() {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingRequests: pool.waitingCount
  };
}

module.exports = {
  pool,
  query,
  getPoolMetrics
};
