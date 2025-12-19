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
 * - LAZY App Check loading (saves ~1,500ms on initial page load)
 *
 * @module firebase/app
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { debug } from '../js/utils/util-debug.js';
import {
  getAuth,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
// App Check is now loaded lazily - see initAppCheckLazy()
import {
  getFunctions as firebaseGetFunctions,
  httpsCallable as firebaseHttpsCallable
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import {
  signInWithCustomToken as firebaseSignInWithCustomToken
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getCountFromServer
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

// App Check - LAZY LOADED for performance
// reCAPTCHA Enterprise SDK is ~355KB and takes ~1,500ms to initialize
// We only load it when actually needed (first Cloud Function call)
// Site Key: 6LfDgOgrAAAAAIKly84yNibZNZsEGD31PnFQLYpM
// See: docs/security/FIREBASE_APP_CHECK_SETUP.md
let appCheck = null;
let appCheckInitPromise = null;
let appCheckModule = null;

/**
 * Lazily initialize App Check
 * Only loads reCAPTCHA SDK when first token is needed
 * 
 * @returns {Promise<Object|null>} App Check instance
 */
async function initAppCheckLazy() {
  // Already initialized
  if (appCheck) return appCheck;
  
  // Initialization in progress - wait for it
  if (appCheckInitPromise) return appCheckInitPromise;
  
  // Start lazy initialization
  appCheckInitPromise = (async () => {
    try {
      debug.log('🔄 Lazy loading App Check (reCAPTCHA Enterprise)...');
      const startTime = performance.now();
      
      // Dynamically import App Check module
      appCheckModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js');
      
      appCheck = appCheckModule.initializeAppCheck(app, {
        provider: new appCheckModule.ReCaptchaEnterpriseProvider('6LfDgOgrAAAAAIKly84yNibZNZsEGD31PnFQLYpM'),
        isTokenAutoRefreshEnabled: true
      });
      
      const elapsed = performance.now() - startTime;
      debug.log(`✅ Firebase App Check initialized (${elapsed.toFixed(0)}ms)`);
      return appCheck;
    } catch (error) {
      debug.warn('⚠️ Firebase App Check initialization failed (will degrade gracefully):', error);
      appCheckInitPromise = null; // Allow retry
      return null;
    }
  })();
  
  return appCheckInitPromise;
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
 * Now lazily initializes App Check if not already done
 *
 * @returns {Promise<Object|null>} App Check instance or null if not initialized
 */
export async function getFirebaseAppCheck() {
  return await initAppCheckLazy();
}

/**
 * Get App Check token
 * Lazily initializes App Check on first call
 *
 * @param {boolean} forceRefresh - Force token refresh
 * @returns {Promise<string|null>} App Check token or null if unavailable
 */
export async function getAppCheckTokenValue(forceRefresh = false) {
  // Lazily initialize App Check
  const appCheckInstance = await initAppCheckLazy();
  
  if (!appCheckInstance || !appCheckModule) {
    debug.warn('App Check not initialized, requests will not include App Check token');
    return null;
  }

  try {
    const tokenResponse = await appCheckModule.getToken(appCheckInstance, forceRefresh);
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
  firebaseSignInWithCustomToken as signInWithCustomToken,
  // Firestore functions
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getCountFromServer
};
