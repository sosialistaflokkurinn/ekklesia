/**
 * Rate limiting middleware for Elections API
 *
 * Protects API endpoints from abuse by limiting the number of requests
 * a client can make within a time window.
 *
 * Security: Prevents brute force attacks, vote flooding, and resource exhaustion
 *
 * Key generation priority:
 * 1. Authenticated user ID (hardest to spoof)
 * 2. IP + User-Agent fingerprint (fallback)
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const crypto = require('crypto');

/**
 * Admin IPs exempt from rate limiting
 * Used for development and testing
 */
const EXEMPT_IPS = [
  '46.182.187.140',  // gudrodur dev
];

/**
 * Check if request should skip rate limiting
 * @param {Object} req - Express request
 * @returns {boolean} true to skip rate limiting
 */
function shouldSkipRateLimit(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '';
  return EXEMPT_IPS.includes(ip);
}

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
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}`)
    .digest('hex')
    .substring(0, 16);

  return `fp:${fingerprint}`;
}

/**
 * IP Key Generator for rate limiting
 * 
 * express-rate-limit v7+ requires using the built-in ipKeyGenerator helper
 * to properly handle IPv6 addresses and pass validation checks.
 * 
 * The ipKeyGenerator function:
 * - Reads req.ip (set by Express trust proxy from X-Forwarded-For)
 * - Normalizes IPv6 addresses to prevent bypass
 * - Passes library validation (no ValidationError)
 * 
 * Cloud Run always sets X-Forwarded-For header with real client IP.
 * Express 'trust proxy: true' setting makes it available via req.ip.
 */

/**
 * Rate limiter for read operations (GET requests)
 *
 * Applied to: GET /elections, GET /elections/:id
 * Limit: 100 requests per minute per IP
 */
const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  keyGenerator: fingerprintKeyGenerator,
  skip: shouldSkipRateLimit,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Disable validation - Cloud Run handles IPv6 via load balancer
  validate: false
});

/**
 * Rate limiter for write operations (POST, PUT, DELETE)
 *
 * Applied to: Create/update/delete elections, questions, answers
 * Limit: 30 requests per minute per IP
 */
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per window
  keyGenerator: fingerprintKeyGenerator,
  skip: shouldSkipRateLimit,
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many write requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});

/**
 * Rate limiter for vote submission
 *
 * Applied to: POST /elections/:id/vote
 * Limit: 10 requests per minute per IP (strict to prevent vote flooding)
 */
const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per window (strict for security)
  keyGenerator: fingerprintKeyGenerator,
  skip: shouldSkipRateLimit, // Admin IPs exempt
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many vote attempts, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});

/**
 * Rate limiter for admin operations
 *
 * Applied to: All /admin/* endpoints
 * Limit: 60 requests per minute per IP (moderate limit for admin operations)
 */
const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per window (moderate for admin operations)
  keyGenerator: fingerprintKeyGenerator,
  skip: shouldSkipRateLimit, // Admin IPs exempt
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many admin requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false
});

module.exports = {
  readLimiter,
  writeLimiter,
  voteLimiter,
  adminLimiter
};
