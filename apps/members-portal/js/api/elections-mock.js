/**
 * Mock Elections API
 *
 * Provides realistic mock data for testing without backend.
 * Simulates API delays (500-800ms) to mimic real network conditions.
 *
 * Used when USE_MOCK_API = true in elections-api.js
 */

// Mock data: Single sample election
const MOCK_ELECTIONS = [
  // Election 1: Active (can vote now)
  {
    id: '1',
    title: 'Árleg félagsfundarkosning 2025',
    question: 'Hver ætti að vera formaður félagsins?',
    status: 'active',
    voting_starts_at: new Date().toISOString(),
    voting_ends_at: new Date(Date.now() + 3600000).toISOString(),
    answers: [
      { id: '1a', text: 'Alice Johnson' },
      { id: '1b', text: 'Bob Smith' },
      { id: '1c', text: 'Carol Williams' },
      { id: '1d', text: 'David Brown' }
    ],
    has_voted: false
  }
];

// Mock results (empty - no closed elections)
const MOCK_RESULTS = {};

/**
 * Simulate network delay
 */
async function delay(ms = 500) {
  return new Promise(resolve => setTimeout(resolve, ms + Math.random() * 300));
}

/**
 * Mock API Implementation
 */
export const MockElectionsAPI = {

  /**
   * Get list of elections
   */
  async getElections(filters = {}) {
    await delay();

    let elections = [...MOCK_ELECTIONS];

    // Filter by status if provided
    if (filters.status) {
      elections = elections.filter(e => e.status === filters.status);
    }

    return elections;
  },

  /**
   * Get single election by ID
   */
  async getElectionById(electionId) {
    await delay();

    const election = MOCK_ELECTIONS.find(e => e.id === electionId);

    if (!election) {
      throw new Error(`Election not found: ${electionId}`);
    }

    // Return a copy to avoid mutations
    return { ...election };
  },

  /**
   * Submit a vote (with validation)
   */
  async submitVote(electionId, answerId) {
    await delay(600);

    const election = MOCK_ELECTIONS.find(e => e.id === electionId);

    if (!election) {
      throw new Error(`Election not found: ${electionId}`);
    }

    // Prevent voting in closed elections
    if (election.status === 'closed') {
      throw new Error('Cannot vote in closed election');
    }

    // Prevent voting in upcoming elections
    if (election.status === 'upcoming') {
      throw new Error('Election has not opened for voting yet');
    }

    // Prevent double voting
    if (election.has_voted) {
      throw new Error('You have already voted in this election');
    }

    // Validate answer exists
    if (!election.answers.find(a => a.id === answerId)) {
      throw new Error(`Invalid answer ID: ${answerId}`);
    }

    // Simulate successful vote submission
    // In real implementation, would call backend API
    election.has_voted = true;

    return {
      success: true,
      message: 'Atkvæði skráð með góðum árangri',
      ballot_id: `ballot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  },

  /**
   * Get election results (only available for closed elections)
   */
  async getResults(electionId) {
    await delay();

    const results = MOCK_RESULTS[electionId];

    if (!results) {
      throw new Error(`Results not available for election: ${electionId}`);
    }

    return results;
  }
};

export default MockElectionsAPI;
