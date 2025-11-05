/**
 * API Utilities - Unified HTTP Client
 * 
 * Provides authenticated HTTP request helpers for Firebase-authenticated APIs.
 * Consolidates duplicate authenticatedFetch implementations from /js/auth.js and /session/auth.js.
 * 
 * All requests automatically include:
 * - Firebase ID token in Authorization header
 * - Content-Type: application/json
 * - Proper error handling
 * 
 * Usage:
 *   import { authenticatedFetch, authenticatedPost } from '../../js/core/api.js';
 *   const data = await authenticatedFetch('/api/members/123');
 *   await authenticatedPost('/api/members', { name: 'Jón' });
 * 
 * @module core/api
 */

import { getFirebaseAuth } from '../../firebase/app.js';
import { debug } from '../utils/debug.js';

/**
 * Custom error for API request failures
 */
export class APIError extends Error {
  constructor(message, status, response) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.response = response;
  }
}

/**
 * Make an authenticated HTTP request with Firebase token
 * 
 * Automatically includes Firebase ID token in Authorization header.
 * Throws error if user is not authenticated.
 * 
 * @param {string} url - Request URL (relative or absolute)
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>} Fetch response object
 * @throws {Error} If user not authenticated
 * @throws {APIError} If request fails
 * 
 * @example
 * const response = await authenticatedFetch('/api/members/123');
 * const data = await response.json();
 */
export async function authenticatedFetch(url, options = {}) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Not authenticated - user must be logged in');
  }

  try {
    // Get fresh Firebase ID token
    const token = await user.getIdToken();

    debug.log(`API Request: ${options.method || 'GET'} ${url}`);

    // Make request with token
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    debug.log(`API Response: ${response.status} ${response.statusText}`);

    return response;

  } catch (error) {
    debug.error('API request failed:', error);
    throw error;
  }
}

/**
 * Make authenticated request and parse JSON response
 * 
 * Convenience wrapper that handles JSON parsing and error checking.
 * 
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {APIError} If request fails or returns non-OK status
 * 
 * @example
 * const member = await authenticatedJSON('/api/members/123');
 * console.log(member.name);
 */
export async function authenticatedJSON(url, options = {}) {
  const response = await authenticatedFetch(url, options);

  // Check for HTTP errors
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // Response not JSON, use status text
    }

    throw new APIError(errorMessage, response.status, response);
  }

  // Parse and return JSON
  return await response.json();
}

/**
 * POST request with JSON body (convenience method)
 * 
 * @param {string} url - Request URL
 * @param {Object} data - Data to send (will be JSON.stringify'd)
 * @returns {Promise<Object>} Parsed JSON response
 * 
 * @example
 * const newMember = await authenticatedPost('/api/members', {
 *   name: 'Jón Jónsson',
 *   email: 'jon@example.com'
 * });
 */
export async function authenticatedPost(url, data) {
  return authenticatedJSON(url, {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

/**
 * PATCH request with JSON body (convenience method)
 * 
 * @param {string} url - Request URL
 * @param {Object} data - Data to send (will be JSON.stringify'd)
 * @returns {Promise<Object>} Parsed JSON response
 * 
 * @example
 * const updated = await authenticatedPatch('/api/members/123', {
 *   phone: '555-1234'
 * });
 */
export async function authenticatedPatch(url, data) {
  return authenticatedJSON(url, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/**
 * PUT request with JSON body (convenience method)
 * 
 * @param {string} url - Request URL
 * @param {Object} data - Data to send (will be JSON.stringify'd)
 * @returns {Promise<Object>} Parsed JSON response
 * 
 * @example
 * const replaced = await authenticatedPut('/api/members/123', {
 *   name: 'Jón Jónsson',
 *   email: 'jon@example.com',
 *   phone: '555-1234'
 * });
 */
export async function authenticatedPut(url, data) {
  return authenticatedJSON(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

/**
 * DELETE request (convenience method)
 * 
 * @param {string} url - Request URL
 * @returns {Promise<Object>} Parsed JSON response (if any)
 * 
 * @example
 * await authenticatedDelete('/api/members/123');
 */
export async function authenticatedDelete(url) {
  const response = await authenticatedFetch(url, {
    method: 'DELETE'
  });

  // Check for HTTP errors
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // Response not JSON, use status text
    }

    throw new APIError(errorMessage, response.status, response);
  }

  // Some DELETE requests return no content (204)
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  // Parse JSON response if present
  return await response.json();
}
