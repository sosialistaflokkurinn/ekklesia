require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { version } = require('../package.json');
const electionRoutes = require('./routes/election');
const adminRouter = require('./routes/admin');
const { verifyAppCheckOptional } = require('./middleware/appCheck');

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
  console.warn('WARNING: CORS origins are not properly restricted in production. Review CORS_ORIGINS environment variable.');
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
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint (no App Check required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'events-service',
    version,
    timestamp: new Date().toISOString()
  });
});

// Security: Firebase App Check verification (monitor-only mode)
// After 1-2 days of monitoring, switch to verifyAppCheck for enforcement
// See: docs/security/FIREBASE_APP_CHECK_IMPLEMENTATION.md Phase 5
app.use('/api', verifyAppCheckOptional);

// API routes
app.use('/api', electionRoutes);
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
      message: 'Request body must be under 5kb'
    });
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('Events Service (Atburðir) - MVP');
  console.log('='.repeat(50));
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Firebase Project: ${process.env.FIREBASE_PROJECT_ID || 'ekklesia-prod-10-2025'}`);
  console.log(`Database: ${process.env.DATABASE_HOST || '127.0.0.1'}:${process.env.DATABASE_PORT || '5433'}`);
  console.log('='.repeat(50));
  console.log('API Endpoints:');
  console.log('  GET  /api/election       - Get current election');
  console.log('  POST /api/request-token  - Request voting token');
  console.log('  GET  /api/my-status      - Check participation status');
  console.log('  GET  /api/my-token       - Retrieve token (disabled in MVP)');
  console.log('  GET  /api/results        - Get results (Phase 2)');
  console.log('  POST /api/admin/reset-election (admin only)');
  console.log('='.repeat(50));
});

module.exports = app;
