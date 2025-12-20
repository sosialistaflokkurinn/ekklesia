/**
 * Session & Authentication Module
 *
 * Pure session logic without DOM dependencies.
 * Handles authentication state, user data extraction, and API requests.
 *
 * Separated from UI logic for:
 * - Better testability (no DOM mocking required)
 * - Reusability (CLI tools, workers, tests)
 * - Clear separation of concerns
 *
 * @module session/auth
 */

import { getFirebaseAuth, onAuthStateChanged, signOut as firebaseSignOut } from '../firebase/app.js';
import { getAppCheckTokenValue } from '../firebase/app.js';

/**
 * Custom error for authentication failures
 *
 * Used to signal that redirect is needed without coupling to window.location.
 */
export class AuthenticationError extends Error {
  constructor(message, redirectTo = '/') {
    super(message);
    this.name = 'AuthenticationError';
    this.redirectTo = redirectTo;
  }
}

/**
 * Auth guard - check if user is authenticated
 *
 * Returns user if authenticated, throws AuthenticationError if not.
 * The caller (usually UI layer) decides how to handle the redirect.
 *
 * @returns {Promise<Object>} Firebase user object
 * @throws {AuthenticationError} If user not authenticated
 */
export async function requireAuth() {
  return new Promise((resolve, reject) => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        // Not authenticated - throw error with redirect hint
        reject(new AuthenticationError('Not authenticated', '/'));
      } else {
        // Authenticated - continue
        resolve(user);
      }
    });
  });
}

/**
 * Get current authenticated user
 *
 * @returns {Promise<Object|null>} Firebase user object or null if not authenticated
 */
export async function getCurrentUser() {
  return new Promise((resolve) => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Extract user data from Firebase token claims
 *
 * Pure function - no side effects, easy to test.
 *
 * @param {Object} user - Firebase user object
 * @returns {Promise<Object>} User data object
 * @returns {Promise<{uid: string, displayName: string|null, kennitala: string|null, email: string|null, phoneNumber: string|null, isMember: boolean}>}
 */
export async function getUserData(user) {
  if (!user) return null;

  const idTokenResult = await user.getIdTokenResult(true);

  return {
    uid: user.uid,
    displayName: user.displayName,
    kennitala: idTokenResult.claims.kennitala || null,
    email: idTokenResult.claims.email || null,
    phoneNumber: idTokenResult.claims.phoneNumber || null,
    isMember: idTokenResult.claims.isMember || false,
    roles: Array.isArray(idTokenResult.claims.roles) ? idTokenResult.claims.roles : []
  };
}

/**
 * Sign out user
 *
 * Pure function - only signs out from Firebase.
 * Caller decides whether to redirect.
 *
 * @returns {Promise<void>}
 */
export async function signOut() {
  // Clear sessionStorage (contains PII caches like members list, elevated users)
  sessionStorage.clear();

  // Clear legacy localStorage keys that contained PII (from before security update)
  // Note: Non-PII caches (events, elections, unions, job_titles) are kept in localStorage
  const piiCacheKeys = [
    'admin_members_list_cache',      // Contains: names, kennitala, emails, phones
    'admin_sync_history_cache',      // May contain kennitala references
    'superuser_elevated_users_cache' // Contains: names, kennitala, emails
  ];
  piiCacheKeys.forEach(key => localStorage.removeItem(key));

  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

/** Default timeout for API requests (30 seconds) */
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Make authenticated API request with Firebase ID token and App Check token
 *
 * Only sets Content-Type: application/json if you're actually sending JSON.
 * This prevents incorrect headers on GET requests and improves preflight caching.
 *
 * @param {string} url - API endpoint URL
 * @param {Object} [options] - Fetch options (method, body, headers, etc.)
 * @param {number} [options.timeout] - Request timeout in ms (default: 30000)
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
  const auth = getFirebaseAuth();
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
    ...options.headers,
  };

  // Only set Content-Type if we're sending a body
  // (avoids incorrect headers on GET requests)
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Add App Check token if available
  if (appCheckToken) {
    headers['X-Firebase-AppCheck'] = appCheckToken;
  }

  // Setup timeout with AbortController
  const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Make request with abort signal
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Listen for auth state changes
 *
 * @param {Function} callback - Callback function (user) => void
 * @returns {Function} Unsubscribe function
 */
export function onAuthChange(callback) {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}
