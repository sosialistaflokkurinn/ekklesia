/**
 * Admin Elections Management Routes
 * Full CRUD interface for election lifecycle management
 *
 * Based on: Issue #192 - Admin Elections Dashboard
 * Auth: Firebase ID tokens with custom claims (election-manager or superadmin)
 * RBAC: election-manager can do most operations, superadmin can hard delete
 */

const express = require('express');
const pool = require('../config/database');
const {
  verifyFirebaseToken,
  requireElectionManager,
  requireSuperadmin,
} = require('../middleware/rbacAuth');
const { logAudit } = require('../services/auditService');

const router = express.Router();

// Apply Firebase token verification to all admin routes
router.use(verifyFirebaseToken);

// =====================================================
// GET /api/admin/elections
// List all elections with optional filters
// =====================================================
// Query params:
// - status: draft|published|paused|closed|archived (optional)
// - includeHidden: true|false (default: false)
// - search: string (search title/question)
// - limit: number (default: 50, max: 200)
// - offset: number (default: 0)

router.get('/elections', requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const {
    status,
    includeHidden = 'false',
    search,
    limit = 50,
    offset = 0,
  } = req.query;

  try {
    // Build WHERE clause
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Filter by status
    if (status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Filter by hidden flag
    if (includeHidden === 'false') {
      conditions.push(`hidden = FALSE`);
    }

    // Search in title or question
    if (search && search.trim()) {
      conditions.push(
        `(LOWER(title) LIKE $${paramIndex} OR LOWER(question) LIKE $${paramIndex})`
      );
      params.push(`%${search.trim().toLowerCase()}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate and sanitize pagination params
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    // Query elections
    const query = `
      SELECT
        id,
        title,
        description,
        question,
        answers,
        status,
        hidden,
        voting_type,
        max_selections,
        eligibility,
        scheduled_start,
        scheduled_end,
        created_by,
        created_at,
        updated_at,
        updated_by,
        published_at,
        closed_at,
        archived_at
      FROM elections.elections
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limitNum, offsetNum);

    const result = await pool.query(query, params);

    // Count total for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM elections.elections
      ${whereClause}
    `;
    const countResult = await pool.query(
      countQuery,
      params.slice(0, params.length - 2)
    ); // Exclude limit/offset params

    const total = parseInt(countResult.rows[0].total, 10);
    const duration = Date.now() - startTime;

    logAudit('list_elections', true, {
      uid: req.user.uid,
      role: req.user.role,
      filters: { status, includeHidden, search },
      count: result.rows.length,
      total,
      duration_ms: duration,
    });

    res.json({
      elections: result.rows,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] List elections error:', error);
    logAudit('list_elections', false, {
      uid: req.user.uid,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list elections',
    });
  }
});

// =====================================================
// POST /api/admin/elections
// Create a new election (draft status)
// =====================================================
// Body: {
//   title: string (required),
//   description: string (optional),
//   question: string (required),
//   answers: string[] (required, min 2 items),
//   voting_type: 'single-choice' | 'multi-choice' (default: 'single-choice'),
//   max_selections: number (required if multi-choice, default: 1),
//   eligibility: 'members' | 'admins' | 'all' (default: 'members'),
//   scheduled_start: ISO timestamp (optional),
//   scheduled_end: ISO timestamp (optional)
// }

router.post('/elections', requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const {
    title,
    description = '',
    question,
    answers,
    voting_type = 'single-choice',
    max_selections = 1,
    eligibility = 'members',
    scheduled_start,
    scheduled_end,
  } = req.body;

  // Validate required fields
  if (!title || !title.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Title is required',
    });
  }

  if (!question || !question.trim()) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Question is required',
    });
  }

  if (!Array.isArray(answers) || answers.length < 2) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Answers must be an array with at least 2 items',
    });
  }

  // Validate voting_type
  if (!['single-choice', 'multi-choice'].includes(voting_type)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'voting_type must be single-choice or multi-choice',
    });
  }

  // Validate max_selections
  if (voting_type === 'single-choice' && max_selections !== 1) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Single-choice elections must have max_selections = 1',
    });
  }

  if (voting_type === 'multi-choice' && (max_selections < 1 || max_selections > answers.length)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: `max_selections must be between 1 and ${answers.length} for multi-choice elections`,
    });
  }

  // Validate eligibility
  if (!['members', 'admins', 'all'].includes(eligibility)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'eligibility must be members, admins, or all',
    });
  }

  try {
    // Insert election
    const result = await pool.query(
      `
      INSERT INTO elections.elections (
        title,
        description,
        question,
        answers,
        voting_type,
        max_selections,
        eligibility,
        scheduled_start,
        scheduled_end,
        created_by,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
      RETURNING *
    `,
      [
        title.trim(),
        description.trim(),
        question.trim(),
        JSON.stringify(answers),
        voting_type,
        max_selections,
        eligibility,
        scheduled_start || null,
        scheduled_end || null,
        req.user.uid,
      ]
    );

    const election = result.rows[0];
    const duration = Date.now() - startTime;

    logAudit('create_election', true, {
      uid: req.user.uid,
      role: req.user.role,
      election_id: election.id,
      title: election.title,
      voting_type,
      duration_ms: duration,
    });

    res.status(201).json({
      success: true,
      election,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] Create election error:', error);
    logAudit('create_election', false, {
      uid: req.user.uid,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create election',
    });
  }
});

// =====================================================
// GET /api/admin/elections/:id
// Get single election details
// =====================================================

router.get('/elections/:id', requireElectionManager, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM elections.elections WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    res.json({
      election: result.rows[0],
    });
  } catch (error) {
    console.error('[Admin] Get election error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get election',
    });
  }
});

// More endpoints to be added in next file...
// - PATCH /api/admin/elections/:id (update)
// - POST /api/admin/elections/:id/open
// - POST /api/admin/elections/:id/close
// - POST /api/admin/elections/:id/hide
// - POST /api/admin/elections/:id/unhide
// - DELETE /api/admin/elections/:id (superadmin only)

module.exports = router;
