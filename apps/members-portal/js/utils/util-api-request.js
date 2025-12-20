/**
 * API Request Utility with Retry and Timeout
 *
 * Provides robust API request handling with:
 * - Automatic retry with exponential backoff
 * - Request timeout
 * - Rate limit handling
 * - Network error recovery
 *
 * @module utils/api-request
 */

import { debug } from './util-debug.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  timeout: 10000,      // 10 seconds
  maxRetries: 3,
  baseDelay: 1000,     // 1 second
  maxDelay: 10000      // 10 seconds
};

/**
 * Custom API Error with status and context
 */
export class ApiError extends Error {
  constructor(message, status = 500, endpoint = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Check if error is a network error (retryable)
 * @param {Error} error - The error to check
 * @returns {boolean} True if network error
 */
function isNetworkError(error) {
  return (
    error.name === 'TypeError' ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('Network request failed')
  );
}

/**
 * Calculate retry delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelay - Base delay in ms
 * @param {number} maxDelay - Maximum delay in ms
 * @returns {number} Delay in milliseconds
 */
function calculateRetryDelay(attempt, baseDelay, maxDelay) {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add jitter (±30%)
  const jitter = exponentialDelay * 0.3 * (Math.random() * 2 - 1);
  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make API request with retry and timeout
 *
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options plus retry config
 * @param {number} options.timeout - Request timeout in ms (default: 10000)
 * @param {number} options.maxRetries - Max retry attempts (default: 3)
 * @param {boolean} options.retry - Enable retry (default: true)
 * @returns {Promise<Response>} Fetch response
 * @throws {ApiError} On request failure
 *
 * @example
 * const response = await apiRequest('/api/members', {
 *   method: 'POST',
 *   body: JSON.stringify(data),
 *   headers: { 'Content-Type': 'application/json' }
 * });
 */
export async function apiRequest(url, options = {}) {
  const {
    timeout = DEFAULT_CONFIG.timeout,
    maxRetries = DEFAULT_CONFIG.maxRetries,
    retry = true,
    ...fetchOptions
  } = options;

  const attempts = retry ? maxRetries : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle rate limiting
      if (response.status === 429 && attempt < attempts - 1) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : calculateRetryDelay(attempt, DEFAULT_CONFIG.baseDelay, DEFAULT_CONFIG.maxDelay);

        debug.warn(`Rate limited, retrying in ${delay}ms`, { url, attempt });
        await sleep(delay);
        continue;
      }

      // Handle server errors with retry
      if (response.status >= 500 && attempt < attempts - 1) {
        const delay = calculateRetryDelay(attempt, DEFAULT_CONFIG.baseDelay, DEFAULT_CONFIG.maxDelay);
        debug.warn(`Server error ${response.status}, retrying in ${delay}ms`, { url, attempt });
        await sleep(delay);
        continue;
      }

      // Return response (caller handles status codes)
      return response;

    } catch (error) {
      // Handle timeout
      if (error.name === 'AbortError') {
        if (attempt < attempts - 1) {
          const delay = calculateRetryDelay(attempt, DEFAULT_CONFIG.baseDelay, DEFAULT_CONFIG.maxDelay);
          debug.warn(`Request timeout, retrying in ${delay}ms`, { url, attempt });
          await sleep(delay);
          continue;
        }
        throw new ApiError('Beiðni rann út á tíma', 408, url);
      }

      // Handle network errors with retry
      if (isNetworkError(error) && attempt < attempts - 1) {
        const delay = calculateRetryDelay(attempt, DEFAULT_CONFIG.baseDelay, DEFAULT_CONFIG.maxDelay);
        debug.warn(`Network error, retrying in ${delay}ms`, { url, attempt, error: error.message });
        await sleep(delay);
        continue;
      }

      // Final failure
      throw new ApiError(
        error.message || 'Óvænt villa í netbeiðni',
        0,
        url
      );
    }
  }

  // Should not reach here, but just in case
  throw new ApiError('Beiðni mistókst eftir endurteknar tilraunir', 0, url);
}

/**
 * Make JSON API request (convenience wrapper)
 *
 * @param {string} url - API endpoint URL
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {ApiError} On request failure or non-OK response
 */
export async function apiRequestJson(url, options = {}) {
  const response = await apiRequest(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }
    throw new ApiError(errorMessage, response.status, url);
  }

  return response.json();
}
