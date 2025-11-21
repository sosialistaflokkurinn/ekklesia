/**
 * Jest Configuration for Elections Service
 *
 * Configured for Node.js API testing with:
 * - CommonJS modules
 * - Supertest for HTTP testing
 * - Mock Firebase Admin SDK
 * - Mock database connections
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js', // Exclude server startup file
    '!src/**/index.js', // Exclude index files
    '!**/node_modules/**',
    '!**/migrations/**'
  ],

  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  modulePaths: ['<rootDir>'],

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // Timeout for tests (database operations can be slow)
  testTimeout: 10000,

  // Verbose output
  verbose: true,
};
