require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { version } = require('../package.json');
const electionRoutes = require('./routes/route-election');
const adminRouter = require('./routes/route-admin');
const externalEventsRouter = require('./routes/route-external-events');
const kimiChatRouter = require('./routes/route-kimi-chat');
const partyWikiRouter = require('./routes/route-party-wiki');
const systemHealthRouter = require('./routes/route-system-health');
const errorsRouter = require('./routes/route-errors');
const { verifyAppCheckOptional } = require('./middleware/middleware-app-check');
const { readLimiter, adminLimiter } = require('./middleware/middleware-rate-limiter');
const logger = require('./utils/util-logger');
const { pool } = require('./config/config-database');

/**
 * Events Service (Atburðir)
 * Election administration and voting token issuance
 * MVP: Option A (Standalone) - No Elections service dependency
 */

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
// CORS configuration - only allow known origins in production
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean) : [
  'https://ekklesia-prod-10-2025.web.app',
  'https://ekklesia-prod-10-2025.firebaseapp.com',
  'http://localhost:3000'
];

if (process.env.NODE_ENV === 'production' && (corsOrigins.length === 0 || corsOrigins.includes('*'))) {
  logger.warn('CORS origins not properly restricted in production', {
    operation: 'server_startup',
    security_issue: 'unrestricted_cors',
    cors_origins: corsOrigins
  });
}

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Body parser with size limit (prevent DoS attacks)
app.use(express.json({
  limit: '5kb',
  strict: true
}));

// Request logging
app.use((req, res, next) => {
  logger.debug('Incoming request', {
    operation: 'http_request',
    method: req.method,
    path: req.path
  });
  next();
});

// Health check endpoint (no App Check required) - liveness probe
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'events-service',
    version,
    timestamp: new Date().toISOString()
  });
});

// Readiness probe - checks database connectivity
app.get('/health/ready', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Readiness check failed', {
      operation: 'health_ready',
      error: error.message
    });
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      error: error.message
    });
  }
});

// Error reporting endpoint - no App Check (errors can occur before Firebase init)
// Uses 10kb limit for error batches, has its own rate limiting
app.use('/api/errors', express.json({ limit: '10kb', strict: true }), errorsRouter);

// Security: Firebase App Check verification (monitor-only mode)
// After 1-2 days of monitoring, switch to verifyAppCheck for enforcement
// See: docs/security/FIREBASE_APP_CHECK_IMPLEMENTATION.md Phase 5
app.use('/api', verifyAppCheckOptional);

// Rate limiting for API routes
app.use('/api', readLimiter);
app.use('/api/admin', adminLimiter);

// API routes
app.use('/api', electionRoutes);
app.use('/api/external-events', externalEventsRouter);

// Kimi chat needs larger body limit for conversation history
app.use('/api/kimi', express.json({ limit: '50kb', strict: true }), kimiChatRouter);
app.use('/api/party-wiki', partyWikiRouter);
app.use('/api/system', systemHealthRouter);
// Admin-only routes (developer testing only)
app.use('/api/admin', adminRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  // Handle payload too large errors
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body too large (limit: 5kb for most routes, 50kb for /api/kimi)'
    });
  }

  logger.error('Unhandled error', {
    operation: 'error_handler',
    error: err.message,
    stack: err.stack
  });
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info('Events Service started', {
    operation: 'server_startup',
    service: 'events-service',
    version,
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    firebase_project: process.env.FIREBASE_PROJECT_ID || 'ekklesia-prod-10-2025',
    database_host: process.env.DATABASE_HOST || '127.0.0.1',
    database_port: process.env.DATABASE_PORT || '5433',
    health_check: `http://localhost:${PORT}/health`
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`, {
    operation: 'server_shutdown',
    signal
  });

  server.close(async () => {
    logger.info('HTTP server closed', { operation: 'server_shutdown' });
    try {
      await pool.end();
      logger.info('Database pool closed', { operation: 'server_shutdown' });
    } catch (err) {
      logger.error('Error closing database pool', {
        operation: 'server_shutdown',
        error: err.message
      });
    }
    process.exit(0);
  });

  // Force exit after 30 seconds if graceful shutdown fails
  setTimeout(() => {
    logger.error('Forced shutdown after timeout', { operation: 'server_shutdown' });
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app;
