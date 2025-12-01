/**
 * Django API Client - Epic #116, Issue #137
 *
 * Provides a secure interface to the Django backend API.
 * Uses Cloud Function to retrieve API token securely.
 */

import { getFirebaseAuth } from '../../firebase/app.js';
import { debug } from '../../js/utils/debug.js';
import { validatePhone } from '../../js/utils/format.js';

const auth = getFirebaseAuth();

// Django API configuration
const DJANGO_API_BASE = 'https://starf.sosialistaflokkurinn.is';
const TOKEN_FUNCTION_URL = 'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/get_django_token';

// Cache for Django token with expiration
let cachedToken = null;
let tokenCacheTime = null;
const TOKEN_CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes (Firebase tokens expire ~1 hour)

/**
 * Get Django API token from Cloud Function
 *
 * @returns {Promise<string>} Django API token
 * @throws {Error} If token retrieval fails
 */
async function getDjangoToken() {
  // Return cached token if available and not expired
  if (cachedToken && tokenCacheTime) {
    const tokenAge = Date.now() - tokenCacheTime;
    if (tokenAge < TOKEN_CACHE_TTL_MS) {
      return cachedToken;
    }
    // Token expired, clear cache
    debug.log('[Django API] Token cache expired, fetching new token');
    cachedToken = null;
    tokenCacheTime = null;
  }

  try {
    // Get Firebase auth token
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }

    const firebaseToken = await user.getIdToken();

    // Call Cloud Function to get Django token
    const response = await fetch(TOKEN_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firebaseToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to retrieve Django token');
    }

    const data = await response.json();
    cachedToken = data.token;
    tokenCacheTime = Date.now();
    debug.log('[Django API] Token cached, expires in 45 minutes');
    return cachedToken;

  } catch (error) {
    debug.error('getDjangoToken error:', error);
    throw error;
  }
}

/**
 * Make authenticated request to Django API
 *
 * @param {string} endpoint - API endpoint (e.g., '/felagar/api/full/813/')
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Response data
 * @throws {Error} If request fails
 */
async function djangoRequest(endpoint, options = {}) {
  try {
    const token = await getDjangoToken();

    const url = `${DJANGO_API_BASE}${endpoint}`;

    // Debug logging
    debug.log('Django API Request:', {
      method: options.method || 'GET',
      url,
      body: options.body
    });

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Token ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      debug.error('Django API Error Response:', errorText);

      let errorMessage;

      try {
        const errorJson = JSON.parse(errorText);
        debug.error('Django API Error JSON:', errorJson);
        errorMessage = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
      } catch (e) {
        errorMessage = `HTTP ${response.status}: ${response.statusText} - ${errorText}`;
      }

      throw new Error(errorMessage);
    }

    return await response.json();

  } catch (error) {
    debug.error('Django API request error:', error);
    throw error;
  }
}

/**
 * Get member by kennitala
 *
 * @param {string} kennitala - Member kennitala
 * @returns {Promise<Object>} Member data
 */
export async function getMember(kennitala) {
  // First try to get Django ID from Firestore
  // Then use that to fetch from Django API
  return await djangoRequest(`/felagar/api/full/${kennitala}/`);
}

/**
 * Update member data
 *
 * @param {string} djangoId - Django member ID
 * @param {Object} data - Fields to update
 * @returns {Promise<Object>} Updated member data
 */
export async function updateMember(djangoId, data) {
  return await djangoRequest(`/felagar/api/full/${djangoId}/`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  });
}

/**
 * Get member by Django ID
 *
 * @param {number} djangoId - Django member ID
 * @returns {Promise<Object>} Member data
 */
export async function getMemberByDjangoId(djangoId) {
  return await djangoRequest(`/felagar/api/full/${djangoId}/`);
}

/**
 * Validate member data before sending to API
 *
 * @param {Object} data - Member data to validate
 * @returns {Object} Validation result {valid: boolean, errors: string[]}
 */
export function validateMemberData(data) {
  const errors = [];

  // Name validation
  if (data.name !== undefined) {
    if (typeof data.name !== 'string' || data.name.trim().length === 0) {
      errors.push('Nafn má ekki vera tómt');
    } else if (data.name.length > 100) {
      errors.push('Nafn má ekki vera lengra en 100 stafir');
    }
  }

  // Email validation
  if (data.contact_info?.email !== undefined) {
    const email = data.contact_info.email;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('Ógilt netfang');
    }
  }

  // Phone validation (use shared utility - accepts various formats)
  if (data.contact_info?.phone !== undefined) {
    const phone = data.contact_info.phone;
    if (phone && !validatePhone(phone)) {
      errors.push('Ógilt símanúmer');
    }
  }

  // Birthday validation
  if (data.birthday !== undefined) {
    const birthday = new Date(data.birthday);
    if (isNaN(birthday.getTime())) {
      errors.push('Ógildur fæðingardagur');
    }
  }

  // Gender validation
  if (data.gender !== undefined && data.gender !== null) {
    const validGenders = [0, 1];
    if (!validGenders.includes(data.gender)) {
      errors.push('Ógilt kyn (0 = Karl, 1 = Kona)');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Clear cached token (call on logout or token error)
 */
export function clearTokenCache() {
  cachedToken = null;
  tokenCacheTime = null;
}
