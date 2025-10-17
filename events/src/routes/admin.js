const express = require('express');
const { pool, query } = require('../config/database');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

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

// Developer-only admin router
const router = express.Router();

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
 * Auth: Firebase ID token (authenticate middleware)
 * Guards: ADMIN_RESET_ENABLED=true and uid in ALLOWED_RESET_UIDS
 */
router.post('/reset-election', authenticate, requireRole('developer'), async (req, res) => {
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

module.exports = router;
