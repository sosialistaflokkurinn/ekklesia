/**
 * Firebase App Check Middleware
 * Verifies that requests come from legitimate app instances
 *
 * Security: Protects against bots, direct API access, replay attacks
 * Cost: $0 (500k verifications/month free, Ekklesia uses ~1,500/month)
 *
 * Based on: Cloud Run Security: Firebase App Check research document
 * Implementation: docs/security/FIREBASE_APP_CHECK_IMPLEMENTATION.md
 *
 * S2S Bypass: Server-to-server calls can use X-API-Key header instead
 * Used by: xj-next (sosialistaflokkurinn.is) for /api/external-events
 */

const admin = require('firebase-admin');
const crypto = require('crypto');
const logger = require('../utils/util-logger');

/**
 * Constant-time string comparison to prevent timing attacks
 * Uses HMAC to normalize inputs to same length before comparison
 */
function secureCompare(a, b) {
  if (!a || !b) return false;
  const key = crypto.randomBytes(32);
  const hmacA = crypto.createHmac('sha256', key).update(String(a)).digest();
  const hmacB = crypto.createHmac('sha256', key).update(String(b)).digest();
  return crypto.timingSafeEqual(hmacA, hmacB);
}

/**
 * Verify Firebase App Check token (ENFORCED)
 * Returns 403 if token is missing or invalid
 *
 * S2S Bypass: Accepts X-API-Key header as alternative for server-to-server calls
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
async function verifyAppCheck(req, res, next) {
  // S2S bypass: Allow server-to-server calls with API key
  const apiKey = req.header('X-API-Key');
  const expectedKey = process.env.S2S_API_KEY;

  if (apiKey && expectedKey && secureCompare(apiKey, expectedKey)) {
    logger.info('S2S authentication successful (App Check bypass)', {
      operation: 'app_check_verification',
      bypass: 's2s_api_key',
      path: req.path,
      method: req.method
    });
    return next();
  }

  const appCheckToken = req.header('X-Firebase-AppCheck');

  // Check if App Check token is present
  if (!appCheckToken) {
    logger.warn('App Check verification failed: Missing token', {
      operation: 'app_check_verification',
      enforcement: 'enforced',
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Return 403 Forbidden (missing token)
    return res.status(403).json({
      error: 'App Check verification failed',
      message: 'Request must come from legitimate app',
      code: 'MISSING_APP_CHECK_TOKEN',
    });
  }

  // Verify the App Check token
  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);

    // Token is valid, attach claims to request
    req.appCheckClaims = appCheckClaims;

    logger.info('App Check verification successful', {
      operation: 'app_check_verification',
      enforcement: 'enforced',
      appId: appCheckClaims.app_id,
      path: req.path
    });

    next();
  } catch (error) {
    logger.error('App Check verification failed: Invalid token', {
      operation: 'app_check_verification',
      enforcement: 'enforced',
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    // Return 403 Forbidden (invalid token)
    return res.status(403).json({
      error: 'App Check verification failed',
      message: 'Invalid or expired app token',
      code: 'INVALID_APP_CHECK_TOKEN',
      details: error.message,
    });
  }
}

/**
 * Optional App Check verification (MONITOR-ONLY MODE)
 * Logs verification status but allows requests to continue
 * Use during transition period before enforcement
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
async function verifyAppCheckOptional(req, res, next) {
  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    logger.warn('Optional App Check: Missing token (allowed)', {
      operation: 'app_check_verification',
      enforcement: 'monitor_only',
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    return next();
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    req.appCheckClaims = appCheckClaims;

    logger.info('Optional App Check: Verification successful', {
      operation: 'app_check_verification',
      enforcement: 'monitor_only',
      appId: appCheckClaims.app_id,
      path: req.path
    });
  } catch (error) {
    logger.warn('Optional App Check: Verification failed (allowed)', {
      operation: 'app_check_verification',
      enforcement: 'monitor_only',
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    // Continue anyway (optional verification)
  }

  next();
}

module.exports = {
  verifyAppCheck,
  verifyAppCheckOptional,
};
