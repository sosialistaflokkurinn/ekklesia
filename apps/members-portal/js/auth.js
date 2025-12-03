/**
 * Shared Authentication Utilities
 *
 * Common auth functions used across the member portal.
 */

import { debug } from './utils/util-debug.js';
import {
  getFirebaseAuth,
  getFirebaseAppCheck,
  getAppCheckTokenValue as firebaseGetAppCheckTokenValue,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut
} from '../firebase/app.js';

// Get Auth instance from centralized firebase/app.js
export const auth = getFirebaseAuth();

// Get App Check instance from centralized firebase/app.js
export const appCheck = getFirebaseAppCheck();

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
  return await firebaseGetAppCheckTokenValue();
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
