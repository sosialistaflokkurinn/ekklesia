/**
 * Heatmap API Client
 *
 * Fetches aggregated member distribution data for visualization.
 * Two-tier caching: memory + localStorage (1hr TTL, matches backend).
 *
 * Security improvements:
 * - Cache cleared on logout
 * - Request deduplication
 * - Cache versioning for schema changes
 *
 * @module api-heatmap
 */

import { httpsCallable } from '../../firebase/app.js';
import { debug } from '../utils/util-debug.js';
import { REGION } from '../config/config.js';
import { onAuthStateChanged } from '../../firebase/app.js';

// Cache configuration (v4 for Cloud SQL migration)
const CACHE_KEY = 'ekklesia_cache_heatmap_v4';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour (matches backend)

// Memory cache
let memoryCache = null;

// Request deduplication: track pending request
let pendingRequest = null;

// Auth state listener registered flag
let authListenerRegistered = false;

/**
 * Register auth state listener to clear cache on logout
 * Only registers once per page load
 */
function registerAuthListener() {
  if (authListenerRegistered) return;

  try {
    onAuthStateChanged((user) => {
      if (!user) {
        // User logged out - clear all heatmap caches
        debug.log('User logged out, clearing heatmap cache');
        clearHeatmapCache();
      }
    });
    authListenerRegistered = true;
    debug.log('Heatmap auth listener registered');
  } catch (e) {
    debug.warn('Failed to register auth listener for heatmap cache:', e);
  }
}

/**
 * Get heatmap data with two-tier caching and request deduplication
 *
 * @param {boolean} forceRefresh - Skip cache and fetch fresh data
 * @returns {Promise<{
 *   municipalities: Array<{name: string, count: number, percentage: number}>,
 *   total_members: number,
 *   total_with_address: number,
 *   coverage_percentage: number,
 *   last_updated: string
 * }>}
 */
export async function getHeatmapData(forceRefresh = false) {
  // Register auth listener on first call
  registerAuthListener();

  // 1. Check memory cache
  if (!forceRefresh && memoryCache) {
    debug.log('Heatmap from memory cache');
    return memoryCache;
  }

  // 2. Check localStorage cache
  if (!forceRefresh) {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        const age = Date.now() - timestamp;

        if (age < CACHE_TTL_MS) {
          debug.log(`Heatmap from localStorage (age: ${Math.round(age / 1000 / 60)} min)`);
          memoryCache = data;
          return data;
        } else {
          debug.log('Heatmap localStorage cache expired');
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (e) {
      debug.warn('Failed to read heatmap cache:', e);
    }
  }

  // 3. Request deduplication: if a request is already in flight, return that promise
  if (pendingRequest) {
    debug.log('Heatmap: returning existing pending request');
    return pendingRequest;
  }

  // 4. Fetch from API with deduplication
  debug.log('Fetching heatmap data from API...');

  pendingRequest = (async () => {
    try {
      const getHeatmap = httpsCallable('get_member_heatmap_data', REGION);
      const result = await getHeatmap();

      memoryCache = result.data;

      // Save to localStorage
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: result.data,
          timestamp: Date.now()
        }));
        debug.log('Heatmap saved to localStorage');
      } catch (e) {
        debug.warn('Failed to save heatmap cache:', e);
      }

      debug.log(`Loaded heatmap: ${result.data.municipalities?.length} municipalities`);
      return result.data;
    } finally {
      // Clear pending request flag when done (success or error)
      pendingRequest = null;
    }
  })();

  return pendingRequest;
}

/**
 * Clear heatmap cache (memory + localStorage)
 * Called automatically on logout
 */
export function clearHeatmapCache() {
  memoryCache = null;
  pendingRequest = null;
  try {
    localStorage.removeItem(CACHE_KEY);
    // Also remove old cache key if exists
    localStorage.removeItem('ekklesia_cache_heatmap');
  } catch (e) {
    /* ignore */
  }
  debug.log('Heatmap cache cleared');
}
