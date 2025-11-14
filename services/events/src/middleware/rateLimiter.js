/**
 * Rate limiting middleware for Events API
 *
 * Protects API endpoints from abuse by limiting the number of requests
 * a client can make within a time window.
 *
 * Security: Prevents brute force attacks, token flooding, and resource exhaustion
 */

const rateLimit = require('express-rate-limit');

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
  // Use IP address for rate limiting
  keyGenerator: (req) => {
    // Use X-Forwarded-For if behind proxy (Cloud Run), otherwise use req.ip
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  }
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
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  }
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
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  },
  // Skip rate limiting for successful token issuance (to avoid penalizing legitimate users)
  skip: (req, res) => {
    // Only apply rate limit to failed attempts
    // Successful token issuance is already protected by database UNIQUE constraint
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
  max: 60, // 60 requests per window
  message: {
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many admin requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  }
});

module.exports = {
  readLimiter,
  writeLimiter,
  tokenLimiter,
  adminLimiter
};
