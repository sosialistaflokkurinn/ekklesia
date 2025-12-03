const pool = require('../config/config-database');
const logger = require('../utils/util-logger');

// Create dedicated audit logger for Cloud Logging audit stream
// This creates a separate log entry type for easy filtering in Cloud Logging
const auditLogger = logger.child({
  logName: 'elections-audit',
  component: 'audit'
});

/**
 * Log audit event to BOTH database AND Cloud Logging
 * IMPORTANT: Never log PII - only correlation_id for debugging
 *
 * Dual-write approach:
 * 1. Database: Permanent record for compliance/legal
 * 2. Cloud Logging: Real-time monitoring, alerting, and correlation
 *
 * Cloud Logging queries:
 *   jsonPayload.component="audit"
 *   jsonPayload.event="submit_vote"
 *   jsonPayload.success=false
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

  // 1. Write to Cloud Logging audit stream (immediate, for monitoring/alerting)
  const logLevel = success ? 'info' : 'warn';
  auditLogger[logLevel]('Audit event', {
    operation: 'audit',
    event: action,
    success,
    ...sanitizedDetails,
    timestamp: new Date().toISOString(),
  });

  // 2. Fire-and-forget insert to database (permanent record)
  pool.query(
    'INSERT INTO audit_log (action, success, details) VALUES ($1, $2, $3)',
    [action, success, sanitizedDetails]
  )
    .then(() => {
      // Log successful DB write in development only (reduce noise in production)
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Audit event persisted to DB', {
          operation: 'audit_log_db',
          action,
          success
        });
      }
    })
    .catch((error) => {
      // Don't fail the request if DB audit logging fails
      // Cloud Logging already has the event
      logger.error('Audit DB write failed (Cloud Logging has event)', {
        operation: 'audit_log_db',
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

  // Election context fields (no PII)
  if (details.election_id) {
    sanitized.election_id = details.election_id;
  }
  if (details.election_title) {
    sanitized.election_title = details.election_title;
  }
  if (details.title) {
    sanitized.title = details.title;
  }

  // User context (already hashed, safe to log)
  if (details.uid_hash) {
    sanitized.uid_hash = details.uid_hash;
  }
  if (details.role) {
    sanitized.role = details.role;
  }

  // Voting context (no PII)
  if (details.answer_count !== undefined) {
    sanitized.answer_count = details.answer_count;
  }
  if (details.ballot_ids) {
    sanitized.ballot_ids = details.ballot_ids;
  }
  if (details.voting_type) {
    sanitized.voting_type = details.voting_type;
  }

  // Schedule context
  if (details.scheduled_start) {
    sanitized.scheduled_start = details.scheduled_start;
  }
  if (details.scheduled_end) {
    sanitized.scheduled_end = details.scheduled_end;
  }

  // Admin operation context
  if (details.updated_fields) {
    sanitized.updated_fields = details.updated_fields;
  }
  if (details.filters) {
    sanitized.filters = details.filters;
  }
  if (details.count !== undefined) {
    sanitized.count = details.count;
  }
  if (details.total !== undefined) {
    sanitized.total = details.total;
  }
  if (details.total_votes !== undefined) {
    sanitized.total_votes = details.total_votes;
  }
  if (details.status) {
    sanitized.status = details.status;
  }
  if (details.anonymized_count !== undefined) {
    sanitized.anonymized_count = details.anonymized_count;
  }
  if (details.election_status) {
    sanitized.election_status = details.election_status;
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
