/**
 * Request Timeout Middleware
 *
 * Prevents long-running requests from hanging indefinitely.
 * Returns 503 Service Unavailable if request exceeds timeout.
 *
 * @module middleware/timeout
 */

const logger = require('../utils/util-logger');

/**
 * Create a timeout middleware with specified duration
 *
 * @param {number} durationMs - Timeout duration in milliseconds
 * @param {string} operation - Operation name for logging
 * @returns {Function} Express middleware function
 *
 * @example
 * // 10 second timeout for read operations
 * router.get('/elections', timeoutMiddleware(10000, 'list_elections'), handler);
 *
 * // 30 second timeout for heavy operations
 * router.get('/results', timeoutMiddleware(30000, 'get_results'), handler);
 */
function timeoutMiddleware(durationMs, operation = 'request') {
  return (req, res, next) => {
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;

      logger.warn('Request timeout', {
        operation: 'request_timeout',
        request_operation: operation,
        timeout_ms: durationMs,
        path: req.path,
        method: req.method,
        correlation_id: req.correlationId
      });

      if (!res.headersSent) {
        // Security: Generic message - don't expose exact timeout duration
        res.status(503).json({
          error: 'Service Unavailable',
          message: 'Request timeout',
          retryAfter: 5
        });
      }
    }, durationMs);

    // Security: Clear timeout on both finish and close events
    // to prevent resource leaks on aborted connections
    const cleanup = () => clearTimeout(timeoutId);
    res.on('finish', cleanup);
    res.on('close', cleanup);

    // Attach timeout state to request for downstream middleware
    req.timedOut = () => timedOut;

    next();
  };
}

/** Default timeouts for common operations */
const TIMEOUTS = {
  READ: 10000,      // 10 seconds for GET operations
  WRITE: 15000,     // 15 seconds for POST/PUT/DELETE
  HEAVY: 30000,     // 30 seconds for complex calculations
  QUICK: 5000       // 5 seconds for simple lookups
};

module.exports = {
  timeoutMiddleware,
  TIMEOUTS
};
