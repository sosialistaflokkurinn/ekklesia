/**
 * Lookup Data API
 *
 * Cached fetching for unions, job titles, cells, and static housing situations.
 * Used by profile pages to populate dropdowns.
 *
 * Two-tier caching:
 * 1. Memory cache (fast, cleared on page refresh)
 * 2. localStorage cache (persistent, 24 hour TTL)
 *
 * This avoids cold start delays on Cloud Functions.
 *
 * @module api-lookups
 */

import { httpsCallable } from '../../firebase/app.js';
import { debug } from '../utils/util-debug.js';

const REGION = 'europe-west2';

// Cache configuration
const CACHE_VERSION = 1; // Increment to invalidate all caches
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CELLS_CACHE_MAX_SIZE = 50; // Max postal codes to cache
const STORAGE_KEY_UNIONS = 'ekklesia_cache_unions';
const STORAGE_KEY_JOB_TITLES = 'ekklesia_cache_job_titles';
const STORAGE_KEY_VERSION = 'ekklesia_cache_version';

// Memory cache storage with timestamps
let unionsCache = null;
let jobTitlesCache = null;
let cellsCache = new Map(); // Map for LRU-like behavior

/**
 * Check and update cache version (invalidates old caches)
 */
function checkCacheVersion() {
  try {
    const storedVersion = localStorage.getItem(STORAGE_KEY_VERSION);
    if (storedVersion !== String(CACHE_VERSION)) {
      debug.log(`🔄 Cache version changed (${storedVersion} → ${CACHE_VERSION}), clearing all caches`);
      localStorage.removeItem(STORAGE_KEY_UNIONS);
      localStorage.removeItem(STORAGE_KEY_JOB_TITLES);
      localStorage.setItem(STORAGE_KEY_VERSION, String(CACHE_VERSION));
    }
  } catch (error) {
    debug.warn('Failed to check cache version:', error);
  }
}

// Check version on module load
checkCacheVersion();

/**
 * Get item from localStorage with TTL check
 * @param {string} key - Storage key
 * @returns {any|null} - Cached data or null if expired/missing
 */
function getFromStorage(key) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const { data, timestamp } = JSON.parse(stored);
    const age = Date.now() - timestamp;

    if (age > CACHE_TTL_MS) {
      debug.log(`📦 Cache expired for ${key} (age: ${Math.round(age / 1000 / 60)} min)`);
      localStorage.removeItem(key);
      return null;
    }

    debug.log(`📦 Loaded ${key} from localStorage (age: ${Math.round(age / 1000 / 60)} min)`);
    return data;
  } catch (error) {
    debug.warn(`Failed to read from localStorage: ${key}`, error);
    return null;
  }
}

/**
 * Save item to localStorage with timestamp
 * @param {string} key - Storage key
 * @param {any} data - Data to store
 */
function saveToStorage(key, data) {
  try {
    const item = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(item));
    debug.log(`💾 Saved ${key} to localStorage`);
  } catch (error) {
    debug.warn(`Failed to save to localStorage: ${key}`, error);
  }
}

/**
 * Housing situation options (static, no API needed)
 */
const HOUSING_SITUATIONS = [
  { value: 0, label: 'Á íbúð, engar eftirstöðvar' },
  { value: 1, label: 'Á íbúð, eftirstöðvar af láni' },
  { value: 2, label: 'Leigi ein(n) eða með maka/fjölskyldu' },
  { value: 3, label: 'Leigi með meðleigjendum' },
  { value: 4, label: 'Dvel hjá ættingjum/vinum' },
  { value: 5, label: 'Dvel í húsi í leyfisleysi' },
  { value: 6, label: 'Heimilislaus' }
];

/**
 * Get all unions (cached)
 * Uses two-tier cache: memory -> localStorage -> API
 *
 * @returns {Promise<Array<{id: number, name: string}>>}
 */
export async function getUnions() {
  // 1. Check memory cache
  if (unionsCache) {
    debug.log('📦 Unions from memory cache');
    return unionsCache;
  }

  // 2. Check localStorage cache
  const stored = getFromStorage(STORAGE_KEY_UNIONS);
  if (stored) {
    unionsCache = stored;
    return unionsCache;
  }

  // 3. Fetch from API
  try {
    debug.log('🔄 Fetching unions from API...');
    const listUnions = httpsCallable('list_unions', REGION);
    const result = await listUnions();

    // API returns array of {id, name}
    unionsCache = result.data || [];

    // Save to localStorage for next visit
    saveToStorage(STORAGE_KEY_UNIONS, unionsCache);

    debug.log(`✅ Loaded ${unionsCache.length} unions`);
    return unionsCache;
  } catch (error) {
    debug.error('❌ Failed to fetch unions:', error);
    return [];
  }
}

/**
 * Get union name by ID
 *
 * @param {number} id - Union ID
 * @returns {Promise<string>} Union name or empty string
 */
export async function getUnionName(id) {
  const unions = await getUnions();
  const union = unions.find(u => u.id === id);
  return union?.name || '';
}

/**
 * Get all job titles (cached)
 * Uses two-tier cache: memory -> localStorage -> API
 *
 * @returns {Promise<Array<{id: number, name: string}>>}
 */
export async function getJobTitles() {
  // 1. Check memory cache
  if (jobTitlesCache) {
    debug.log('📦 Job titles from memory cache');
    return jobTitlesCache;
  }

  // 2. Check localStorage cache
  const stored = getFromStorage(STORAGE_KEY_JOB_TITLES);
  if (stored) {
    jobTitlesCache = stored;
    return jobTitlesCache;
  }

  // 3. Fetch from API
  try {
    debug.log('🔄 Fetching job titles from API...');
    const listJobTitles = httpsCallable('list_job_titles', REGION);
    const result = await listJobTitles();

    // API returns array of {id, name}
    jobTitlesCache = result.data || [];

    // Save to localStorage for next visit
    saveToStorage(STORAGE_KEY_JOB_TITLES, jobTitlesCache);

    debug.log(`✅ Loaded ${jobTitlesCache.length} job titles`);
    return jobTitlesCache;
  } catch (error) {
    debug.error('❌ Failed to fetch job titles:', error);
    return [];
  }
}

/**
 * Get job title name by ID
 *
 * @param {number} id - Job title ID
 * @returns {Promise<string>} Job title name or empty string
 */
export async function getJobTitleName(id) {
  const titles = await getJobTitles();
  const title = titles.find(t => t.id === id);
  return title?.name || '';
}

/**
 * Get cells for a postal code (cached by postal_code_id)
 * Uses LRU-like eviction when cache exceeds CELLS_CACHE_MAX_SIZE
 *
 * @param {number} postalCodeId - Postal code ID from lookup_postal_codes
 * @param {boolean} forceRefresh - Force fetch from API
 * @returns {Promise<Array<{id: number, name: string}>>}
 */
export async function getCellsByPostalCode(postalCodeId, forceRefresh = false) {
  // Check cache unless forcing refresh
  if (!forceRefresh && cellsCache.has(postalCodeId)) {
    debug.log(`📦 Cells for postal ${postalCodeId} from cache`);
    return cellsCache.get(postalCodeId);
  }

  try {
    debug.log(`🔄 Fetching cells for postal code ${postalCodeId}...`);
    const getCells = httpsCallable('get_cells_by_postal_code', REGION);
    const result = await getCells({ postal_code_id: postalCodeId });

    // API returns array of {id, name}
    const cells = result.data || [];

    // Evict oldest entries if cache is full (simple LRU)
    if (cellsCache.size >= CELLS_CACHE_MAX_SIZE) {
      const oldestKey = cellsCache.keys().next().value;
      cellsCache.delete(oldestKey);
      debug.log(`🗑️ Evicted oldest cells cache entry: ${oldestKey}`);
    }

    cellsCache.set(postalCodeId, cells);
    debug.log(`✅ Loaded ${cells.length} cells`);
    return cells;
  } catch (error) {
    debug.error('❌ Failed to fetch cells:', error);
    return [];
  }
}

/**
 * Get housing situation options (static)
 *
 * @returns {Array<{value: number, label: string}>}
 */
export function getHousingSituations() {
  return HOUSING_SITUATIONS;
}

/**
 * Get housing situation label by value
 *
 * @param {number} value - Housing situation value (0-6)
 * @returns {string} Label or empty string
 */
export function getHousingSituationLabel(value) {
  const situation = HOUSING_SITUATIONS.find(s => s.value === value);
  return situation?.label || '';
}

/**
 * Clear all caches (for testing or forced refresh)
 * Clears both memory and localStorage caches
 *
 * @param {string} type - Optional: 'unions', 'jobTitles', 'cells', or null for all
 */
export function clearLookupCaches(type = null) {
  if (!type || type === 'unions') {
    unionsCache = null;
    try { localStorage.removeItem(STORAGE_KEY_UNIONS); } catch (e) { /* ignore */ }
  }

  if (!type || type === 'jobTitles') {
    jobTitlesCache = null;
    try { localStorage.removeItem(STORAGE_KEY_JOB_TITLES); } catch (e) { /* ignore */ }
  }

  if (!type || type === 'cells') {
    cellsCache.clear();
  }

  debug.log(`🗑️ Lookup caches cleared: ${type || 'all'}`);
}

/**
 * Preload all lookups (call on page init for better UX)
 */
export async function preloadLookups() {
  debug.log('⏳ Preloading lookups...');
  await Promise.all([
    getUnions(),
    getJobTitles()
  ]);
  debug.log('✅ Lookups preloaded');
}
