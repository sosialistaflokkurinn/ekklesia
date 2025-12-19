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

// Singleton promise for auth resolution to prevent race conditions
let authResolutionPromise = null;

/**
 * Auth Guard - Redirect to login if not authenticated
 * Call this at the top of protected pages (dashboard, profile)
 *
 * Uses singleton pattern to prevent race conditions when called
 * multiple times concurrently.
 */
export function requireAuth() {
  // If already resolving, return existing promise
  if (authResolutionPromise) {
    return authResolutionPromise;
  }

  // Create new resolution promise
  authResolutionPromise = new Promise((resolve, reject) => {
    const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
      unsubscribe();
      // Clear singleton after resolution
      authResolutionPromise = null;

      if (!user) {
        // Not authenticated - redirect to login
        // Use replace to prevent back-button issues
        window.location.replace('/');
        reject(new Error('Not authenticated'));
      } else {
        // Authenticated - continue
        resolve(user);
      }
    });
  });

  return authResolutionPromise;
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
 * Get Firebase App Check token with error handling
 * @returns {Promise<string|null>} App Check token or null if unavailable
 */
async function getAppCheckTokenValue() {
  try {
    const token = await firebaseGetAppCheckTokenValue();
    return token;
  } catch (error) {
    // Log warning but don't block - App Check may be optional
    debug.warn('App Check token failed:', error.message);
    // Return null - let backend decide if App Check is required
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
