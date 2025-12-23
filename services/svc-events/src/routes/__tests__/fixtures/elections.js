/**
 * Test Fixtures for Admin Election API Tests
 */

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Sample draft election
 */
const draftElection = {
  id: TEST_UUID,
  title: 'Draft Election',
  description: 'Test description',
  question: 'Test question?',
  status: 'draft',
  voting_type: 'single-choice',
  max_selections: 1,
  eligibility: 'members',
  created_by: 'test-admin-uid',
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-01T00:00:00Z'),
  answers: [
    { id: 'answer-1', text: 'Yes', display_order: 1 },
    { id: 'answer-2', text: 'No', display_order: 2 },
  ],
};

/**
 * Sample published election
 */
const publishedElection = {
  ...draftElection,
  status: 'published',
  published_at: new Date('2025-01-02T00:00:00Z'),
};

/**
 * Sample open election (voting active)
 */
const openElection = {
  ...publishedElection,
  status: 'open',
  voting_start_time: new Date('2025-01-03T00:00:00Z'),
};

/**
 * Sample paused election
 */
const pausedElection = {
  ...openElection,
  status: 'paused',
};

/**
 * Sample closed election
 */
const closedElection = {
  ...openElection,
  status: 'closed',
  closed_at: new Date('2025-01-04T00:00:00Z'),
};

/**
 * Sample archived election
 */
const archivedElection = {
  ...closedElection,
  status: 'archived',
  archived_at: new Date('2025-01-05T00:00:00Z'),
};

/**
 * Sample deleted election
 */
const deletedElection = {
  ...draftElection,
  status: 'deleted',
  deleted_at: new Date('2025-01-06T00:00:00Z'),
};

/**
 * Token statistics for status endpoint
 */
const tokenStatistics = {
  total: 100,
  used: 45,
  unused: 55,
  participation_rate: '45.00%',
};

/**
 * Election results for results endpoint
 */
const electionResults = {
  total_votes: 45,
  eligible_voters: 100,
  participation_rate: '45.00%',
  answers: [
    { text: 'Yes', votes: 30, percentage: '66.67%' },
    { text: 'No', votes: 15, percentage: '33.33%' },
  ],
};

/**
 * Token distribution for tokens endpoint
 */
const tokenDistribution = {
  total: 100,
  used: 45,
  unused: 55,
  expired: 0,
  usage_rate: '45.00%',
};

/**
 * Token timeline for tokens endpoint
 */
const tokenTimeline = {
  first_issued: new Date('2025-01-03T00:00:00Z'),
  last_issued: new Date('2025-01-03T00:10:00Z'),
  avg_expiration_hours: 24,
};

module.exports = {
  TEST_UUID,
  draftElection,
  publishedElection,
  openElection,
  pausedElection,
  closedElection,
  archivedElection,
  deletedElection,
  tokenStatistics,
  electionResults,
  tokenDistribution,
  tokenTimeline,
};
