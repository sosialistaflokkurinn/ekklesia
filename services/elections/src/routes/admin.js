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

// =====================================================
// PATCH /api/admin/elections/:id
// Update election (draft only)
// =====================================================
// Body: {
//   title?: string,
//   description?: string,
//   question?: string,
//   answers?: string[],
//   voting_type?: 'single-choice' | 'multi-choice',
//   max_selections?: number,
//   eligibility?: 'members' | 'admins' | 'all',
//   scheduled_start?: ISO timestamp,
//   scheduled_end?: ISO timestamp
// }

router.patch('/elections/:id', requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const {
    title,
    description,
    question,
    answers,
    voting_type,
    max_selections,
    eligibility,
    scheduled_start,
    scheduled_end,
  } = req.body;

  try {
    // Check election exists and is draft
    const checkResult = await pool.query(
      'SELECT status FROM elections.elections WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    if (checkResult.rows[0].status !== 'draft') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only draft elections can be edited',
      });
    }

    // Build dynamic UPDATE query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Title cannot be empty',
        });
      }
      updates.push(`title = $${paramIndex}`);
      params.push(title.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(description.trim());
      paramIndex++;
    }

    if (question !== undefined) {
      if (!question.trim()) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Question cannot be empty',
        });
      }
      updates.push(`question = $${paramIndex}`);
      params.push(question.trim());
      paramIndex++;
    }

    if (answers !== undefined) {
      if (!Array.isArray(answers) || answers.length < 2) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Answers must be an array with at least 2 items',
        });
      }
      updates.push(`answers = $${paramIndex}`);
      params.push(JSON.stringify(answers));
      paramIndex++;
    }

    if (voting_type !== undefined) {
      if (!['single-choice', 'multi-choice'].includes(voting_type)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'voting_type must be single-choice or multi-choice',
        });
      }
      updates.push(`voting_type = $${paramIndex}`);
      params.push(voting_type);
      paramIndex++;
    }

    if (max_selections !== undefined) {
      updates.push(`max_selections = $${paramIndex}`);
      params.push(max_selections);
      paramIndex++;
    }

    if (eligibility !== undefined) {
      if (!['members', 'admins', 'all'].includes(eligibility)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'eligibility must be members, admins, or all',
        });
      }
      updates.push(`eligibility = $${paramIndex}`);
      params.push(eligibility);
      paramIndex++;
    }

    if (scheduled_start !== undefined) {
      updates.push(`scheduled_start = $${paramIndex}`);
      params.push(scheduled_start || null);
      paramIndex++;
    }

    if (scheduled_end !== undefined) {
      updates.push(`scheduled_end = $${paramIndex}`);
      params.push(scheduled_end || null);
      paramIndex++;
    }

    // Always update updated_by
    updates.push(`updated_by = $${paramIndex}`);
    params.push(req.user.uid);
    paramIndex++;

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update',
      });
    }

    // Execute update
    params.push(id);
    const result = await pool.query(
      `
      UPDATE elections.elections
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `,
      params
    );

    const election = result.rows[0];
    const duration = Date.now() - startTime;

    logAudit('update_election', true, {
      uid: req.user.uid,
      role: req.user.role,
      election_id: id,
      updated_fields: Object.keys(req.body),
      duration_ms: duration,
    });

    res.json({
      success: true,
      election,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] Update election error:', error);
    logAudit('update_election', false, {
      uid: req.user.uid,
      election_id: id,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update election',
    });
  }
});

// =====================================================
// POST /api/admin/elections/:id/open
// Open election (publish)
// =====================================================

router.post('/elections/:id/open', requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    // Check election exists and is draft
    const checkResult = await pool.query(
      'SELECT status, hidden FROM elections.elections WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const { status, hidden } = checkResult.rows[0];

    if (status !== 'draft') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only draft elections can be opened',
      });
    }

    if (hidden) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot open hidden election - unhide it first',
      });
    }

    // Update status to published and set published_at
    const result = await pool.query(
      `
      UPDATE elections.elections
      SET status = 'published', published_at = NOW(), updated_by = $1
      WHERE id = $2
      RETURNING *
    `,
      [req.user.uid, id]
    );

    const election = result.rows[0];
    const duration = Date.now() - startTime;

    logAudit('open_election', true, {
      uid: req.user.uid,
      role: req.user.role,
      election_id: id,
      title: election.title,
      duration_ms: duration,
    });

    res.json({
      success: true,
      election,
      message: 'Election opened successfully',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] Open election error:', error);
    logAudit('open_election', false, {
      uid: req.user.uid,
      election_id: id,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to open election',
    });
  }
});

// =====================================================
// POST /api/admin/elections/:id/close
// Close election (stop voting)
// =====================================================

router.post('/elections/:id/close', requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    // Check election exists and is published/paused
    const checkResult = await pool.query(
      'SELECT status FROM elections.elections WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const { status } = checkResult.rows[0];

    if (!['published', 'paused'].includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Only published or paused elections can be closed',
      });
    }

    // Update status to closed and set closed_at
    const result = await pool.query(
      `
      UPDATE elections.elections
      SET status = 'closed', closed_at = NOW(), updated_by = $1
      WHERE id = $2
      RETURNING *
    `,
      [req.user.uid, id]
    );

    const election = result.rows[0];
    const duration = Date.now() - startTime;

    logAudit('close_election', true, {
      uid: req.user.uid,
      role: req.user.role,
      election_id: id,
      title: election.title,
      duration_ms: duration,
    });

    res.json({
      success: true,
      election,
      message: 'Election closed successfully',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] Close election error:', error);
    logAudit('close_election', false, {
      uid: req.user.uid,
      election_id: id,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to close election',
    });
  }
});

// =====================================================
// POST /api/admin/elections/:id/hide
// Hide election (soft delete)
// =====================================================

router.post('/elections/:id/hide', requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    // Check election exists and is not already hidden
    const checkResult = await pool.query(
      'SELECT hidden FROM elections.elections WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    if (checkResult.rows[0].hidden) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election is already hidden',
      });
    }

    // Update hidden flag
    const result = await pool.query(
      `
      UPDATE elections.elections
      SET hidden = TRUE, updated_by = $1
      WHERE id = $2
      RETURNING *
    `,
      [req.user.uid, id]
    );

    const election = result.rows[0];
    const duration = Date.now() - startTime;

    logAudit('hide_election', true, {
      uid: req.user.uid,
      role: req.user.role,
      election_id: id,
      title: election.title,
      duration_ms: duration,
    });

    res.json({
      success: true,
      election,
      message: 'Election hidden successfully',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] Hide election error:', error);
    logAudit('hide_election', false, {
      uid: req.user.uid,
      election_id: id,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to hide election',
    });
  }
});

// =====================================================
// POST /api/admin/elections/:id/unhide
// Unhide election (restore from soft delete)
// =====================================================

router.post('/elections/:id/unhide', requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    // Check election exists and is hidden
    const checkResult = await pool.query(
      'SELECT hidden FROM elections.elections WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    if (!checkResult.rows[0].hidden) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election is not hidden',
      });
    }

    // Update hidden flag
    const result = await pool.query(
      `
      UPDATE elections.elections
      SET hidden = FALSE, updated_by = $1
      WHERE id = $2
      RETURNING *
    `,
      [req.user.uid, id]
    );

    const election = result.rows[0];
    const duration = Date.now() - startTime;

    logAudit('unhide_election', true, {
      uid: req.user.uid,
      role: req.user.role,
      election_id: id,
      title: election.title,
      duration_ms: duration,
    });

    res.json({
      success: true,
      election,
      message: 'Election restored successfully',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] Unhide election error:', error);
    logAudit('unhide_election', false, {
      uid: req.user.uid,
      election_id: id,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to restore election',
    });
  }
});

// =====================================================
// DELETE /api/admin/elections/:id
// Permanently delete election (superadmin only)
// =====================================================
// DANGER: This is irreversible - deletes all data

router.delete('/elections/:id', requireSuperadmin, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    // Check election exists
    const checkResult = await pool.query(
      'SELECT title, status FROM elections.elections WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const { title, status } = checkResult.rows[0];

    // Safety check: don't allow deleting active elections
    if (status === 'published') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Cannot delete active election - close it first',
      });
    }

    // Permanently delete election
    await pool.query('DELETE FROM elections.elections WHERE id = $1', [id]);

    const duration = Date.now() - startTime;

    logAudit('delete_election', true, {
      uid: req.user.uid,
      role: req.user.role,
      election_id: id,
      title,
      status,
      duration_ms: duration,
    });

    res.json({
      success: true,
      message: 'Election permanently deleted',
      election_id: id,
      title,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] Delete election error:', error);
    logAudit('delete_election', false, {
      uid: req.user.uid,
      election_id: id,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete election',
    });
  }
});

// =====================================================
// GET /api/admin/elections/:id/results
// Get election results
// =====================================================

router.get('/elections/:id/results', requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;

  try {
    // Check election exists
    const electionResult = await pool.query(
      'SELECT title, question, answers, status, closed_at FROM elections.elections WHERE id = $1',
      [id]
    );

    if (electionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const election = electionResult.rows[0];

    // Only allow viewing results for closed elections
    if (election.status !== 'closed' && election.status !== 'archived') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Results only available for closed elections',
      });
    }

    // Get results using helper function from migration 004
    const resultsData = await pool.query(
      'SELECT * FROM get_election_results($1)',
      [id]
    );

    // Calculate total votes
    const totalVotes = resultsData.rows.reduce((sum, row) => sum + parseInt(row.votes, 10), 0);

    // Parse answers JSON
    const answers = JSON.parse(election.answers);

    // Build results array with answer text
    const resultsArray = resultsData.rows.map(row => {
      const answer = answers.find(a => a.id === row.answer_id);
      return {
        answer_id: row.answer_id,
        answer_text: answer ? answer.text : row.answer_id,
        votes: parseInt(row.votes, 10),
        percentage: parseFloat(row.percentage),
      };
    });

    // Find winner (most votes)
    const winner = resultsArray.length > 0
      ? resultsArray.reduce((max, current) => (current.votes > max.votes ? current : max))
      : null;

    const results = {
      election_id: id,
      title: election.title,
      question: election.question,
      answers: answers,
      status: election.status,
      closed_at: election.closed_at,
      total_votes: totalVotes,
      results: resultsArray,
      winner: winner && winner.votes > 0 ? winner : null,
    };

    const duration = Date.now() - startTime;

    logAudit('get_results', true, {
      uid: req.user.uid,
      role: req.user.role,
      election_id: id,
      total_votes: totalVotes,
      duration_ms: duration,
    });

    res.json(results);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[Admin] Get results error:', error);
    logAudit('get_results', false, {
      uid: req.user.uid,
      election_id: id,
      error: error.message,
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get results',
    });
  }
});

module.exports = router;
