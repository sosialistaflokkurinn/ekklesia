/**
 * Mock rate limiter middleware for tests
 */

const adminLimiter = (req, res, next) => next();
const publicLimiter = (req, res, next) => next();

module.exports = {
  adminLimiter,
  publicLimiter
};
