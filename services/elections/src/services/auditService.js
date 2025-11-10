const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * Log audit event to database
 * IMPORTANT: Never log PII - only correlation_id for debugging
 *
 * @param {string} action - Action type (register_token, record_ballot, fetch_results)
 * @param {boolean} success - Whether action succeeded
 * @param {object} details - Additional details (no PII allowed)
 */
function logAudit(action, success, details = {}) {
  let sanitizedDetails;

  try {
    // Sanitize details to ensure no PII
    sanitizedDetails = sanitizeDetails(details);
  } catch (error) {
    logger.error('Audit details sanitization failed', {
      operation: 'audit_sanitization',
      error: error.message,
      stack: error.stack
    });
    sanitizedDetails = { error: 'sanitization_failed' };
  }

  // Fire-and-forget insert so request handlers do not block on logging
  pool.query(
    'INSERT INTO audit_log (action, success, details) VALUES ($1, $2, $3)',
    [action, success, sanitizedDetails]
  )
    .then(() => {
      // Log successful audit in development only (reduce noise in production)
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Audit event logged', {
          operation: 'audit_log',
          action,
          success,
          details: sanitizedDetails
        });
      }
    })
    .catch((error) => {
      // Don't fail the request if audit logging fails
      logger.error('Audit event logging failed', {
        operation: 'audit_log',
        action,
        error: error.message,
        stack: error.stack
      });
    });
}

/**
 * Sanitize details object to remove any potential PII
 * Only allow: correlation_id (random), answer, error messages, metrics
 *
 * IMPORTANT: Do NOT log token_hash or token_hash_prefix
 * Reason: Even partial token hash could enable deanonymization attacks
 *         when combined with timing data or database breach.
 */
function sanitizeDetails(details) {
  const sanitized = {};

  // Allow correlation_id (random UUID, not derived from token)
  // Use for request tracing without deanonymization risk
  if (details.correlation_id) {
    sanitized.correlation_id = details.correlation_id;
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

  // Explicitly drop any token-related fields to prevent accidental logging
  // This ensures absolute voter anonymity even in audit logs
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
    logger.error('Failed to retrieve audit logs', {
      operation: 'get_audit_logs',
      error: error.message,
      stack: error.stack,
      limit
    });
    throw error;
  }
}

module.exports = {
  logAudit,
  getRecentAuditLogs
};
