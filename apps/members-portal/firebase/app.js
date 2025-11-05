/**
 * Firebase Service Layer
 *
 * Single source of truth for Firebase initialization and service access.
 * All modules should import Firebase services from here instead of
 * importing directly from CDN.
 *
 * Benefits:
 * - Single CDN import point (faster page loads)
 * - Easier to mock for testing
 * - Centralized Firebase configuration
 * - Explicit service dependencies
 *
 * @module firebase/app
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { debug } from '../js/utils/debug.js';
import {
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';
import {
  getFunctions as firebaseGetFunctions,
  httpsCallable as firebaseHttpsCallable
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import {
  signInWithCustomToken as firebaseSignInWithCustomToken
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsDqnt8G54VAANlucQpI20r3Sw1p2Bcp4",
  authDomain: "ekklesia-prod-10-2025.firebaseapp.com",
  projectId: "ekklesia-prod-10-2025",
  storageBucket: "ekklesia-prod-10-2025.firebasestorage.app",
  messagingSenderId: "521240388393",
  appId: "1:521240388393:web:de2a986ae545e20bb5cd38"
};

// Initialize Firebase (singleton)
const app = initializeApp(firebaseConfig);

// Initialize Firebase App Check with reCAPTCHA Enterprise
// Site Key: 6LfDgOgrAAAAAIKly84yNibZNZsEGD31PnFQLYpM
// See: docs/security/FIREBASE_APP_CHECK_SETUP.md
let appCheck = null;
try {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider('6LfDgOgrAAAAAIKly84yNibZNZsEGD31PnFQLYpM'),
    isTokenAutoRefreshEnabled: true
  });
  debug.log('✅ Firebase App Check initialized (reCAPTCHA Enterprise)');
} catch (error) {
  debug.warn('⚠️ Firebase App Check initialization failed (will degrade gracefully):', error);
}

/**
 * Get Firebase App instance
 *
 * @returns {Object} Firebase app instance
 */
export function getApp() {
  return app;
}

/**
 * Get Firebase Authentication instance
 *
 * @returns {Object} Firebase Auth instance
 */
export function getFirebaseAuth() {
  return getAuth(app);
}

/**
 * Get Firestore instance
 *
 * @returns {Object} Firestore instance
 */
export function getFirebaseFirestore() {
  return getFirestore(app);
}

/**
 * Get Firebase Functions instance
 *
 * @param {string} [region] - Cloud Functions region (e.g., 'europe-west2')
 * @returns {Object} Firebase Functions instance
 */
export function getFunctions(region) {
  if (region) {
    return firebaseGetFunctions(app, region);
  }
  return firebaseGetFunctions(app);
}

/**
 * Create callable Cloud Function reference
 *
 * @param {string} name - Cloud Function name
 * @param {string} [region] - Cloud Functions region (e.g., 'europe-west2')
 * @returns {Function} Callable function reference
 */
export function httpsCallable(name, region) {
  const functions = getFunctions(region);
  return firebaseHttpsCallable(functions, name);
}

/**
 * Get Firebase App Check instance
 *
 * @returns {Object|null} App Check instance or null if not initialized
 */
export function getFirebaseAppCheck() {
  return appCheck;
}

/**
 * Get App Check token
 *
 * @param {boolean} forceRefresh - Force token refresh
 * @returns {Promise<string|null>} App Check token or null if unavailable
 */
export async function getAppCheckTokenValue(forceRefresh = false) {
  if (!appCheck) {
    debug.warn('App Check not initialized, requests will not include App Check token');
    return null;
  }

  try {
    const tokenResponse = await getAppCheckToken(appCheck, forceRefresh);
    return tokenResponse.token;
  } catch (error) {
    debug.error('Failed to get App Check token:', error);
    return null;
  }
}

// Re-export commonly used functions
export {
  onAuthStateChanged,
  firebaseSignOut as signOut,
  firebaseSignInWithCustomToken as signInWithCustomToken
};
