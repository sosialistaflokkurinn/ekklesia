/**
 * Mock database configuration for tests
 */

const mockQuery = jest.fn();
const mockPool = {
  query: mockQuery,
  connect: jest.fn().mockResolvedValue({
    query: mockQuery,
    release: jest.fn()
  }),
  end: jest.fn()
};

module.exports = {
  pool: mockPool,
  query: mockQuery
};
