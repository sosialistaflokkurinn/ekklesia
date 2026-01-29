require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { version } = require('../package.json');
const rateLimit = require('express-rate-limit');

// Initialize Firebase Admin SDK (required for App Check, Storage, etc.)
require('./config/config-firebase');
const electionRoutes = require('./routes/route-election');
const adminRouter = require('./routes/route-admin');
const externalEventsRouter = require('./routes/route-external-events');
const sysadminChatRouter = require('./routes/route-sysadmin-chat');
const memberAssistantRouter = require('./routes/route-member-assistant');
const emailTemplateAssistantRouter = require('./routes/route-email-template-assistant');
const partyWikiRouter = require('./routes/route-party-wiki');
const systemHealthRouter = require('./routes/route-system-health');
const errorsRouter = require('./routes/route-errors');
const analyticsRouter = require('./routes/route-analytics');
const { verifyAppCheck } = require('./middleware/middleware-app-check');
const { readLimiter, adminLimiter, healthLimiter } = require('./middleware/middleware-rate-limiter');
const logger = require('./utils/util-logger');
const { pool } = require('./config/config-database');

/**
 * Events Service (Atburðir)
 * Election administration and voting token issuance
 * MVP: Option A (Standalone) - No Elections service dependency
 */

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy headers from Cloud Run (1 = trust first proxy hop)
// Required for express-rate-limit to correctly identify clients
// Using 1 instead of true to prevent IP spoofing bypass (ERR_ERL_PERMISSIVE_TRUST_PROXY)
app.set('trust proxy', 1);

// Middleware
// CORS configuration - only allow known origins in production
// Support both comma and semicolon separators (semicolons work better with gcloud --set-env-vars)
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(/[,;]/).map(s => s.trim()).filter(Boolean)
  : [
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
// Skip for routes that need larger limits (they have their own parsers)
const largeBodyRoutes = ['/api/sysadmin', '/api/member-assistant', '/api/email-template-assistant'];
app.use((req, res, next) => {
  if (largeBodyRoutes.some(route => req.path.startsWith(route))) {
    return next(); // Skip global parser, use route-specific one
  }
  express.json({ limit: '5kb', strict: true })(req, res, next);
});

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
// Rate limited to prevent abuse (CodeQL: Missing rate limiting fix)
app.get('/health/ready', healthLimiter, async (req, res) => {
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

// =============================================================================
// PUBLIC API ROUTES (no App Check required)
// These routes are designed for public access or have their own auth mechanisms
// =============================================================================

// External events - public API for xj-next website and dashboard
// S2S calls can use X-API-Key header for additional features
app.use('/api/external-events', readLimiter, externalEventsRouter);

// Analytics tracking - public for anonymous page view tracking
app.use('/api/analytics', readLimiter, analyticsRouter);

// =============================================================================
// APP CHECK PROTECTED ROUTES
// All routes below require valid Firebase App Check token
// =============================================================================

// Rate limiting for App Check–protected API routes
const appCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs for /api
});

// Rate limiting for API routes (MUST come before auth to prevent DoS on auth endpoints)
app.use('/api', readLimiter);
app.use('/api/admin', adminLimiter);
// Security: Firebase App Check verification (ENFORCED)
// Rejects requests without valid App Check token (403 Forbidden)
// See: docs/security/FIREBASE_APP_CHECK_IMPLEMENTATION.md
app.use('/api', appCheckLimiter, verifyAppCheck);

// API routes (App Check protected)
app.use('/api', electionRoutes);

// Sysadmin chat needs larger body limit for conversation history
app.use('/api/sysadmin', express.json({ limit: '100kb', strict: true }), sysadminChatRouter);
// Member assistant (RAG-powered) - larger limit for history + web search context
app.use('/api/member-assistant', express.json({ limit: '100kb', strict: true }), memberAssistantRouter);
// Email template assistant - helps admins write email templates
app.use('/api/email-template-assistant', express.json({ limit: '50kb', strict: true }), emailTemplateAssistantRouter);
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
      message: 'Request body too large (limit: 5kb for most routes, 50-100kb for AI routes)'
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
