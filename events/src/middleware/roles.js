/**
 * Roles middleware utilities
 * Extract roles from req.user (populated by Firebase auth middleware)
 * and enforce required roles on protected routes.
 */

function hasRole(req, role) {
  const roles = (req.user && Array.isArray(req.user.roles)) ? req.user.roles : [];
  return roles.includes(role);
}

function requireRole(role) {
  return (req, res, next) => {
    if (!hasRole(req, role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing required role: ${role}`
      });
    }
    next();
  };
}

function requireAnyRoles(roles) {
  return (req, res, next) => {
    const userRoles = (req.user && Array.isArray(req.user.roles)) ? req.user.roles : [];
    if (!roles.some(r => userRoles.includes(r))) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Missing required role (any of): ${roles.join(', ')}`
      });
    }
    next();
  };
}

module.exports = { hasRole, requireRole, requireAnyRoles };
