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

import { MockElectionsAPI } from './elections-mock.js';
import { debug } from '../utils/debug.js';
import { authenticatedFetch } from '../auth.js';

// DEVELOPMENT FLAG: Toggle between mock and real API
const USE_MOCK_API = true;

// Production Elections Service URL
const ELECTIONS_API_BASE = 'https://elections-service-ymzrguoifa-nw.a.run.app';

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
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.elections || [];

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
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error fetching election ${electionId}:`, error);
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
    const payload = {
      answer_id: answerId
    };

    const response = await authenticatedFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Vote submission failed: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error submitting vote for election ${electionId}:`, error);
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
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    debug.error(`Error fetching results for election ${electionId}:`, error);
    throw error;
  }
}
