const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { getCurrentElection, getElectionStatus } = require('../services/electionService');
const { issueVotingToken, getTokenStatus } = require('../services/tokenService');

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
    console.error('Error fetching election:', error);
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

    res.json({
      success: true,
      token: result.token,
      expires_at: result.expires_at,
      message: result.message,
      note: 'Save this token securely - you will need it to vote. This token will not be shown again.'
    });
  } catch (error) {
    console.error('Error issuing voting token:', error);

    // Handle specific errors
    if (error.message.includes('already')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }

    if (error.message.includes('not currently active')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: error.message
      });
    }

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
    console.error('Error fetching token status:', error);
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
    console.error('Error retrieving token:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

/**
 * GET /api/results
 * Get election results
 * MVP: Placeholder until Elections service integration
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

    res.json({
      message: 'Results available after Elections service integration (Phase 2)',
      election_id: election.id,
      election_title: election.title,
      election_status: election.status,
      note: 'MVP implementation does not include Elections service. Results fetching deferred to Phase 2.'
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch election results'
    });
  }
});

module.exports = router;
