/**
 * Async Handler Middleware
 *
 * Wraps async route handlers to ensure promise rejections
 * are caught and passed to Express error handling middleware.
 *
 * Without this wrapper, unhandled promise rejections in async
 * route handlers can crash the server or cause silent failures.
 *
 * @module middleware/async-handler
 */

/**
 * Wrap an async route handler to catch promise rejections
 *
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped handler that passes errors to next()
 *
 * @example
 * router.get('/elections', asyncHandler(async (req, res) => {
 *   const elections = await getElections();
 *   res.json(elections);
 * }));
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
