/**
 * Jest Setup File
 * Runs before all tests to configure mocks and environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_NAME = 'postgres';
process.env.DATABASE_USER = 'postgres';
process.env.DATABASE_PASSWORD = 'test';
process.env.FIREBASE_PROJECT_ID = 'ekklesia-test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Create shared mockAuth that tests can access
global.mockAuth = {
  verifyIdToken: jest.fn(),
};

// Mock Firebase Admin SDK
jest.mock('firebase-admin', () => {
  const mockApp = {
    options: {
      projectId: 'ekklesia-test',
    },
  };

  return {
    initializeApp: jest.fn(() => mockApp),
    auth: jest.fn(() => global.mockAuth),
    app: jest.fn(() => mockApp),
    apps: [],
  };
});

// Mock express-rate-limit to avoid IPv6 warnings and simplify tests
jest.mock('express-rate-limit', () => ({
  rateLimit: jest.fn(() => (req, res, next) => next()),
  ipKeyGenerator: jest.fn(() => (req) => req.ip || 'test-ip'),
}));

// Mock Winston logger to reduce noise
jest.mock('winston', () => {
  // Make format a callable function that also has methods
  // winston.format((info) => info)() pattern requires returning a function
  const mockFormat = jest.fn(() => jest.fn(() => ({})));
  mockFormat.combine = jest.fn(() => ({}));
  mockFormat.timestamp = jest.fn(() => ({}));
  mockFormat.errors = jest.fn(() => ({}));
  mockFormat.json = jest.fn(() => ({}));
  mockFormat.colorize = jest.fn(() => ({}));
  mockFormat.simple = jest.fn(() => ({}));
  mockFormat.printf = jest.fn(() => ({}));
  mockFormat.metadata = jest.fn(() => ({}));

  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
    createChild: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
  };

  return {
    createLogger: jest.fn(() => mockLogger),
    format: mockFormat,
    transports: {
      Console: jest.fn(),
    },
  };
});

// Mock Google Cloud Logging
jest.mock('@google-cloud/logging-winston', () => {
  return {
    LoggingWinston: jest.fn(() => ({
      log: jest.fn(),
    })),
  };
});

// Global test utilities
global.sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
