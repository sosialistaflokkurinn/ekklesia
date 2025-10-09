require('dotenv').config();
const express = require('express');
const cors = require('cors');
const electionRoutes = require('./routes/election');

/**
 * Events Service (Atburðir)
 * Election administration and voting token issuance
 * MVP: Option A (Standalone) - No Elections service dependency
 */

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: [
    'https://ekklesia-prod-10-2025.web.app',
    'https://ekklesia-prod-10-2025.firebaseapp.com',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'events-service',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api', electionRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
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
  console.log(`Database: ${process.env.DATABASE_HOST || '34.147.159.80'}:${process.env.DATABASE_PORT || '5432'}`);
  console.log('='.repeat(50));
  console.log('API Endpoints:');
  console.log('  GET  /api/election       - Get current election');
  console.log('  POST /api/request-token  - Request voting token');
  console.log('  GET  /api/my-status      - Check participation status');
  console.log('  GET  /api/my-token       - Retrieve token (disabled in MVP)');
  console.log('  GET  /api/results        - Get results (Phase 2)');
  console.log('='.repeat(50));
});

module.exports = app;
