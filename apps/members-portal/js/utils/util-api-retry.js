/**
 * API Retry Utility
 *
 * Provides retry logic with exponential backoff for transient failures.
 * Automatically retries 5xx errors and network failures.
 *
 * @module utils/api-retry
 */

/** Status codes that should trigger a retry */
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

/** Default retry configuration */
const DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000
};

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 *
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 */
function getRetryDelay(attempt, baseDelay = 1000, maxDelay = 10000) {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Check if an error is retryable
 *
 * @param {Error} error - Error to check
 * @returns {boolean} True if error is retryable
 */
function isRetryableError(error) {
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return true;
  }

  // Abort errors (timeout) - might want to retry
  if (error.name === 'AbortError') {
    return true;
  }

  // Check status code if available
  if (error.status && RETRYABLE_STATUS_CODES.includes(error.status)) {
    return true;
  }

  return false;
}

/**
 * Execute a function with retry logic
 *
 * @param {Function} fn - Async function to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelayMs - Base delay for backoff (default: 1000)
 * @param {number} options.maxDelayMs - Maximum delay (default: 10000)
 * @param {Function} options.onRetry - Callback on each retry (attempt, error, delay)
 * @returns {Promise<*>} Result of the function
 * @throws {Error} If all retries fail
 *
 * @example
 * const result = await withRetry(
 *   () => authenticatedFetch('/api/elections'),
 *   { maxRetries: 3 }
 * );
 */
export async function withRetry(fn, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  let lastError;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry client errors (4xx) except rate limits (429)
      if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw error;
      }

      // Check if error is retryable
      if (!isRetryableError(error) && attempt > 0) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt >= config.maxRetries) {
        throw error;
      }

      // Calculate delay
      const delay = getRetryDelay(attempt, config.baseDelayMs, config.maxDelayMs);

      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt + 1, error, delay);
      }

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a retryable version of an async function
 *
 * @param {Function} fn - Async function to wrap
 * @param {Object} options - Retry options
 * @returns {Function} Retryable version of the function
 *
 * @example
 * const retryableFetch = createRetryable(
 *   (url) => authenticatedFetch(url),
 *   { maxRetries: 3 }
 * );
 *
 * const result = await retryableFetch('/api/elections');
 */
export function createRetryable(fn, options = {}) {
  return async function retryableFn(...args) {
    return withRetry(() => fn(...args), options);
  };
}
