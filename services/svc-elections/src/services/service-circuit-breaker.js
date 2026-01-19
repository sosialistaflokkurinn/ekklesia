/**
 * Circuit Breaker Service
 * Prevents cascade failures during database issues
 *
 * Uses opossum library to implement circuit breaker pattern:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail fast
 * - HALF-OPEN: Testing if service recovered
 *
 * Based on: Issue #338 - Add circuit breaker for vote processing resilience
 */

const CircuitBreaker = require('opossum');
const logger = require('../utils/util-logger');

// Circuit breaker configuration
const CIRCUIT_BREAKER_OPTIONS = {
  timeout: 5000,                // 5 second timeout for database operations
  errorThresholdPercentage: 50, // Open circuit when 50% of requests fail
  resetTimeout: 10000,          // Try again after 10 seconds
  volumeThreshold: 5,           // Minimum requests before circuit can open
  rollingCountTimeout: 10000,   // Time window for error rate calculation
  rollingCountBuckets: 10,      // Number of buckets in rolling window
};

// Track circuit breakers by name
const breakers = new Map();

/**
 * Create or get a circuit breaker for a named operation
 *
 * @param {string} name - Unique name for this circuit breaker
 * @param {Function} asyncFn - Async function to wrap
 * @param {Object} options - Override default options
 * @returns {CircuitBreaker} - The circuit breaker instance
 */
function getCircuitBreaker(name, asyncFn, options = {}) {
  if (breakers.has(name)) {
    return breakers.get(name);
  }

  const breakerOptions = { ...CIRCUIT_BREAKER_OPTIONS, ...options };
  const breaker = new CircuitBreaker(asyncFn, breakerOptions);

  // Event handlers for monitoring
  breaker.on('open', () => {
    logger.error('Circuit breaker OPENED', {
      operation: 'circuit_breaker',
      breaker: name,
      state: 'open',
      message: 'Too many failures, fast-failing requests',
    });
  });

  breaker.on('halfOpen', () => {
    logger.info('Circuit breaker HALF-OPEN', {
      operation: 'circuit_breaker',
      breaker: name,
      state: 'half_open',
      message: 'Testing if service recovered',
    });
  });

  breaker.on('close', () => {
    logger.info('Circuit breaker CLOSED', {
      operation: 'circuit_breaker',
      breaker: name,
      state: 'closed',
      message: 'Service recovered, normal operation resumed',
    });
  });

  breaker.on('timeout', () => {
    logger.warn('Circuit breaker timeout', {
      operation: 'circuit_breaker',
      breaker: name,
      timeout_ms: breakerOptions.timeout,
    });
  });

  breaker.on('reject', () => {
    logger.warn('Circuit breaker rejected request (circuit open)', {
      operation: 'circuit_breaker',
      breaker: name,
      state: 'open',
    });
  });

  breaker.on('fallback', (result) => {
    logger.info('Circuit breaker fallback executed', {
      operation: 'circuit_breaker',
      breaker: name,
      fallback_result: typeof result,
    });
  });

  breakers.set(name, breaker);
  return breaker;
}

/**
 * Get circuit breaker stats for monitoring
 *
 * @param {string} name - Circuit breaker name
 * @returns {Object|null} - Stats object or null if not found
 */
function getCircuitBreakerStats(name) {
  const breaker = breakers.get(name);
  if (!breaker) return null;

  const stats = breaker.stats;
  return {
    name,
    state: breaker.opened ? 'open' : (breaker.halfOpen ? 'half_open' : 'closed'),
    enabled: breaker.enabled,
    failures: stats.failures,
    successes: stats.successes,
    rejects: stats.rejects,
    timeouts: stats.timeouts,
    fallbacks: stats.fallbacks,
    latencyMean: stats.latencyMean,
    latencyP99: stats.percentiles['99'],
  };
}

/**
 * Get all circuit breaker stats
 *
 * @returns {Object[]} - Array of stats for all breakers
 */
function getAllCircuitBreakerStats() {
  const stats = [];
  for (const name of breakers.keys()) {
    stats.push(getCircuitBreakerStats(name));
  }
  return stats;
}

/**
 * Check if a circuit breaker is open (fast-failing)
 *
 * @param {string} name - Circuit breaker name
 * @returns {boolean} - True if circuit is open
 */
function isCircuitOpen(name) {
  const breaker = breakers.get(name);
  return breaker ? breaker.opened : false;
}

module.exports = {
  getCircuitBreaker,
  getCircuitBreakerStats,
  getAllCircuitBreakerStats,
  isCircuitOpen,
  CIRCUIT_BREAKER_OPTIONS,
};
