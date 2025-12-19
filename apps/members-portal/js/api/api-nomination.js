/**
 * Nomination Committee API Client
 * API client for uppstillingarnefnd (nomination committee) voting endpoints.
 *
 * All endpoints require Firebase authentication.
 * Unlike regular elections, votes are NON-ANONYMOUS.
 */

import { getFirebaseAuth } from '../../firebase/app.js';
import { debug } from '../utils/util-debug.js';

// API Base URL
const API_BASE_URL = 'https://elections-service-521240388393.europe-west2.run.app/api/nomination';

// For local development
// const API_BASE_URL = 'http://localhost:8081/api/nomination';

/**
 * Get Firebase auth token
 * @returns {Promise<string>} ID token
 */
async function getAuthToken() {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Notandi er ekki innskráður');
  }

  const token = await user.getIdToken();

  // Log auth info for debugging (UID is safe to log, not the token)
  debug.log('[Nomination API] Auth check', {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
  });

  return token;
}

/**
 * Make authenticated request to nomination API
 * @param {string} endpoint - API endpoint (without base URL)
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Request timeout in milliseconds
 * @returns {Promise<Object>} Response data
 */
async function makeRequest(endpoint, options = {}, timeoutMs = 30000) {
  const token = await getAuthToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    debug.log(`[Nomination API] ${options.method || 'GET'} ${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      debug.warn('[Nomination API] Request failed', {
        status: response.status,
        message: data.message,
        endpoint,
      });
      const error = new Error(data.message || 'API villa');
      error.status = response.status;
      error.data = data;
      throw error;
    }

    // Log successful response summary
    debug.log('[Nomination API] Response OK', {
      endpoint,
      electionsCount: data.elections?.length,
      hasAccess: data.elections?.length > 0,
    });

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('Beiðni rann út á tíma');
    }

    debug.error('[Nomination API] Error:', error);
    throw error;
  }
}

/**
 * List nomination committee elections the current user can access
 * @returns {Promise<Object>} { elections: [...], total: number }
 */
export async function getNominationElections() {
  return await makeRequest('/elections');
}

/**
 * Get single nomination election details
 * @param {string} electionId - Election UUID
 * @returns {Promise<Object>} { election, previous_rounds, previous_vote }
 */
export async function getNominationElection(electionId) {
  return await makeRequest(`/elections/${electionId}`);
}

/**
 * Submit nomination vote with justifications
 * @param {string} electionId - Election UUID
 * @param {Object} voteData - Vote data
 * @param {Array<string>} voteData.ranked_answers - Ordered array of candidate IDs
 * @param {Object} voteData.justifications - Object mapping candidate ID to justification text
 * @param {string} voteData.voter_name - Display name for results
 * @returns {Promise<Object>} { success: true, ballot_id }
 */
export async function submitNominationVote(electionId, voteData) {
  const { ranked_answers, justifications, voter_name } = voteData;

  return await makeRequest(`/elections/${electionId}/vote`, {
    method: 'POST',
    body: JSON.stringify({
      ranked_answers,
      justifications,
      voter_name,
    }),
  });
}

/**
 * Get nomination election results (non-anonymous)
 * @param {string} electionId - Election UUID
 * @returns {Promise<Object>} Full results with voter identities
 */
export async function getNominationResults(electionId) {
  return await makeRequest(`/elections/${electionId}/results`);
}

/**
 * Check if user has access to nomination features
 * (Tries to list elections - if 403/empty, no access)
 * @returns {Promise<boolean>} True if user has access
 */
export async function checkNominationAccess() {
  try {
    const result = await getNominationElections();
    return result.elections && result.elections.length > 0;
  } catch (error) {
    if (error.status === 403) {
      return false;
    }
    // Re-throw other errors
    throw error;
  }
}

export default {
  getNominationElections,
  getNominationElection,
  submitNominationVote,
  getNominationResults,
  checkNominationAccess,
};
