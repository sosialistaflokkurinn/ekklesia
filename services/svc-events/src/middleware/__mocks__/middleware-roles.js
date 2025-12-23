/**
 * Mock role middleware for tests
 */

const requireRole = (role) => (req, res, next) => next();
const requireAnyRoles = (...roles) => (req, res, next) => next();
const attachCorrelationId = (req, res, next) => {
  req.correlationId = 'test-correlation-id-123';
  next();
};

module.exports = {
  requireRole,
  requireAnyRoles,
  attachCorrelationId
};
