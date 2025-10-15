const crypto = require('crypto');
const { query } = require('../config/database');
const { isElectionActive } = require('./electionService');
const { registerToken: registerWithElections } = require('./electionsClient');

/**
 * Token Service
 * Handles voting token generation and management
 * Phase 5: Integrated mode - tokens registered with Elections service via S2S
 */

/**
 * Check if member is eligible to receive voting token
 */
async function checkEligibility(election, kennitala) {
  const errors = [];

  // Check election exists
  if (!election) {
    errors.push('No active election available');
    return { eligible: false, errors };
  }

  // Check election is active
  if (!isElectionActive(election)) {
    errors.push('Election is not currently active for voting');
  }

  // Check if token already issued (one per member)
  const existingToken = await query(
    'SELECT id, voted, expires_at FROM voting_tokens WHERE kennitala = $1',
    [kennitala]
  );

  if (existingToken.rows.length > 0) {
    const token = existingToken.rows[0];
    const now = new Date();
    const expiresAt = new Date(token.expires_at);

    if (token.voted) {
      errors.push('You have already voted in this election');
    } else if (now > expiresAt) {
      // Expired token - delete it and allow new token issuance
      console.log(`INFO: Deleting expired token for kennitala ${kennitala.substring(0, 7)}****`);
      await query('DELETE FROM voting_tokens WHERE id = $1', [token.id]);
      // Don't add to errors - allow new token to be issued
    } else {
      errors.push('Voting token already issued. Use GET /api/my-token to retrieve it.');
    }
  }

  return {
    eligible: errors.length === 0,
    errors
  };
}

/**
 * Issue a new voting token to member
 * MVP: Store in database only (no S2S to Elections service)
 */
async function issueVotingToken(election, kennitala) {
  // Check eligibility
  const eligibility = await checkEligibility(election, kennitala);
  if (!eligibility.eligible) {
    throw new Error(eligibility.errors.join(', '));
  }

  // Generate secure token (32 bytes = 64 hex characters)
  const token = crypto.randomBytes(32).toString('hex');

  // Hash token for storage (SHA-256)
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Calculate expiration (24 hours or election end, whichever is sooner)
  const expiresAt = new Date(
    Math.min(
      Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      new Date(election.voting_ends_at).getTime()
    )
  );

  // Store token in database (idempotent - handles double-clicks)
  const result = await query(`
    INSERT INTO voting_tokens (kennitala, token_hash, expires_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (kennitala) DO NOTHING
    RETURNING id, token_hash
  `, [kennitala, tokenHash, expiresAt]);

  // If conflict (token already exists), fetch existing token
  if (result.rowCount === 0) {
    console.log('Token already exists for kennitala, returning existing token');
    const existing = await query(`
      SELECT token_hash FROM voting_tokens WHERE kennitala = $1
    `, [kennitala]);

    if (existing.rowCount === 0) {
      throw new Error('Token conflict but existing token not found (database inconsistency)');
    }

    // Return existing token (idempotent behavior)
    return existing.rows[0].token_hash;
  }

  console.log('Voting token issued:', { kennitala, expiresAt });

  // Phase 5: Register token with Elections service via S2S
  try {
    await registerWithElections(tokenHash);
    console.log('Token registered with Elections service:', { tokenHash: tokenHash.substring(0, 8) + '...' });
  } catch (error) {
    console.error('Failed to register token with Elections service:', error);
    // Continue even if Elections service registration fails (graceful degradation)
    // Member can still use token, but vote won't be recorded until Elections service is available
  }

  // Return token to member
  return {
    token,
    expires_at: expiresAt,
    message: 'Token issued successfully. Save this token - you will need it to vote.'
  };
}

/**
 * Get member's token status
 */
async function getTokenStatus(kennitala) {
  const result = await query(
    `SELECT
      id,
      token_hash,
      issued_at,
      expires_at,
      voted,
      voted_at
    FROM voting_tokens
    WHERE kennitala = $1`,
    [kennitala]
  );

  if (result.rows.length === 0) {
    return {
      token_issued: false,
      voted: false
    };
  }

  const token = result.rows[0];
  const now = new Date();
  const expiresAt = new Date(token.expires_at);
  const isExpired = now > expiresAt;

  return {
    token_issued: true,
    token_issued_at: token.issued_at,
    expires_at: token.expires_at,
    expired: isExpired,
    voted: token.voted,
    voted_at: token.voted_at
  };
}

/**
 * Retrieve previously issued token (if exists and not expired)
 * MVP: Return plain token for member to use
 */
async function getIssuedToken(kennitala) {
  const result = await query(
    `SELECT
      token_hash,
      issued_at,
      expires_at,
      voted
    FROM voting_tokens
    WHERE kennitala = $1`,
    [kennitala]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const tokenRecord = result.rows[0];
  const now = new Date();
  const expiresAt = new Date(tokenRecord.expires_at);

  // Check if expired
  if (now > expiresAt) {
    throw new Error('Token has expired. Please request a new token.');
  }

  // Check if already voted
  if (tokenRecord.voted) {
    throw new Error('Token already used for voting');
  }

  // Note: In MVP, we cannot return the plain token because we only store the hash
  // This is a security design decision - tokens are single-use and should be saved by the member
  throw new Error('Cannot retrieve token - tokens are single-use and must be saved when issued. Please contact support if you lost your token.');
}

module.exports = {
  checkEligibility,
  issueVotingToken,
  getTokenStatus,
  getIssuedToken
};
