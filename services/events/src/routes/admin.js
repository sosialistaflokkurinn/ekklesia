const express = require('express');
const crypto = require('crypto');
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

// 2. Extract client IP address for audit logging
router.use((req, res, next) => {
  req.clientIp = req.ip ||
                 req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                 req.headers['x-real-ip'] ||
                 req.connection.remoteAddress ||
                 req.socket.remoteAddress ||
                 null;
  next();
});

// 3. Require authentication for all admin endpoints
router.use(authenticate);

// 4. Require at least one admin role (fail-secure default)
router.use(requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager']));

/**
 * Helper: Write audit log entry to database
 * @param {Object} client - PostgreSQL client (for transaction support)
 * @param {Object} data - Audit log data
 */
async function writeAuditLog(client, { actionType, performedBy, electionId, electionTitle, details, ipAddress, correlationId }) {
  try {
    await client.query(
      `INSERT INTO elections.admin_audit_log
       (action_type, performed_by, election_id, election_title, details, ip_address, correlation_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        actionType,
        performedBy,
        electionId,
        electionTitle,
        details ? JSON.stringify(details) : null,
        ipAddress,
        correlationId
      ]
    );
  } catch (err) {
    console.error('[Admin] Audit logging error:', err);
    // Don't throw - logging errors shouldn't fail the operation
  }
}

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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { title, description, question, answers } = req.body;
    const uid = req.user?.uid;

    // Validation
    if (!title || !question || !Array.isArray(answers) || answers.length < 2) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: title, question, answers (min 2)',
        correlation_id: req.correlationId
      });
    }

    const result = await client.query(
      `INSERT INTO elections.elections (title, description, question, answers, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, NOW(), NOW())
       RETURNING *`,
      [title, description || '', question, JSON.stringify(answers), uid]
    );

    // Write audit log
    await writeAuditLog(client, {
      actionType: 'create_election',
      performedBy: uid,
      electionId: result.rows[0].id,
      electionTitle: title,
      details: { title, question, answer_count: answers.length },
      ipAddress: req.clientIp,
      correlationId: req.correlationId
    });

    await client.query('COMMIT');

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
    await client.query('ROLLBACK');
    console.error('[Admin] Create election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create election',
      correlation_id: req.correlationId
    });
  } finally {
    client.release();
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const uid = req.user?.uid;

    const result = await client.query(
      `UPDATE elections.elections
       SET status = 'published', published_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election not found or not in draft status',
        correlation_id: req.correlationId
      });
    }

    // Write audit log
    await writeAuditLog(client, {
      actionType: 'publish_election',
      performedBy: uid,
      electionId: id,
      electionTitle: result.rows[0].title,
      details: { previous_status: 'draft', new_status: 'published' },
      ipAddress: req.clientIp,
      correlationId: req.correlationId
    });

    await client.query('COMMIT');

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
    await client.query('ROLLBACK');
    console.error('[Admin] Publish election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to publish election',
      correlation_id: req.correlationId
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/admin/elections/:id/close
 * Close election (published/open → closed)
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
       WHERE id = $1 AND status IN ('published', 'open', 'paused')
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Election not found or not in published/open/paused status',
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

// ============================================================================
// Election Statistics & Query Endpoints (Issues #88-#92)
// ============================================================================

/**
 * POST /api/admin/elections/:id/open
 * Open voting (published → open, generate voting tokens)
 * Role: developer, meeting_election_manager
 * Issue: #88
 *
 * Actions:
 * 1. Transition election from published to open status
 * 2. Generate voting tokens for all eligible members
 * 3. Record token generation timestamp
 * 4. Log audit event
 */
router.post('/elections/:id/open', requireAnyRoles(['developer', 'meeting_election_manager']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const uid = req.user?.uid;

    // Step 1: Verify election exists and is in published status
    const electionResult = await client.query(
      'SELECT id, status, title FROM elections.elections WHERE id = $1',
      [id]
    );

    if (electionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
        correlation_id: req.correlationId
      });
    }

    const election = electionResult.rows[0];
    if (election.status !== 'published') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Bad Request',
        message: `Election must be in published status to open voting. Current status: ${election.status}`,
        correlation_id: req.correlationId
      });
    }

    // Step 2: Get token count from request
    const tokenCount = parseInt(req.body?.member_count || '0');

    if (isNaN(tokenCount) || tokenCount < 1 || tokenCount > 10000) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'member_count must be a number between 1 and 10000',
        correlation_id: req.correlationId
      });
    }

    // Step 3: Transition election to open status
    const updatedElection = await client.query(
      `UPDATE elections.elections
       SET status = 'open', voting_start_time = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // Step 4: Generate voting tokens
    // Generate requested number of tokens without member lookup (Epic #43 integration later)
    const generatedTokens = [];

    for (let i = 0; i < tokenCount; i++) {
      const tokenBytes = crypto.randomBytes(32);
      const token = tokenBytes.toString('base64url'); // Convert to URL-safe base64
      const tokenHash = crypto.createHash('sha256').update(tokenBytes).digest('hex');

      // Store token hash in database
      await client.query(
        `INSERT INTO elections.voting_tokens (election_id, token_hash, issued_at, expires_at, used)
         VALUES ($1, $2, NOW(), NOW() + INTERVAL '24 hours', false)`,
        [id, tokenHash]
      );

      // Store plaintext token for response
      generatedTokens.push({
        token: token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // Step 5: Write audit log
    await writeAuditLog(client, {
      actionType: 'open_election',
      performedBy: uid,
      electionId: id,
      electionTitle: election.title,
      details: { tokens_generated: tokenCount, member_count: tokenCount },
      ipAddress: req.clientIp,
      correlationId: req.correlationId
    });

    await client.query('COMMIT');

    console.warn(JSON.stringify({
      level: 'warn',
      message: 'Election opened for voting',
      correlation_id: req.correlationId,
      performed_by: uid,
      election_id: id,
      election_title: election.title,
      tokens_generated: tokenCount,
      timestamp: new Date().toISOString()
    }));

    return res.json({
      message: 'Election opened for voting',
      election: updatedElection.rows[0],
      tokens_generated: tokenCount,
      tokens: generatedTokens  // Return plaintext tokens
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Admin] Open election error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to open election for voting',
      correlation_id: req.correlationId
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/admin/elections/:id/status
 * Get election current status and statistics
 * Role: developer, meeting_election_manager, event_manager
 * Issue: #89
 *
 * Returns:
 * - Election metadata
 * - Current status
 * - Voting period info
 * - Member counts (eligible, voted, not voted)
 * - Token generation time
 * - Last updated timestamp
 */
router.get('/elections/:id/status', requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager']), async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch election with token stats
    const result = await query(
      `SELECT
        e.id,
        e.title,
        e.description,
        e.status,
        e.created_at,
        e.updated_at,
        e.voting_start_time,
        e.voting_end_time,
        e.published_at,
        e.closed_at,
        (SELECT COUNT(*) FROM elections.voting_tokens WHERE election_id = e.id) as total_tokens,
        (SELECT COUNT(*) FROM elections.voting_tokens WHERE election_id = e.id AND used = true) as tokens_used,
        (SELECT COUNT(*) FROM elections.voting_tokens WHERE election_id = e.id AND used = false) as tokens_unused
       FROM elections.elections e
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
        correlation_id: req.correlationId
      });
    }

    const election = result.rows[0];

    console.log(JSON.stringify({
      level: 'info',
      message: 'Election status queried',
      correlation_id: req.correlationId,
      performed_by: req.user?.uid,
      election_id: id,
      status: election.status,
      timestamp: new Date().toISOString()
    }));

    return res.json({
      election: {
        id: election.id,
        title: election.title,
        description: election.description,
        status: election.status,
        created_at: election.created_at,
        updated_at: election.updated_at,
        voting_period: {
          start: election.voting_start_time,
          end: election.voting_end_time,
          published_at: election.published_at,
          closed_at: election.closed_at
        }
      },
      token_statistics: {
        total: parseInt(election.total_tokens) || 0,
        used: parseInt(election.tokens_used) || 0,
        unused: parseInt(election.tokens_unused) || 0,
        participation_rate: election.total_tokens > 0
          ? ((parseInt(election.tokens_used) / parseInt(election.total_tokens)) * 100).toFixed(2) + '%'
          : 'N/A'
      }
    });
  } catch (error) {
    console.error('[Admin] Election status error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch election status',
      correlation_id: req.correlationId
    });
  }
});

/**
 * GET /api/admin/elections/:id/results
 * Get election results and vote distribution
 * Role: developer, meeting_election_manager, event_manager
 * Issue: #90
 *
 * Returns:
 * - Question text
 * - Vote counts by answer
 * - Percentage breakdown
 * - Total votes cast
 * - Eligible voters
 * - Participation rate
 */
router.get('/elections/:id/results', requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager']), async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch election details
    const electionResult = await query(
      `SELECT id, title, question, answers, status FROM elections.elections WHERE id = $1`,
      [id]
    );

    if (electionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
        correlation_id: req.correlationId
      });
    }

    const election = electionResult.rows[0];
    const answers = JSON.parse(election.answers || '[]');

    // Fetch vote counts from Elections service (ballots table)
    const resultsResult = await query(
      `SELECT answer, COUNT(*) as vote_count
       FROM elections.ballots
       WHERE election_id = $1
       GROUP BY answer
       ORDER BY vote_count DESC`,
      [id]
    );

    const votesByAnswer = {};
    let totalVotes = 0;

    // Initialize all answers with 0
    answers.forEach(answer => {
      votesByAnswer[answer] = 0;
    });

    // Populate actual vote counts
    resultsResult.rows.forEach(row => {
      votesByAnswer[row.answer] = parseInt(row.vote_count);
      totalVotes += parseInt(row.vote_count);
    });

    // Calculate participation rate
    const tokenResult = await query(
      `SELECT COUNT(*) as total FROM elections.voting_tokens WHERE election_id = $1`,
      [id]
    );
    const eligibleVoters = parseInt(tokenResult.rows[0].total) || 0;
    const participationRate = eligibleVoters > 0 ? ((totalVotes / eligibleVoters) * 100).toFixed(2) : 0;

    console.log(JSON.stringify({
      level: 'info',
      message: 'Election results queried',
      correlation_id: req.correlationId,
      performed_by: req.user?.uid,
      election_id: id,
      total_votes: totalVotes,
      timestamp: new Date().toISOString()
    }));

    return res.json({
      election: {
        id: election.id,
        title: election.title,
        question: election.question,
        status: election.status
      },
      results: {
        total_votes: totalVotes,
        eligible_voters: eligibleVoters,
        participation_rate: `${participationRate}%`,
        answers: answers.map(answer => ({
          text: answer,
          votes: votesByAnswer[answer],
          percentage: totalVotes > 0 ? ((votesByAnswer[answer] / totalVotes) * 100).toFixed(2) + '%' : '0%'
        }))
      }
    });
  } catch (error) {
    console.error('[Admin] Election results error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch election results',
      correlation_id: req.correlationId
    });
  }
});

/**
 * GET /api/admin/elections/:id/tokens
 * Get voting token distribution statistics
 * Role: developer, meeting_election_manager, event_manager
 * Issue: #91
 *
 * Returns:
 * - Total tokens generated
 * - Tokens used (ballots cast)
 * - Tokens unused
 * - Tokens expired
 * - Distribution timeline
 */
router.get('/elections/:id/tokens', requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager']), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify election exists
    const electionResult = await query(
      'SELECT id, title, status FROM elections.elections WHERE id = $1',
      [id]
    );

    if (electionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
        correlation_id: req.correlationId
      });
    }

    const election = electionResult.rows[0];

    // Fetch token statistics
    const tokenStats = await query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN used = true THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN used = false THEN 1 ELSE 0 END) as unused,
        SUM(CASE WHEN expires_at < NOW() THEN 1 ELSE 0 END) as expired,
        MIN(issued_at) as first_issued,
        MAX(issued_at) as last_issued,
        AVG(EXTRACT(EPOCH FROM (expires_at - issued_at))) as avg_expiration_seconds
       FROM elections.voting_tokens
       WHERE election_id = $1`,
      [id]
    );

    const stats = tokenStats.rows[0];

    console.log(JSON.stringify({
      level: 'info',
      message: 'Token distribution queried',
      correlation_id: req.correlationId,
      performed_by: req.user?.uid,
      election_id: id,
      total_tokens: parseInt(stats.total) || 0,
      timestamp: new Date().toISOString()
    }));

    return res.json({
      election: {
        id: election.id,
        title: election.title,
        status: election.status
      },
      token_distribution: {
        total: parseInt(stats.total) || 0,
        used: parseInt(stats.used) || 0,
        unused: parseInt(stats.unused) || 0,
        expired: parseInt(stats.expired) || 0,
        usage_rate: stats.total > 0 ? ((parseInt(stats.used) / parseInt(stats.total)) * 100).toFixed(2) + '%' : '0%'
      },
      token_timeline: {
        first_issued: stats.first_issued,
        last_issued: stats.last_issued,
        avg_expiration_hours: stats.avg_expiration_seconds ? (parseInt(stats.avg_expiration_seconds) / 3600).toFixed(2) : 'N/A'
      }
    });
  } catch (error) {
    console.error('[Admin] Token distribution error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch token distribution',
      correlation_id: req.correlationId
    });
  }
});

module.exports = router;
