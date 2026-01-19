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
 *
 * Defense-in-depth: Elevated roles are verified against Firestore
 * to prevent privilege escalation from compromised token claims.
 * See: Issue #394
 */

const admin = require('../firebase'); // Use initialized Firebase Admin SDK
const logger = require('../utils/util-logger');

// Firestore instance for role verification
const db = admin.firestore();

/**
 * Verify elevated role claims against Firestore database
 * Defense-in-depth: Ensures token claims match database source of truth
 *
 * @param {string} uid - Firebase UID
 * @param {string} claimedRole - Role from token claims (superadmin or election-manager)
 * @returns {Promise<{verified: boolean, dbRoles: string[]}>}
 */
async function verifyRoleAgainstDatabase(uid, claimedRole) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      // No Firestore document - could be legacy user or data inconsistency
      logger.warn('RBAC: No Firestore document for elevated user', {
        uid,
        claimedRole,
      });
      return { verified: false, dbRoles: [] };
    }

    const userData = userDoc.data();
    const dbRoles = userData.roles || ['member'];

    // Map claimed role back to Firestore role format for comparison
    // election-manager -> admin, superadmin -> superuser
    let expectedDbRole;
    if (claimedRole === 'superadmin') {
      expectedDbRole = 'superuser';
    } else if (claimedRole === 'election-manager') {
      expectedDbRole = 'admin';
    } else {
      // Fail closed explicitly for unexpected claimed roles
      // This should never happen as caller filters elevatedRoles, but defense-in-depth
      logger.error('RBAC: Unexpected claimed role during database verification', {
        uid,
        claimedRole,
        dbRoles,
        security: 'UNEXPECTED_ROLE',
      });
      return { verified: false, dbRoles };
    }

    const verified = dbRoles.includes(expectedDbRole);

    if (!verified) {
      logger.error('RBAC: Role claim does not match database', {
        uid,
        claimedRole,
        expectedDbRole,
        dbRoles,
        security: 'ROLE_MISMATCH',
      });
    }

    return { verified, dbRoles };
  } catch (error) {
    logger.error('RBAC: Database role verification failed', {
      uid,
      claimedRole,
      error: error.message,
    });
    // Fail closed - deny access on verification error
    return { verified: false, dbRoles: [] };
  }
}

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
    logger.warn('RBAC: Missing or invalid Authorization header', {
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

    // Extract role - support both 'role' claim and 'roles' array
    let userRole = decodedToken.role || null;

    // Map member portal roles to elections roles
    // superuser -> superadmin, admin -> election-manager
    if (userRole === 'superuser') {
      userRole = 'superadmin';
    } else if (userRole === 'admin') {
      userRole = 'election-manager';
    }

    // If no single 'role' claim, check 'roles' array for admin/superuser
    if (!userRole && decodedToken.roles) {
      if (decodedToken.roles.includes('superuser')) {
        userRole = 'superadmin'; // Map superuser -> superadmin
      } else if (decodedToken.roles.includes('admin')) {
        userRole = 'election-manager'; // Map admin -> election-manager
      }
    }

    // Defense-in-depth: Verify elevated roles against Firestore database
    // This prevents privilege escalation from compromised token claims
    const elevatedRoles = ['superadmin', 'election-manager'];
    if (userRole && elevatedRoles.includes(userRole)) {
      const { verified, dbRoles } = await verifyRoleAgainstDatabase(
        decodedToken.uid,
        userRole
      );

      if (!verified) {
        logger.error('RBAC: Elevated role verification failed', {
          uid: decodedToken.uid,
          claimedRole: userRole,
          dbRoles,
          path: req.path,
          security: 'ROLE_VERIFICATION_FAILED',
        });

        return res.status(403).json({
          error: 'Forbidden',
          message: 'Role verification failed',
          code: 'ROLE_VERIFICATION_FAILED',
        });
      }

      logger.info('RBAC: Elevated role verified against database', {
        uid: decodedToken.uid,
        role: userRole,
        dbRoles,
      });
    }

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: userRole,
      claims: decodedToken, // Full claims object
    };

    logger.info('RBAC: Firebase token verified', {
      uid: req.user.uid,
      email: req.user.email,
      role: req.user.role,
      originalRoles: decodedToken.roles,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('RBAC: Token verification failed', {
      error: error.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    // Security: Generic error message to prevent information disclosure
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication failed',
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
    logger.error('RBAC: requireElectionManager called without req.user');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'RBAC middleware misconfigured',
    });
  }

  const userRole = req.user.role;
  const allowedRoles = ['election-manager', 'superadmin'];

  if (!allowedRoles.includes(userRole)) {
    logger.warn('RBAC: Permission denied - insufficient role', {
      uid: req.user.uid,
      userRole,
      path: req.path,
      method: req.method,
    });

    // Security: Generic error message - don't expose roles structure
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied',
    });
  }

  logger.info('RBAC: Access granted - election-manager or superadmin', {
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
    logger.error('RBAC: requireSuperadmin called without req.user');
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'RBAC middleware misconfigured',
    });
  }

  const userRole = req.user.role;

  if (userRole !== 'superadmin') {
    logger.warn('RBAC: Permission denied - superadmin required', {
      uid: req.user.uid,
      userRole,
      path: req.path,
      method: req.method,
    });

    // Security: Generic error message - don't expose roles structure
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied',
    });
  }

  logger.info('RBAC: Access granted - superadmin', {
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
