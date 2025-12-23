/**
 * Admin API Tests
 * Test suite for election administration endpoints
 */

const request = require('supertest');
const express = require('express');

// Mock modules BEFORE requiring anything that uses them
jest.mock('../../config/config-database');
jest.mock('../../config/config-firebase');
jest.mock('../../middleware/middleware-auth');
jest.mock('../../middleware/middleware-roles');
jest.mock('../../middleware/middleware-rate-limiter');
jest.mock('../../utils/util-logger');

// Import mocked database module
const { pool, _resetMocks } = require('../../config/config-database');

// Now import the router
const adminRouter = require('../route-admin');

// Test fixtures
const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000';

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
  answers: JSON.stringify([
    { id: 'answer-1', text: 'Yes', display_order: 1 },
    { id: 'answer-2', text: 'No', display_order: 2 },
  ]),
};

const publishedElection = {
  ...draftElection,
  status: 'published',
  published_at: new Date('2025-01-02T00:00:00Z'),
};

const openElection = {
  ...publishedElection,
  status: 'open',
  voting_start_time: new Date('2025-01-03T00:00:00Z'),
};

const closedElection = {
  ...openElection,
  status: 'closed',
  closed_at: new Date('2025-01-04T00:00:00Z'),
};

describe('Admin Election API', () => {
  let app;

  beforeEach(() => {
    // Reset all mocks before each test
    _resetMocks();
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    // Mock middleware that sets req.user
    app.use((req, res, next) => {
      req.user = {
        uid: 'test-admin-uid',
        email: 'admin@example.com'
      };
      req.correlationId = 'test-correlation-id-123';
      next();
    });

    app.use('/api/admin', adminRouter);
  });

  describe('POST /elections - Create Election', () => {
    it('should reject election with missing required fields', async () => {
      const incompleteData = {
        title: 'Incomplete Election'
      };

      const response = await request(app)
        .post('/api/admin/elections')
        .send(incompleteData)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Missing required fields');
    });
  });

  describe('GET /elections - List Elections', () => {
    it('should list all elections with default pagination', async () => {
      // Mock: First call returns elections list
      pool.query.mockResolvedValueOnce({
        rows: [draftElection, publishedElection],
        rowCount: 2
      });

      const response = await request(app)
        .get('/api/admin/elections')
        .expect(200);

      expect(response.body).toHaveProperty('elections');
      expect(Array.isArray(response.body.elections)).toBe(true);
    });
  });

  describe('GET /elections/:id - Get Election Details', () => {
    it('should retrieve election details by ID', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [draftElection],
        rowCount: 1
      });

      const response = await request(app)
        .get(`/api/admin/elections/${TEST_UUID}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title');
    });

    it('should return 404 for non-existent election', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const response = await request(app)
        .get('/api/admin/elections/non-existent-id')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('PATCH /elections/:id/draft - Edit Draft Election', () => {
    it('should reject update with no fields', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [draftElection],
        rowCount: 1
      });

      const response = await request(app)
        .patch(`/api/admin/elections/${TEST_UUID}/draft`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('Election Lifecycle', () => {
    describe('POST /elections/:id/publish', () => {
      it('should reject publishing non-draft elections', async () => {
        pool.query.mockResolvedValueOnce({
          rows: [publishedElection],
          rowCount: 1
        });

        const response = await request(app)
          .post(`/api/admin/elections/${TEST_UUID}/publish`)
          .expect(400);

        expect(response.body.error).toBe('Bad Request');
      });
    });

    describe('POST /elections/:id/open', () => {
      it('should require published status to open voting', async () => {
        // This endpoint uses pool.connect() + client.query()
        // Mock sequence: BEGIN, SELECT (returns draft election), ROLLBACK
        pool.query
          .mockResolvedValueOnce({ rows: [], command: 'BEGIN' })  // BEGIN
          .mockResolvedValueOnce({  // SELECT - election exists but wrong status
            rows: [{ id: TEST_UUID, status: 'draft', title: 'Test' }],
            rowCount: 1
          })
          .mockResolvedValueOnce({ rows: [], command: 'ROLLBACK' });  // ROLLBACK

        const response = await request(app)
          .post(`/api/admin/elections/${TEST_UUID}/open`)
          .send({})
          .expect(400);

        expect(response.body.error).toBe('Bad Request');
        expect(response.body.message).toContain('published status');
      });
    });

    describe('POST /elections/:id/pause', () => {
      it('should only pause open elections', async () => {
        // UPDATE returns 0 rows when status doesn't match (not 'published')
        pool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        });

        const response = await request(app)
          .post(`/api/admin/elections/${TEST_UUID}/pause`)
          .expect(400);

        expect(response.body.error).toBe('Bad Request');
      });
    });

    describe('POST /elections/:id/resume', () => {
      it('should only resume paused elections', async () => {
        // UPDATE returns 0 rows when status doesn't match (not 'paused')
        pool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        });

        const response = await request(app)
          .post(`/api/admin/elections/${TEST_UUID}/resume`)
          .expect(400);

        expect(response.body.error).toBe('Bad Request');
      });
    });

    describe('POST /elections/:id/archive', () => {
      it('should only archive closed elections', async () => {
        // UPDATE returns 0 rows when status doesn't match (not 'closed')
        pool.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        });

        const response = await request(app)
          .post(`/api/admin/elections/${TEST_UUID}/archive`)
          .expect(400);

        expect(response.body.error).toBe('Bad Request');
      });
    });
  });

  describe('DELETE /elections/:id - Delete Election', () => {
    it('should only delete draft elections', async () => {
      // DELETE returns 0 rows when status doesn't match (not 'draft')
      pool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const response = await request(app)
        .delete(`/api/admin/elections/${TEST_UUID}`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });
  });

  describe('Error Handling', () => {
    it('should include correlation_id in error responses', async () => {
      const response = await request(app)
        .post('/api/admin/elections')
        .send({})
        .expect(400);

      expect(response.body.correlation_id).toBe('test-correlation-id-123');
    });

    it('should handle database errors gracefully', async () => {
      pool.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/admin/elections/${TEST_UUID}`)
        .expect(500);

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.correlation_id).toBeDefined();
    });
  });
});
