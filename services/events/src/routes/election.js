const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { getCurrentElection, getElectionStatus } = require('../services/electionService');
const { issueVotingToken, getTokenStatus } = require('../services/tokenService');
const { fetchResults: fetchElectionResults } = require('../services/electionsClient');
const logger = require('../utils/logger');

/**
 * GET /api/election
 * Get current election details
 */
router.get('/election', authenticate, async (req, res) => {
  try {
    const election = await getCurrentElection();

    if (!election) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No active election available'
      });
    }

    res.json({
      id: election.id,
      title: election.title,
      description: election.description,
      question_text: election.question_text,
      status: election.status,
      status_message: getElectionStatus(election),
      voting_starts_at: election.voting_starts_at,
      voting_ends_at: election.voting_ends_at
    });
  } catch (error) {
    logger.error('Failed to fetch election details', {
      operation: 'get_election',
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch election details'
    });
  }
});

/**
 * POST /api/request-token
 * Request a one-time voting token
 * MVP: Store in DB only (no S2S to Elections service)
 */
router.post('/request-token', authenticate, async (req, res) => {
  try {
    const { kennitala } = req.user;

    // Get current election
    const election = await getCurrentElection();

    // Issue token
    const result = await issueVotingToken(election, kennitala);

    // Security: ensure tokens are never cacheable by clients or intermediary proxies
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');

    res.json({
      success: true,
      token: result.token,
      expires_at: result.expires_at,
      message: result.message,
      note: 'Save this token securely - you will need it to vote. This token will not be shown again.'
    });
  } catch (error) {
    logger.error('Failed to issue voting token', {
      operation: 'request_token',
      error: error.message,
      stack: error.stack,
      kennitala: req.user.kennitala ? '[REDACTED]' : undefined
    });

    // Handle specific errors
    if (error.message.includes('already')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }

    if (error.message.includes('expired')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
      return res.status(400).json({
        error: 'Bad Request',
        message: error.message,
        hint: 'Your previous token has expired. The database should allow you to request a new one.'
      });
    }

    if (error.message.includes('not currently active')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to issue voting token'
    });
  }
});

/**
 * GET /api/my-status
 * Check member's participation status
 */
router.get('/my-status', authenticate, async (req, res) => {
  try {
    const { kennitala } = req.user;

    const status = await getTokenStatus(kennitala);

    res.json(status);
  } catch (error) {
    logger.error('Failed to fetch participation status', {
      operation: 'get_my_status',
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch participation status'
    });
  }
});

/**
 * GET /api/my-token
 * Retrieve previously issued token (if exists and not expired)
 * MVP: Cannot retrieve plain token (only hash stored for security)
 */
router.get('/my-token', authenticate, async (req, res) => {
  try {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Tokens cannot be retrieved after issuance for security reasons. Tokens are single-use and must be saved when issued. If you lost your token, please contact support.',
      hint: 'Use POST /api/request-token to get a new token if yours has expired.'
    });
  } catch (error) {
    logger.error('Token retrieval attempted', {
      operation: 'get_my_token',
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/results
 * Get election results from Elections service
 * Phase 5: Fetch results via S2S from Elections service
 */
router.get('/results', authenticate, async (req, res) => {
  try {
    const election = await getCurrentElection();

    if (!election) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'No election available'
      });
    }

    // Fetch results from Elections service via S2S
    try {
      const results = await fetchElectionResults();

      res.json({
        election_id: election.id,
        election_title: election.title,
        election_status: election.status,
        total_ballots: results.total_ballots,
        results: results.results,
        fetched_at: new Date().toISOString()
      });
    } catch (electionsError) {
      logger.warn('Elections service unavailable', {
        operation: 'fetch_results_from_elections',
        error: electionsError.message,
        stack: electionsError.stack,
        election_id: election.id
      });

      // Graceful degradation: return partial data if Elections service is unavailable
      res.json({
        election_id: election.id,
        election_title: election.title,
        election_status: election.status,
        total_ballots: 0,
        results: null,
        error: 'Elections service temporarily unavailable',
        message: 'Results could not be fetched. Please try again later.'
      });
    }
  } catch (error) {
    logger.error('Failed to fetch election results', {
      operation: 'get_results',
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch election results'
    });
  }
});

module.exports = router;
