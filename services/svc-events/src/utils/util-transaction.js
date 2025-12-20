/**
 * Transaction Utility
 *
 * Provides robust transaction handling with proper error recovery.
 * Handles rollback failures gracefully to prevent connection state pollution.
 *
 * @module utils/transaction
 */

const logger = require('./util-logger');

/**
 * Execute operations within a safe transaction
 *
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 * If rollback fails, the connection is forcefully released
 * to prevent state pollution.
 *
 * @param {Object} client - PostgreSQL client from pool.connect()
 * @param {Function} operations - Async function receiving the client
 * @param {string} correlationId - Optional correlation ID for logging
 * @returns {Promise<*>} Result of the operations function
 * @throws {Error} Original error if operations fail
 *
 * @example
 * const client = await pool.connect();
 * try {
 *   const result = await safeTransaction(client, async (tx) => {
 *     await tx.query('INSERT INTO ...');
 *     await tx.query('UPDATE ...');
 *     return { success: true };
 *   }, req.correlationId);
 *   res.json(result);
 * } finally {
 *   client.release();
 * }
 */
async function safeTransaction(client, operations, correlationId = null) {
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const result = await operations(client);

    await client.query('COMMIT');
    transactionStarted = false;

    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        logger.error('CRITICAL: Rollback failed - connection may be in invalid state', {
          operation: 'transaction_rollback_failed',
          originalError: error.message,
          rollbackError: rollbackError.message,
          correlation_id: correlationId
        });

        // Force connection closure to prevent state pollution
        // The 'true' parameter tells the pool to destroy this connection
        try {
          client.release(true);
        } catch (releaseError) {
          // Ignore release errors at this point
        }

        throw new Error(`Transaction recovery failed: ${error.message}`);
      }
    }
    throw error;
  }
}

/**
 * Execute a simple transaction with automatic client management
 *
 * Gets a client from the pool, executes the transaction,
 * and releases the client automatically.
 *
 * @param {Object} pool - PostgreSQL connection pool
 * @param {Function} operations - Async function receiving the client
 * @param {string} correlationId - Optional correlation ID for logging
 * @returns {Promise<*>} Result of the operations function
 *
 * @example
 * const result = await withTransaction(pool, async (client) => {
 *   await client.query('INSERT INTO ...');
 *   return { inserted: true };
 * }, req.correlationId);
 */
async function withTransaction(pool, operations, correlationId = null) {
  const client = await pool.connect();
  try {
    return await safeTransaction(client, operations, correlationId);
  } finally {
    client.release();
  }
}

module.exports = {
  safeTransaction,
  withTransaction
};
