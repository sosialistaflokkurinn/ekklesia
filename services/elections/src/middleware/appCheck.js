/**
 * Firebase App Check Middleware
 * Verifies that requests come from legitimate app instances
 *
 * Security: Protects against bots, direct API access, replay attacks
 * Cost: $0 (500k verifications/month free, Ekklesia uses ~1,500/month)
 *
 * Based on: Cloud Run Security: Firebase App Check research document
 * Implementation: docs/security/FIREBASE_APP_CHECK_IMPLEMENTATION.md
 */

const admin = require('../firebase'); // Use initialized Firebase Admin SDK

/**
 * Verify Firebase App Check token (ENFORCED)
 * Returns 403 if token is missing or invalid
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
async function verifyAppCheck(req, res, next) {
  const appCheckToken = req.header('X-Firebase-AppCheck');

  // Check if App Check token is present
  if (!appCheckToken) {
    console.warn('App Check verification failed: Missing token', {
      path: req.path,
      method: req.method,
      ip: req.ip,
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

    console.info('App Check verification successful', {
      appId: appCheckClaims.app_id,
      path: req.path,
    });

    next();
  } catch (error) {
    console.error('App Check verification failed: Invalid token', {
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
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
    console.warn('Optional App Check: Missing token (allowed)', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    return next();
  }

  try {
    const appCheckClaims = await admin.appCheck().verifyToken(appCheckToken);
    req.appCheckClaims = appCheckClaims;

    console.info('Optional App Check: Verification successful', {
      appId: appCheckClaims.app_id,
      path: req.path,
    });
  } catch (error) {
    console.warn('Optional App Check: Verification failed (allowed)', {
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });
    // Continue anyway (optional verification)
  }

  next();
}

module.exports = {
  verifyAppCheck,
  verifyAppCheckOptional,
};
