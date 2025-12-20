const admin = require('../config/config-firebase');
const logger = require('../utils/util-logger');

/**
 * Authentication Middleware
 * Verifies Firebase ID token from Members service
 *
 * Expected token claims:
 * - uid: Firebase user ID
 * - kennitala: Icelandic national ID (DDMMYY-XXXX)
 * - isMember: boolean (membership status)
 *
 * Adds `req.user` with verified claims
 */
async function authenticate(req, res, next) {
  try {
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
