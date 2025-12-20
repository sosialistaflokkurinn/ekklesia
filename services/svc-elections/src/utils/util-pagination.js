/**
 * Pagination Validation Utility
 *
 * Validates and normalizes pagination parameters to prevent
 * performance issues from invalid or malicious input.
 *
 * @module utils/pagination
 */

/** Maximum allowed limit per request */
const MAX_LIMIT = 100;

/** Default limit if not specified */
const DEFAULT_LIMIT = 50;

/** Maximum allowed offset to prevent DOS */
const MAX_OFFSET = 1000000;

/**
 * Validate and normalize pagination parameters
 *
 * @param {string|number} limit - Requested limit
 * @param {string|number} offset - Requested offset
 * @param {Object} options - Optional configuration
 * @param {number} options.maxLimit - Maximum allowed limit (default: 100)
 * @param {number} options.defaultLimit - Default limit (default: 50)
 * @param {number} options.maxOffset - Maximum allowed offset (default: 1000000)
 * @returns {{ valid: boolean, limit?: number, offset?: number, error?: string }}
 *
 * @example
 * const pagination = validatePagination(req.query.limit, req.query.offset);
 * if (!pagination.valid) {
 *   return res.status(400).json({ error: 'Bad Request', message: pagination.error });
 * }
 * const { limit, offset } = pagination;
 */
function validatePagination(limit, offset, options = {}) {
  const {
    maxLimit = MAX_LIMIT,
    defaultLimit = DEFAULT_LIMIT,
    maxOffset = MAX_OFFSET
  } = options;

  // Validate and normalize limit
  let limitNum = defaultLimit;
  if (limit !== undefined && limit !== null && limit !== '') {
    const parsed = parseInt(limit, 10);
    if (isNaN(parsed)) {
      return { valid: false, error: 'limit must be a positive integer' };
    }
    if (parsed < 1) {
      return { valid: false, error: 'limit must be at least 1' };
    }
    limitNum = Math.min(parsed, maxLimit);
  }

  // Validate and normalize offset
  let offsetNum = 0;
  if (offset !== undefined && offset !== null && offset !== '') {
    const parsed = parseInt(offset, 10);
    if (isNaN(parsed)) {
      return { valid: false, error: 'offset must be a non-negative integer' };
    }
    if (parsed < 0) {
      return { valid: false, error: 'offset must be non-negative' };
    }
    if (parsed > maxOffset) {
      return { valid: false, error: `offset exceeds maximum allowed value (${maxOffset})` };
    }
    offsetNum = parsed;
  }

  return {
    valid: true,
    limit: limitNum,
    offset: offsetNum
  };
}

/**
 * Create pagination response metadata
 *
 * @param {number} total - Total number of items
 * @param {number} limit - Items per page
 * @param {number} offset - Current offset
 * @returns {Object} Pagination metadata
 */
function createPaginationMeta(total, limit, offset) {
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.floor(offset / limit) + 1;

  return {
    total,
    limit,
    offset,
    totalPages,
    currentPage,
    hasNext: offset + limit < total,
    hasPrev: offset > 0
  };
}

module.exports = {
  validatePagination,
  createPaginationMeta,
  MAX_LIMIT,
  DEFAULT_LIMIT,
  MAX_OFFSET
};
