const admin = require('firebase-admin');

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

console.log('✓ Firebase Admin SDK initialized');

module.exports = admin;
