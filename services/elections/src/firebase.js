/**
 * Firebase Admin SDK Initialization
 * 
 * Initializes Firebase Admin SDK for server-side operations
 * Used by: rbacAuth.js, appCheck.js
 * 
 * Service Account:
 * - Production: Uses Application Default Credentials (ADC)
 * - Local: Set GOOGLE_APPLICATION_CREDENTIALS env var
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK once
if (!admin.apps.length) {
  try {
    // In Cloud Run, ADC (Application Default Credentials) is automatic
    // Locally, set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'ekklesia-prod-10-2025',
    });

    console.info('✅ Firebase Admin SDK initialized', {
      projectId: admin.app().options.projectId,
      credential: process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'Service Account Key' : 'ADC (Auto)',
    });
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error.message);
    throw error;
  }
}

module.exports = admin;
