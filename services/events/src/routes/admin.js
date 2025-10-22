const express = require('express');
const { pool, query } = require('../config/database');
const authenticate = require('../middleware/auth');
const { requireRole, requireAnyRoles, attachCorrelationId } = require('../middleware/roles');

/**
 * In-memory rate limiter for admin operations.
 * LIMITATIONS:
 * - Per-instance state (not shared across Cloud Run instances)
 * - Lost on instance restart
 * - Potential unbounded growth without cleanup
 * ACCEPTABLE FOR:
 * - Low-frequency operations (e.g., monthly)
 * - Trusted internal users (not public-facing)
 * UPGRADE PATH:
 * - Use Firestore/Redis for global, durable rate limiting
 */
const lastResetByUid = new Map();
// Periodic cleanup of stale entries older than 24h
setInterval(() => {
  const now = Date.now();
  const staleBefore = now - (24 * 60 * 60 * 1000);
  for (const [uid, ts] of lastResetByUid.entries()) {
    if (ts < staleBefore) lastResetByUid.delete(uid);
  }
}, 60 * 60 * 1000).unref?.(); // avoid keeping process alive solely for timer

// Admin router with base authentication
const router = express.Router();

// Apply base middleware to ALL admin routes
// 1. Attach correlation ID for request tracing
router.use(attachCorrelationId);

// 2. Require authentication for all admin endpoints
router.use(authenticate);

// 3. Require at least one admin role (fail-secure default)
router.use(requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager']));

// Helper: check if admin reset is enabled and caller is allowed
function isResetAllowed(uid) {
  const enabled = (process.env.ADMIN_RESET_ENABLED || '').toLowerCase() === 'true';
  if (!enabled) return false;

  const allowedUids = (process.env.ALLOWED_RESET_UIDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return allowedUids.includes(uid);
}

/**
 * POST /api/admin/reset-election
 * Body: { scope: 'all' | 'mine', confirm?: string }
 * Auth: Firebase ID token (applied at router level)
 * Role: developer only (destructive operation)
 * Guards: ADMIN_RESET_ENABLED=true and uid in ALLOWED_RESET_UIDS
 */
router.post('/reset-election', requireRole('developer'), async (req, res) => {
  try {
    const { uid, kennitala } = req.user || {};

    if (!isResetAllowed(uid)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin reset not allowed'
      });
    }

  const scope = (req.body && req.body.scope) || 'all';
    const confirm = (req.body && req.body.confirm) || '';

    // Prepare result object
    const result = {
      scope,
      performed_by: uid,
      before: {},
      after: {},
      actions: []
    };

    // Rate limit for full reset to avoid accidental repeats
    if (scope === 'all') {
      let minIntervalSec = Number.parseInt(process.env.ADMIN_RESET_MIN_INTERVAL_SEC ?? '300', 10);
      if (!Number.isFinite(minIntervalSec) || minIntervalSec < 0) {
        console.error('Invalid ADMIN_RESET_MIN_INTERVAL_SEC; falling back to default 300s');
        minIntervalSec = 300;
      }
      // Cap to 1 day to avoid accidental extreme throttling due to typos
      if (minIntervalSec > 86400) {
        console.warn(`ADMIN_RESET_MIN_INTERVAL_SEC too high (${minIntervalSec}); capping to 86400s`);
        minIntervalSec = 86400;
      }
      const now = Date.now();
      const last = lastResetByUid.get(uid) || 0;
      const elapsed = Math.floor((now - last) / 1000);
      if (elapsed < minIntervalSec) {
        const retryAfter = minIntervalSec - elapsed;
        console.warn(JSON.stringify({
          level: 'warn',
          message: 'Admin reset rate-limited',
          performed_by: uid,
          retry_after_sec: retryAfter,
          timestamp: new Date().toISOString()
        }));
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Please wait ${retryAfter}s before attempting another full reset`,
          retryAfter
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // BEFORE state
      const beforeEvents = await client.query('SELECT COUNT(*)::int AS cnt FROM public.voting_tokens');
      const beforeElectionsTokens = await client.query('SELECT COUNT(*)::int AS cnt FROM elections.voting_tokens');
      const beforeElectionsBallots = await client.query('SELECT COUNT(*)::int AS cnt FROM elections.ballots');
      result.before = {
        events_tokens: beforeEvents.rows[0].cnt,
        elections_tokens: beforeElectionsTokens.rows[0].cnt,
        elections_ballots: beforeElectionsBallots.rows[0].cnt
      };

      if (scope === 'mine') {
        // Delete only this user's token in Events service
        const delMine = await client.query('DELETE FROM public.voting_tokens WHERE kennitala = $1', [kennitala]);
        result.actions.push({ action: 'delete_events_token_for_user', kennitala });
        console.log(JSON.stringify({
          level: 'info',
          message: 'Admin reset - user scope',
          action: 'mine',
          performed_by: uid,
          kennitala_masked: kennitala ? `${kennitala.substring(0,7)}****` : null,
          timestamp: new Date().toISOString()
        }));
      } else if (scope === 'all') {
        // Production guardrail: block destructive reset unless explicitly allowed
        const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
        const prodAllowed = (process.env.PRODUCTION_RESET_ALLOWED || '').toLowerCase() === 'true';
        if (isProd && !prodAllowed) {
          await client.query('ROLLBACK');
          console.warn(JSON.stringify({
            level: 'warn',
            message: 'Blocked full reset in production (guardrail)',
            performed_by: uid,
            timestamp: new Date().toISOString()
          }));
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Full reset is blocked in production. Set PRODUCTION_RESET_ALLOWED=true to enable (with strict controls).'
          });
        }
        // Full reset requires explicit confirmation phrase
        if (confirm !== 'RESET ALL') {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Bad Request',
            message: "Confirmation phrase mismatch. Type 'RESET ALL' to confirm."
          });
        }
        // Clear Elections service data (anonymized data only)
        await client.query('TRUNCATE TABLE elections.ballots CASCADE');
        await client.query('TRUNCATE TABLE elections.voting_tokens CASCADE');
        result.actions.push({ action: 'truncate_elections_tables', tables: ['elections.ballots', 'elections.voting_tokens'] });

        // Clear Events service tokens (safe; tokens are not PII)
        await client.query('DELETE FROM public.voting_tokens');
        result.actions.push({ action: 'delete_all_events_tokens', table: 'public.voting_tokens' });

        const alertPayload = {
          level: 'warn',
          message: 'Admin reset - FULL RESET executed',
          performed_by: uid,
          before_counts: result.before,
          after_counts: {},
          timestamp: new Date().toISOString()
        };
        console.warn(JSON.stringify(alertPayload));
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Bad Request',
          message: "Invalid scope. Use 'mine' or 'all'"
        });
      }

      // AFTER state
      const afterEvents = await client.query('SELECT COUNT(*)::int AS cnt FROM public.voting_tokens');
      const afterElectionsTokens = await client.query('SELECT COUNT(*)::int AS cnt FROM elections.voting_tokens');
      const afterElectionsBallots = await client.query('SELECT COUNT(*)::int AS cnt FROM elections.ballots');
      result.after = {
        events_tokens: afterEvents.rows[0].cnt,
        elections_tokens: afterElectionsTokens.rows[0].cnt,
        elections_ballots: afterElectionsBallots.rows[0].cnt
      };

      // Emit completion log with final counts
      console.warn(JSON.stringify({
        level: 'info',
        message: 'Admin reset completed',
        performed_by: uid,
        final_counts: result.after,
        timestamp: new Date().toISOString()
      }));

      await client.query('COMMIT');

      // Update in-memory rate limit timestamp for full reset
      if (scope === 'all') {
        lastResetByUid.set(uid, Date.now());
      }

      return res.json({
        success: true,
        message: scope === 'mine'
          ? 'Deleted your Events token. You can request a new token now.'
          : 'Election reset complete. All tokens and ballots cleared.'
        ,
        ...result
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[Admin Reset] Transaction error:', err);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to perform reset'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Admin Reset] Error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Unexpected error'
    });
  }
});

// ============================================================================
// Election Management Endpoints (Issues #71-#79)
// ============================================================================

/**
 * GET /api/admin/elections
 * List all elections with optional filtering
 * Role: developer, meeting_election_manager, event_manager (read-only)
 * Issue: #78
 */
router.get('/elections', requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager']), async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT id, title, description, status, created_at, updated_at, created_by FROM elections.elections';
    const params = [];

    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);

    console.log(JSON.stringify({
      level: 'info',
      message: 'List elections',
      correlation_id: req.correlationId,
      performed_by: req.user?.uid,
      count: result.rows.length,
      status_filter: status || 'all',
      timestamp: new Date().toISOString()
    }));

    return res.json({
      elections: result.rows,
      limit: parseInt(limit),
      offset: parseInt(offset),
      count: result.rows.length
    });
  } catch (error) {
    console.error('[Admin] List elections error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list elections',
      correlation_id: req.correlationId
    });
  }
});

/**
 * GET /api/admin/elections/:id
 * Get election details (preview)
 * Role: developer, meeting_election_manager, event_manager (read-only)
 * Issue: #79
 */
router.get('/elections/:id', requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM elections.elections WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
        correlation_id: req.correlationId
      });
    }

    console.log(JSON.stringify({
      level: 'info',
      message: 'Preview election',
      correlation_id: req.correlationId,
      performed_by: req.user?.uid,
      election_id: id,
      timestamp: new Date().toISOString()
    }));

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Preview election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch election',
      correlation_id: req.correlationId
    });
  }
});

/**
 * POST /api/admin/elections
 * Create new election (draft status)
 * Role: developer, meeting_election_manager
 * Issue: #71
 */
router.post('/elections', requireAnyRoles(['developer', 'meeting_election_manager']), async (req, res) => {
  try {
    const { title, description, question, answers } = req.body;
    const uid = req.user?.uid;

    // Validation
    if (!title || !question || !Array.isArray(answers) || answers.length < 2) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: title, question, answers (min 2)',
        correlation_id: req.correlationId
      });
    }

    const result = await query(
      `INSERT INTO elections.elections (title, description, question, answers, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, NOW(), NOW())
       RETURNING *`,
      [title, description || '', question, JSON.stringify(answers), uid]
    );

    console.log(JSON.stringify({
      level: 'info',
      message: 'Election created',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: result.rows[0].id,
      title,
      timestamp: new Date().toISOString()
    }));

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Create election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create election',
      correlation_id: req.correlationId
    });
  }
});

/**
 * PATCH /api/admin/elections/:id/draft
 * Edit draft election
 * Role: developer, meeting_election_manager
 * Issue: #72
 */
router.patch('/elections/:id/draft', requireAnyRoles(['developer', 'meeting_election_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, question, answers } = req.body;
    const uid = req.user?.uid;

    // Check if election exists and is in draft status
    const existing = await query(
      'SELECT status FROM elections.elections WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
        correlation_id: req.correlationId
      });
    }

    if (existing.rows[0].status !== 'draft') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Can only edit elections in draft status',
        current_status: existing.rows[0].status,
        correlation_id: req.correlationId
      });
    }

    // Build dynamic update query
    const updates = [];
    const params = [id];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${++paramCount}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${++paramCount}`);
      params.push(description);
    }
    if (question) {
      updates.push(`question = $${++paramCount}`);
      params.push(question);
    }
    if (answers) {
      updates.push(`answers = $${++paramCount}`);
      params.push(JSON.stringify(answers));
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No fields to update',
        correlation_id: req.correlationId
      });
    }

    updates.push('updated_at = NOW()');

    const result = await query(
      `UPDATE elections.elections SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    console.log(JSON.stringify({
      level: 'info',
      message: 'Draft election updated',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      updated_fields: Object.keys(req.body),
      timestamp: new Date().toISOString()
    }));

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Edit draft election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update election',
      correlation_id: req.correlationId
    });
  }
});

/**
 * PATCH /api/admin/elections/:id/metadata
 * Edit election metadata only (title, description)
 * Role: developer, meeting_election_manager, event_manager
 * Note: event_manager can only edit metadata, not lifecycle
 */
router.patch('/elections/:id/metadata', requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;
    const uid = req.user?.uid;

    if (!title && description === undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Must provide title or description to update',
        correlation_id: req.correlationId
      });
    }

    const updates = [];
    const params = [id];
    let paramCount = 1;

    if (title) {
      updates.push(`title = $${++paramCount}`);
      params.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${++paramCount}`);
      params.push(description);
    }

    updates.push('updated_at = NOW()');

    const result = await query(
      `UPDATE elections.elections SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
        correlation_id: req.correlationId
      });
    }

    console.log(JSON.stringify({
      level: 'info',
      message: 'Election metadata updated',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      updated_fields: Object.keys(req.body),
      timestamp: new Date().toISOString()
    }));

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Update metadata error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update election metadata',
      correlation_id: req.correlationId
    });
  }
});

/**
 * POST /api/admin/elections/:id/publish
 * Publish election (draft → published)
 * Role: developer, meeting_election_manager
 * Issue: #73
 */
router.post('/elections/:id/publish', requireAnyRoles(['developer', 'meeting_election_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;

    const result = await query(
      `UPDATE elections.elections
       SET status = 'published', published_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election not found or not in draft status',
        correlation_id: req.correlationId
      });
    }

    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Election published',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      title: result.rows[0].title,
      timestamp: new Date().toISOString()
    }));

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Publish election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to publish election',
      correlation_id: req.correlationId
    });
  }
});

/**
 * POST /api/admin/elections/:id/close
 * Close election (published → closed)
 * Role: developer, meeting_election_manager
 * Issue: #74
 */
router.post('/elections/:id/close', requireAnyRoles(['developer', 'meeting_election_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;

    const result = await query(
      `UPDATE elections.elections
       SET status = 'closed', closed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('published', 'paused')
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election not found or not in published/paused status',
        correlation_id: req.correlationId
      });
    }

    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Election closed',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      title: result.rows[0].title,
      timestamp: new Date().toISOString()
    }));

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Close election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to close election',
      correlation_id: req.correlationId
    });
  }
});

/**
 * POST /api/admin/elections/:id/pause
 * Pause election (published → paused)
 * Role: developer, meeting_election_manager
 * Issue: #75
 */
router.post('/elections/:id/pause', requireAnyRoles(['developer', 'meeting_election_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;

    const result = await query(
      `UPDATE elections.elections
       SET status = 'paused', updated_at = NOW()
       WHERE id = $1 AND status = 'published'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election not found or not in published status',
        correlation_id: req.correlationId
      });
    }

    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Election paused',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      title: result.rows[0].title,
      timestamp: new Date().toISOString()
    }));

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Pause election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to pause election',
      correlation_id: req.correlationId
    });
  }
});

/**
 * POST /api/admin/elections/:id/resume
 * Resume election (paused → published)
 * Role: developer, meeting_election_manager
 * Issue: #75
 */
router.post('/elections/:id/resume', requireAnyRoles(['developer', 'meeting_election_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;

    const result = await query(
      `UPDATE elections.elections
       SET status = 'published', updated_at = NOW()
       WHERE id = $1 AND status = 'paused'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election not found or not in paused status',
        correlation_id: req.correlationId
      });
    }

    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Election resumed',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      title: result.rows[0].title,
      timestamp: new Date().toISOString()
    }));

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Resume election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to resume election',
      correlation_id: req.correlationId
    });
  }
});

/**
 * POST /api/admin/elections/:id/archive
 * Archive election (closed → archived)
 * Role: developer, meeting_election_manager
 * Issue: #76
 */
router.post('/elections/:id/archive', requireAnyRoles(['developer', 'meeting_election_manager']), async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;

    const result = await query(
      `UPDATE elections.elections
       SET status = 'archived', archived_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'closed'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election not found or not in closed status',
        correlation_id: req.correlationId
      });
    }

    console.log(JSON.stringify({
      level: 'info',
      message: 'Election archived',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      title: result.rows[0].title,
      timestamp: new Date().toISOString()
    }));

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('[Admin] Archive election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to archive election',
      correlation_id: req.correlationId
    });
  }
});

/**
 * DELETE /api/admin/elections/:id
 * Soft delete draft election
 * Role: developer only (destructive operation)
 * Issue: #77
 */
router.delete('/elections/:id', requireRole('developer'), async (req, res) => {
  try {
    const { id } = req.params;
    const uid = req.user?.uid;

    const result = await query(
      `UPDATE elections.elections
       SET status = 'deleted', deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election not found or not in draft status (only drafts can be deleted)',
        correlation_id: req.correlationId
      });
    }

    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Draft election deleted',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      title: result.rows[0].title,
      timestamp: new Date().toISOString()
    }));

    return res.json({
      message: 'Election draft deleted successfully',
      election: result.rows[0]
    });
  } catch (error) {
    console.error('[Admin] Delete election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete election',
      correlation_id: req.correlationId
    });
  }
});

module.exports = router;
