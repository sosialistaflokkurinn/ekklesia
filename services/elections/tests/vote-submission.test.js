/**
 * Vote Submission Endpoint Tests
 *
 * Tests for POST /api/elections/:id/vote endpoint
 *
 * Covers:
 * - Happy path (single/multi-choice votes)
 * - Authentication & authorization
 * - Validation (answer IDs, selection counts)
 * - Voting window checks
 * - Eligibility checks
 * - Duplicate vote prevention
 * - Transaction handling
 * - Edge cases
 */

const request = require('supertest');
const express = require('express');
const { createMockClient, createMockPool } = require('./helpers/db-mock');
const {
  singleChoiceElection,
  multiChoiceElection,
  draftElection,
  pastElection,
  futureElection,
  adminOnlyElection,
  memberUser,
  adminUser,
  validToken,
} = require('./fixtures/elections');

// Mock express-rate-limit to avoid IPv6 warnings in tests
jest.mock('express-rate-limit', () => {
  return jest.fn(() => (req, res, next) => next());
});

// Mock Firebase to prevent real Firebase initialization
jest.mock('../src/firebase', () => ({
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
  appCheck: jest.fn(() => ({
    verifyToken: jest.fn(),
  })),
}));

// Mock appCheck middleware to avoid loading Firebase
jest.mock('../src/middleware/appCheck', () => ({
  verifyAppCheck: jest.fn((req, res, next) => next()),
  verifyAppCheckOptional: jest.fn((req, res, next) => next()),
}));

// Mock the database module BEFORE requiring anything that uses it
jest.mock('../src/config/database', () => {
  const { createMockPool } = require('./helpers/db-mock');
  const mockPool = createMockPool();
  // Make pool.query return a resolved promise for audit service
  mockPool.query = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  mockPool.on = jest.fn();
  return mockPool;
});

// Mock memberAuth middleware to control authentication in tests
// Default implementation checks header and rejects
const mockVerifyMemberToken = jest.fn();
mockVerifyMemberToken.mockImplementation((req, res, next) => {
  console.log('[MOCK AUTH] Called! Headers:', Object.keys(req.headers || {}));

  // Check Authorization header (same as real middleware)
  const authHeader = req.header('Authorization');
  console.log('[MOCK AUTH] Authorization header:', authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[MOCK AUTH] Returning 401 - no auth header');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  // If header exists but no user set up, reject
  console.log('[MOCK AUTH] Returning 401 - no user setup');
  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Mock: No user set up for this test',
    code: 'MISSING_AUTH_TOKEN',
  });
});

jest.mock('../src/middleware/memberAuth', () => {
  // Implement helper functions inline to avoid loading Firebase/database modules
  function isEligible(election, req) {
    const { isAdmin, isMember } = req.user;

    if (election.eligibility === 'all') return true;
    if (election.eligibility === 'admins') return isAdmin;
    if (election.eligibility === 'members') return isMember || isAdmin;

    return false;
  }

  function validateVotingWindow(election) {
    const now = new Date();

    if (election.status !== 'published') {
      if (election.status === 'draft') return { valid: false, error: 'Election not yet published' };
      if (election.status === 'closed') return { valid: false, error: 'Election has closed' };
      if (election.status === 'paused') return { valid: false, error: 'Election is temporarily paused' };
      if (election.status === 'archived') return { valid: false, error: 'Election is archived' };
      return { valid: false, error: 'Election is not active' };
    }

    if (election.scheduled_start && now < new Date(election.scheduled_start)) {
      return { valid: false, error: 'Voting has not started yet' };
    }

    if (election.scheduled_end && now > new Date(election.scheduled_end)) {
      return { valid: false, error: 'Voting has ended' };
    }

    return { valid: true };
  }

  function validateAnswers(answerIds, election) {
    if (!Array.isArray(answerIds) || answerIds.length === 0) {
      return { valid: false, error: 'No answers selected' };
    }

    const answers = election.answers;
    if (!Array.isArray(answers)) {
      return { valid: false, error: 'Invalid election configuration' };
    }

    const validAnswerIds = answers.map(a => a.id);
    const invalidAnswers = answerIds.filter(id => !validAnswerIds.includes(id));
    if (invalidAnswers.length > 0) {
      return { valid: false, error: `Invalid answer IDs: ${invalidAnswers.join(', ')}` };
    }

    if (election.voting_type === 'single-choice' && answerIds.length !== 1) {
      return { valid: false, error: 'Single-choice elections require exactly 1 selection' };
    }

    if (election.voting_type === 'multi-choice') {
      if (answerIds.length > election.max_selections) {
        return {
          valid: false,
          error: `Too many selections (max: ${election.max_selections}, got: ${answerIds.length})`,
        };
      }
    }

    const uniqueAnswers = new Set(answerIds);
    if (uniqueAnswers.size !== answerIds.length) {
      return { valid: false, error: 'Duplicate answer selections are not allowed' };
    }

    return { valid: true };
  }

  return {
    verifyMemberToken: mockVerifyMemberToken,
    isEligible,
    validateVotingWindow,
    validateAnswers,
    hasVoted: jest.fn(),
    filterElectionsByEligibility: jest.fn(),
  };
});

const pool = require('../src/config/database');

// Import router AFTER all mocks are set up
// This ensures it loads with mocked dependencies
const electionsRouter = require('../src/routes/elections');

let app;
let mockClient;

// Helper function to set up authenticated user for tests
function setupAuthenticatedUser(user) {
  mockVerifyMemberToken.mockImplementation((req, res, next) => {
    req.user = {
      uid: user.uid,
      email: user.email,
      roles: user.roles || [],
      isMember: user.isMember !== undefined ? user.isMember : true,
      isAdmin: user.isAdmin || false,
      claims: {
        uid: user.uid,
        email: user.email,
        roles: user.roles || [],
      },
    };
    next();
  });
}

// Helper function to set up unauthenticated/invalid token
function setupUnauthenticated(errorMessage = 'Invalid or expired token') {
  mockVerifyMemberToken.mockImplementation((req, res, next) => {
    return res.status(401).json({
      error: 'Unauthorized',
      message: errorMessage,
      code: 'INVALID_AUTH_TOKEN',
    });
  });
}

// Helper function to setup successful database responses for vote submission
// ballotIds can be a single string or an array of strings for multi-choice votes
function setupSuccessfulVoteScenario(election, ballotIds = 'ballot-123') {
  const ballotIdArray = Array.isArray(ballotIds) ? ballotIds : [ballotIds];
  let ballotIdCounter = 0;

  mockClient.query.mockImplementation(async (sql, params) => {
    if (sql === 'BEGIN') {
      return { rows: [], command: 'BEGIN' };
    }
    if (sql.includes('SELECT') && sql.includes('elections.elections')) {
      return { rows: [election], rowCount: 1 };
    }
    if (sql.includes('check_member_voted_v2')) {
      return { rows: [{ has_voted: false }], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO elections.ballots')) {
      const ballotId = ballotIdArray[ballotIdCounter % ballotIdArray.length];
      ballotIdCounter++;
      return { rows: [{ id: ballotId }], rowCount: 1 };
    }
    if (sql === 'COMMIT') {
      return { rows: [], command: 'COMMIT' };
    }
    if (sql === 'ROLLBACK') {
      return { rows: [], command: 'ROLLBACK' };
    }
    return { rows: [], rowCount: 0 };
  });
}

describe('POST /api/elections/:id/vote - Vote Submission', () => {
  beforeEach(() => {
    // Don't reload routes - just create fresh Express app
    // Reloading causes issues with module mocking
    app = express();
    app.use(express.json());
    app.use('/api', electionsRouter);

    // Create mock database client
    mockClient = createMockClient();

    // Mock pool.connect() to return our mock client
    pool.connect.mockResolvedValue(mockClient);

    // Ensure pool.query is mocked for audit service (fire-and-forget)
    pool.query.mockResolvedValue({ rows: [], rowCount: 0 });

    // Reset mock to default implementation (reject all requests)
    // CRITICAL: mockClear() only clears call history, NOT the implementation!
    // Must re-set default implementation to prevent tests from using previous implementations
    mockVerifyMemberToken.mockClear();
    mockVerifyMemberToken.mockImplementation((req, res, next) => {
      const authHeader = req.header('Authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Missing or invalid Authorization header',
          code: 'MISSING_AUTH_TOKEN',
        });
      }

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Mock: No user set up for this test',
        code: 'MISSING_AUTH_TOKEN',
      });
    });
  });

  afterEach(() => {
    mockClient._reset();
  });

  // =====================================================
  // 1. HAPPY PATH TESTS
  // =====================================================

  describe('Happy Path - Successful Vote Submission', () => {
    test('should accept single-choice vote (1 answer)', async () => {
      setupAuthenticatedUser(memberUser);
      setupSuccessfulVoteScenario(singleChoiceElection, 'ballot-123');

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        ballot_ids: ['ballot-123'],
        message: 'Vote recorded successfully',
      });
    });

    test('should accept multi-choice vote (2 answers)', async () => {
      setupAuthenticatedUser(memberUser);
      setupSuccessfulVoteScenario(multiChoiceElection, ['ballot-1', 'ballot-2']);

      const response = await request(app)
        .post('/api/elections/election-2/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-1', 'answer-2'] })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        ballot_ids: ['ballot-1', 'ballot-2'],
        message: 'Vote recorded successfully',
      });
    });

    test('should accept multi-choice vote (3 answers, max selections)', async () => {
      setupAuthenticatedUser(memberUser);
      setupSuccessfulVoteScenario(multiChoiceElection, ['ballot-1', 'ballot-2', 'ballot-3']);

      const response = await request(app)
        .post('/api/elections/election-2/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-1', 'answer-2', 'answer-3'] })
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        ballot_ids: ['ballot-1', 'ballot-2', 'ballot-3'],
        message: 'Vote recorded successfully',
      });
    });

    test('should insert ballots with correct data structure', async () => {
      setupAuthenticatedUser(memberUser);

      const insertedBallots = [];

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          // Capture ballot data
          insertedBallots.push({
            election_id: params[0],
            member_uid: params[1],
            answer_id: params[2],
            answer: params[3],
            token_hash: params[4],
          });
          return { rows: [{ id: 'ballot-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(insertedBallots).toHaveLength(1);
      expect(insertedBallots[0]).toEqual({
        election_id: 'election-1',
        member_uid: memberUser.uid,
        answer_id: 'answer-yes',
        answer: 'Yes', // Answer text from election.answers
        token_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      });
    });
  });

  // =====================================================
  // 2. AUTHENTICATION TESTS
  // =====================================================

  describe('Authentication & Authorization', () => {
    test('should reject request without Authorization header (401)', async () => {
      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .send({ answer_ids: ['answer-yes'] })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
        code: 'MISSING_AUTH_TOKEN',
      });
    });

    test('should reject request with invalid Authorization format (401)', async () => {
      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', 'InvalidFormat token123')
        .send({ answer_ids: ['answer-yes'] })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header',
      });
    });

    test('should reject request with invalid Firebase token (401)', async () => {
      setupUnauthenticated('Invalid or expired token');

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', 'Bearer invalid-token')
        .send({ answer_ids: ['answer-yes'] })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
        code: 'INVALID_AUTH_TOKEN',
      });
    });

    test('should reject request with expired Firebase token (401)', async () => {
      setupUnauthenticated('Invalid or expired token');

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    });
  });

  // =====================================================
  // 3. VALIDATION TESTS
  // =====================================================

  describe('Input Validation', () => {
    beforeEach(() => {
      setupAuthenticatedUser(memberUser);
    });

    test('should reject vote for non-existent election (404)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [], rowCount: 0 }; // Election not found
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/non-existent-id/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: 'Election not found',
      });

      // Verify transaction was used (BEGIN and ROLLBACK called)
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    test('should reject empty answer_ids array (400)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: [] })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: 'No answers selected',
      });
    });

    test('should reject missing answer_ids field (400)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({}) // No answer_ids
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: 'No answers selected',
      });
    });

    test('should reject invalid answer IDs (400)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['invalid-answer-id'] })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('Invalid answer IDs'),
      });
    });

    test('should reject too many selections for single-choice (400)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes', 'answer-no'] })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: 'Single-choice elections require exactly 1 selection',
      });
    });

    test('should reject exceeding max_selections for multi-choice (400)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [multiChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-2/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          answer_ids: ['answer-1', 'answer-2', 'answer-3', 'answer-4'] // 4 > max 3
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: expect.stringContaining('Too many selections'),
      });
    });

    test('should reject duplicate answer IDs (400)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [multiChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-2/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-1', 'answer-1'] })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: 'Duplicate answer selections are not allowed',
      });
    });

    test('should reject non-array answer_ids (400)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: 'not-an-array' })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
        message: 'No answers selected',
      });
    });
  });

  // =====================================================
  // 4. VOTING WINDOW TESTS
  // =====================================================

  describe('Voting Window Validation', () => {
    beforeEach(() => {
      setupAuthenticatedUser(memberUser);
    });

    test('should reject vote if election status is not published (403)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [draftElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-draft/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(404); // Draft elections return 404 (hidden)

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: 'Election not found',
      });
    });

    test('should reject vote if voting has not started yet (403)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [futureElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-future/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'Voting has not started yet',
      });
    });

    test('should reject vote if voting has already ended (403)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [pastElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-past/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'Voting has ended',
      });
    });

    test('should reject vote if election status is closed (403)', async () => {
      const closedElection = {
        ...singleChoiceElection,
        id: 'election-closed',
        status: 'closed',
      };

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [closedElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-closed/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'Election has closed',
      });
    });

    test('should reject vote if election is paused (403)', async () => {
      const pausedElection = {
        ...singleChoiceElection,
        id: 'election-paused',
        status: 'paused',
      };

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [pausedElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-paused/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'Election is temporarily paused',
      });
    });
  });

  // =====================================================
  // 5. ELIGIBILITY TESTS
  // =====================================================

  describe('Eligibility Checks', () => {
    test('should reject member vote on admin-only election (403)', async () => {
      setupAuthenticatedUser(memberUser);

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [adminOnlyElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-admin/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Forbidden',
        message: 'You are not eligible to vote in this election',
      });
    });

    test('should accept admin vote on admin-only election (201)', async () => {
      setupAuthenticatedUser(adminUser);

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [adminOnlyElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          return { rows: [{ id: 'ballot-admin-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-admin/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should accept member vote on member election (201)', async () => {
      setupAuthenticatedUser(memberUser);

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          return { rows: [{ id: 'ballot-member-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('should reject vote on hidden election (404)', async () => {
      setupAuthenticatedUser(memberUser);

      const hiddenElection = {
        ...singleChoiceElection,
        hidden: true,
      };

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [hiddenElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: 'Election not found',
      });
    });
  });

  // =====================================================
  // 6. DUPLICATE VOTE TESTS
  // =====================================================

  describe('Duplicate Vote Prevention', () => {
    beforeEach(() => {
      setupAuthenticatedUser(memberUser);
    });

    test('should reject duplicate vote (409)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          // Member has already voted
          return { rows: [{ has_voted: true }], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(409);

      expect(response.body).toMatchObject({
        error: 'Conflict',
        message: 'You have already voted in this election',
      });

      // Verify rollback was called
      const queries = mockClient._getQueries();
      expect(queries.some(q => q.sql === 'ROLLBACK')).toBe(true);
    });

    test('should call check_member_voted_v2 with correct parameters', async () => {
      const voteCheckCalls = [];

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          voteCheckCalls.push({ sql, params });
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          return { rows: [{ id: 'ballot-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(voteCheckCalls).toHaveLength(1);
      expect(voteCheckCalls[0].params).toEqual([
        'election-1',
        memberUser.uid,
      ]);
    });
  });

  // =====================================================
  // 7. TRANSACTION TESTS
  // =====================================================

  describe('Transaction Handling', () => {
    beforeEach(() => {
      setupAuthenticatedUser(memberUser);
    });

    test('should begin transaction before any queries', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          return { rows: [{ id: 'ballot-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      const queries = mockClient._getQueries();
      expect(queries[0].sql).toBe('BEGIN');
    });

    test('should commit transaction on successful vote', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          return { rows: [{ id: 'ballot-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      const queries = mockClient._getQueries();
      expect(queries[queries.length - 1].sql).toBe('COMMIT');
    });

    test('should rollback transaction on election not found', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [], rowCount: 0 }; // Not found
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/non-existent/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(404);

      const queries = mockClient._getQueries();
      expect(queries.some(q => q.sql === 'ROLLBACK')).toBe(true);
      expect(queries.some(q => q.sql === 'COMMIT')).toBe(false);
    });

    test('should rollback transaction on validation error', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: [] }) // Empty array
        .expect(400);

      const queries = mockClient._getQueries();
      expect(queries.some(q => q.sql === 'ROLLBACK')).toBe(true);
      expect(queries.some(q => q.sql === 'COMMIT')).toBe(false);
    });

    test('should rollback transaction on duplicate vote', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: true }], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(409);

      const queries = mockClient._getQueries();
      expect(queries.some(q => q.sql === 'ROLLBACK')).toBe(true);
    });

    test('should rollback transaction on database error', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          throw new Error('Database connection error');
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(500);

      const queries = mockClient._getQueries();
      expect(queries.some(q => q.sql === 'ROLLBACK')).toBe(true);
    });

    test('should release client connection on success', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          return { rows: [{ id: 'ballot-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should release client connection on error', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          throw new Error('Database error');
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(500);

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  // =====================================================
  // 8. EDGE CASES & ERROR HANDLING
  // =====================================================

  describe('Edge Cases & Error Handling', () => {
    beforeEach(() => {
      setupAuthenticatedUser(memberUser);
    });

    test('should handle database connection error (500)', async () => {
      pool.connect.mockRejectedValue(new Error('Connection pool exhausted'));

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error',
      });
    });

    test('should handle database query error (500)', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          throw new Error('Query execution failed');
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error',
        message: 'Failed to record vote',
      });
    });

    test('should handle invalid JSON body (400)', async () => {
      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid-json{')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle malformed election data gracefully', async () => {
      const malformedElection = {
        ...singleChoiceElection,
        answers: null, // Invalid answers field
      };

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [malformedElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
      });
    });

    test('should handle ballot insertion failure', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          throw new Error('Unique constraint violation');
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error',
      });

      const queries = mockClient._getQueries();
      expect(queries.some(q => q.sql === 'ROLLBACK')).toBe(true);
    });

    test('should handle very long election IDs gracefully', async () => {
      const longId = 'x'.repeat(1000);

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [], rowCount: 0 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post(`/api/elections/${longId}/vote`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(404);
    });

    test('should handle missing request body', async () => {
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        // No .send() - empty body
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Bad Request',
      });
    });

    test('should include debug info in development mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          throw new Error('Test error message');
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(500);

      expect(response.body.debug).toBeDefined();
      expect(response.body.debug).toBe('Test error message');

      process.env.NODE_ENV = originalEnv;
    });

    test('should not include debug info in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          throw new Error('Test error message');
        }
        if (sql === 'ROLLBACK') return { rows: [], command: 'ROLLBACK' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(500);

      expect(response.body.debug).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  // =====================================================
  // 9. INTEGRATION SCENARIOS
  // =====================================================

  describe('Integration Scenarios', () => {
    test('should handle concurrent ballot insertions for multi-choice', async () => {
      setupAuthenticatedUser(memberUser);

      let insertCount = 0;
      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [multiChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          insertCount++;
          return { rows: [{ id: `ballot-${insertCount}` }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      const response = await request(app)
        .post('/api/elections/election-2/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-1', 'answer-2', 'answer-3'] })
        .expect(201);

      expect(insertCount).toBe(3);
      expect(response.body.ballot_ids).toHaveLength(3);
    });

    test('should use FOR UPDATE lock on election row', async () => {
      setupAuthenticatedUser(memberUser);

      const selectQueries = [];

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          selectQueries.push(sql);
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          return { rows: [{ id: 'ballot-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(selectQueries.length).toBeGreaterThan(0);
      expect(selectQueries[0]).toContain('FOR UPDATE');
    });

    test('should use correct sentinel token for member votes', async () => {
      setupAuthenticatedUser(memberUser);

      const insertedTokens = [];

      mockClient.query.mockImplementation(async (sql, params) => {
        if (sql === 'BEGIN') return { rows: [], command: 'BEGIN' };
        if (sql.includes('SELECT') && sql.includes('elections.elections')) {
          return { rows: [singleChoiceElection], rowCount: 1 };
        }
        if (sql.includes('check_member_voted_v2')) {
          return { rows: [{ has_voted: false }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO elections.ballots')) {
          insertedTokens.push(params[4]); // token_hash is 5th param
          return { rows: [{ id: 'ballot-123' }], rowCount: 1 };
        }
        if (sql === 'COMMIT') return { rows: [], command: 'COMMIT' };
        return { rows: [], rowCount: 0 };
      });

      await request(app)
        .post('/api/elections/election-1/vote')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ answer_ids: ['answer-yes'] })
        .expect(201);

      expect(insertedTokens).toHaveLength(1);
      expect(insertedTokens[0]).toBe(
        '0000000000000000000000000000000000000000000000000000000000000000'
      );
    });
  });
});
