/**
 * Mock database configuration for tests
 *
 * Usage in tests:
 *   const { pool } = require('../../config/config-database');
 *   pool.query.mockResolvedValueOnce({ rows: [...], rowCount: 1 });
 */

const mockQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });

const mockClient = {
  query: mockQuery,
  release: jest.fn(),
};

const mockPool = {
  query: mockQuery,
  connect: jest.fn().mockResolvedValue(mockClient),
  end: jest.fn(),
  on: jest.fn(),
};

module.exports = {
  pool: mockPool,
  query: mockQuery,
  // Expose for test configuration
  _mockClient: mockClient,
  _resetMocks: () => {
    mockQuery.mockReset();
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockClient.release.mockReset();
    mockPool.connect.mockReset();
    mockPool.connect.mockResolvedValue(mockClient);
  },
};
