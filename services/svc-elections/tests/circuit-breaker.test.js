/**
 * Circuit Breaker Service Tests
 *
 * Tests for the circuit breaker implementation using opossum library.
 *
 * Covers:
 * - Circuit state transitions (CLOSED → OPEN → HALF-OPEN → CLOSED)
 * - Timeout handling
 * - Error threshold behavior
 * - Recovery patterns
 * - Stats and monitoring
 */

const CircuitBreaker = require('opossum');

// Mock winston before importing the module under test
jest.mock('winston', () => {
  const mockFormat = jest.fn(() => jest.fn(() => ({})));
  mockFormat.combine = jest.fn(() => ({}));
  mockFormat.timestamp = jest.fn(() => ({}));
  mockFormat.errors = jest.fn(() => ({}));
  mockFormat.json = jest.fn(() => ({}));
  mockFormat.colorize = jest.fn(() => ({}));
  mockFormat.simple = jest.fn(() => ({}));
  mockFormat.printf = jest.fn(() => ({}));
  mockFormat.metadata = jest.fn(() => ({}));

  return {
    createLogger: jest.fn(() => ({
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    })),
    format: mockFormat,
    transports: { Console: jest.fn() },
  };
});

jest.mock('@google-cloud/logging-winston', () => ({
  LoggingWinston: jest.fn(() => ({ log: jest.fn() })),
}));

// Import after mocks are set up
const {
  getCircuitBreaker,
  getCircuitBreakerStats,
  getAllCircuitBreakerStats,
  isCircuitOpen,
  CIRCUIT_BREAKER_OPTIONS,
} = require('../src/services/service-circuit-breaker');

describe('Circuit Breaker Service', () => {
  // Helper to create a fresh breaker for each test
  let breakerCount = 0;
  const createTestBreaker = (asyncFn, options = {}) => {
    breakerCount++;
    return getCircuitBreaker(`test-breaker-${breakerCount}`, asyncFn, options);
  };

  describe('Circuit Breaker Creation', () => {
    test('should create a new circuit breaker with default options', () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const breaker = createTestBreaker(asyncFn);

      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });

    test('should return same breaker for same name', () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const name = `singleton-test-${Date.now()}`;

      const breaker1 = getCircuitBreaker(name, asyncFn);
      const breaker2 = getCircuitBreaker(name, asyncFn);

      expect(breaker1).toBe(breaker2);
    });

    test('should apply custom options', () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const customOptions = {
        timeout: 1000,
        errorThresholdPercentage: 25,
      };

      const breaker = createTestBreaker(asyncFn, customOptions);

      expect(breaker.options.timeout).toBe(1000);
      expect(breaker.options.errorThresholdPercentage).toBe(25);
    });

    test('should have correct default options', () => {
      expect(CIRCUIT_BREAKER_OPTIONS.timeout).toBe(5000);
      expect(CIRCUIT_BREAKER_OPTIONS.errorThresholdPercentage).toBe(50);
      expect(CIRCUIT_BREAKER_OPTIONS.resetTimeout).toBe(10000);
      expect(CIRCUIT_BREAKER_OPTIONS.volumeThreshold).toBe(5);
    });
  });

  describe('Circuit State Transitions', () => {
    test('should start in CLOSED state', () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const breaker = createTestBreaker(asyncFn);

      expect(breaker.opened).toBe(false);
      expect(breaker.closed).toBe(true);
    });

    test('should execute function when circuit is CLOSED', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const breaker = createTestBreaker(asyncFn);

      const result = await breaker.fire();

      expect(result).toBe('success');
      expect(asyncFn).toHaveBeenCalled();
    });

    test('should open circuit after error threshold exceeded', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('failure'));
      const breaker = createTestBreaker(asyncFn, {
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        resetTimeout: 30000,
      });

      // Generate failures to trigger circuit open
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) {
          // Expected failures
        }
      }

      expect(breaker.opened).toBe(true);
    });

    test('should reject requests when circuit is OPEN', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('failure'));
      const breaker = createTestBreaker(asyncFn, {
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        resetTimeout: 30000,
      });

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.opened).toBe(true);

      // Next request should be rejected without calling asyncFn
      asyncFn.mockClear();

      await expect(breaker.fire()).rejects.toThrow('Breaker is open');
      expect(asyncFn).not.toHaveBeenCalled();
    });

    test('should transition to HALF-OPEN after resetTimeout', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('failure'));
      const breaker = createTestBreaker(asyncFn, {
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        resetTimeout: 100, // Short timeout for testing
      });

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.opened).toBe(true);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Circuit should now be half-open (pendingClose)
      expect(breaker.pendingClose).toBe(true);
    });

    test('should close circuit after successful request in HALF-OPEN state', async () => {
      let shouldFail = true;
      const asyncFn = jest.fn().mockImplementation(() => {
        if (shouldFail) {
          return Promise.reject(new Error('failure'));
        }
        return Promise.resolve('success');
      });

      const breaker = createTestBreaker(asyncFn, {
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        resetTimeout: 100,
      });

      // Open the circuit with failures
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) {
          // Expected
        }
      }

      expect(breaker.opened).toBe(true);

      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 150));

      // Now make the function succeed
      shouldFail = false;

      // Successful request should close the circuit
      const result = await breaker.fire();
      expect(result).toBe('success');

      // Circuit should be closed now
      expect(breaker.closed).toBe(true);
    });
  });

  describe('Timeout Handling', () => {
    test('should timeout slow operations', async () => {
      const slowFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 200))
      );

      const breaker = createTestBreaker(slowFn, {
        timeout: 50, // 50ms timeout
      });

      await expect(breaker.fire()).rejects.toThrow(/Timed out/);
    });

    test('should complete fast operations within timeout', async () => {
      const fastFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('fast'), 10))
      );

      const breaker = createTestBreaker(fastFn, {
        timeout: 1000,
      });

      const result = await breaker.fire();
      expect(result).toBe('fast');
    });
  });

  describe('Stats and Monitoring', () => {
    test('should track successful requests', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const name = `stats-success-${Date.now()}`;
      const breaker = getCircuitBreaker(name, asyncFn);

      await breaker.fire();
      await breaker.fire();

      const stats = getCircuitBreakerStats(name);

      expect(stats).not.toBeNull();
      expect(stats.successes).toBe(2);
      expect(stats.failures).toBe(0);
    });

    test('should track failed requests', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('failure'));
      const name = `stats-failure-${Date.now()}`;
      const breaker = getCircuitBreaker(name, asyncFn, {
        volumeThreshold: 10, // High threshold to prevent opening
      });

      try {
        await breaker.fire();
      } catch (e) {
        // Expected
      }

      const stats = getCircuitBreakerStats(name);

      expect(stats).not.toBeNull();
      expect(stats.failures).toBe(1);
    });

    test('should return null for non-existent breaker', () => {
      const stats = getCircuitBreakerStats('non-existent-breaker');
      expect(stats).toBeNull();
    });

    test('should report correct state in stats', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('failure'));
      const name = `stats-state-${Date.now()}`;
      const breaker = getCircuitBreaker(name, asyncFn, {
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        resetTimeout: 30000,
      });

      // Initially closed
      let stats = getCircuitBreakerStats(name);
      expect(stats.state).toBe('closed');

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) {
          // Expected
        }
      }

      stats = getCircuitBreakerStats(name);
      expect(stats.state).toBe('open');
    });

    test('should return all breaker stats', () => {
      const allStats = getAllCircuitBreakerStats();

      expect(Array.isArray(allStats)).toBe(true);
      expect(allStats.length).toBeGreaterThan(0);
    });
  });

  describe('isCircuitOpen Helper', () => {
    test('should return false for closed circuit', () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const name = `is-open-closed-${Date.now()}`;
      getCircuitBreaker(name, asyncFn);

      expect(isCircuitOpen(name)).toBe(false);
    });

    test('should return true for open circuit', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('failure'));
      const name = `is-open-open-${Date.now()}`;
      const breaker = getCircuitBreaker(name, asyncFn, {
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        resetTimeout: 30000,
      });

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) {
          // Expected
        }
      }

      expect(isCircuitOpen(name)).toBe(true);
    });

    test('should return false for non-existent breaker', () => {
      expect(isCircuitOpen('does-not-exist')).toBe(false);
    });
  });

  describe('Error Types', () => {
    test('should identify timeout errors by name', async () => {
      const slowFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('slow'), 200))
      );

      const breaker = createTestBreaker(slowFn, { timeout: 50 });

      try {
        await breaker.fire();
        fail('Should have thrown');
      } catch (error) {
        // opossum timeout errors can be identified by name or message
        expect(
          error.name === 'TimeoutError' || error.message.includes('Timed out')
        ).toBe(true);
      }
    });

    test('should identify circuit open errors', async () => {
      const asyncFn = jest.fn().mockRejectedValue(new Error('failure'));
      const breaker = createTestBreaker(asyncFn, {
        errorThresholdPercentage: 50,
        volumeThreshold: 2,
        resetTimeout: 30000,
      });

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.fire();
        } catch (e) {
          // Expected
        }
      }

      try {
        await breaker.fire();
        fail('Should have thrown');
      } catch (error) {
        expect(error.message).toContain('Breaker is open');
      }
    });
  });
});
