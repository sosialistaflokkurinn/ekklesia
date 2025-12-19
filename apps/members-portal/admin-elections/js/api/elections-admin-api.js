/**
 * Elections Admin API Client
 * 
 * Handles all API calls to the elections-service admin endpoints.
 * Extracted from election-create.js for better organization and reusability.
 */

import { R } from '../../i18n/strings-loader.js';
import { debug } from '../../../js/utils/util-debug.js';
import { showModal } from '../../../js/components/ui-modal.js';
import { getFirebaseAuth } from '../../../firebase/app.js';

const auth = getFirebaseAuth();
const API_BASE_URL = 'https://elections-service-521240388393.europe-west2.run.app/api/admin';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Fetch with automatic retry on network errors
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries (default: 1)
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      // Only retry on network errors, not on abort
      if (error.name === 'AbortError' || attempt === retries) {
        throw error;
      }
      
      console.warn(`[Elections API] Fetch attempt ${attempt + 1} failed, retrying...`, error.message);
      // Wait 1 second before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Get Firebase ID token for authentication
 * @returns {Promise<string>} Firebase ID token
 * @throws {Error} If user is not authenticated
 */
async function getAuthToken() {
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error(R.string.error_not_authenticated);
  }
  
  return await user.getIdToken();
}

/**
 * Make an authenticated API request with timeout
 * @param {string} url - Full URL to request
 * @param {object} options - Fetch options (method, body, etc.)
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
async function makeAuthenticatedRequest(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const token = await getAuthToken();
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchWithRetry(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Handle API error response
 * @param {Response} response - Fetch response object
 * @param {string} defaultMessage - Default error message if none from API
 * @throws {Error} Always throws with user-friendly error message
 */
async function handleErrorResponse(response, defaultMessage) {
  const errorData = await response.json();
  console.error('[Elections API] Backend error:', errorData);
  
  // Show user-friendly error modal
  const errorMessage = errorData.message || errorData.error || defaultMessage;
  await showModal({
    title: `❌ ${R.string.error_message || 'Villa'}`,
    message: `<p><strong>${R.string.error_action_failed || 'Ekki tókst að framkvæma aðgerð.'}</strong></p><p>${errorMessage}</p>`,
    confirmText: R.string.modal_close_aria || 'Loka',
    showCancel: false
  });
  
  throw new Error(errorMessage);
}

/**
 * Create a new election
 * @param {object} payload - Election data
 * @returns {Promise<object>} Created election data
 */
export async function createElection(payload) {
  debug.log('[Elections API] Creating election:', payload);
  
  const url = `${API_BASE_URL}/elections`;
  const response = await makeAuthenticatedRequest(url, {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    await handleErrorResponse(response, R.string.error_create_election);
  }

  const result = await response.json();
  debug.log('[Elections API] Election created:', result);
  return result;
}

/**
 * Update an existing election
 * @param {string} electionId - Election ID to update
 * @param {object} payload - Updated election data (full or metadata-only)
 * @returns {Promise<object>} Updated election data
 */
export async function updateElection(electionId, payload) {
  debug.log('[Elections API] Updating election:', electionId, payload);
  
  const url = `${API_BASE_URL}/elections/${electionId}`;
  const response = await makeAuthenticatedRequest(url, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    await handleErrorResponse(response, R.string.error_update_election);
  }

  const result = await response.json();
  debug.log('[Elections API] Election updated:', result);
  return result;
}

/**
 * Fetch a single election by ID
 * @param {string} electionId - Election ID to fetch
 * @returns {Promise<object>} Election data
 */
export async function fetchElection(electionId) {
  debug.log('[Elections API] Fetching election:', electionId);
  
  const url = `${API_BASE_URL}/elections/${electionId}`;
  const response = await makeAuthenticatedRequest(url, {
    method: 'GET'
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Failed to fetch election');
  }

  const result = await response.json();
  debug.log('[Elections API] Election fetched:', result);
  return result.election;
}

/**
 * Open (publish) an election
 * @param {string} electionId - Election ID to open
 * @param {object} [payload] - Optional payload (e.g. voting_starts_at, voting_ends_at)
 * @returns {Promise<object>} Opened election data
 */
export async function openElection(electionId, payload = {}) {
  debug.log('[Elections API] Opening election:', electionId, payload);
  
  const url = `${API_BASE_URL}/elections/${electionId}/open`;
  const options = {
    method: 'POST'
  };

  if (Object.keys(payload).length > 0) {
    options.body = JSON.stringify(payload);
  }

  const response = await makeAuthenticatedRequest(url, options);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Elections API] Error opening election:', errorData);
    throw new Error(errorData.message || 'Failed to open election');
  }

  const result = await response.json();
  debug.log('[Elections API] Election opened:', result);
  return result;
}

/**
 * Close an election
 * @param {string} electionId - Election ID to close
 * @param {object} [payload] - Optional payload (e.g. voting_ends_at)
 * @returns {Promise<object>} Closed election data
 */
export async function closeElection(electionId, payload = {}) {
  debug.log('[Elections API] Closing election:', electionId, payload);
  
  const url = `${API_BASE_URL}/elections/${electionId}/close`;
  const options = {
    method: 'POST'
  };

  if (Object.keys(payload).length > 0) {
    options.body = JSON.stringify(payload);
  }

  const response = await makeAuthenticatedRequest(url, options);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[Elections API] Error closing election:', errorData);
    throw new Error(errorData.message || 'Failed to close election');
  }

  const result = await response.json();
  debug.log('[Elections API] Election closed:', result);
  return result;
}

/**
 * Fetch list of elections
 * @param {boolean} includeHidden - Whether to include hidden elections
 * @returns {Promise<Array>} List of elections
 */
export async function fetchElections(includeHidden = false) {
  debug.log('[Elections API] Fetching elections list');
  
  const url = `${API_BASE_URL}/elections${includeHidden ? '?includeHidden=true' : ''}`;
  const response = await makeAuthenticatedRequest(url, {
    method: 'GET'
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Failed to fetch elections list');
  }

  const result = await response.json();
  debug.log('[Elections API] Elections fetched:', result.elections?.length || 0);
  return result.elections || [];
}

/**
 * Hide (soft delete) an election
 * @param {string} electionId - Election ID to hide
 * @returns {Promise<object>} Result
 */
export async function hideElection(electionId) {
  debug.log('[Elections API] Hiding election:', electionId);
  
  const url = `${API_BASE_URL}/elections/${electionId}/hide`;
  const response = await makeAuthenticatedRequest(url, {
    method: 'POST'
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Failed to hide election');
  }

  return await response.json();
}

/**
 * Unhide (restore) an election
 * @param {string} electionId - Election ID to unhide
 * @returns {Promise<object>} Result
 */
export async function unhideElection(electionId) {
  debug.log('[Elections API] Unhiding election:', electionId);
  
  const url = `${API_BASE_URL}/elections/${electionId}/unhide`;
  const response = await makeAuthenticatedRequest(url, {
    method: 'POST'
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Failed to unhide election');
  }

  return await response.json();
}

/**
 * Delete an election (hard delete)
 * @param {string} electionId - Election ID to delete
 * @returns {Promise<object>} Result
 */
export async function deleteElection(electionId) {
  debug.log('[Elections API] Deleting election:', electionId);

  const url = `${API_BASE_URL}/elections/${electionId}`;
  const response = await makeAuthenticatedRequest(url, {
    method: 'DELETE'
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Failed to delete election');
  }

  return await response.json();
}

/**
 * Fetch election results (includes vote breakdown)
 * @param {string} electionId - Election ID
 * @returns {Promise<object>} Election with results data
 */
export async function fetchElectionResults(electionId) {
  debug.log('[Elections API] Fetching results for election:', electionId);

  const url = `${API_BASE_URL}/elections/${electionId}/results`;
  const response = await makeAuthenticatedRequest(url, {
    method: 'GET'
  });

  if (!response.ok) {
    await handleErrorResponse(response, 'Failed to fetch election results');
  }

  const result = await response.json();
  debug.log('[Elections API] Election results:', result);
  return result;
}
