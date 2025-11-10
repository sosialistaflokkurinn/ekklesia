/**
 * Member Authentication Middleware
 * Verifies Firebase ID tokens for member-facing endpoints
 *
 * Purpose: Enable authenticated members to:
 * - List elections they can vote in
 * - View election details
 * - Submit votes
 * - View results
 *
 * Based on: Issue #248 - Implement Member-Facing Elections API Endpoints
 * Security: Firebase authentication for all member endpoints
 */

const admin = require('../firebase'); // Use initialized Firebase Admin SDK
const pool = require('../config/database');

/**
 * Verify Firebase ID token and extract user info
 * Simpler than RBAC - just checks authentication, not roles
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
async function verifyMemberToken(req, res, next) {
  // Extract token from Authorization header
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Extract roles (if any)
    const roles = decodedToken.roles || [];
    const isMember = roles.includes('member') || roles.length === 0; // Default to member if no roles
    const isAdmin = roles.includes('admin') || roles.includes('superuser');

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      roles: roles,
      isMember: isMember,
      isAdmin: isAdmin,
      claims: decodedToken, // Full claims object
    };

    next();
  } catch (error) {
    console.error('[MemberAuth] Token verification failed:', error.message);

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      code: 'INVALID_AUTH_TOKEN',
    });
  }
}

/**
 * Check if member is eligible to view/vote in election
 * Called after verifyMemberToken middleware
 *
 * @param {object} election - Election object from database
 * @param {object} req - Express request (must have req.user)
 * @returns {boolean} - True if member is eligible
 */
function isEligible(election, req) {
  const { isAdmin, isMember } = req.user;

  // Check election eligibility setting
  if (election.eligibility === 'all') {
    return true; // Everyone can see/vote
  }

  if (election.eligibility === 'admins') {
    return isAdmin; // Only admins
  }

  if (election.eligibility === 'members') {
    return isMember || isAdmin; // Members and admins
  }

  return false; // Default: not eligible
}

/**
 * Check if member has already voted in election
 *
 * @param {string} electionId - Election UUID
 * @param {string} memberUid - Firebase UID
 * @returns {Promise<boolean>} - True if member has voted
 */
async function hasVoted(electionId, memberUid) {
  try {
    const result = await pool.query(
      'SELECT check_member_voted($1, $2) as has_voted',
      [electionId, memberUid]
    );

    return result.rows[0]?.has_voted || false;
  } catch (error) {
    console.error('[MemberAuth] Error checking vote status:', error);
    return false; // Fail safe: assume not voted
  }
}

/**
 * Filter elections by eligibility
 * Returns only elections the member can see
 *
 * @param {Array} elections - Array of election objects
 * @param {object} req - Express request (must have req.user)
 * @returns {Array} - Filtered elections
 */
function filterElectionsByEligibility(elections, req) {
  return elections.filter(election => {
    // Always hide draft elections (not published yet)
    if (election.status === 'draft') {
      return false;
    }

    // Always hide hidden elections (soft-deleted)
    if (election.hidden) {
      return false;
    }

    // Check eligibility
    return isEligible(election, req);
  });
}

/**
 * Validate voting window
 * Checks if election is currently open for voting
 *
 * @param {object} election - Election object from database
 * @returns {object} - {valid: boolean, error: string}
 */
function validateVotingWindow(election) {
  const now = new Date();

  // Check status
  if (election.status !== 'published') {
    if (election.status === 'draft') {
      return { valid: false, error: 'Election not yet published' };
    }
    if (election.status === 'closed') {
      return { valid: false, error: 'Election has closed' };
    }
    if (election.status === 'paused') {
      return { valid: false, error: 'Election is temporarily paused' };
    }
    if (election.status === 'archived') {
      return { valid: false, error: 'Election is archived' };
    }

    return { valid: false, error: 'Election is not active' };
  }

  // Check scheduled start time (if set)
  if (election.scheduled_start && now < new Date(election.scheduled_start)) {
    return { valid: false, error: 'Voting has not started yet' };
  }

  // Check scheduled end time (if set)
  if (election.scheduled_end && now > new Date(election.scheduled_end)) {
    return { valid: false, error: 'Voting has ended' };
  }

  return { valid: true };
}

/**
 * Validate answer selections
 * Checks if submitted answer IDs are valid for the election
 *
 * @param {Array<string>} answerIds - Selected answer IDs
 * @param {object} election - Election object from database
 * @returns {object} - {valid: boolean, error: string}
 */
function validateAnswers(answerIds, election) {
  // Validate input
  if (!Array.isArray(answerIds) || answerIds.length === 0) {
    return { valid: false, error: 'No answers selected' };
  }

  // Parse election answers (JSONB)
  const answers = election.answers;
  if (!Array.isArray(answers)) {
    return { valid: false, error: 'Invalid election configuration' };
  }

  // Get valid answer IDs
  const validAnswerIds = answers.map(a => a.id);

  // Check all selected answers are valid
  const invalidAnswers = answerIds.filter(id => !validAnswerIds.includes(id));
  if (invalidAnswers.length > 0) {
    return { valid: false, error: `Invalid answer IDs: ${invalidAnswers.join(', ')}` };
  }

  // Check selection count for single-choice
  if (election.voting_type === 'single-choice' && answerIds.length !== 1) {
    return { valid: false, error: 'Single-choice elections require exactly 1 selection' };
  }

  // Check selection count for multi-choice
  if (election.voting_type === 'multi-choice') {
    if (answerIds.length > election.max_selections) {
      return {
        valid: false,
        error: `Too many selections (max: ${election.max_selections}, got: ${answerIds.length})`,
      };
    }
  }

  // Check for duplicate selections
  const uniqueAnswers = new Set(answerIds);
  if (uniqueAnswers.size !== answerIds.length) {
    return { valid: false, error: 'Duplicate answer selections are not allowed' };
  }

  return { valid: true };
}

module.exports = {
  verifyMemberToken,
  isEligible,
  hasVoted,
  filterElectionsByEligibility,
  validateVotingWindow,
  validateAnswers,
};
