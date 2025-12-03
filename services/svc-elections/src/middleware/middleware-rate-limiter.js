/**
 * Rate limiting middleware for Elections API
 *
 * Protects API endpoints from abuse by limiting the number of requests
 * a client can make within a time window.
 *
 * Security: Prevents brute force attacks, vote flooding, and resource exhaustion
 */

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

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
  keyGenerator: ipKeyGenerator, // Use library's IPv6-safe helper
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false // Disable `X-RateLimit-*` headers
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
  keyGenerator: ipKeyGenerator, // Use library's IPv6-safe helper
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many write requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
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
  keyGenerator: ipKeyGenerator, // Use library's IPv6-safe helper
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many vote attempts, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for successful votes (to avoid penalizing legitimate voters)
  skip: (req, res) => {
    // Only apply rate limit to failed attempts
    // Successful votes are already protected by database UNIQUE constraint
    return res.statusCode === 200 || res.statusCode === 201;
  }
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
  keyGenerator: ipKeyGenerator, // Use library's IPv6-safe helper
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many admin requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  readLimiter,
  writeLimiter,
  voteLimiter,
  adminLimiter
};
