const { query } = require('../config/database');

/**
 * Election Service
 * Handles election data and business logic
 */

/**
 * Get the current election
 * MVP: Returns the single election from database
 */
async function getCurrentElection() {
  const result = await query(`
    SELECT
      id,
      title,
      description,
      question_text,
      status,
      voting_start_time,
      voting_end_time,
      created_at
    FROM elections.elections
    WHERE status IN ('published', 'open')
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

/**
 * Check if election is currently active (published and within voting period)
 */
function isElectionActive(election) {
  if (!election || (election.status !== 'published' && election.status !== 'open')) {
    return false;
  }

  const now = new Date();
  const startsAt = new Date(election.voting_start_time);
  const endsAt = new Date(election.voting_end_time);

  return now >= startsAt && now <= endsAt;
}

/**
 * Get human-readable election status
 */
function getElectionStatus(election) {
  if (!election) {
    return 'No election available';
  }

  if (election.status === 'draft') {
    return 'Draft - not yet published';
  }

  if (election.status === 'closed') {
    return 'Closed - voting has ended';
  }

  const now = new Date();
  const startsAt = new Date(election.voting_start_time);
  const endsAt = new Date(election.voting_end_time);

  if (now < startsAt) {
    return `Scheduled - voting starts ${startsAt.toISOString()}`;
  }

  if (now > endsAt) {
    return `Ended - voting closed ${endsAt.toISOString()}`;
  }

  return 'Active - voting is open';
}

module.exports = {
  getCurrentElection,
  isElectionActive,
  getElectionStatus
};
