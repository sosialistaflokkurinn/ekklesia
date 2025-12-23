/**
 * Candidate Metadata API Client
 *
 * Client for accessing and updating nomination candidate metadata via svc-elections.
 * Tracks edit history to show who wrote/modified each field.
 *
 * Backend: svc-elections /api/candidates
 * Data stored in Firestore: nomination-candidates collection
 */

import { debug } from '../utils/util-debug.js';
import { authenticatedFetch } from '../auth.js';
import { API_ENDPOINTS } from '../config/config.js';

const CANDIDATES_API = API_ENDPOINTS.CANDIDATES;

/**
 * Create detailed API error from response
 * @param {Response} response - Fetch response object
 * @param {string} operation - Description of the failed operation
 * @returns {Promise<Error>} Error with detailed message
 */
async function createApiError(response, operation) {
  let errorMessage = `${operation}: ${response.status} ${response.statusText}`;

  try {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = `${operation}: ${errorBody.message}`;
      } else if (errorBody.error) {
        errorMessage = `${operation}: ${errorBody.error}`;
      }
    }
  } catch {
    // If we can't parse the body, use the status message
  }

  const error = new Error(errorMessage);
  error.status = response.status;
  error.statusText = response.statusText;
  return error;
}

/**
 * Get all candidate metadata
 * @returns {Promise<Array>} Array of candidate objects
 */
export async function getAllCandidates() {
  try {
    debug.log('[Candidates API] Fetching all candidates');
    const response = await authenticatedFetch(`${CANDIDATES_API}`);

    if (!response.ok) {
      throw await createApiError(response, 'Failed to fetch candidates');
    }

    const data = await response.json();
    debug.log('[Candidates API] Fetched', data.candidates?.length || 0, 'candidates');
    return data.candidates || [];
  } catch (error) {
    debug.error('[Candidates API] Error fetching candidates:', error);
    throw error;
  }
}

/**
 * Get single candidate by ID
 * @param {string} candidateId - Candidate document ID
 * @returns {Promise<Object|null>} Candidate object or null if not found
 */
export async function getCandidate(candidateId) {
  try {
    debug.log('[Candidates API] Fetching candidate:', candidateId);
    const response = await authenticatedFetch(`${CANDIDATES_API}/${candidateId}`);

    if (response.status === 404) {
      debug.warn('[Candidates API] Candidate not found:', candidateId);
      return null;
    }

    if (!response.ok) {
      throw await createApiError(response, 'Failed to fetch candidate');
    }

    const data = await response.json();
    return data.candidate || null;
  } catch (error) {
    debug.error('[Candidates API] Error fetching candidate:', error);
    throw error;
  }
}

/**
 * Update candidate metadata field
 * Tracks edit history with user info and timestamp
 *
 * @param {string} candidateId - Candidate document ID
 * @param {string} field - Field name to update
 * @param {*} value - New value for the field
 * @returns {Promise<Object>} Updated candidate data
 */
export async function updateCandidateField(candidateId, field, value) {
  try {
    debug.log('[Candidates API] Updating candidate field:', { candidateId, field });

    const response = await authenticatedFetch(`${CANDIDATES_API}/${candidateId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ field, value }),
    });

    if (!response.ok) {
      throw await createApiError(response, 'Failed to update candidate');
    }

    const data = await response.json();
    debug.log('[Candidates API] Updated candidate:', candidateId);
    return data.candidate;
  } catch (error) {
    debug.error('[Candidates API] Error updating candidate:', error);
    throw error;
  }
}

/**
 * Update multiple candidate fields at once
 *
 * @param {string} candidateId - Candidate document ID
 * @param {Object} updates - Object with field: value pairs
 * @returns {Promise<Object>} Updated candidate data
 */
export async function updateCandidate(candidateId, updates) {
  try {
    debug.log('[Candidates API] Updating candidate:', { candidateId, fields: Object.keys(updates) });

    const response = await authenticatedFetch(`${CANDIDATES_API}/${candidateId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ updates }),
    });

    if (!response.ok) {
      throw await createApiError(response, 'Failed to update candidate');
    }

    const data = await response.json();
    debug.log('[Candidates API] Updated candidate:', candidateId);
    return data.candidate;
  } catch (error) {
    debug.error('[Candidates API] Error updating candidate:', error);
    throw error;
  }
}

/**
 * Get edit history for a candidate
 * @param {string} candidateId - Candidate document ID
 * @returns {Promise<Array>} Edit history array
 */
export async function getCandidateEditHistory(candidateId) {
  try {
    debug.log('[Candidates API] Fetching edit history:', candidateId);
    const response = await authenticatedFetch(`${CANDIDATES_API}/${candidateId}/history`);

    if (!response.ok) {
      throw await createApiError(response, 'Failed to fetch edit history');
    }

    const data = await response.json();
    return data.edit_history || [];
  } catch (error) {
    debug.error('[Candidates API] Error fetching edit history:', error);
    throw error;
  }
}

export default {
  getAllCandidates,
  getCandidate,
  updateCandidateField,
  updateCandidate,
  getCandidateEditHistory
};
