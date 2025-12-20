/**
 * Rate limiting middleware for Events API
 *
 * Protects API endpoints from abuse by limiting the number of requests
 * a client can make within a time window.
 *
 * Security: Prevents brute force attacks, token flooding, and resource exhaustion
 *
 * Key generation priority:
 * 1. Authenticated user ID (hardest to spoof)
 * 2. IP + User-Agent fingerprint (fallback)
 */

const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

/**
 * Generate a rate limit key with fingerprinting
 *
 * Uses authenticated user ID when available, otherwise falls back
 * to IP + User-Agent fingerprint to make spoofing harder.
 *
 * @param {Object} req - Express request object
 * @returns {string} Rate limit key
 */
function fingerprintKeyGenerator(req) {
  // Prefer authenticated user ID (harder to spoof)
  if (req.user?.uid) {
    return `user:${req.user.uid}`;
  }

  // Fallback to IP + User-Agent fingerprint
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}`)
    .digest('hex')
    .substring(0, 16);

  return `fp:${fingerprint}`;
}

/**
 * Rate limiter for read operations (GET requests)
 *
 * Applied to: GET /election, GET /token-status, GET /results
 * Limit: 100 requests per minute per IP
 */
const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: fingerprintKeyGenerator,
  // Disable validation - Cloud Run handles IPv6 via load balancer
  validate: false
});

/**
 * Rate limiter for write operations (POST, PUT, DELETE)
 *
 * Applied to: General write operations
 * Limit: 30 requests per minute per IP
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per window
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many write requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: fingerprintKeyGenerator,
  validate: false
});

/**
 * Rate limiter for token issuance
 *
 * Applied to: POST /request-token
 * Limit: 10 requests per minute per IP (strict to prevent token flooding)
 */
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window (strict for security)
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many token requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: fingerprintKeyGenerator,
  validate: false
  // Note: Removed skip() to prevent rate limit bypass via validation errors
  // All attempts now count against the rate limit
});

/**
 * Rate limiter for admin operations
 *
 * Applied to: All /admin/* endpoints
 * Limit: 60 requests per minute per IP (moderate limit for admin operations)
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per window
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many admin requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: fingerprintKeyGenerator,
  validate: false
});

module.exports = {
  readLimiter,
  writeLimiter,
  tokenLimiter,
  adminLimiter
};
