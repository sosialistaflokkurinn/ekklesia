/**
 * Client Error Reporting Routes
 *
 * Receives error reports from the frontend for production monitoring.
 * Errors are logged to Cloud Logging for analysis.
 *
 * Features:
 * - Rate limiting per IP to prevent abuse
 * - Validation of error payload structure
 * - Additional server-side PII sanitization
 * - No authentication required (errors can occur before login)
 */

const express = require('express');
const logger = require('../utils/util-logger');

const router = express.Router();

/**
 * In-memory rate limiting per IP
 * Simple implementation - resets on service restart
 */
const rateLimitState = new Map();
const RATE_LIMIT = {
  maxRequests: 20,      // Max requests per window
  windowMs: 60 * 1000,  // 1 minute window
  cleanupMs: 5 * 60 * 1000  // Cleanup old entries every 5 minutes
};

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitState.entries()) {
    if (now - data.windowStart > RATE_LIMIT.windowMs * 2) {
      rateLimitState.delete(ip);
    }
  }
}, RATE_LIMIT.cleanupMs);

/**
 * Check rate limit for IP
 * @param {string} ip - Client IP address
 * @returns {boolean} True if allowed, false if rate limited
 */
function checkRateLimit(ip) {
  const now = Date.now();
  let data = rateLimitState.get(ip);

  if (!data || now - data.windowStart > RATE_LIMIT.windowMs) {
    // New window
    data = { count: 1, windowStart: now };
    rateLimitState.set(ip, data);
    return true;
  }

  if (data.count >= RATE_LIMIT.maxRequests) {
    return false;
  }

  data.count++;
  return true;
}

/**
 * Server-side PII patterns (backup sanitization)
 */
const PII_PATTERNS = [
  /\b\d{6}[-–]?\d{4}\b/g,  // Kennitala
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,  // Email
  /\b\d{3}[-–\s]?\d{4}\b/g,  // Phone
];

/**
 * Sanitize string for PII (server-side backup)
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizePII(str) {
  if (typeof str !== 'string') return str;
  let sanitized = str;
  for (const pattern of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

/**
 * Sanitize error object recursively
 * @param {*} obj - Object to sanitize
 * @param {number} depth - Current depth
 * @returns {*} Sanitized object
 */
function sanitizeObject(obj, depth = 0) {
  if (depth > 3) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return sanitizePII(obj);
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    const keys = Object.keys(obj).slice(0, 20);
    for (const key of keys) {
      if (/password|token|secret|auth|credential|kennitala|ssn/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeObject(obj[key], depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate error report structure
 * @param {Object} body - Request body
 * @returns {{valid: boolean, error?: string}} Validation result
 */
function validateErrorReport(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  if (!Array.isArray(body.errors)) {
    return { valid: false, error: 'errors must be an array' };
  }

  if (body.errors.length === 0) {
    return { valid: false, error: 'errors array is empty' };
  }

  if (body.errors.length > 10) {
    return { valid: false, error: 'Too many errors in batch (max 10)' };
  }

  // Validate each error has required fields
  for (const error of body.errors) {
    if (!error.message || typeof error.message !== 'string') {
      return { valid: false, error: 'Each error must have a message string' };
    }
  }

  return { valid: true };
}

/**
 * POST /api/errors
 * Receive error reports from frontend
 *
 * Expected body:
 * {
 *   errors: [
 *     { timestamp, message, stack, name, context, page }
 *   ],
 *   clientTimestamp: string,
 *   userAgent: string,
 *   url: string
 * }
 */
router.post('/', (req, res) => {
  // Get client IP (considering proxies)
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  // Rate limit check
  if (!checkRateLimit(clientIp)) {
    logger.warn('Error reporting rate limited', {
      operation: 'error_report_rate_limited',
      clientIp
    });
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Error reporting rate limit exceeded'
    });
  }

  // Validate payload
  const validation = validateErrorReport(req.body);
  if (!validation.valid) {
    return res.status(400).json({
      error: 'Bad Request',
      message: validation.error
    });
  }

  // Sanitize and log each error
  const { errors, clientTimestamp, userAgent, url } = req.body;

  for (const error of errors) {
    // Apply server-side sanitization as backup
    const sanitizedError = sanitizeObject(error);
    const sanitizedUrl = sanitizePII(url || '');

    // Log to Cloud Logging with structured data
    logger.error('Client error reported', {
      operation: 'client_error',
      source: 'frontend',
      clientIp,
      clientTimestamp,
      userAgent: userAgent?.substring(0, 200),  // Limit length
      pageUrl: sanitizedUrl,
      errorName: sanitizedError.name || 'Error',
      errorMessage: sanitizedError.message?.substring(0, 1000),  // Limit length
      errorStack: sanitizedError.stack?.substring(0, 2000),  // Limit length
      errorPage: sanitizedError.page,
      errorContext: sanitizedError.context,
      severity: sanitizedError.context?.severity || 'error'
    });
  }

  logger.info('Error batch received', {
    operation: 'error_batch_received',
    errorCount: errors.length,
    clientIp
  });

  // Return success (202 Accepted - async processing implied)
  res.status(202).json({
    received: true,
    count: errors.length
  });
});

/**
 * GET /api/errors/stats
 * Get error reporting statistics (for monitoring)
 * Note: In production, this would query stored errors
 */
router.get('/stats', (req, res) => {
  // For now, just return rate limit state info
  const activeIps = rateLimitState.size;

  res.json({
    status: 'operational',
    rateLimiting: {
      activeIps,
      maxRequestsPerMinute: RATE_LIMIT.maxRequests
    },
    note: 'Errors are logged to Cloud Logging. Use GCP Console to view.'
  });
});

module.exports = router;
