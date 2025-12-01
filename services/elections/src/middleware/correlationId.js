/**
 * Correlation ID Middleware
 *
 * Adds unique request ID to every request for tracing.
 * Supports incoming X-Request-Id header (for distributed tracing)
 * or generates new UUID.
 *
 * Usage:
 * - req.correlationId - Access the correlation ID
 * - req.logger - Child logger with correlation ID pre-attached
 * - Response includes X-Correlation-Id header for client debugging
 *
 * Cloud Logging queries:
 *   jsonPayload.correlationId="abc-123-def"
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Correlation ID middleware
 * Attaches correlationId and scoped logger to every request
 */
function correlationIdMiddleware(req, res, next) {
  // Use incoming header or generate new ID
  const correlationId = req.header('X-Request-Id') ||
                        req.header('X-Correlation-Id') ||
                        crypto.randomUUID();

  // Attach to request
  req.correlationId = correlationId;

  // Add to response headers (for client debugging)
  res.setHeader('X-Correlation-Id', correlationId);

  // Create request-scoped logger with correlation ID pre-attached
  req.logger = logger.child({
    correlationId,
    path: req.path,
    method: req.method,
  });

  // Track request timing
  req.requestStartTime = Date.now();

  // Log request start (only in development to reduce noise)
  if (process.env.NODE_ENV !== 'production') {
    req.logger.debug('Request started', {
      operation: 'http_request',
      event: 'request_start',
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  }

  // Log request completion
  res.on('finish', () => {
    const duration = Date.now() - req.requestStartTime;

    // Log all requests in production for monitoring, but at appropriate levels
    const logLevel = res.statusCode >= 500 ? 'error'
                   : res.statusCode >= 400 ? 'warn'
                   : 'info';

    req.logger[logLevel]('Request completed', {
      operation: 'http_request',
      event: 'request_end',
      status: res.statusCode,
      duration_ms: duration,
    });
  });

  next();
}

module.exports = correlationIdMiddleware;
