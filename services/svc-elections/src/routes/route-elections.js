const express = require('express');
const crypto = require('crypto');
const pool = require('../config/config-database');
const authenticateS2S = require('../middleware/middleware-s2s-auth');
const { verifyAppCheck } = require('../middleware/middleware-app-check');
const { logAudit } = require('../services/service-audit');
const logger = require('../utils/util-logger');
const { hashUidForLogging } = require('../utils/util-hash-uid');
const {
  verifyMemberToken,
  hasVoted,
  filterElectionsByEligibility,
  validateVotingWindow,
  validateAnswers,
  validateRankedAnswers,
  isEligible,
} = require('../middleware/middleware-member-auth');
const { readLimiter, voteLimiter, writeLimiter } = require('../middleware/middleware-rate-limiter');

const router = express.Router();

// =====================================================
// MEMBER-FACING ENDPOINTS
// =====================================================
// These endpoints are for authenticated members to:
// - List elections they can vote in
// - View election details
// - Submit votes
// - View results
//
// Based on: Issue #248 - Member-Facing Elections API
// Auth: Firebase ID tokens (verifyMemberToken middleware)

// =====================================================
// GET /api/elections - List Elections for Member
// =====================================================
router.get('/elections', readLimiter, verifyMemberToken, async (req, res) => {
  const startTime = Date.now();
  const {
    status,
    limit = 50,
    offset = 0,
  } = req.query;

  try {
    // Build WHERE clause for filtering
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Only show published, not hidden elections
    conditions.push(`status != 'draft'`);
    conditions.push(`hidden = FALSE`);

    // Filter by status if provided
    if (status && ['published', 'closed', 'paused', 'archived'].includes(status)) {
      conditions.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Validate and sanitize pagination
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const offsetNum = Math.max(parseInt(offset, 10) || 0, 0);

    // Query elections with computed fields for frontend compatibility
    const query = `
      SELECT
        e.id,
        e.title,
        e.description,
        e.question,
        e.answers,
        e.status,
        e.voting_type,
        e.max_selections,
        e.seats_to_fill,
        e.eligibility,
        e.scheduled_start,
        e.scheduled_end,
        -- Aliases for frontend compatibility
        e.scheduled_start as voting_starts_at,
        e.scheduled_end as voting_ends_at,
        e.published_at as opened_at,
        -- Computed duration in minutes
        CASE
          WHEN e.scheduled_start IS NOT NULL AND e.scheduled_end IS NOT NULL
          THEN EXTRACT(EPOCH FROM (e.scheduled_end - e.scheduled_start)) / 60
          ELSE NULL
        END as duration_minutes,
        e.created_at,
        e.published_at,
        e.closed_at,
        (
          SELECT elections.check_member_voted_v2(e.id, $${paramIndex})
        ) as has_voted
      FROM elections.elections e
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    params.push(req.user.uid, limitNum, offsetNum);

    const result = await pool.query(query, params);

    // Filter by eligibility
    const filteredElections = filterElectionsByEligibility(result.rows, req);

    // Count total (for pagination)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM elections.elections e
      ${whereClause}
    `;
    const countResult = await pool.query(
      countQuery,
      params.slice(0, params.length - 3) // Exclude uid, limit, offset
    );

    const total = parseInt(countResult.rows[0].total, 10);
    const duration = Date.now() - startTime;

    (req.logger || logger).info('[Member API] List elections', {
      uid_hash: hashUidForLogging(req.user.uid),
      count: filteredElections.length,
      total,
      duration_ms: duration,
    });

    res.json({
      elections: filteredElections,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        has_more: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    (req.logger || logger).error('[Member API] List elections error:', { error: error.message, stack: error.stack });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list elections',
    });
  }
});

// =====================================================
// GET /api/elections/:id - Get Election Details
// =====================================================
router.get('/elections/:id', readLimiter, verifyMemberToken, async (req, res) => {
  const { id } = req.params;

  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid election ID format',
    });
  }

  try {
    // Query election with computed fields for frontend compatibility
    const result = await pool.query(
      `SELECT
        e.id,
        e.title,
        e.description,
        e.question,
        e.answers,
        e.status,
        e.voting_type,
        e.max_selections,
        e.seats_to_fill,
        e.eligibility,
        e.scheduled_start,
        e.scheduled_end,
        -- Aliases for frontend compatibility
        e.scheduled_start as voting_starts_at,
        e.scheduled_end as voting_ends_at,
        e.published_at as opened_at,
        -- Computed duration in minutes
        CASE
          WHEN e.scheduled_start IS NOT NULL AND e.scheduled_end IS NOT NULL
          THEN EXTRACT(EPOCH FROM (e.scheduled_end - e.scheduled_start)) / 60
          ELSE NULL
        END as duration_minutes,
        e.created_at,
        e.published_at,
        e.closed_at,
        e.hidden,
        (
          SELECT elections.check_member_voted_v2(e.id, $2)
        ) as has_voted
      FROM elections.elections e
      WHERE e.id = $1`,
      [id, req.user.uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const election = result.rows[0];

    // Check if draft or hidden
    if (election.status === 'draft' || election.hidden) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    // Check eligibility
    if (!isEligible(election, req)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not eligible to view this election',
      });
    }

    (req.logger || logger).info('[Member API] Get election details', {
      uid_hash: hashUidForLogging(req.user.uid),
      election_id: id,
    });

    res.json({ election });
  } catch (error) {
    (req.logger || logger).error('[Member API] Get election error:', { error: error.message, stack: error.stack });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get election',
    });
  }
});

// =====================================================
// POST /api/elections/:id/vote - Submit Vote
// =====================================================
// Supports three voting types:
// - single-choice: { answer_ids: ["id"] } - exactly 1 selection
// - multi-choice: { answer_ids: ["id1", "id2"] } - up to max_selections
// - ranked-choice (STV): { ranked_answers: ["id1", "id2", "id3"] } - ordered preferences
router.post('/elections/:id/vote', voteLimiter, verifyMemberToken, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { answer_ids, ranked_answers } = req.body || {};

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Lock election row for reading
    const electionResult = await client.query(
      `SELECT
        e.id,
        e.title,
        e.question,
        e.answers,
        e.status,
        e.voting_type,
        e.max_selections,
        e.seats_to_fill,
        e.eligibility,
        e.scheduled_start,
        e.scheduled_end,
        e.hidden
      FROM elections.elections e
      WHERE e.id = $1
      FOR UPDATE`,
      [id]
    );

    if (electionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const election = electionResult.rows[0];

    // Check if draft or hidden
    if (election.status === 'draft' || election.hidden) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    // Check eligibility
    if (!isEligible(election, req)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not eligible to vote in this election',
      });
    }

    // Check voting window
    const windowCheck = validateVotingWindow(election);
    if (!windowCheck.valid) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Forbidden',
        message: windowCheck.error,
      });
    }

    // Validate based on voting type
    const isRankedChoice = election.voting_type === 'ranked-choice';

    if (isRankedChoice) {
      // Ranked-choice (STV) validation
      if (!ranked_answers) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Forgangsröðun (ranked_answers) vantar í beiðni',
        });
      }
      const rankCheck = validateRankedAnswers(ranked_answers, election);
      if (!rankCheck.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Bad Request',
          message: rankCheck.error,
        });
      }
    } else {
      // Single-choice or multi-choice validation
      const answerCheck = validateAnswers(answer_ids, election);
      if (!answerCheck.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Bad Request',
          message: answerCheck.error,
        });
      }
    }

    // Check if already voted (using SECURITY DEFINER function)
    const voteCheckResult = await client.query(
      'SELECT elections.check_member_voted_v2($1, $2) as has_voted',
      [id, req.user.uid]
    );

    if (voteCheckResult.rows[0].has_voted) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Conflict',
        message: 'You have already voted in this election',
      });
    }

    // Insert ballots based on voting type
    // Note: token_hash uses sentinel value for Firebase-authenticated votes
    // Sentinel token: 64 zeros (exists in voting_tokens table)
    const MEMBER_VOTE_TOKEN = '0000000000000000000000000000000000000000000000000000000000000000';
    const ballotIds = [];

    if (isRankedChoice) {
      // Ranked-choice (STV): Insert single ballot with ranked_answers JSONB
      const ballotResult = await client.query(
        `INSERT INTO elections.ballots (election_id, member_uid, ranked_answers, token_hash, submitted_at)
         VALUES ($1, $2, $3, $4, date_trunc('minute', NOW()))
         RETURNING id`,
        [id, req.user.uid, JSON.stringify(ranked_answers), MEMBER_VOTE_TOKEN]
      );
      ballotIds.push(ballotResult.rows[0].id);
    } else {
      // Single-choice or multi-choice: Insert one ballot per selected answer
      for (const answerId of answer_ids) {
        // Find answer text from election.answers array
        let answerText = answerId;
        const answerObj = election.answers.find(a => {
          if (typeof a === 'string') return a === answerId;
          return (a.id || a.answer_text || a.text) === answerId;
        });

        if (answerObj && typeof answerObj === 'object') {
          answerText = answerObj.text || answerObj.answer_text || answerId;
        }

        const ballotResult = await client.query(
          `INSERT INTO elections.ballots (election_id, member_uid, answer_id, answer, token_hash, submitted_at)
           VALUES ($1, $2, $3, $4, $5, date_trunc('minute', NOW()))
           RETURNING id`,
          [id, req.user.uid, answerId, answerText, MEMBER_VOTE_TOKEN]
        );

        ballotIds.push(ballotResult.rows[0].id);
      }
    }

    await client.query('COMMIT');

    const duration = Date.now() - startTime;
    const voteCount = isRankedChoice ? ranked_answers.length : answer_ids.length;

    (req.logger || logger).info('[Member API] Vote submitted', {
      uid_hash: hashUidForLogging(req.user.uid),
      election_id: id,
      election_title: election.title,
      answer_count: voteCount,
      ballot_ids: ballotIds,
      voting_type: election.voting_type,
      duration_ms: duration,
    });

    logAudit('submit_vote', true, {
      uid_hash: hashUidForLogging(req.user.uid),
      election_id: id,
      answer_count: voteCount,
      ballot_ids: ballotIds,
      duration_ms: duration,
    });

    res.status(201).json({
      success: true,
      ballot_ids: ballotIds,
      message: isRankedChoice ? 'Forgangsröðun skráð' : 'Vote recorded successfully',
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    const duration = Date.now() - startTime;

    // Enhanced error logging for debugging (req.logger includes correlationId)
    (req.logger || logger).error('[Member API] Vote submission error:', {
      error: error.message,
      stack: error.stack,
      election_id: id,
      uid: req.user?.uid,
      answer_ids,
      ranked_answers,
    });

    logAudit('submit_vote', false, {
      uid: req.user?.uid,
      election_id: id,
      error: error.message,
      stack: error.stack.split('\n')[0], // First line of stack trace
      duration_ms: duration,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to record vote',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// =====================================================
// GET /api/elections/:id/results - Get Election Results
// =====================================================
// Returns results for closed elections
// For ranked-choice (STV): Uses STV algorithm to calculate winners
router.get('/elections/:id/results', readLimiter, verifyMemberToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Get election info
    const electionResult = await pool.query(
      `SELECT
        e.id,
        e.title,
        e.question,
        e.answers,
        e.status,
        e.voting_type,
        e.seats_to_fill,
        e.ranked_method,
        e.quota_type,
        e.closed_at,
        e.scheduled_end,
        e.hidden,
        e.eligibility
      FROM elections.elections e
      WHERE e.id = $1`,
      [id]
    );

    if (electionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const election = electionResult.rows[0];

    // Check if draft or hidden
    if (election.status === 'draft' || election.hidden) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    // Check eligibility
    if (!isEligible(election, req)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You are not eligible to view this election',
      });
    }

    // Dynamically check if election is closed based on timestamps
    const now = new Date();
    const closedAt = election.closed_at ? new Date(election.closed_at) : null;
    const scheduledEnd = election.scheduled_end ? new Date(election.scheduled_end) : null;

    const isDynamicallyClosed = (election.status === 'closed' || election.status === 'archived') || // Already explicitly closed
                               (scheduledEnd && now > scheduledEnd) ||                             // Past scheduled end
                               (closedAt && now > closedAt);                                       // Past explicit closed_at

    if (!isDynamicallyClosed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Results are only available for closed elections',
      });
    }

    // Check if ranked-choice (STV)
    const isRankedChoice = election.voting_type === 'ranked-choice';

    if (isRankedChoice) {
      // STV Results calculation
      const stvResults = await calculateSTVResults(id, election, req.logger || logger);

      (req.logger || logger).info('[Member API] Get STV results', {
        uid_hash: hashUidForLogging(req.user.uid),
        election_id: id,
        total_ballots: stvResults.total_ballots,
        winners_count: stvResults.winners.length,
      });

      return res.json({
        election_id: id,
        title: election.title,
        question: election.question,
        status: election.status,
        voting_type: 'ranked-choice',
        seats_to_fill: election.seats_to_fill,
        ...stvResults,
      });
    }

    // Standard results for single-choice / multi-choice
    const resultsData = await pool.query(
      'SELECT * FROM get_election_results($1)',
      [id]
    );

    // Calculate total votes
    const totalVotes = resultsData.rows.reduce((sum, row) => sum + parseInt(row.votes, 10), 0);

    // Parse answers JSON
    const answers = election.answers;

    // Build results array with answer text
    const results = resultsData.rows.map(row => {
      const answer = answers.find(a => a.id === row.answer_id);
      return {
        answer_id: row.answer_id,
        text: answer ? answer.text : row.answer_id,
        votes: parseInt(row.votes, 10),
        percentage: parseFloat(row.percentage),
      };
    });

    // Find winner (most votes)
    const winner = results.length > 0
      ? results.reduce((max, current) => (current.votes > max.votes ? current : max))
      : null;

    (req.logger || logger).info('[Member API] Get results', {
      uid_hash: hashUidForLogging(req.user.uid),
      election_id: id,
      total_votes: totalVotes,
    });

    res.json({
      election_id: id,
      title: election.title,
      question: election.question,
      status: election.status,
      voting_type: election.voting_type || 'single-choice',
      total_votes: totalVotes,
      results,
      winner: winner && winner.votes > 0 ? winner : null,
    });
  } catch (error) {
    (req.logger || logger).error('[Member API] Get results error:', { error: error.message, stack: error.stack });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get results',
    });
  }
});

// =====================================================
// STV Results Calculation Helper
// =====================================================
// Supports both full STV and simple ranking
// ranked_method: 'stv' (vote transfers) or 'simple' (first preference only)
// quota_type: 'droop', 'hare', or 'none'
async function calculateSTVResults(electionId, election, log) {
  // Import local STV utility
  const { stv } = require('../utils/util-stv');

  // Get configuration (with defaults for backwards compatibility)
  const rankedMethod = election.ranked_method || 'stv';
  const quotaType = election.quota_type || 'droop';
  const seatsToFill = election.seats_to_fill || 1;

  // Get candidate IDs from election answers
  const candidates = election.answers.map(a => a.id || a.text);
  const candidateMap = new Map(election.answers.map(a => [a.id || a.text, a.text || a.id]));

  // Get ranked ballots from database
  const ballotsResult = await pool.query(
    `SELECT ranked_answers
     FROM elections.ballots
     WHERE election_id = $1 AND ranked_answers IS NOT NULL`,
    [electionId]
  );

  const totalBallots = ballotsResult.rows.length;

  // If no ballots, return empty results
  if (totalBallots === 0) {
    return {
      total_ballots: 0,
      seats_to_fill: seatsToFill,
      ranked_method: rankedMethod,
      quota_type: quotaType,
      quota: null,
      winners: [],
      eliminated: [],
      rounds: [],
      first_preference_counts: candidates.map(c => ({
        candidate_id: c,
        text: candidateMap.get(c),
        votes: 0,
        percentage: 0,
      })),
    };
  }

  // Convert ballots to format
  const votes = ballotsResult.rows.map(row => ({
    weight: 1,
    preferences: row.ranked_answers,
  }));

  // Count first preference votes (needed for both methods)
  const firstPreferenceCounts = new Map();
  candidates.forEach(c => firstPreferenceCounts.set(c, 0));

  votes.forEach(vote => {
    if (vote.preferences && vote.preferences.length > 0) {
      const firstChoice = vote.preferences[0];
      if (firstPreferenceCounts.has(firstChoice)) {
        firstPreferenceCounts.set(firstChoice, firstPreferenceCounts.get(firstChoice) + 1);
      }
    }
  });

  // Build first preference results (sorted by votes)
  const firstPreferenceResults = candidates.map(c => ({
    candidate_id: c,
    text: candidateMap.get(c),
    votes: firstPreferenceCounts.get(c) || 0,
    percentage: totalBallots > 0
      ? parseFloat(((firstPreferenceCounts.get(c) || 0) / totalBallots * 100).toFixed(2))
      : 0,
  })).sort((a, b) => b.votes - a.votes);

  // Calculate quota based on quota_type
  let quota = null;
  if (quotaType === 'droop') {
    quota = Math.floor(totalBallots / (seatsToFill + 1)) + 1;
  } else if (quotaType === 'hare') {
    quota = Math.ceil(totalBallots / seatsToFill);
  }
  // quota_type === 'none' leaves quota as null

  let winners = [];
  let eliminated = [];
  let rounds = [];

  if (rankedMethod === 'stv') {
    // Full STV with vote transfers
    let roundNumber = 0;

    const stvResult = stv({
      seatsToFill: seatsToFill,
      candidates: candidates,
      votes: votes,
      report: (message) => {
        if (message.includes('Round')) {
          roundNumber++;
        }
        rounds.push({
          round: roundNumber,
          message: message,
        });
      },
    });

    winners = stvResult.winners.map(winnerId => ({
      candidate_id: winnerId,
      text: candidateMap.get(winnerId),
    }));

    eliminated = candidates
      .filter(c => !stvResult.winners.includes(c))
      .map(c => ({
        candidate_id: c,
        text: candidateMap.get(c),
      }));

  } else {
    // Simple method: just rank by first preferences, top N win
    const sortedCandidates = [...firstPreferenceResults];

    winners = sortedCandidates
      .slice(0, seatsToFill)
      .map(c => ({
        candidate_id: c.candidate_id,
        text: c.text,
      }));

    eliminated = sortedCandidates
      .slice(seatsToFill)
      .map(c => ({
        candidate_id: c.candidate_id,
        text: c.text,
      }));

    // No rounds for simple method
    rounds = [];
  }

  log.info('[Ranked Results] Calculation complete', {
    election_id: electionId,
    total_ballots: totalBallots,
    seats: seatsToFill,
    ranked_method: rankedMethod,
    quota_type: quotaType,
    quota: quota,
    winners: winners.map(w => w.candidate_id),
    rounds_count: rounds.length,
  });

  return {
    total_ballots: totalBallots,
    ranked_method: rankedMethod,
    quota_type: quotaType,
    quota: quota,
    winners: winners,
    eliminated: eliminated,
    rounds: rounds,
    first_preference_counts: firstPreferenceResults,
  };
}

// =====================================================
// S2S ENDPOINTS (Legacy single-election system)
// =====================================================

// =====================================================
// S2S Endpoint: Register Voting Token
// =====================================================
// Called by Events service when member requests token
// POST /api/s2s/register-token
// Body: { token_hash: string }
// Headers: X-API-Key: <shared-secret>

router.post('/s2s/register-token', writeLimiter, authenticateS2S, async (req, res) => {
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

router.get('/s2s/results', readLimiter, authenticateS2S, async (req, res) => {
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
//         X-Firebase-AppCheck: <app-check-token> (required)
// Body: { answer: 'yes' | 'no' | 'abstain' }
//
// Security: Firebase App Check verification (ENFORCED)

router.post('/vote', voteLimiter, verifyAppCheck, async (req, res) => {
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
//         X-Firebase-AppCheck: <app-check-token> (required)
//
// Security: Firebase App Check verification (ENFORCED)

router.get('/token-status', readLimiter, verifyAppCheck, async (req, res) => {
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
