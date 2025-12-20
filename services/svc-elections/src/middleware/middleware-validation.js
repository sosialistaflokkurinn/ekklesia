/**
 * Input Validation Middleware
 *
 * Provides request validation using Zod schemas.
 * Centralizes validation logic and provides consistent error responses.
 *
 * @module middleware/validation
 */

const { z } = require('zod');
const logger = require('../utils/util-logger');

/**
 * Create a validation middleware for request body
 *
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @returns {Function} Express middleware function
 *
 * @example
 * const voteSchema = z.object({
 *   answerId: z.string().uuid(),
 *   token: z.string().min(1)
 * });
 *
 * router.post('/elections/:id/vote',
 *   validateBody(voteSchema),
 *   async (req, res) => {
 *     // req.validatedBody is guaranteed to match the schema
 *     const { answerId, token } = req.validatedBody;
 *   }
 * );
 */
function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Validation failed', {
          operation: 'validation_error',
          path: req.path,
          method: req.method,
          errors: error.errors,
          correlation_id: req.correlationId
        });

        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
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
 * @returns {Function} Express middleware function
 *
 * @example
 * const querySchema = z.object({
 *   status: z.enum(['active', 'closed']).optional(),
 *   limit: z.coerce.number().min(1).max(100).default(50)
 * });
 *
 * router.get('/elections',
 *   validateQuery(querySchema),
 *   async (req, res) => {
 *     const { status, limit } = req.validatedQuery;
 *   }
 * );
 */
function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.validatedQuery = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Query validation failed', {
          operation: 'query_validation_error',
          path: req.path,
          errors: error.errors,
          correlation_id: req.correlationId
        });

        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid query parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
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
 * @returns {Function} Express middleware function
 *
 * @example
 * const paramsSchema = z.object({
 *   id: z.string().uuid()
 * });
 *
 * router.get('/elections/:id',
 *   validateParams(paramsSchema),
 *   async (req, res) => {
 *     const { id } = req.validatedParams;
 *   }
 * );
 */
function validateParams(schema) {
  return (req, res, next) => {
    try {
      req.validatedParams = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Params validation failed', {
          operation: 'params_validation_error',
          path: req.path,
          errors: error.errors,
          correlation_id: req.correlationId
        });

        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid URL parameters',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
            code: e.code
          }))
        });
      }
      next(error);
    }
  };
}

// ============================================
// Common Schemas for Elections Service
// ============================================

/** UUID schema */
const uuidSchema = z.string().uuid();

/** Pagination query schema */
const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

/** Election status enum */
const electionStatusSchema = z.enum(['draft', 'active', 'closed']);

/** Vote submission schema */
const voteSchema = z.object({
  answerId: z.string().min(1),
  token: z.string().min(1)
});

/** Ranked vote submission schema (STV) */
const rankedVoteSchema = z.object({
  rankings: z.array(z.object({
    answerId: z.string().min(1),
    rank: z.number().int().min(1)
  })).min(1),
  token: z.string().min(1)
});

/** Create election schema (admin) */
const createElectionSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  question: z.string().min(1).max(500),
  answers: z.array(z.object({
    id: z.string(),
    text: z.string().min(1).max(255)
  })).min(2).max(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isRanked: z.boolean().default(false),
  seats: z.number().int().min(1).max(100).default(1)
});

/** Election ID param schema */
const electionIdParamSchema = z.object({
  id: z.string().uuid()
});

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  // Common schemas
  schemas: {
    uuid: uuidSchema,
    pagination: paginationSchema,
    electionStatus: electionStatusSchema,
    vote: voteSchema,
    rankedVote: rankedVoteSchema,
    createElection: createElectionSchema,
    electionIdParam: electionIdParamSchema
  }
};
