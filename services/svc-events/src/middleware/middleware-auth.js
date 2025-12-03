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
        message: 'Missing or invalid Authorization header. Expected: Bearer <token>'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify token with Firebase Admin SDK
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Extract required claims
    const { uid, kennitala, isMember } = decodedToken;

    // Validate required claims exist
    if (!uid) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token: missing uid claim'
      });
    }

    if (!kennitala) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token: missing kennitala claim'
      });
    }

    // Check membership status
    if (!isMember) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Active membership required. Please verify your membership status.'
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
    logger.error('Authentication failed', {
      operation: 'authenticate',
      error: error.message,
      code: error.code,
      stack: error.stack
    });

    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token expired. Please log in again.'
      });
    }

    if (error.code === 'auth/argument-error') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token format'
      });
    }

    // Generic error
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Failed to verify authentication token'
    });
  }
}

module.exports = authenticate;
