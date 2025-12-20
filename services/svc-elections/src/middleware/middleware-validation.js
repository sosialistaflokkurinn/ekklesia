/**
 * Input Validation Middleware
 *
 * Provides request validation using Zod schemas.
 * Centralizes validation logic and provides consistent error responses.
 *
 * Security improvements:
 * - String sanitization (trim, length limits)
 * - Sensitive field filtering in logs
 * - Unknown field stripping
 * - Error count limiting
 *
 * @module middleware/validation
 */

const { z } = require('zod');
const logger = require('../utils/util-logger');

// ============================================
// Security: Sensitive fields to filter from logs
// ============================================
const SENSITIVE_FIELDS = ['token', 'password', 'ssn', 'kennitala', 'email'];

/**
 * Sanitize error details to prevent sensitive data leakage in logs
 * @param {Array} errors - Zod error array
 * @returns {Array} - Sanitized error array
 */
function sanitizeErrorsForLog(errors) {
  return errors.map(e => {
    const fieldPath = e.path.join('.');
    const isSensitive = SENSITIVE_FIELDS.some(f =>
      fieldPath.toLowerCase().includes(f.toLowerCase())
    );

    return {
      field: fieldPath,
      code: e.code,
      // Don't include message for sensitive fields (could contain the value)
      message: isSensitive ? '[REDACTED]' : e.message
    };
  });
}

/**
 * Format errors for API response (safe for client)
 * @param {Array} errors - Zod error array
 * @param {number} maxErrors - Maximum errors to return
 * @returns {Array} - Formatted error array
 */
function formatErrorsForResponse(errors, maxErrors = 5) {
  return errors.slice(0, maxErrors).map(e => ({
    field: e.path.join('.'),
    message: e.message,
    code: e.code
  }));
}

/**
 * Create a validation middleware for request body
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {Object} options - Validation options
 * @param {number} options.maxErrors - Maximum errors to return (default: 5)
 * @returns {Function} Express middleware function
 *
 * @example
 * router.post('/elections/:id/vote',
 *   validateBody(schemas.vote),
 *   async (req, res) => {
 *     const { answerId, token } = req.validatedBody;
 *   }
 * );
 */
function validateBody(schema, options = {}) {
  const { maxErrors = 5 } = options;

  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Security: Sanitize errors for logging
        const safeErrors = sanitizeErrorsForLog(error.errors);

        logger.warn('Validation failed', {
          operation: 'validation_error',
          path: req.path,
          method: req.method,
          errorCount: error.errors.length,
          firstError: safeErrors[0]?.code,
          correlation_id: req.correlationId,
          ip: req.ip
        });

        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: formatErrorsForResponse(error.errors, maxErrors)
        });
      }
      next(error);
    }
  };
}

/**
 * Create a validation middleware for query parameters
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware function
 */
function validateQuery(schema, options = {}) {
  const { maxErrors = 5 } = options;

  return (req, res, next) => {
    try {
      req.validatedQuery = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Query validation failed', {
          operation: 'query_validation_error',
          path: req.path,
          errorCount: error.errors.length,
          correlation_id: req.correlationId
        });

        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: formatErrorsForResponse(error.errors, maxErrors)
        });
      }
      next(error);
    }
  };
}

/**
 * Create a validation middleware for URL parameters
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware function
 */
function validateParams(schema, options = {}) {
  const { maxErrors = 5 } = options;

  return (req, res, next) => {
    try {
      req.validatedParams = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Params validation failed', {
          operation: 'params_validation_error',
          path: req.path,
          errorCount: error.errors.length,
          correlation_id: req.correlationId
        });

        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid URL parameters',
          details: formatErrorsForResponse(error.errors, maxErrors)
        });
      }
      next(error);
    }
  };
}

// ============================================
// Common Schema Primitives (with security)
// ============================================

/**
 * Sanitized string - trimmed with length limits
 * Use for general text input
 */
const sanitizedString = z.string()
  .trim()
  .min(1, 'Cannot be empty')
  .max(500, 'Text too long');

/**
 * Short sanitized string - for IDs, codes, etc.
 */
const shortString = z.string()
  .trim()
  .min(1, 'Cannot be empty')
  .max(100, 'Text too long');

/**
 * UUID schema - strict format validation
 */
const uuidSchema = z.string()
  .trim()
  .uuid('Invalid ID format');

/**
 * Token schema - hex string validation
 * Supports both 32-char and 64-char tokens
 */
const tokenSchema = z.string()
  .trim()
  .min(32, 'Invalid token')
  .max(128, 'Invalid token')
  .regex(/^[a-f0-9]+$/i, 'Invalid token format');

/**
 * Kennitala schema - Icelandic national ID
 * 10 digits, basic format validation
 */
const kennitalaSchema = z.string()
  .trim()
  .length(10, 'Kennitala must be 10 digits')
  .regex(/^\d{10}$/, 'Kennitala must contain only digits');

// ============================================
// Common Schemas for Elections Service
// ============================================

/** Pagination query schema */
const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0)
});

/** Election status enum */
const electionStatusSchema = z.enum(['draft', 'active', 'closed']);

/** Vote submission schema */
const voteSchema = z.object({
  answerId: shortString.max(50),
  token: tokenSchema
});

/**
 * Ranked vote submission schema (STV)
 * With duplicate rank prevention
 */
const rankedVoteSchema = z.object({
  rankings: z.array(z.object({
    answerId: shortString.max(50),
    rank: z.number().int().min(1).max(100)
  }))
    .min(1, 'At least one ranking required')
    .max(50, 'Too many rankings')
    .refine(
      (rankings) => {
        const ranks = rankings.map(r => r.rank);
        return new Set(ranks).size === ranks.length;
      },
      { message: 'Ranks must be unique' }
    )
    .refine(
      (rankings) => {
        const answerIds = rankings.map(r => r.answerId);
        return new Set(answerIds).size === answerIds.length;
      },
      { message: 'Cannot rank the same answer twice' }
    ),
  token: tokenSchema
});

/** Create election schema (admin) */
const createElectionSchema = z.object({
  title: sanitizedString.max(255),
  description: sanitizedString.max(2000).optional(),
  question: sanitizedString.max(500),
  answers: z.array(z.object({
    id: shortString.max(50),
    text: sanitizedString.max(255)
  }))
    .min(2, 'At least 2 answers required')
    .max(20, 'Maximum 20 answers allowed'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isRanked: z.boolean().default(false),
  seats: z.number().int().min(1).max(100).default(1)
});

/** Election ID param schema */
const electionIdParamSchema = z.object({
  id: uuidSchema
});

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  // Common schemas
  schemas: {
    // Primitives
    uuid: uuidSchema,
    token: tokenSchema,
    kennitala: kennitalaSchema,
    sanitizedString,
    shortString,
    // Domain schemas
    pagination: paginationSchema,
    electionStatus: electionStatusSchema,
    vote: voteSchema,
    rankedVote: rankedVoteSchema,
    createElection: createElectionSchema,
    electionIdParam: electionIdParamSchema
  }
};
