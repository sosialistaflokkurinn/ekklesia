import admin from 'firebase-admin';
import config from './config.js';

let app = null;

/**
 * Initialize Firebase Admin SDK
 * Uses Application Default Credentials (ADC) in Cloud Run
 */
export function initializeFirebase() {
  if (app) return app;

  try {
    // In Cloud Run, ADC is automatically available
    // No need to provide credentials explicitly
    app = admin.initializeApp({
      projectId: config.firebase.projectId
    });

    console.log('✅ Firebase Admin SDK initialized');
    return app;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', error);
    throw error;
  }
}

/**
 * Verify Firebase ID token
 * @param {string} idToken - Firebase ID token from client
 * @returns {Promise<admin.auth.DecodedIdToken>} Decoded token with user claims
 */
export async function verifyIdToken(idToken) {
  if (!app) {
    initializeFirebase();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid authentication token');
  }
}

/**
 * Get user by UID
 * @param {string} uid - Firebase user UID
 * @returns {Promise<admin.auth.UserRecord>} User record
 */
export async function getUser(uid) {
  if (!app) {
    initializeFirebase();
  }

  try {
    const userRecord = await admin.auth().getUser(uid);
    return userRecord;
  } catch (error) {
    console.error('Failed to get user:', error);
    throw new Error('User not found');
  }
}

export default { initializeFirebase, verifyIdToken, getUser };
