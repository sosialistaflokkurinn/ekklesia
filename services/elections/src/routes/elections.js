const express = require('express');
const crypto = require('crypto');
const pool = require('../config/database');
const authenticateS2S = require('../middleware/s2sAuth');
const { verifyAppCheckOptional } = require('../middleware/appCheck');
const { logAudit } = require('../services/auditService');
const logger = require('../utils/logger');

const router = express.Router();

// =====================================================
// S2S Endpoint: Register Voting Token
// =====================================================
// Called by Events service when member requests token
// POST /api/s2s/register-token
// Body: { token_hash: string }
// Headers: X-API-Key: <shared-secret>

router.post('/s2s/register-token', authenticateS2S, async (req, res) => {
  const startTime = Date.now();
  const correlation_id = crypto.randomUUID(); // Random ID for request tracing (no PII)
  const { token_hash } = req.body;

  // Validate input
  if (!token_hash) {
    logAudit('register_token', false, { error: 'Missing token_hash', correlation_id });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Missing token_hash in request body'
    });
  }

  // Validate token hash format (SHA-256 = 64 hex chars)
  if (!/^[a-f0-9]{64}$/.test(token_hash)) {
    logAudit('register_token', false, { error: 'Invalid token_hash format', correlation_id });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid token_hash format (must be 64 hex characters)'
    });
  }

  try {
    // Insert token (duplicate will fail due to PRIMARY KEY constraint)
    await pool.query(
      'INSERT INTO voting_tokens (token_hash) VALUES ($1)',
      [token_hash]
    );

    const duration = Date.now() - startTime;
    logAudit('register_token', true, { correlation_id, duration_ms: duration });

    res.status(201).json({
      success: true,
      token_hash,
      message: 'Token registered successfully'
    });

  } catch (error) {
    const duration = Date.now() - startTime;

    // Check if duplicate token
    if (error.code === '23505') { // PostgreSQL unique violation
      logAudit('register_token', false, { error: 'Token already registered', correlation_id, duration_ms: duration });
      return res.status(409).json({
        error: 'Conflict',
        message: 'Token already registered'
      });
    }

    logger.error('Register token failed', {
      operation: 's2s_register_token',
      error: error.message,
      stack: error.stack,
      correlation_id,
      duration_ms: duration
    });
    logAudit('register_token', false, { error: error.message, correlation_id, duration_ms: duration });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to register token'
    });
  }
});

// =====================================================
// S2S Endpoint: Get Results
// =====================================================
// Called by Events service to fetch election results
// GET /api/s2s/results
// Headers: X-API-Key: <shared-secret>

router.get('/s2s/results', authenticateS2S, async (req, res) => {
  const startTime = Date.now();

  try {
    // Count ballots by answer
    const result = await pool.query(`
      SELECT
        answer,
        COUNT(*) as count
      FROM ballots
      GROUP BY answer
      ORDER BY answer
    `);

    // Build results object
    const results = {
      yes: 0,
      no: 0,
      abstain: 0
    };

    result.rows.forEach(row => {
      results[row.answer] = parseInt(row.count, 10);
    });

    const totalBallots = results.yes + results.no + results.abstain;
    const duration = Date.now() - startTime;
    logAudit('fetch_results', true, { total_ballots: totalBallots, duration_ms: duration });

    res.json({
      total_ballots: totalBallots,
      results,
      election_title: process.env.ELECTION_TITLE || 'Prófunarkosning 2025'
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Fetch results failed', {
      operation: 's2s_fetch_results',
      error: error.message,
      stack: error.stack,
      duration_ms: duration
    });
    logAudit('fetch_results', false, { error: error.message, duration_ms: duration });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch results'
    });
  }
});

// =====================================================
// Public Endpoint: Submit Ballot
// =====================================================
// POST /api/vote
// Headers: Authorization: Bearer <token-from-events>
//         X-Firebase-AppCheck: <app-check-token> (optional, monitored)
// Body: { answer: 'yes' | 'no' | 'abstain' }
//
// Security: Firebase App Check verification (monitor-only mode)
// After 1-2 days of monitoring, switch to verifyAppCheck for enforcement

router.post('/vote', verifyAppCheckOptional, async (req, res) => {
  const startTime = Date.now();
  const correlation_id = crypto.randomUUID(); // Random ID for request tracing (no PII)

  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logAudit('record_ballot', false, { error: 'Missing authorization token', correlation_id });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header'
    });
  }

  const token = authHeader.split('Bearer ')[1];
  const { answer } = req.body;

  // Validate answer
  if (!answer || !['yes', 'no', 'abstain'].includes(answer)) {
    logAudit('record_ballot', false, { error: 'Invalid answer', answer, correlation_id });
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid answer. Must be yes, no, or abstain'
    });
  }

  // Hash token (SHA-256)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Database transaction (atomic ballot submission)
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check token exists and not used (with row lock for concurrent votes)
    const tokenResult = await client.query(
      'SELECT used FROM voting_tokens WHERE token_hash = $1 FOR UPDATE NOWAIT',
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      const duration = Date.now() - startTime;
      logAudit('record_ballot', false, { error: 'Token not registered', correlation_id, duration_ms: duration });
      return res.status(404).json({
        error: 'Not Found',
        message: 'Token not registered'
      });
    }

    if (tokenResult.rows[0].used) {
      await client.query('ROLLBACK');
      const duration = Date.now() - startTime;
      logAudit('record_ballot', false, { error: 'Token already used', correlation_id, duration_ms: duration });
      return res.status(409).json({
        error: 'Conflict',
        message: 'Token already used'
      });
    }

    // Insert ballot (timestamp rounded to nearest minute for anonymity)
    const ballotResult = await client.query(`
      INSERT INTO ballots (token_hash, answer, submitted_at)
      VALUES ($1, $2, date_trunc('minute', NOW()))
      RETURNING id
    `, [tokenHash, answer]);

    const ballotId = ballotResult.rows[0].id;

    // Mark token as used
    await client.query(
      'UPDATE voting_tokens SET used = TRUE, used_at = NOW() WHERE token_hash = $1',
      [tokenHash]
    );

    await client.query('COMMIT');

    const duration = Date.now() - startTime;
    logAudit('record_ballot', true, { answer, correlation_id, duration_ms: duration });

    res.status(201).json({
      success: true,
      ballot_id: ballotId,
      message: 'Vote recorded successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    const duration = Date.now() - startTime;

    // Check if lock timeout (FOR UPDATE NOWAIT failed)
    if (error.code === '55P03') { // Lock not available
      logger.warn('Lock contention detected on vote', {
        operation: 'record_ballot',
        errorCode: '55P03',
        correlation_id,
        duration_ms: duration
      });
      logAudit('record_ballot', false, { error: 'Lock contention', correlation_id, duration_ms: duration });
      return res.status(503).json({
        error: 'Service Temporarily Unavailable',
        message: 'Please retry in a moment',
        retryAfter: 1  // seconds
      });
    }

    logger.error('Ballot submission failed', {
      operation: 'record_ballot',
      error: error.message,
      stack: error.stack,
      correlation_id,
      duration_ms: duration
    });
    logAudit('record_ballot', false, { error: error.message, correlation_id, duration_ms: duration });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to record vote'
    });

  } finally {
    client.release();
  }
});

// =====================================================
// Public Endpoint: Check Token Status
// =====================================================
// GET /api/token-status
// Headers: Authorization: Bearer <token-from-events>
//         X-Firebase-AppCheck: <app-check-token> (optional, monitored)
//
// Security: Firebase App Check verification (monitor-only mode)

router.get('/token-status', verifyAppCheckOptional, async (req, res) => {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header'
    });
  }

  const token = authHeader.split('Bearer ')[1];

  // Hash token
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    // Check token exists
    const result = await pool.query(
      'SELECT used, registered_at FROM voting_tokens WHERE token_hash = $1',
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Token not registered'
      });
    }

    const tokenData = result.rows[0];

    res.json({
      valid: true,
      used: tokenData.used,
      registered_at: tokenData.registered_at,
      election_title: process.env.ELECTION_TITLE || 'Prófunarkosning 2025',
      election_question: process.env.ELECTION_QUESTION || 'Do you support this proposal?'
    });

  } catch (error) {
    logger.error('Token status check failed', {
      operation: 'token_status',
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to check token status'
    });
  }
});

module.exports = router;
