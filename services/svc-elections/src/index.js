require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { version } = require('../package.json');
const logger = require('./utils/util-logger');
const { getPoolStats } = require('./config/config-database');
const { getAllCircuitBreakerStats } = require('./services/service-circuit-breaker');

const electionsRouter = require('./routes/route-elections');
const adminRouter = require('./routes/route-admin'); // Admin CRUD routes (Issue #192)
const nominationRouter = require('./routes/route-nomination'); // Nomination committee routes
const candidatesRouter = require('./routes/route-candidates'); // Candidate metadata
const correlationIdMiddleware = require('./middleware/middleware-correlation-id');

const app = express();
const PORT = process.env.PORT || 8081;

// Trust proxy - Required for Cloud Run to correctly populate req.ip from X-Forwarded-For
// This allows rate limiting to work correctly with the real client IP
app.set('trust proxy', true);

// =====================================================
// Middleware
// =====================================================

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(/[,^]/)
  : ['http://localhost:3000'];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Body parser with size limit (prevent DoS attacks)
// 50kb allows nomination votes with justifications for ~10 candidates
app.use(express.json({
  limit: '50kb',
  strict: true
}));

// Correlation ID middleware - adds request tracing
// Must be early in chain so all handlers have access to req.correlationId and req.logger
app.use(correlationIdMiddleware);

// Note: Request logging is now handled by correlationIdMiddleware
// which provides automatic start/end logging with timing and correlation IDs

// =====================================================
// Routes
// =====================================================

// Health check endpoint (no auth required)
// Includes pool and circuit breaker stats for monitoring (Issue #337, #338)
app.get('/health', (req, res) => {
  const poolStats = getPoolStats();
  const circuitBreakerStats = getAllCircuitBreakerStats();

  // Determine overall health status
  // Unhealthy if: pool waiting > 0 (requests queued) or circuit breaker open
  const poolHealthy = poolStats.waiting === 0;
  const circuitHealthy = circuitBreakerStats.every(cb => cb.state !== 'open');
  const status = poolHealthy && circuitHealthy ? 'healthy' : 'degraded';

  res.json({
    status,
    service: 'elections-service',
    version,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    pool: poolStats,
    circuitBreakers: circuitBreakerStats,
  });
});

// Elections API routes
app.use('/api', electionsRouter);

// Admin API routes
app.use('/api/admin', adminRouter);

// Nomination committee routes
app.use('/api/nomination', nominationRouter);

// Candidate metadata routes
app.use('/api/candidates', candidatesRouter);

// 404 handler
app.use((req, res) => {
  const response = {
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  };

  // Only expose available routes in development (security: prevent information disclosure)
  if (process.env.NODE_ENV !== 'production') {
    response.availableRoutes = [
      'GET /health',
      'POST /api/s2s/register-token (S2S only)',
      'GET /api/s2s/results (S2S only)',
      'POST /api/vote',
      'GET /api/token-status',
      'GET /api/admin/elections (Admin)',
      'POST /api/admin/elections (Admin)',
      'GET /api/admin/elections/:id (Admin)',
      'PATCH /api/admin/elections/:id (Admin)',
      'POST /api/admin/elections/:id/open (Admin)',
      'POST /api/admin/elections/:id/close (Admin)',
      'POST /api/admin/elections/:id/hide (Admin)',
      'POST /api/admin/elections/:id/unhide (Admin)',
      'DELETE /api/admin/elections/:id (Superadmin)',
      'GET /api/admin/elections/:id/results (Admin)',
      // Nomination Committee endpoints
      'GET /api/nomination/elections (Committee)',
      'GET /api/nomination/elections/:id (Committee)',
      'POST /api/nomination/elections/:id/vote (Committee)',
      'GET /api/nomination/elections/:id/results (Committee)',
      // Candidate metadata endpoints
      'GET /api/candidates (Auth)',
      'GET /api/candidates/:id (Auth)',
      'PATCH /api/candidates/:id (Auth)',
      'GET /api/candidates/:id/history (Auth)'
    ];
  }

  res.status(404).json(response);
});

// Error handler
app.use((err, req, res, next) => {
  // Handle payload too large errors
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Payload Too Large',
      message: 'Request body must be under 50kb'
    });
  }

  // Handle JSON parse errors (SyntaxError from express.json())
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON in request body'
    });
  }

  logger.error('[Error] Global error handler:', { error: err.message, stack: err.stack, type: err.type });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message
  });
});

// =====================================================
// Server Start
// =====================================================

app.listen(PORT, () => {
  logger.info('Elections Service started', {
    service: 'elections-service',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    cors_origins: corsOrigins,
    schema: 'elections',
    election_title: process.env.ELECTION_TITLE || 'Prófunarkosning 2025',
  });

  // Development-only startup banner
  if (process.env.NODE_ENV !== 'production') {
    console.log('='.repeat(60));
    console.log('🗳️  Elections Service - Admin + Voting API');
    console.log('='.repeat(60));
    console.log(`✓ Server running on port ${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✓ CORS origins: ${corsOrigins.join(', ')}`);
    console.log(`✓ Schema: elections`);
    console.log(`✓ Election: ${process.env.ELECTION_TITLE || 'Prófunarkosning 2025'}`);
    console.log('='.repeat(60));
    console.log('📡 Voting API Endpoints:');
    console.log(`   GET    http://localhost:${PORT}/health`);
    console.log(`   POST   http://localhost:${PORT}/api/s2s/register-token (S2S)`);
    console.log(`   GET    http://localhost:${PORT}/api/s2s/results (S2S)`);
    console.log(`   POST   http://localhost:${PORT}/api/vote`);
    console.log(`   GET    http://localhost:${PORT}/api/token-status`);
    console.log('='.repeat(60));
    console.log('🔧 Admin API Endpoints (RBAC Protected):');
    console.log(`   GET    http://localhost:${PORT}/api/admin/elections`);
    console.log(`   POST   http://localhost:${PORT}/api/admin/elections`);
    console.log(`   GET    http://localhost:${PORT}/api/admin/elections/:id`);
    console.log(`   PATCH  http://localhost:${PORT}/api/admin/elections/:id`);
    console.log(`   POST   http://localhost:${PORT}/api/admin/elections/:id/open`);
    console.log(`   POST   http://localhost:${PORT}/api/admin/elections/:id/close`);
    console.log(`   POST   http://localhost:${PORT}/api/admin/elections/:id/hide`);
    console.log(`   POST   http://localhost:${PORT}/api/admin/elections/:id/unhide`);
    console.log(`   DELETE http://localhost:${PORT}/api/admin/elections/:id (Superadmin)`);
    console.log(`   GET    http://localhost:${PORT}/api/admin/elections/:id/results`);
    console.log('='.repeat(60));
    console.log('⚠️  CRITICAL: This service must handle 300 votes/sec spike');
    console.log('📖 See: docs/USAGE_CONTEXT.md for load characteristics');
    console.log('📖 See: docs/OPERATIONAL_PROCEDURES.md for meeting prep');
    console.log('='.repeat(60));
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
