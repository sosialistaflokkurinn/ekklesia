/**
 * Nomination Committee Routes
 * API endpoints for uppstillingarnefnd (nomination committee) voting
 *
 * Purpose: Enable committee members to:
 * - List nomination elections they can vote in
 * - Submit ranked votes with justifications
 * - View results with full voter identity (non-anonymous)
 *
 * Key differences from regular elections:
 * - Non-anonymous: voter identity is preserved permanently
 * - Justifications required for top N candidates
 * - Multiple formal voting rounds
 * - Committee-only access (specific UID list)
 */

const express = require('express');
const pool = require('../config/config-database');
const logger = require('../utils/util-logger');
const { logAudit } = require('../services/service-audit');
const {
  verifyMemberToken,
  validateVotingWindow,
  validateRankedAnswers,
} = require('../middleware/middleware-member-auth');
const {
  verifyFirebaseToken,
  requireElectionManager,
} = require('../middleware/middleware-rbac-auth');
const { readLimiter, voteLimiter, adminLimiter } = require('../middleware/middleware-rate-limiter');
const { hashUidForLogging } = require('../utils/util-hash-uid');

const router = express.Router();

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Check if user is a committee member for this election
 * @param {object} election - Election object with committee_member_uids
 * @param {string} uid - Firebase UID to check
 * @returns {boolean} - True if user is a committee member
 */
function isCommitteeMember(election, uid) {
  if (!election.committee_member_uids) {
    return false;
  }

  const committeeUids = Array.isArray(election.committee_member_uids)
    ? election.committee_member_uids
    : [];

  return committeeUids.includes(uid);
}

/**
 * Validate UUID format
 * @param {string} id - UUID to validate
 * @returns {boolean} - True if valid UUID format
 */
function isValidUUID(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// =====================================================
// GET /api/nomination/elections - List Committee Elections
// =====================================================
router.get('/elections', readLimiter, verifyMemberToken, async (req, res) => {
  const startTime = Date.now();

  try {
    // Log incoming request details
    logger.info('[Nomination API] List elections request', {
      uid: req.user?.uid,
      uidType: typeof req.user?.uid,
    });

    // Query nomination-committee elections where user is a member
    const result = await pool.query(
      `SELECT
        e.id,
        e.title,
        e.description,
        e.question,
        e.answers,
        e.status,
        e.voting_type,
        e.seats_to_fill,
        e.round_number,
        e.parent_election_id,
        e.requires_justification,
        e.justification_required_for_top_n,
        e.scheduled_start,
        e.scheduled_end,
        e.created_at,
        e.published_at,
        e.closed_at,
        e.committee_member_uids,
        (
          SELECT elections.check_member_voted_v2(e.id, $1)
        ) as has_voted,
        (
          SELECT COUNT(DISTINCT b.member_uid)
          FROM elections.ballots b
          WHERE b.election_id = e.id AND b.ranked_answers IS NOT NULL
        ) as votes_cast
      FROM elections.elections e
      WHERE e.voting_type = 'nomination-committee'
        AND e.hidden = FALSE
        AND e.committee_member_uids @> $2::jsonb
      ORDER BY e.created_at DESC`,
      [req.user.uid, JSON.stringify([req.user.uid])]
    );

    const duration = Date.now() - startTime;

    (req.logger || logger).info('[Nomination API] List elections', {
      uid: req.user.uid,
      count: result.rows.length,
      duration_ms: duration,
    });

    res.json({
      elections: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    logger.error('[Nomination API] List elections error:', {
      error: error.message,
      stack: error.stack,
      uid: req.user?.uid,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list elections',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
});

// =====================================================
// GET /api/nomination/elections/:id - Get Election Details
// =====================================================
router.get('/elections/:id', readLimiter, verifyMemberToken, async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid election ID format',
    });
  }

  try {
    // Get election
    const result = await pool.query(
      `SELECT
        e.*,
        (
          SELECT elections.check_member_voted_v2(e.id, $2)
        ) as has_voted,
        (
          SELECT COUNT(DISTINCT b.member_uid)
          FROM elections.ballots b
          WHERE b.election_id = e.id AND b.ranked_answers IS NOT NULL
        ) as votes_cast
      FROM elections.elections e
      WHERE e.id = $1 AND e.voting_type = 'nomination-committee'`,
      [id, req.user.uid]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const election = result.rows[0];

    // Check if hidden
    if (election.hidden) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    // Check committee membership
    if (!isCommitteeMember(election, req.user.uid)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Þú ert ekki meðlimur í þessari nefnd',
      });
    }

    // Get previous rounds if this is a subsequent round
    let previousRounds = [];
    if (election.parent_election_id) {
      const roundsResult = await pool.query(
        `SELECT id, round_number, status, closed_at
         FROM elections.elections
         WHERE parent_election_id = $1 OR id = $1
         ORDER BY round_number ASC`,
        [election.parent_election_id]
      );
      previousRounds = roundsResult.rows;
    }

    // Get user's previous vote in this round (if any)
    let previousVote = null;
    if (election.has_voted) {
      const voteResult = await pool.query(
        `SELECT b.ranked_answers, b.submitted_at,
                COALESCE(
                  (SELECT jsonb_agg(
                    jsonb_build_object(
                      'candidate_id', j.candidate_id,
                      'rank', j.rank_position,
                      'text', j.justification_text
                    ) ORDER BY j.rank_position
                  )
                  FROM elections.ballot_justifications j
                  WHERE j.ballot_id = b.id),
                  '[]'::jsonb
                ) as justifications
         FROM elections.ballots b
         WHERE b.election_id = $1 AND b.member_uid = $2
         LIMIT 1`,
        [id, req.user.uid]
      );

      if (voteResult.rows.length > 0) {
        previousVote = voteResult.rows[0];
      }
    }

    (req.logger || logger).info('[Nomination API] Get election', {
      uid: req.user.uid,
      election_id: id,
    });

    res.json({
      election,
      previous_rounds: previousRounds,
      previous_vote: previousVote,
    });
  } catch (error) {
    (req.logger || logger).error('[Nomination API] Get election error:', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get election',
    });
  }
});

// =====================================================
// POST /api/nomination/elections/:id/vote - Submit Vote
// =====================================================
// Body: {
//   ranked_answers: ["candidate1", "candidate2", ...],
//   justifications: {
//     "candidate1": "Reason for first choice...",
//     "candidate2": "Reason for second choice...",
//     "candidate3": "Reason for third choice..."
//   },
//   voter_name: "Guðrún Jónsdóttir"  // Display name for results
// }
router.post('/elections/:id/vote', voteLimiter, verifyMemberToken, async (req, res) => {
  const startTime = Date.now();
  const { id } = req.params;
  const { ranked_answers, justifications, voter_name } = req.body;

  if (!isValidUUID(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid election ID format',
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Lock election row
    const electionResult = await client.query(
      `SELECT *
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

    // Check voting type
    if (election.voting_type !== 'nomination-committee') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Bad Request',
        message: 'This endpoint is only for nomination-committee elections',
      });
    }

    // Check if hidden
    if (election.hidden) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    // Check committee membership
    if (!isCommitteeMember(election, req.user.uid)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Þú ert ekki meðlimur í þessari nefnd',
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

    // Validate ranked answers
    const rankCheck = validateRankedAnswers(ranked_answers, election);
    if (!rankCheck.valid) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Bad Request',
        message: rankCheck.error,
      });
    }

    // Validate justifications if required
    if (election.requires_justification) {
      const requiredCount = election.justification_required_for_top_n || 3;
      const topCandidates = ranked_answers.slice(0, requiredCount);

      for (const candidateId of topCandidates) {
        if (!justifications || !justifications[candidateId] || justifications[candidateId].trim().length < 10) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Bad Request',
            message: `Rökstuðningur vantar fyrir ${candidateId} (að minnsta kosti 10 stafir)`,
          });
        }
      }
    }

    // Check if already voted in this round
    const voteCheckResult = await client.query(
      'SELECT elections.check_member_voted_v2($1, $2) as has_voted',
      [id, req.user.uid]
    );

    if (voteCheckResult.rows[0].has_voted) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Conflict',
        message: 'Þú hefur þegar kosið í þessari umferð',
      });
    }

    // Get voter name from request or claims
    const displayName = voter_name ||
                       req.user.claims?.name ||
                       req.user.email ||
                       'Unknown';

    // Insert ballot (NO anonymization - preserve_voter_identity = true)
    // Use sentinel token for member-based voting
    const MEMBER_VOTE_TOKEN = '0000000000000000000000000000000000000000000000000000000000000000';

    const ballotResult = await client.query(
      `INSERT INTO elections.ballots (election_id, member_uid, ranked_answers, token_hash, submitted_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id`,
      [id, req.user.uid, JSON.stringify(ranked_answers), MEMBER_VOTE_TOKEN]
    );

    const ballotId = ballotResult.rows[0].id;

    // Insert justifications for top N candidates
    const topN = election.justification_required_for_top_n || 3;
    const topCandidates = ranked_answers.slice(0, topN);

    for (let i = 0; i < topCandidates.length; i++) {
      const candidateId = topCandidates[i];
      const justificationText = justifications?.[candidateId] || '';

      if (justificationText.trim().length > 0) {
        await client.query(
          `INSERT INTO elections.ballot_justifications
           (ballot_id, election_id, candidate_id, rank_position, justification_text, member_uid, member_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            ballotId,
            id,
            candidateId,
            i + 1,  // 1-indexed rank position
            justificationText.trim(),
            req.user.uid,
            displayName,
          ]
        );
      }
    }

    await client.query('COMMIT');

    const duration = Date.now() - startTime;

    // Log with FULL identity (non-anonymous)
    (req.logger || logger).info('[Nomination API] Vote submitted', {
      uid: req.user.uid,
      voter_name: displayName,
      election_id: id,
      election_title: election.title,
      round_number: election.round_number,
      ranking: ranked_answers,
      ballot_id: ballotId,
      duration_ms: duration,
    });

    // Audit log with full identity (for committee transparency)
    logAudit('nomination_vote', true, {
      uid: req.user.uid,
      voter_name: displayName,
      election_id: id,
      election_title: election.title,
      round_number: election.round_number,
      ranking: ranked_answers,
      ballot_id: ballotId,
      duration_ms: duration,
    });

    res.status(201).json({
      success: true,
      ballot_id: ballotId,
      message: 'Atkvæði skráð',
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }

    // Direct console.error for Cloud Run logs
    console.error('[Nomination API] Vote error:', {
      error: error.message,
      stack: error.stack,
      election_id: id,
      uid: req.user?.uid,
    });

    (req.logger || logger).error('[Nomination API] Vote error:', {
      error: error.message,
      stack: error.stack,
      election_id: id,
      uid: req.user?.uid,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að skrá atkvæði',
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// =====================================================
// GET /api/nomination/elections/:id/results - Get Results
// =====================================================
// Returns full results with voter identity (non-anonymous)
router.get('/elections/:id/results', readLimiter, verifyMemberToken, async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid election ID format',
    });
  }

  try {
    // Get election
    const electionResult = await pool.query(
      `SELECT *
       FROM elections.elections e
       WHERE e.id = $1 AND e.voting_type = 'nomination-committee'`,
      [id]
    );

    if (electionResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    const election = electionResult.rows[0];

    // Check if hidden
    if (election.hidden) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Election not found',
      });
    }

    // Check committee membership
    if (!isCommitteeMember(election, req.user.uid)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Þú ert ekki meðlimur í þessari nefnd',
      });
    }

    // Get all votes with full identity (using helper function)
    const votesResult = await pool.query(
      `SELECT * FROM elections.get_named_ballots($1)`,
      [id]
    );

    // Check if all committee members have voted
    const totalCommitteeMembers = Array.isArray(election.committee_member_uids)
      ? election.committee_member_uids.length
      : 0;
    const totalVotesCast = votesResult.rows.length;

    if (totalVotesCast < totalCommitteeMembers) {
      const remaining = totalCommitteeMembers - totalVotesCast;
      return res.status(403).json({
        error: 'Forbidden',
        message: `Niðurstöður eru ekki aðgengilegar fyrr en allir nefndarmenn hafa kosið. ${remaining} nefndarma${remaining === 1 ? 'ður' : 'enn'} á eftir að kjósa.`,
        votes_cast: totalVotesCast,
        committee_size: totalCommitteeMembers,
      });
    }

    // Get average rankings (using helper function)
    const rankingsResult = await pool.query(
      `SELECT * FROM elections.calculate_average_rankings($1)`,
      [id]
    );

    // Calculate STV results if seats_to_fill > 0
    let stvResults = null;
    if (election.seats_to_fill > 0 && votesResult.rows.length > 0) {
      const { stv } = require('../utils/util-stv');

      const candidates = election.answers.map(a => a.id || a.text);
      const votes = votesResult.rows.map(row => ({
        weight: 1,
        preferences: row.preferences,
      }));

      const stvOutput = stv({
        seatsToFill: election.seats_to_fill,
        candidates: candidates,
        votes: votes,
        report: () => {}, // Suppress output
      });

      stvResults = {
        winners: stvOutput.winners,
        quota: Math.floor(votesResult.rows.length / (election.seats_to_fill + 1)) + 1,
      };
    }

    // Format votes for response (with voter names)
    const formattedVotes = votesResult.rows.map(row => ({
      voter_name: row.member_name,
      voter_uid: row.member_uid,
      ranking: row.preferences,
      justifications: row.justifications,
      submitted_at: row.submitted_at,
    }));

    // Get committee size
    const committeeSize = Array.isArray(election.committee_member_uids)
      ? election.committee_member_uids.length
      : 0;

    (req.logger || logger).info('[Nomination API] Get results', {
      uid: req.user.uid,
      election_id: id,
      total_votes: formattedVotes.length,
    });

    res.json({
      election_id: id,
      title: election.title,
      question: election.question,
      status: election.status,
      round_number: election.round_number,
      seats_to_fill: election.seats_to_fill,
      candidates: election.answers,
      committee_size: committeeSize,
      votes_cast: formattedVotes.length,
      votes: formattedVotes,
      average_rankings: rankingsResult.rows,
      stv_results: stvResults,
    });
  } catch (error) {
    (req.logger || logger).error('[Nomination API] Get results error:', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að sækja niðurstöður',
    });
  }
});

// =====================================================
// ADMIN ENDPOINTS
// =====================================================

// =====================================================
// POST /api/nomination/admin/elections - Create Nomination Election
// =====================================================
// Creates a new nomination-committee election
// Body: {
//   title: string,
//   question: string,
//   candidates: [{id, text}, ...],
//   committee_member_uids: ["uid1", "uid2", ...],
//   seats_to_fill: number,
//   justification_required_for_top_n: number (default 3)
// }
router.post('/admin/elections', adminLimiter, verifyFirebaseToken, requireElectionManager, async (req, res) => {
  const startTime = Date.now();
  const {
    title,
    description = '',
    question,
    candidates,
    committee_member_uids,
    seats_to_fill = 1,
    justification_required_for_top_n = 3,
  } = req.body;

  // Validate required fields
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Titil vantar' });
  }

  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Bad Request', message: 'Spurningu vantar' });
  }

  if (!Array.isArray(candidates) || candidates.length < 2) {
    return res.status(400).json({ error: 'Bad Request', message: 'Að minnsta kosti 2 frambjóðendur þurfa að vera' });
  }

  if (!Array.isArray(committee_member_uids) || committee_member_uids.length < 1) {
    return res.status(400).json({ error: 'Bad Request', message: 'Nefndarmanna UIDs vantar' });
  }

  try {
    // Insert election
    const result = await pool.query(
      `INSERT INTO elections.elections (
        title,
        description,
        question,
        answers,
        voting_type,
        eligibility,
        committee_member_uids,
        seats_to_fill,
        max_selections,
        preserve_voter_identity,
        requires_justification,
        justification_required_for_top_n,
        round_number,
        created_by,
        status
      ) VALUES ($1, $2, $3, $4, 'nomination-committee', 'committee', $5, $6, $7, TRUE, TRUE, $8, 1, $9, 'draft')
      RETURNING *`,
      [
        title.trim(),
        description.trim(),
        question.trim(),
        JSON.stringify(candidates),
        JSON.stringify(committee_member_uids),
        seats_to_fill,
        candidates.length, // max_selections = all candidates
        justification_required_for_top_n,
        req.user.uid,
      ]
    );

    const election = result.rows[0];
    const duration = Date.now() - startTime;

    (req.logger || logger).info('[Nomination Admin] Election created', {
      uid: req.user.uid,
      election_id: election.id,
      title: election.title,
      committee_size: committee_member_uids.length,
      duration_ms: duration,
    });

    logAudit('create_nomination_election', true, {
      uid: req.user.uid,
      election_id: election.id,
      title: election.title,
      duration_ms: duration,
    });

    res.status(201).json({
      success: true,
      election,
    });
  } catch (error) {
    (req.logger || logger).error('[Nomination Admin] Create error:', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að búa til kosningu',
    });
  }
});

// =====================================================
// POST /api/nomination/admin/elections/:id/open-round
// Open/publish a nomination election round
// =====================================================
router.post('/admin/elections/:id/open-round', adminLimiter, verifyFirebaseToken, requireElectionManager, async (req, res) => {
  const { id } = req.params;
  const { scheduled_start, scheduled_end } = req.body;

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Ógilt ID' });
  }

  try {
    // Check election exists and is draft
    const checkResult = await pool.query(
      `SELECT status, voting_type FROM elections.elections WHERE id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Kosning fannst ekki' });
    }

    const { status, voting_type } = checkResult.rows[0];

    if (voting_type !== 'nomination-committee') {
      return res.status(400).json({ error: 'Bad Request', message: 'Þetta er ekki nefndarkosning' });
    }

    if (status !== 'draft') {
      return res.status(400).json({ error: 'Bad Request', message: 'Aðeins hægt að opna drög' });
    }

    // Open election
    const result = await pool.query(
      `UPDATE elections.elections
       SET status = 'published',
           published_at = NOW(),
           scheduled_start = COALESCE($2, NOW()),
           scheduled_end = $3,
           updated_by = $1
       WHERE id = $4
       RETURNING *`,
      [req.user.uid, scheduled_start, scheduled_end, id]
    );

    const election = result.rows[0];

    (req.logger || logger).info('[Nomination Admin] Round opened', {
      uid: req.user.uid,
      election_id: id,
      round_number: election.round_number,
    });

    res.json({
      success: true,
      election,
      message: 'Umferð opnuð',
    });
  } catch (error) {
    (req.logger || logger).error('[Nomination Admin] Open round error:', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að opna umferð',
    });
  }
});

// =====================================================
// POST /api/nomination/admin/elections/:id/close-round
// Close a nomination election round
// =====================================================
router.post('/admin/elections/:id/close-round', adminLimiter, verifyFirebaseToken, requireElectionManager, async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Ógilt ID' });
  }

  try {
    // Check election exists and is published
    const checkResult = await pool.query(
      `SELECT status, voting_type FROM elections.elections WHERE id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Kosning fannst ekki' });
    }

    const { status, voting_type } = checkResult.rows[0];

    if (voting_type !== 'nomination-committee') {
      return res.status(400).json({ error: 'Bad Request', message: 'Þetta er ekki nefndarkosning' });
    }

    if (status !== 'published') {
      return res.status(400).json({ error: 'Bad Request', message: 'Aðeins hægt að loka opnum umferðum' });
    }

    // Close election (NO anonymization for nomination-committee)
    const result = await pool.query(
      `UPDATE elections.elections
       SET status = 'closed',
           closed_at = NOW(),
           updated_by = $1
       WHERE id = $2
       RETURNING *`,
      [req.user.uid, id]
    );

    const election = result.rows[0];

    (req.logger || logger).info('[Nomination Admin] Round closed', {
      uid: req.user.uid,
      election_id: id,
      round_number: election.round_number,
    });

    res.json({
      success: true,
      election,
      message: 'Umferð lokað',
    });
  } catch (error) {
    (req.logger || logger).error('[Nomination Admin] Close round error:', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að loka umferð',
    });
  }
});

// =====================================================
// POST /api/nomination/admin/elections/:id/next-round
// Create next round (copy election, increment round_number)
// =====================================================
router.post('/admin/elections/:id/next-round', adminLimiter, verifyFirebaseToken, requireElectionManager, async (req, res) => {
  const { id } = req.params;

  if (!isValidUUID(id)) {
    return res.status(400).json({ error: 'Bad Request', message: 'Ógilt ID' });
  }

  try {
    // Get current election
    const checkResult = await pool.query(
      `SELECT * FROM elections.elections WHERE id = $1`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not Found', message: 'Kosning fannst ekki' });
    }

    const original = checkResult.rows[0];

    if (original.voting_type !== 'nomination-committee') {
      return res.status(400).json({ error: 'Bad Request', message: 'Þetta er ekki nefndarkosning' });
    }

    if (original.status !== 'closed') {
      return res.status(400).json({ error: 'Bad Request', message: 'Aðeins hægt að búa til næstu umferð úr lokaðri umferð' });
    }

    // Determine parent_election_id (original or first round)
    const parentId = original.parent_election_id || original.id;
    const nextRoundNumber = original.round_number + 1;

    // Create new round
    const result = await pool.query(
      `INSERT INTO elections.elections (
        title,
        description,
        question,
        answers,
        voting_type,
        eligibility,
        committee_member_uids,
        seats_to_fill,
        max_selections,
        preserve_voter_identity,
        requires_justification,
        justification_required_for_top_n,
        round_number,
        parent_election_id,
        created_by,
        status
      ) VALUES ($1, $2, $3, $4, 'nomination-committee', 'committee', $5, $6, $7, TRUE, TRUE, $8, $9, $10, $11, 'draft')
      RETURNING *`,
      [
        original.title,
        original.description,
        original.question,
        JSON.stringify(original.answers),
        JSON.stringify(original.committee_member_uids),
        original.seats_to_fill,
        original.max_selections,
        original.justification_required_for_top_n,
        nextRoundNumber,
        parentId,
        req.user.uid,
      ]
    );

    const newElection = result.rows[0];

    (req.logger || logger).info('[Nomination Admin] Next round created', {
      uid: req.user.uid,
      original_id: id,
      new_id: newElection.id,
      round_number: nextRoundNumber,
    });

    res.status(201).json({
      success: true,
      election: newElection,
      message: `Umferð ${nextRoundNumber} búin til`,
    });
  } catch (error) {
    (req.logger || logger).error('[Nomination Admin] Next round error:', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að búa til næstu umferð',
    });
  }
});

// =====================================================
// GET /api/nomination/admin/elections - List all nomination elections
// =====================================================
router.get('/admin/elections', adminLimiter, verifyFirebaseToken, requireElectionManager, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        e.*,
        (
          SELECT COUNT(DISTINCT b.member_uid)
          FROM elections.ballots b
          WHERE b.election_id = e.id AND b.ranked_answers IS NOT NULL
        ) as votes_cast
       FROM elections.elections e
       WHERE e.voting_type = 'nomination-committee'
       ORDER BY e.created_at DESC`
    );

    res.json({
      elections: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    (req.logger || logger).error('[Nomination Admin] List error:', {
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Mistókst að sækja kosningar',
    });
  }
});

module.exports = router;
