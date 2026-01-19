/**
 * Client Error Reporting Routes
 *
 * Receives error reports from the frontend for production monitoring.
 * Errors are logged to Cloud Logging for analysis.
 *
 * Features:
 * - Rate limiting per IP to prevent abuse
 * - Error fingerprint deduplication (reduces log spam during outages)
 * - Volume-based throttling (samples errors during high volume)
 * - Validation of error payload structure
 * - Additional server-side PII sanitization
 * - No authentication required (errors can occur before login)
 *
 * Note: Rate limiting is per-instance (not distributed across Cloud Run instances).
 * This is acceptable for MVP. For true distributed rate limiting, use Redis.
 * See: Issue #402
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../utils/util-logger');

const router = express.Router();

/**
 * In-memory rate limiting per IP
 * Note: Per-instance only, not distributed across Cloud Run instances
 */
const rateLimitState = new Map();
const RATE_LIMIT = {
  maxRequests: 10,      // Max requests per window (reduced from 20)
  windowMs: 60 * 1000,  // 1 minute window
  cleanupMs: 5 * 60 * 1000  // Cleanup old entries every 5 minutes
};

/**
 * Error fingerprint deduplication
 * Prevents logging the same error multiple times during outages
 */
const errorFingerprints = new Map();
const DEDUP_CONFIG = {
  windowMs: 5 * 60 * 1000,  // 5 minute dedup window
  maxFingerprints: 1000,    // Max fingerprints to track (FIFO-style cleanup)
};

/**
 * Volume-based throttling
 * Reduces logging when error volume is high (during outages)
 */
const volumeState = {
  count: 0,
  windowStart: Date.now(),
  windowMs: 60 * 1000,      // 1 minute window
  normalThreshold: 50,      // Below this, log all errors
  highThreshold: 200,       // Above this, sample at 10%
  samplingRate: 0.1,        // 10% sampling during high volume
};

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitState.entries()) {
    if (now - data.windowStart > RATE_LIMIT.windowMs * 2) {
      rateLimitState.delete(ip);
    }
  }
  // Also cleanup old fingerprints
  for (const [fp, data] of errorFingerprints.entries()) {
    if (now - data.firstSeen > DEDUP_CONFIG.windowMs) {
      errorFingerprints.delete(fp);
    }
  }
  // Reset volume counter
  if (now - volumeState.windowStart > volumeState.windowMs) {
    volumeState.count = 0;
    volumeState.windowStart = now;
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
 * Generate fingerprint for error deduplication
 * Uses hash of error message + first line of stack trace
 *
 * @param {Object} error - Error object
 * @returns {string} Fingerprint hash
 */
function generateErrorFingerprint(error) {
  const message = error.message || '';
  // Use first line of stack trace (usually the error location)
  const stackFirstLine = (error.stack || '').split('\n')[1] || '';
  const fingerprintData = `${message}|${stackFirstLine}`;
  return crypto.createHash('md5').update(fingerprintData).digest('hex').substring(0, 16);
}

/**
 * Check if error is duplicate and should be deduplicated
 * Returns true if this is a NEW error, false if duplicate
 *
 * @param {string} fingerprint - Error fingerprint
 * @returns {{isNew: boolean, count: number}} Dedup result
 */
function checkErrorDedup(fingerprint) {
  const now = Date.now();
  const existing = errorFingerprints.get(fingerprint);

  if (!existing || now - existing.firstSeen > DEDUP_CONFIG.windowMs) {
    // New error or expired
    errorFingerprints.set(fingerprint, { firstSeen: now, count: 1 });

    // FIFO cleanup if too many fingerprints (Map maintains insertion order)
    if (errorFingerprints.size > DEDUP_CONFIG.maxFingerprints) {
      const oldestKey = errorFingerprints.keys().next().value;
      errorFingerprints.delete(oldestKey);
    }

    return { isNew: true, count: 1 };
  }

  // Duplicate - increment count but don't log
  existing.count++;
  return { isNew: false, count: existing.count };
}

/**
 * Check volume-based throttling
 * During high error volume, only sample a percentage of errors
 *
 * @returns {{shouldLog: boolean, volume: string}} Throttle result
 */
function checkVolumeThrottle() {
  const now = Date.now();

  // Reset window if expired
  if (now - volumeState.windowStart > volumeState.windowMs) {
    volumeState.count = 0;
    volumeState.windowStart = now;
  }

  volumeState.count++;

  // Below normal threshold - log all
  if (volumeState.count <= volumeState.normalThreshold) {
    return { shouldLog: true, volume: 'normal' };
  }

  // Between normal and high - log 50%
  if (volumeState.count <= volumeState.highThreshold) {
    const shouldLog = Math.random() < 0.5;
    return { shouldLog, volume: 'elevated' };
  }

  // Above high threshold - sample at configured rate
  const shouldLog = Math.random() < volumeState.samplingRate;
  return { shouldLog, volume: 'high' };
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

  // Volume throttling check (prevents log spam during outages)
  const volumeCheck = checkVolumeThrottle();

  // Sanitize and log each error
  const { errors, clientTimestamp, userAgent, url } = req.body;
  let loggedCount = 0;
  let dedupedCount = 0;
  let throttledCount = 0;

  for (const error of errors) {
    // Generate fingerprint for deduplication
    const fingerprint = generateErrorFingerprint(error);
    const dedupCheck = checkErrorDedup(fingerprint);

    // Skip duplicates (but count them)
    if (!dedupCheck.isNew) {
      dedupedCount++;
      continue;
    }

    // Skip if volume throttled (but count them)
    if (!volumeCheck.shouldLog) {
      throttledCount++;
      continue;
    }

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
      severity: sanitizedError.context?.severity || 'error',
      fingerprint,
      volumeLevel: volumeCheck.volume,
    });

    loggedCount++;
  }

  // Log batch summary (always, for monitoring)
  logger.info('Error batch received', {
    operation: 'error_batch_received',
    errorCount: errors.length,
    loggedCount,
    dedupedCount,
    throttledCount,
    volumeLevel: volumeCheck.volume,
    clientIp,
  });

  // Return success (202 Accepted - async processing implied)
  res.status(202).json({
    received: true,
    count: errors.length,
    logged: loggedCount,
    deduped: dedupedCount,
    throttled: throttledCount,
  });
});

/**
 * GET /api/errors/stats
 * Get error reporting statistics (for monitoring)
 * Note: In production, this would query stored errors
 */
router.get('/stats', (req, res) => {
  const now = Date.now();

  // Determine volume level
  let volumeLevel = 'normal';
  if (volumeState.count > volumeState.highThreshold) {
    volumeLevel = 'high';
  } else if (volumeState.count > volumeState.normalThreshold) {
    volumeLevel = 'elevated';
  }

  res.json({
    status: 'operational',
    rateLimiting: {
      activeIps: rateLimitState.size,
      maxRequestsPerMinute: RATE_LIMIT.maxRequests,
    },
    deduplication: {
      trackedFingerprints: errorFingerprints.size,
      maxFingerprints: DEDUP_CONFIG.maxFingerprints,
      windowMinutes: DEDUP_CONFIG.windowMs / 60000,
    },
    volumeThrottling: {
      currentCount: volumeState.count,
      volumeLevel,
      windowAgeMs: now - volumeState.windowStart,
      thresholds: {
        normal: volumeState.normalThreshold,
        high: volumeState.highThreshold,
      },
      samplingRate: volumeLevel === 'high' ? volumeState.samplingRate : (volumeLevel === 'elevated' ? 0.5 : 1.0),
    },
    note: 'Errors are logged to Cloud Logging. Use GCP Console to view. Rate limiting is per-instance.',
  });
});

module.exports = router;
