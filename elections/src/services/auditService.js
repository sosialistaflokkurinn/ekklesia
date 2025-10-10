const pool = require('../config/database');

/**
 * Log audit event to database
 * IMPORTANT: Never log PII - only token hash prefix for debugging
 *
 * @param {string} action - Action type (register_token, record_ballot, fetch_results)
 * @param {boolean} success - Whether action succeeded
 * @param {object} details - Additional details (no PII allowed)
 */
async function logAudit(action, success, details = {}) {
  try {
    // Sanitize details to ensure no PII
    const sanitizedDetails = sanitizeDetails(details);

    await pool.query(
      'INSERT INTO audit_log (action, success, details) VALUES ($1, $2, $3)',
      [action, success, sanitizedDetails]
    );

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Audit]', action, success ? '✓' : '✗', sanitizedDetails);
    }
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('[Audit] Failed to log audit event:', error.message);
  }
}

/**
 * Sanitize details object to remove any potential PII
 * Only allow: token_hash_prefix, answer, error messages
 */
function sanitizeDetails(details) {
  const sanitized = {};

  // Allow token hash prefix (first 8 chars for debugging)
  if (details.token_hash) {
    sanitized.token_hash_prefix = details.token_hash.substring(0, 8);
  }

  // Allow answer (yes/no/abstain - no PII)
  if (details.answer) {
    sanitized.answer = details.answer;
  }

  // Allow error messages (sanitized)
  if (details.error) {
    sanitized.error = typeof details.error === 'string'
      ? details.error
      : details.error.message || 'Unknown error';
  }

  // Allow count fields
  if (details.total_ballots !== undefined) {
    sanitized.total_ballots = details.total_ballots;
  }

  // Allow duration (performance monitoring)
  if (details.duration_ms !== undefined) {
    sanitized.duration_ms = details.duration_ms;
  }

  return sanitized;
}

/**
 * Get recent audit logs (for debugging)
 * @param {number} limit - Number of logs to retrieve
 */
async function getRecentAuditLogs(limit = 20) {
  try {
    const result = await pool.query(
      'SELECT id, timestamp, action, success, details FROM audit_log ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  } catch (error) {
    console.error('[Audit] Failed to retrieve audit logs:', error.message);
    throw error;
  }
}

module.exports = {
  logAudit,
  getRecentAuditLogs
};
