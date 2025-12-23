/**
 * Database Mock Helper for Tests
 * Provides mock database client and pool for testing
 */

/**
 * Create a mock database client with transaction support
 */
function createMockClient(options = {}) {
  const { queryResults = {}, onQuery = () => {} } = options;

  let transactionState = 'none';

  const mockClient = {
    query: jest.fn(async (sql, params) => {
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

      // Find matching result by pattern
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

    _getQueries: () => mockClient.query.mock.calls.map(call => ({
      sql: call[0],
      params: call[1]
    })),
    _getTransactionState: () => transactionState,
    _reset: () => {
      transactionState = 'none';
      mockClient.query.mockClear();
      mockClient.release.mockClear();
    },
  };

  return mockClient;
}

/**
 * Create a mock database pool
 */
function createMockPool(options = {}) {
  const mockClient = createMockClient(options);

  const mockPool = {
    connect: jest.fn(async () => mockClient),
    query: mockClient.query,
    end: jest.fn(async () => {}),
    on: jest.fn(),

    _getMockClient: () => mockClient,
  };

  return mockPool;
}

module.exports = {
  createMockClient,
  createMockPool,
};
