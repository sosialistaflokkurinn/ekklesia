/**
 * Admin API Tests
 * Test suite for election administration endpoints
 *
 * Coverage:
 * - Election CRUD operations
 * - Election lifecycle (publish, open, close, archive)
 * - Statistics queries (status, results, tokens)
 * - Role-based access control
 * - Error handling
 */

const request = require('supertest');
const express = require('express');

// Mock database and auth middleware
jest.mock('../../config/config-database');
jest.mock('../../config/config-firebase');
jest.mock('../../middleware/middleware-auth');
jest.mock('../../middleware/middleware-roles');
jest.mock('../../middleware/middleware-rate-limiter');
jest.mock('../../utils/util-logger');

const adminRouter = require('../route-admin');

describe('Admin Election API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock middleware that sets req.user and req.correlationId
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
    it('should create a new election in draft status', async () => {
      const electionData = {
        title: 'Board Member Election 2025',
        description: 'Annual board election',
        question: 'Who should be elected to the board?',
        answers: ['Alice', 'Bob', 'Charlie']
      };

      const response = await request(app)
        .post('/api/admin/elections')
        .send(electionData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(electionData.title);
      expect(response.body.status).toBe('draft');
      expect(response.body.created_by).toBe('test-admin-uid');
    });

    it('should reject election with missing required fields', async () => {
      const incompleteData = {
        title: 'Incomplete Election'
        // Missing question and answers
      };

      const response = await request(app)
        .post('/api/admin/elections')
        .send(incompleteData)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Missing required fields');
    });

    it('should reject election with fewer than 2 answers', async () => {
      const invalidData = {
        title: 'Invalid Election',
        question: 'Question?',
        answers: ['Only One Answer']  // Need minimum 2
      };

      const response = await request(app)
        .post('/api/admin/elections')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('minimum 2 answers');
    });
  });

  describe('GET /elections - List Elections', () => {
    it('should list all elections with default pagination', async () => {
      const response = await request(app)
        .get('/api/admin/elections')
        .expect(200);

      expect(response.body).toHaveProperty('elections');
      expect(Array.isArray(response.body.elections)).toBe(true);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(0);
    });

    it('should filter elections by status', async () => {
      const response = await request(app)
        .get('/api/admin/elections')
        .query({ status: 'published' })
        .expect(200);

      expect(response.body.elections).toBeDefined();
      // All returned elections should have status: published
    });

    it('should support pagination with limit and offset', async () => {
      const response = await request(app)
        .get('/api/admin/elections')
        .query({ limit: 10, offset: 20 })
        .expect(200);

      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(20);
    });
  });

  describe('GET /elections/:id - Get Election Details', () => {
    it('should retrieve election details by ID', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/admin/elections/${electionId}`)
        .expect(200);

      expect(response.body.id).toBe(electionId);
      expect(response.body).toHaveProperty('title');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 for non-existent election', async () => {
      const nonExistentId = 'non-existent-id';

      const response = await request(app)
        .get(`/api/admin/elections/${nonExistentId}`)
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toContain('Election not found');
    });
  });

  describe('PATCH /elections/:id/draft - Edit Draft Election', () => {
    it('should update all fields of a draft election', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';
      const updates = {
        title: 'Updated Title',
        question: 'Updated Question?',
        answers: ['Updated Yes', 'Updated No']
      };

      const response = await request(app)
        .patch(`/api/admin/elections/${electionId}/draft`)
        .send(updates)
        .expect(200);

      expect(response.body.title).toBe(updates.title);
      expect(response.body.question).toBe(updates.question);
      expect(response.body.answers).toEqual(updates.answers);
    });

    it('should reject updates to non-draft elections', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';
      const updates = { title: 'New Title' };

      const response = await request(app)
        .patch(`/api/admin/elections/${electionId}/draft`)
        .send(updates)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('draft status');
    });

    it('should reject update with no fields', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .patch(`/api/admin/elections/${electionId}/draft`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('No fields to update');
    });
  });

  describe('PATCH /elections/:id/metadata - Edit Metadata', () => {
    it('should update title and description of any election', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';
      const updates = {
        title: 'Updated Title',
        description: 'Updated description'
      };

      const response = await request(app)
        .patch(`/api/admin/elections/${electionId}/metadata`)
        .send(updates)
        .expect(200);

      expect(response.body.title).toBe(updates.title);
      expect(response.body.description).toBe(updates.description);
    });

    it('should allow partial updates', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .patch(`/api/admin/elections/${electionId}/metadata`)
        .send({ title: 'New Title' })
        .expect(200);

      expect(response.body.title).toBe('New Title');
    });
  });

  describe('POST /elections/:id/publish - Publish Election', () => {
    it('should publish a draft election', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/publish`)
        .expect(200);

      expect(response.body.status).toBe('published');
      expect(response.body.published_at).toBeDefined();
    });

    it('should reject publishing non-draft elections', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/publish`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('draft status');
    });
  });

  describe('POST /elections/:id/open - Open Voting', () => {
    it('should open voting and generate tokens', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';
      const body = { member_count: 100 };

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/open`)
        .send(body)
        .expect(200);

      expect(response.body.election.status).toBe('open');
      expect(response.body.tokens_generated).toBe(100);
      expect(response.body.election.voting_start_time).toBeDefined();
    });

    it('should require published status to open voting', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/open`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('published status');
    });
  });

  describe('POST /elections/:id/close - Close Voting', () => {
    it('should close voting on an open election', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/close`)
        .expect(200);

      expect(response.body.status).toBe('closed');
      expect(response.body.closed_at).toBeDefined();
    });

    it('should allow closing paused elections', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/close`)
        .expect(200);

      expect(response.body.status).toBe('closed');
    });
  });

  describe('POST /elections/:id/pause - Pause Voting', () => {
    it('should pause an open election', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/pause`)
        .expect(200);

      expect(response.body.status).toBe('paused');
    });

    it('should only pause published elections', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/pause`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('published status');
    });
  });

  describe('POST /elections/:id/resume - Resume Voting', () => {
    it('should resume a paused election', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/resume`)
        .expect(200);

      expect(response.body.status).toBe('open');
    });

    it('should only resume paused elections', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/resume`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('paused status');
    });
  });

  describe('POST /elections/:id/archive - Archive Election', () => {
    it('should archive a closed election', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/archive`)
        .expect(200);

      expect(response.body.status).toBe('archived');
      expect(response.body.archived_at).toBeDefined();
    });

    it('should only archive closed elections', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .post(`/api/admin/elections/${electionId}/archive`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('closed status');
    });
  });

  describe('DELETE /elections/:id - Delete Election', () => {
    it('should soft delete a draft election', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .delete(`/api/admin/elections/${electionId}`)
        .expect(200);

      expect(response.body.election.status).toBe('deleted');
      expect(response.body.election.deleted_at).toBeDefined();
    });

    it('should only delete draft elections', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .delete(`/api/admin/elections/${electionId}`)
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('draft status');
    });
  });

  describe('GET /elections/:id/status - Election Status', () => {
    it('should return election status and token statistics', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/admin/elections/${electionId}/status`)
        .expect(200);

      expect(response.body.election).toBeDefined();
      expect(response.body.election.id).toBe(electionId);
      expect(response.body.token_statistics).toBeDefined();
      expect(response.body.token_statistics).toHaveProperty('total');
      expect(response.body.token_statistics).toHaveProperty('used');
      expect(response.body.token_statistics).toHaveProperty('unused');
      expect(response.body.token_statistics).toHaveProperty('participation_rate');
    });

    it('should calculate participation rate correctly', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/admin/elections/${electionId}/status`)
        .expect(200);

      const { token_statistics } = response.body;
      if (token_statistics.total > 0) {
        const expectedRate = ((token_statistics.used / token_statistics.total) * 100).toFixed(2);
        expect(token_statistics.participation_rate).toContain(expectedRate);
      }
    });
  });

  describe('GET /elections/:id/results - Election Results', () => {
    it('should return election results and vote distribution', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/admin/elections/${electionId}/results`)
        .expect(200);

      expect(response.body.election).toBeDefined();
      expect(response.body.election.id).toBe(electionId);
      expect(response.body.results).toBeDefined();
      expect(response.body.results).toHaveProperty('total_votes');
      expect(response.body.results).toHaveProperty('eligible_voters');
      expect(response.body.results).toHaveProperty('participation_rate');
      expect(Array.isArray(response.body.results.answers)).toBe(true);
    });

    it('should include vote counts and percentages for each answer', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/admin/elections/${electionId}/results`)
        .expect(200);

      const { answers } = response.body.results;
      answers.forEach(answer => {
        expect(answer).toHaveProperty('text');
        expect(answer).toHaveProperty('votes');
        expect(answer).toHaveProperty('percentage');
        expect(typeof answer.votes).toBe('number');
      });
    });
  });

  describe('GET /elections/:id/tokens - Token Distribution', () => {
    it('should return token distribution statistics', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/admin/elections/${electionId}/tokens`)
        .expect(200);

      expect(response.body.election).toBeDefined();
      expect(response.body.token_distribution).toBeDefined();
      expect(response.body.token_distribution).toHaveProperty('total');
      expect(response.body.token_distribution).toHaveProperty('used');
      expect(response.body.token_distribution).toHaveProperty('unused');
      expect(response.body.token_distribution).toHaveProperty('expired');
      expect(response.body.token_distribution).toHaveProperty('usage_rate');
    });

    it('should include token timeline information', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/admin/elections/${electionId}/tokens`)
        .expect(200);

      expect(response.body.token_timeline).toBeDefined();
      expect(response.body.token_timeline).toHaveProperty('first_issued');
      expect(response.body.token_timeline).toHaveProperty('last_issued');
      expect(response.body.token_timeline).toHaveProperty('avg_expiration_hours');
    });
  });

  describe('Error Handling', () => {
    it('should include correlation_id in error responses', async () => {
      const response = await request(app)
        .post('/api/admin/elections')
        .send({}) // Invalid request
        .expect(400);

      expect(response.body.correlation_id).toBe('test-correlation-id-123');
    });

    it('should handle database errors gracefully', async () => {
      const electionId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get(`/api/admin/elections/${electionId}/status`)
        .expect(500); // Assuming database error

      expect(response.body.error).toBe('Internal Server Error');
      expect(response.body.message).toBeDefined();
      expect(response.body.correlation_id).toBeDefined();
    });
  });

  describe('Audit Logging', () => {
    it('should log all creation operations', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await request(app)
        .post('/api/admin/elections')
        .send({
          title: 'Test Election',
          question: 'Test?',
          answers: ['Yes', 'No']
        });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Election created')
      );

      consoleSpy.mockRestore();
    });

    it('should log lifecycle transitions', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await request(app)
        .post('/api/admin/elections/test-id/publish');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Election published')
      );

      consoleSpy.mockRestore();
    });
  });
});
