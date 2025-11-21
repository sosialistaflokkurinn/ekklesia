/**
 * Roles middleware utilities
 * Extract roles from req.user (populated by Firebase auth middleware)
 * and enforce required roles on protected routes.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Get user's roles from request
 * @param {object} req - Express request object
 * @returns {string[]} - Array of role strings
 */
function getUserRoles(req) {
  return (req.user && Array.isArray(req.user.roles)) ? req.user.roles : [];
}

/**
 * Check if user has a specific role
 * @param {object} req - Express request object
 * @param {string} role - Role to check
 * @returns {boolean}
 */
function hasRole(req, role) {
  return getUserRoles(req).includes(role);
}

/**
 * Check if user has all specified roles
 * @param {object} req - Express request object
 * @param {string[]} roles - Roles to check (must have ALL)
 * @returns {boolean}
 */
function hasAllRoles(req, roles) {
  const userRoles = getUserRoles(req);
  return roles.every(r => userRoles.includes(r));
}

/**
 * Check if user has any of the specified roles
 * @param {object} req - Express request object
 * @param {string[]} roles - Roles to check (must have ANY)
 * @returns {boolean}
 */
function hasAnyRole(req, roles) {
  const userRoles = getUserRoles(req);
  return roles.some(r => userRoles.includes(r));
}

/**
 * Generate correlation ID for request tracing
 * @returns {string} - 16-char hex correlation ID
 */
function generateCorrelationId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Create enhanced 403 response with audit details
 * @param {object} req - Express request object
 * @param {string[]} requiredRoles - Roles that were required
 * @param {string} mode - 'any' or 'all'
 * @returns {object} - Response payload
 */
function createForbiddenResponse(req, requiredRoles, mode = 'any') {
  const correlationId = req.correlationId || generateCorrelationId();
  const userRoles = getUserRoles(req);
  const uid = req.user?.uid || 'unknown';

  // Log structured denial event
  logger.warn('Access denied - insufficient roles', {
    operation: 'role_check',
    correlation_id: correlationId,
    performed_by: uid,
    granted_roles: userRoles,
    required_roles: requiredRoles,
    requirement_mode: mode,
    path: req.path,
    method: req.method
  });

  return {
    error: 'Forbidden',
    message: mode === 'all'
      ? `Missing required roles (must have all): ${requiredRoles.join(', ')}`
      : `Missing required role (must have any of): ${requiredRoles.join(', ')}`,
    correlation_id: correlationId,
    required_roles: requiredRoles,
    requirement_mode: mode
  };
}

/**
 * Middleware: Require user to have a specific role
 * @param {string} role - Required role
 * @returns {function} - Express middleware
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.correlationId) {
      req.correlationId = generateCorrelationId();
    }

    if (!hasRole(req, role)) {
      return res.status(403).json(createForbiddenResponse(req, [role], 'any'));
    }

    next();
  };
}

/**
 * Middleware: Require user to have ANY of the specified roles
 * @param {string[]} roles - Array of acceptable roles
 * @returns {function} - Express middleware
 */
function requireAnyRoles(roles) {
  return (req, res, next) => {
    if (!req.correlationId) {
      req.correlationId = generateCorrelationId();
    }

    if (!hasAnyRole(req, roles)) {
      return res.status(403).json(createForbiddenResponse(req, roles, 'any'));
    }

    next();
  };
}

/**
 * Middleware: Require user to have ALL of the specified roles
 * @param {string[]} roles - Array of required roles (must have all)
 * @returns {function} - Express middleware
 */
function requireAllRoles(roles) {
  return (req, res, next) => {
    if (!req.correlationId) {
      req.correlationId = generateCorrelationId();
    }

    if (!hasAllRoles(req, roles)) {
      const missing = roles.filter(r => !hasRole(req, r));
      return res.status(403).json(createForbiddenResponse(req, missing, 'all'));
    }

    next();
  };
}

/**
 * Middleware: Attach correlation ID to request (for tracing)
 * Use this early in the middleware chain
 */
function attachCorrelationId(req, res, next) {
  if (!req.correlationId) {
    req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  }
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}

module.exports = {
  getUserRoles,
  hasRole,
  hasAllRoles,
  hasAnyRole,
  requireRole,
  requireAnyRoles,
  requireAllRoles,
  attachCorrelationId,
  generateCorrelationId
};
