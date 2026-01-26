const admin = require('../config/config-firebase');
const crypto = require('crypto');
const logger = require('../utils/util-logger');

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a, b) {
  if (!a || !b) return false;
  const strA = String(a);
  const strB = String(b);
  const maxLen = Math.max(strA.length, strB.length);
  const bufA = Buffer.alloc(maxLen, 0);
  const bufB = Buffer.alloc(maxLen, 0);
  bufA.write(strA);
  bufB.write(strB);
  const equal = crypto.timingSafeEqual(bufA, bufB);
  return equal && strA.length === strB.length;
}

/**
 * Authentication Middleware
 * Verifies Firebase ID token from Members service
 *
 * Expected token claims:
 * - uid: Firebase user ID
 * - kennitala: Icelandic national ID (DDMMYY-XXXX)
 * - isMember: boolean (membership status)
 *
 * S2S Bypass: Server-to-server calls can use X-API-Key + X-User-Id headers
 * Used by: xj-next for proxied chat requests
 *
 * Adds `req.user` with verified claims
 */
async function authenticate(req, res, next) {
  try {
    // S2S bypass: Allow server-to-server calls with API key + user info
    const apiKey = req.header('X-API-Key');
    const expectedKey = process.env.S2S_API_KEY;
    const s2sUserId = req.header('X-User-Id');

    // Debug logging for S2S auth
    logger.info('S2S auth check', {
      operation: 'authenticate_debug',
      hasApiKey: !!apiKey,
      hasExpectedKey: !!expectedKey,
      hasUserId: !!s2sUserId,
      apiKeyLength: apiKey?.length,
      expectedKeyLength: expectedKey?.length,
      path: req.path,
    });

    if (apiKey && expectedKey && secureCompare(apiKey, expectedKey) && s2sUserId) {
      logger.info('S2S authentication successful', {
        operation: 'authenticate',
        bypass: 's2s_api_key',
        userId: s2sUserId,
        path: req.path,
      });

      // Fetch user data from Firebase to get claims
      try {
        const userRecord = await admin.auth().getUser(s2sUserId);
        const customClaims = userRecord.customClaims || {};

        req.user = {
          uid: s2sUserId,
          email: userRecord.email,
          name: userRecord.displayName,
          kennitala: customClaims.kennitala,
          isMember: customClaims.isMember,
          roles: Array.isArray(customClaims.roles) ? customClaims.roles : [],
        };

        return next();
      } catch (userError) {
        logger.error('S2S auth: Failed to fetch user', {
          operation: 'authenticate',
          userId: s2sUserId,
          error: userError.message,
        });
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Authentication failed',
        });
      }
    }

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Security: Basic token format validation
    if (!idToken || idToken.length < 100 || idToken.length > 2048) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed'
      });
    }

    // Verify token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Extract required claims
    const { uid, kennitala, isMember } = decodedToken;

    // Security: Use generic error message to prevent claim enumeration
    if (!uid || !kennitala) {
      logger.warn('Token missing required claims', {
        operation: 'authenticate',
        hasUid: !!uid,
        hasKennitala: !!kennitala
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication failed'
      });
    }

    // Check membership status
    if (!isMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Active membership required'
      });
    }

    // Attach user info to request (include roles array if present)
    req.user = {
      uid,
      kennitala,
      isMember,
      roles: Array.isArray(decodedToken.roles) ? decodedToken.roles : []
    };

    next();
  } catch (error) {
    // Security: Log details internally but return generic message to client
    logger.error('Authentication failed', {
      operation: 'authenticate',
      error_code: error.code,
      correlation_id: req.correlationId
    });

    // Security: Use generic error messages to prevent information disclosure
    // All auth errors return the same message to prevent timing/enumeration attacks
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed'
    });
  }
}

module.exports = authenticate;
