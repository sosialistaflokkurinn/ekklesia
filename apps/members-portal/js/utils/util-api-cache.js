/**
 * API Request Cache Utility
 *
 * Simple in-memory cache with TTL for GET requests.
 * Reduces unnecessary API calls and improves performance.
 *
 * @module utils/api-cache
 */

/**
 * @typedef {Object} CacheEntry
 * @property {*} data - Cached data
 * @property {number} timestamp - When the data was cached
 * @property {number} ttl - Time to live in milliseconds
 */

/** @type {Map<string, CacheEntry>} */
const cache = new Map();

/** Default TTL: 1 minute */
const DEFAULT_TTL = 60 * 1000;

/** Max cache entries to prevent memory issues */
const MAX_ENTRIES = 100;

/**
 * Get cached data if valid
 *
 * @param {string} key - Cache key
 * @returns {*|null} Cached data or null if expired/missing
 *
 * @example
 * const cached = getCached('elections:active');
 * if (cached) {
 *   return cached;
 * }
 */
export function getCached(key) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  const isExpired = Date.now() - entry.timestamp > entry.ttl;

  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

/**
 * Store data in cache
 *
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {number} ttlMs - Time to live in milliseconds (default: 60000)
 *
 * @example
 * setCache('elections:active', elections, 120000); // 2 minute TTL
 */
export function setCache(key, data, ttlMs = DEFAULT_TTL) {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }

  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

/**
 * Invalidate cache entries matching a pattern
 *
 * @param {string} pattern - Pattern to match (simple string contains)
 *
 * @example
 * // After creating a new election, invalidate elections cache
 * invalidateCache('elections');
 */
export function invalidateCache(pattern) {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

/**
 * Clear entire cache
 */
export function clearCache() {
  cache.clear();
}

/**
 * Get cache statistics
 *
 * @returns {{ size: number, keys: string[] }} Cache stats
 */
export function getCacheStats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  };
}

/**
 * Create a cached version of an async function
 *
 * @param {Function} fn - Async function to cache
 * @param {Function} keyFn - Function to generate cache key from arguments
 * @param {number} ttlMs - Time to live in milliseconds
 * @returns {Function} Cached version of the function
 *
 * @example
 * const cachedGetElections = withCache(
 *   getElections,
 *   (filters) => `elections:${JSON.stringify(filters)}`,
 *   60000
 * );
 */
export function withCache(fn, keyFn, ttlMs = DEFAULT_TTL) {
  return async function cachedFn(...args) {
    const key = keyFn(...args);
    const cached = getCached(key);

    if (cached !== null) {
      return cached;
    }

    const result = await fn(...args);
    setCache(key, result, ttlMs);
    return result;
  };
}
