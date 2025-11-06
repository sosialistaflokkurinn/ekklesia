/**
 * RBAC (Role-Based Access Control) Middleware
 * Verifies Firebase ID tokens and checks user roles
 *
 * Roles:
 * - election-manager: Can create, edit, open, close, hide/unhide elections
 * - superadmin: Can do everything + hard delete elections
 *
 * Based on: Issue #192 - Admin Elections Dashboard
 * Security: Firebase custom claims for role management
 */

const admin = require('firebase-admin');

/**
 * Verify Firebase ID token and extract user claims
 * Attaches user info to req.user for downstream handlers
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
async function verifyFirebaseToken(req, res, next) {
  // Extract token from Authorization header
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('RBAC: Missing or invalid Authorization header', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || null, // Custom claim
      claims: decodedToken, // Full claims object
    };

    console.info('RBAC: Firebase token verified', {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      path: req.path,
    });

    next();
  } catch (error) {
    console.error('RBAC: Token verification failed', {
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      code: 'INVALID_AUTH_TOKEN',
      details: error.message,
    });
  }
}

/**
 * Require election-manager or superadmin role
 * Must be used after verifyFirebaseToken middleware
 *
 * @param {object} req - Express request (must have req.user)
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
function requireElectionManager(req, res, next) {
  if (!req.user) {
    console.error('RBAC: requireElectionManager called without req.user');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'RBAC middleware misconfigured',
    });
  }

  const userRole = req.user.role;
  const allowedRoles = ['election-manager', 'superadmin'];

  if (!allowedRoles.includes(userRole)) {
    console.warn('RBAC: Permission denied - insufficient role', {
      uid: req.user.uid,
      email: req.user.email,
      userRole,
      requiredRoles: allowedRoles,
      path: req.path,
      method: req.method,
    });

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions - requires election-manager or superadmin role',
      code: 'INSUFFICIENT_PERMISSIONS',
      userRole,
      requiredRoles: allowedRoles,
    });
  }

  console.info('RBAC: Access granted - election-manager or superadmin', {
    uid: req.user.uid,
    role: userRole,
    path: req.path,
  });

  next();
}

/**
 * Require superadmin role (strictest permission)
 * Used for hard delete and other destructive operations
 * Must be used after verifyFirebaseToken middleware
 *
 * @param {object} req - Express request (must have req.user)
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
function requireSuperadmin(req, res, next) {
  if (!req.user) {
    console.error('RBAC: requireSuperadmin called without req.user');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'RBAC middleware misconfigured',
    });
  }

  const userRole = req.user.role;

  if (userRole !== 'superadmin') {
    console.warn('RBAC: Permission denied - superadmin required', {
      uid: req.user.uid,
      email: req.user.email,
      userRole,
      requiredRole: 'superadmin',
      path: req.path,
      method: req.method,
    });

    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions - requires superadmin role',
      code: 'SUPERADMIN_REQUIRED',
      userRole,
      requiredRole: 'superadmin',
    });
  }

  console.info('RBAC: Access granted - superadmin', {
    uid: req.user.uid,
    role: userRole,
    path: req.path,
  });

  next();
}

/**
 * Helper: Check if user has specific role
 * Can be used in route handlers for custom logic
 *
 * @param {object} user - req.user object
 * @param {string} role - Role to check
 * @returns {boolean} - True if user has role
 */
function hasRole(user, role) {
  return user && user.role === role;
}

/**
 * Helper: Check if user has any of the specified roles
 *
 * @param {object} user - req.user object
 * @param {string[]} roles - Array of roles to check
 * @returns {boolean} - True if user has any of the roles
 */
function hasAnyRole(user, roles) {
  return user && roles.includes(user.role);
}

module.exports = {
  verifyFirebaseToken,
  requireElectionManager,
  requireSuperadmin,
  hasRole,
  hasAnyRole,
};
