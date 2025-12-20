/**
 * Server-to-Server Authentication Middleware
 * Validates API key for S2S endpoints (Events service only)
 *
 * Security improvements:
 * - Constant-time comparison using HMAC to avoid length leakage
 * - Generic error responses
 * - Rate limiting integration recommended
 */

const crypto = require('crypto');
const logger = require('../utils/util-logger');

/**
 * Perform constant-time comparison that doesn't leak length information
 * Uses HMAC to normalize inputs to same length before comparison
 */
function secureCompare(a, b) {
  if (!a || !b) return false;

  // Use HMAC with a random key to normalize both inputs to same length
  // This prevents timing attacks based on length differences
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(String(a)).digest();
  const hmacB = crypto.createHmac('sha256', key).update(String(b)).digest();

  return crypto.timingSafeEqual(hmacA, hmacB);
}

function authenticateS2S(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.S2S_API_KEY;

  // Generic error for all auth failures (prevents information leakage)
  const authError = {
    error: 'Unauthorized',
    message: 'Authentication failed'
  };

  // Check if both keys exist
  if (!apiKey || !expectedKey) {
    logger.warn('[S2S Auth] Missing API key', {
      hasApiKey: !!apiKey,
      hasExpectedKey: !!expectedKey,
      ip: req.ip
    });
    return res.status(401).json(authError);
  }

  // Security: Use HMAC-based comparison to prevent length leakage
  if (!secureCompare(apiKey, expectedKey)) {
    logger.warn('[S2S Auth] Invalid API key attempt', {
      ip: req.ip
    });
    return res.status(401).json(authError);
  }

  // API key valid, proceed
  next();
}

module.exports = authenticateS2S;
