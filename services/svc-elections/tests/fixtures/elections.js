/**
 * Test Fixtures for Elections
 *
 * Sample election data for testing
 */

/**
 * Sample single-choice election
 */
const singleChoiceElection = {
  id: 'election-1',
  title: 'Should we adopt Policy #123?',
  description: 'Vote yes or no',
  voting_type: 'single-choice',
  max_selections: 1,
  status: 'published',
  eligibility: 'members',
  scheduled_start: new Date('2025-01-01T00:00:00Z'),
  scheduled_end: new Date('2025-12-31T23:59:59Z'),
  answers: [
    { id: 'answer-yes', text: 'Yes' },
    { id: 'answer-no', text: 'No' },
  ],
  hidden: false,
  created_at: new Date('2024-12-01T00:00:00Z'),
  updated_at: new Date('2024-12-01T00:00:00Z'),
};

/**
 * Sample multi-choice election
 */
const multiChoiceElection = {
  id: 'election-2',
  title: 'Select your top 3 priorities',
  description: 'Choose up to 3 options',
  voting_type: 'multi-choice',
  max_selections: 3,
  status: 'published',
  eligibility: 'members',
  scheduled_start: new Date('2025-01-01T00:00:00Z'),
  scheduled_end: new Date('2025-12-31T23:59:59Z'),
  answers: [
    { id: 'answer-1', text: 'Healthcare' },
    { id: 'answer-2', text: 'Education' },
    { id: 'answer-3', text: 'Environment' },
    { id: 'answer-4', text: 'Economy' },
    { id: 'answer-5', text: 'Housing' },
  ],
  hidden: false,
  created_at: new Date('2024-12-01T00:00:00Z'),
  updated_at: new Date('2024-12-01T00:00:00Z'),
};

/**
 * Draft election (not published)
 */
const draftElection = {
  ...singleChoiceElection,
  id: 'election-draft',
  status: 'draft',
};

/**
 * Closed election (voting ended)
 */
const closedElection = {
  ...singleChoiceElection,
  id: 'election-closed',
  status: 'closed',
};

/**
 * Election with past scheduled end
 */
const pastElection = {
  ...singleChoiceElection,
  id: 'election-past',
  scheduled_end: new Date('2024-01-01T00:00:00Z'),
};

/**
 * Election with future scheduled start
 */
const futureElection = {
  ...singleChoiceElection,
  id: 'election-future',
  scheduled_start: new Date('2026-01-01T00:00:00Z'),
};

/**
 * Admin-only election
 */
const adminOnlyElection = {
  ...singleChoiceElection,
  id: 'election-admin',
  eligibility: 'admins',
};

/**
 * Sample authenticated user (member)
 */
const memberUser = {
  uid: 'user-123',
  email: 'member@example.com',
  roles: ['member'],
  isMember: true,
  isAdmin: false,
};

/**
 * Sample authenticated user (admin)
 */
const adminUser = {
  uid: 'admin-456',
  email: 'admin@example.com',
  roles: ['admin'],
  isMember: true,
  isAdmin: true,
};

/**
 * Sample Firebase ID token
 */
const validToken = 'valid-firebase-token-123';

/**
 * Sample ballot data
 */
const sampleBallot = {
  id: 'ballot-1',
  election_id: 'election-1',
  member_uid: 'user-123',
  answer_id: 'answer-yes',
  answer: 'Yes',
  token_hash: '0000000000000000000000000000000000000000000000000000000000000000',
  submitted_at: new Date('2025-06-01T12:00:00Z'),
};

module.exports = {
  // Elections
  singleChoiceElection,
  multiChoiceElection,
  draftElection,
  closedElection,
  pastElection,
  futureElection,
  adminOnlyElection,

  // Users
  memberUser,
  adminUser,
  validToken,

  // Ballots
  sampleBallot,
};
