require('dotenv').config();
const express = require('express');
const cors = require('cors');

const electionsRouter = require('./routes/elections');
const { cloudflareOnly } = require('./middleware/cloudflare');

const app = express();
const PORT = process.env.PORT || 8081;

// =====================================================
// Middleware
// =====================================================

// Security: Cloudflare origin protection
// Blocks direct access to Cloud Run URL, only allows traffic from Cloudflare
app.use(cloudflareOnly);

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(/[,^]/)
  : ['http://localhost:3000'];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Body parser
app.use(express.json());

// Request logging (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// =====================================================
// Routes
// =====================================================

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'elections-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Elections API routes
app.use('/api', electionsRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /health',
      'POST /api/s2s/register-token (S2S only)',
      'GET /api/s2s/results (S2S only)',
      'POST /api/vote',
      'GET /api/token-status'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);
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
  console.log('='.repeat(60));
  console.log('🗳️  Elections Service MVP - Anonymous Ballot Recording');
  console.log('='.repeat(60));
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ CORS origins: ${corsOrigins.join(', ')}`);
  console.log(`✓ Schema: elections`);
  console.log(`✓ Election: ${process.env.ELECTION_TITLE || 'Prófunarkosning 2025'}`);
  console.log('='.repeat(60));
  console.log('📡 API Endpoints:');
  console.log(`   GET    http://localhost:${PORT}/health`);
  console.log(`   POST   http://localhost:${PORT}/api/s2s/register-token (S2S)`);
  console.log(`   GET    http://localhost:${PORT}/api/s2s/results (S2S)`);
  console.log(`   POST   http://localhost:${PORT}/api/vote`);
  console.log(`   GET    http://localhost:${PORT}/api/token-status`);
  console.log('='.repeat(60));
  console.log('⚠️  CRITICAL: This service must handle 300 votes/sec spike');
  console.log('📖 See: docs/USAGE_CONTEXT.md for load characteristics');
  console.log('📖 See: docs/OPERATIONAL_PROCEDURES.md for meeting prep');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
