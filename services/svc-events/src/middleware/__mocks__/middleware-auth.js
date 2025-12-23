/**
 * Mock authentication middleware for tests
 */

const authenticate = (req, res, next) => {
  req.user = {
    uid: 'test-admin-uid',
    email: 'admin@example.com'
  };
  next();
};

module.exports = authenticate;
