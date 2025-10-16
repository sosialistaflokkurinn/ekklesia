const express = require('express');
const { pool, query } = require('../config/database');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

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
      } else if (scope === 'all') {
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

      await client.query('COMMIT');

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
