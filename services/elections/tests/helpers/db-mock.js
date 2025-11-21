/**
 * Database Mock Helper for Tests
 *
 * Provides mock database client and pool for testing without real database
 */

/**
 * Create a mock database client with transaction support
 *
 * @param {Object} options - Mock options
 * @param {Object} options.queryResults - Map of SQL patterns to results
 * @param {Function} options.onQuery - Callback for query tracking
 * @returns {Object} Mock client
 */
function createMockClient(options = {}) {
  const { queryResults = {}, onQuery = () => {} } = options;

  const queries = [];
  let transactionState = 'none'; // 'none', 'active', 'committed', 'rolledback'

  const mockClient = {
    query: jest.fn(async (sql, params) => {
      queries.push({ sql, params });
      onQuery({ sql, params });

      // Transaction control
      if (sql === 'BEGIN') {
        transactionState = 'active';
        return { rows: [], command: 'BEGIN' };
      }
      if (sql === 'COMMIT') {
        transactionState = 'committed';
        return { rows: [], command: 'COMMIT' };
      }
      if (sql === 'ROLLBACK') {
        transactionState = 'rolledback';
        return { rows: [], command: 'ROLLBACK' };
      }

      // Find matching result
      for (const [pattern, result] of Object.entries(queryResults)) {
        if (sql.includes(pattern)) {
          if (typeof result === 'function') {
            return result(sql, params);
          }
          return result;
        }
      }

      // Default empty result
      return { rows: [], rowCount: 0 };
    }),

    release: jest.fn(),

    // Test helpers
    _getQueries: () => {
      // Use Jest's built-in call tracking instead of custom array
      // This works even when mockImplementation() is called
      return mockClient.query.mock.calls.map(call => ({
        sql: call[0],
        params: call[1]
      }));
    },
    _getTransactionState: () => transactionState,
    _reset: () => {
      queries.length = 0;
      transactionState = 'none';
      mockClient.query.mockClear();
      mockClient.release.mockClear();
    },
  };

  return mockClient;
}

/**
 * Create a mock database pool
 *
 * @param {Object} options - Mock options
 * @returns {Object} Mock pool
 */
function createMockPool(options = {}) {
  const mockClient = createMockClient(options);

  const mockPool = {
    connect: jest.fn(async () => mockClient),
    query: mockClient.query,
    end: jest.fn(async () => {}),
    on: jest.fn(),
    options: {
      min: 2,
      max: 5,
    },

    // Test helper
    _getMockClient: () => mockClient,
  };

  return mockPool;
}

module.exports = {
  createMockClient,
  createMockPool,
};
