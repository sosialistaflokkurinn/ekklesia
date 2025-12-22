/**
 * Elections API Client
 *
 * Handles communication with the Elections Service backend.
 * Toggles between mock API (for development) and real API (for production).
 *
 * Endpoints:
 * - GET /api/elections - List all elections member can vote in
 * - GET /api/elections/:id - Get single election details
 * - POST /api/elections/:id/vote - Submit a vote
 * - GET /api/elections/:id/results - Get election results
 */

import { MockElectionsAPI } from '../../elections/js/api/elections-mock.js';
import { debug } from '../utils/util-debug.js';
import { authenticatedFetch } from '../auth.js';
import { normalizeElectionStatus, normalizeElectionsStatus } from '../utils/util-format.js';
import { SERVICES } from '../config/config.js';

// DEVELOPMENT FLAG: Toggle between mock and real API
// NOTE: Real API endpoints implemented in Issue #248
// Backend is live at https://elections-service-521240388393.europe-west1.run.app
const USE_MOCK_API = false;

/**
 * Create detailed API error from response
 * Extracts error message from response body if available
 *
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
      } else if (errorBody.detail) {
        errorMessage = `${operation}: ${errorBody.detail}`;
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

// Production Elections Service URL
/**
 * Elections API Base URL
 *
 * Configured in js/config/config.js
 * Deployed: Cloud Run (Europe West 2)
 * Note: Must match URL in admin-elections/js/api/elections-admin-api.js
 */
const ELECTIONS_API_BASE = SERVICES.ELECTIONS;

/**
 * Get list of elections eligible for member
 *
 * @param {Object} filters - Optional filters: { status: 'active' | 'upcoming' | 'closed' }
 * @returns {Promise<Array>} List of election objects
 *
 * Election object:
 * {
 *   id: string,
 *   title: string,
 *   question: string,
 *   status: 'active' | 'upcoming' | 'closed',
 *   voting_starts_at: string (ISO date),
 *   voting_ends_at: string (ISO date),
 *   answers: [{id, text}, ...],
 *   has_voted: boolean
 * }
 */
export async function getElections(filters = {}) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.getElections(filters);
  }

  try {
    const url = new URL(`${ELECTIONS_API_BASE}/api/elections`);

    if (filters.status) {
      url.searchParams.append('status', filters.status);
    }

    const response = await authenticatedFetch(url.toString());

    if (!response.ok) {
      throw await createApiError(response, 'Failed to fetch elections');
    }

    const data = await response.json();
    // Normalize status: backend uses 'published', frontend expects 'active'
    return normalizeElectionsStatus(data.elections || []);

  } catch (error) {
    debug.error('Error fetching elections:', error);
    throw error;
  }
}

/**
 * Get single election details
 *
 * @param {string} electionId - Election ID
 * @returns {Promise<Object>} Election object with full details
 */
export async function getElectionById(electionId) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.getElectionById(electionId);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/elections/${electionId}`;
    const response = await authenticatedFetch(url);

    if (!response.ok) {
      throw await createApiError(response, `Failed to fetch election ${electionId}`);
    }

    const data = await response.json();
    // Normalize status: backend uses 'published', frontend expects 'active'
    return normalizeElectionStatus(data.election);

  } catch (error) {
    debug.error(`Error fetching election ${electionId}:`, error);
    throw error;
  }
}

/**
 * Get single election details (Admin API)
 * Used for viewing draft/hidden elections in admin interface
 *
 * @param {string} electionId - Election ID
 * @returns {Promise<Object>} Election object with full details
 */
export async function getAdminElectionById(electionId) {
  try {
    const url = `${ELECTIONS_API_BASE}/api/admin/elections/${electionId}`;
    const response = await authenticatedFetch(url);

    if (!response.ok) {
      throw await createApiError(response, `Failed to fetch admin election ${electionId}`);
    }

    const data = await response.json();
    // Handle both response formats and normalize status
    return normalizeElectionStatus(data.election || data);

  } catch (error) {
    debug.error(`Error fetching admin election ${electionId}:`, error);
    throw error;
  }
}

/**
 * Submit a vote in an election
 *
 * @param {string} electionId - Election ID
 * @param {string|number} answerId - Selected answer ID
 * @returns {Promise<Object>} Vote confirmation response
 *
 * Response:
 * {
 *   success: true,
 *   message: 'Vote recorded',
 *   ballot_id: string
 * }
 */
export async function submitVote(electionId, answerId) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.submitVote(electionId, answerId);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/elections/${electionId}/vote`;
    // Backend expects answer_ids as array (supports multi-choice elections)
    const payload = {
      answer_ids: Array.isArray(answerId) ? answerId : [answerId]
    };

    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw await createApiError(response, 'Vote submission failed');
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error submitting vote for election ${electionId}:`, error);
    throw error;
  }
}

/**
 * Submit a ranked-choice (STV) vote in an election
 *
 * @param {string} electionId - Election ID
 * @param {Array<string>} rankedAnswerIds - Ordered array of candidate IDs (1st preference first)
 * @returns {Promise<Object>} Vote confirmation response
 *
 * Response:
 * {
 *   success: true,
 *   message: 'Forgangsröðun skráð',
 *   ballot_ids: string[]
 * }
 */
export async function submitRankedVote(electionId, rankedAnswerIds) {
  if (USE_MOCK_API) {
    // Mock API doesn't support ranked voting yet
    return { success: true, message: 'Mock ranked vote recorded', ballot_ids: ['mock-ballot-id'] };
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/elections/${electionId}/vote`;
    // Backend expects ranked_answers as ordered array for ranked-choice elections
    const payload = {
      ranked_answers: rankedAnswerIds
    };

    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw await createApiError(response, 'Ranked vote submission failed');
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error submitting ranked vote for election ${electionId}:`, error);
    throw error;
  }
}

/**
 * Get election results
 *
 * Only available after election closes.
 *
 * @param {string} electionId - Election ID
 * @returns {Promise<Object>} Results object
 *
 * Results:
 * {
 *   id: string,
 *   title: string,
 *   total_votes: number,
 *   answers: [
 *     {
 *       id: string,
 *       text: string,
 *       count: number
 *     },
 *     ...
 *   ]
 * }
 */
export async function getResults(electionId) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.getResults(electionId);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/elections/${electionId}/results`;
    const response = await authenticatedFetch(url);

    if (!response.ok) {
      throw await createApiError(response, `Failed to fetch results for election ${electionId}`);
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error fetching results for election ${electionId}:`, error);
    throw error;
  }
}

/**
 * Get policy session by ID
 *
 * @param {string} sessionId - Policy session identifier
 * @returns {Promise<Object>} Policy session object with policy_draft, amendments, final_vote
 */
export async function getPolicySession(sessionId) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.getPolicySession(sessionId);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/policy-sessions/${sessionId}`;
    const response = await authenticatedFetch(url);

    if (!response.ok) {
      throw await createApiError(response, `Failed to fetch policy session ${sessionId}`);
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error fetching policy session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Submit amendment during break period
 *
 * @param {string} sessionId - Policy session identifier
 * @param {Object} amendmentData - { section_id, proposed_text, rationale }
 * @returns {Promise<Object>} { success, message, amendment_id }
 */
export async function submitAmendment(sessionId, amendmentData) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.submitAmendment(sessionId, amendmentData);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/policy-sessions/${sessionId}/amendments`;
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(amendmentData)
    });

    if (!response.ok) {
      throw await createApiError(response, 'Failed to submit amendment');
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error submitting amendment to session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Vote on amendment in policy session
 *
 * @param {string} sessionId - Policy session identifier
 * @param {string} amendmentId - Amendment identifier
 * @param {string} vote - 'yes' or 'no'
 * @returns {Promise<Object>} { success, message, vote_id }
 */
export async function voteOnAmendment(sessionId, amendmentId, vote) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.voteOnAmendment(sessionId, amendmentId, vote);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/policy-sessions/${sessionId}/amendments/${amendmentId}/vote`;
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote })
    });

    if (!response.ok) {
      throw await createApiError(response, 'Failed to vote on amendment');
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error voting on amendment:`, error);
    throw error;
  }
}

/**
 * Vote on policy item (original section) in policy session
 *
 * @param {string} sessionId - Policy session identifier
 * @param {string} itemId - Policy item/section identifier
 * @param {string} vote - 'yes' or 'no'
 * @returns {Promise<Object>} { success, message, vote_id }
 */
export async function voteOnPolicyItem(sessionId, itemId, vote) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.voteOnPolicyItem(sessionId, itemId, vote);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/policy-sessions/${sessionId}/items/${itemId}/vote`;
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote })
    });

    if (!response.ok) {
      throw await createApiError(response, 'Failed to vote on policy item');
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error voting on policy item:`, error);
    throw error;
  }
}

/**
 * Vote on final policy (Yes/No/Abstain)
 *
 * @param {string} sessionId - Policy session identifier
 * @param {string} vote - 'yes', 'no', or 'abstain'
 * @returns {Promise<Object>} { success, message, vote_id }
 */
export async function voteOnFinalPolicy(sessionId, vote) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.voteOnFinalPolicy(sessionId, vote);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/policy-sessions/${sessionId}/vote`;
    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote })
    });

    if (!response.ok) {
      throw await createApiError(response, 'Failed to vote on final policy');
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error voting on final policy for session ${sessionId}:`, error);
    throw error;
  }
}

/**
 * Get policy session results
 *
 * @param {string} sessionId - Policy session identifier
 * @returns {Promise<Object>} Aggregated results with amendment_results and final_policy_results
 */
export async function getPolicyResults(sessionId) {
  if (USE_MOCK_API) {
    return MockElectionsAPI.getPolicyResults(sessionId);
  }

  try {
    const url = `${ELECTIONS_API_BASE}/api/policy-sessions/${sessionId}/results`;
    const response = await authenticatedFetch(url);

    if (!response.ok) {
      throw await createApiError(response, `Failed to fetch policy session results ${sessionId}`);
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error fetching results for policy session ${sessionId}:`, error);
    throw error;
  }
}
