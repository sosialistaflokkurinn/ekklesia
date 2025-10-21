/**
 * Shared Authentication Utilities
 *
 * Common auth functions used across the member portal.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsDqnt8G54VAANlucQpI20r3Sw1p2Bcp4",
  authDomain: "ekklesia-prod-10-2025.firebaseapp.com",
  projectId: "ekklesia-prod-10-2025",
  storageBucket: "ekklesia-prod-10-2025.firebasestorage.app",
  messagingSenderId: "521240388393",
  appId: "1:521240388393:web:de2a986ae545e20bb5cd38"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firebase App Check with reCAPTCHA Enterprise
// Site Key: 6LfDgOgrAAAAAIKly84yNibZNZsEGD31PnFQLYpM
// See: docs/security/FIREBASE_APP_CHECK_SETUP.md
let appCheck = null;
try {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider('6LfDgOgrAAAAAIKly84yNibZNZsEGD31PnFQLYpM'),
    isTokenAutoRefreshEnabled: true  // Automatically refresh tokens
  });
  console.log('✅ Firebase App Check initialized (reCAPTCHA Enterprise)');
} catch (error) {
  console.warn('⚠️ Firebase App Check initialization failed (will degrade gracefully):', error);
}

export { appCheck };

/**
 * Auth Guard - Redirect to login if not authenticated
 * Call this at the top of protected pages (dashboard, profile)
 */
export function requireAuth() {
  return new Promise((resolve) => {
    const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        // Not authenticated - redirect to login
        window.location.href = '/';
      } else {
        // Authenticated - continue
        resolve(user);
      }
    });
  });
}

/**
 * Get current user
 * Returns null if not authenticated
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Sign out and redirect to login
 */
export async function signOut() {
  await firebaseSignOut(auth);
  window.location.href = '/';
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChanged(callback) {
  return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * Get user data from token claims
 */
export async function getUserData(user) {
  if (!user) return null;

  const idTokenResult = await user.getIdTokenResult();

  return {
    uid: user.uid,
    displayName: user.displayName,
    kennitala: idTokenResult.claims.kennitala,
    email: idTokenResult.claims.email,
    phoneNumber: idTokenResult.claims.phoneNumber,
    isMember: idTokenResult.claims.isMember || false,
    roles: idTokenResult.claims.roles || []
  };
}

/**
 * Get Firebase App Check token
 * @returns {Promise<string|null>} App Check token or null if unavailable
 */
async function getAppCheckTokenValue() {
  if (!appCheck) {
    console.warn('App Check not initialized, requests will not include App Check token');
    return null;
  }

  try {
    const tokenResponse = await getAppCheckToken(appCheck);
    return tokenResponse.token;
  } catch (error) {
    console.error('Failed to get App Check token:', error);
    // Degrade gracefully - return null instead of throwing
    return null;
  }
}

/**
 * Make authenticated API request with Firebase ID token and App Check token
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options (method, body, headers, etc.)
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get Firebase ID token
  const idToken = await user.getIdToken();

  // Get App Check token (may be null if App Check not available)
  const appCheckToken = await getAppCheckTokenValue();

  // Build headers
  const headers = {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add App Check token if available
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  // Make request
  return fetch(url, {
    ...options,
    headers,
  });
}
