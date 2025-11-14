const admin = require('firebase-admin');
const logger = require('../utils/logger');

/**
 * Firebase Admin SDK Configuration
 * Used for verifying Firebase ID tokens from Members service
 */

// Initialize Firebase Admin SDK
// Uses Application Default Credentials (ADC) in production (Cloud Run)
// For local development, set GOOGLE_APPLICATION_CREDENTIALS env var
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'ekklesia-prod-10-2025'
});

logger.info('Firebase Admin SDK initialized', {
  operation: 'firebase_init',
  projectId: process.env.FIREBASE_PROJECT_ID
});

module.exports = admin;
