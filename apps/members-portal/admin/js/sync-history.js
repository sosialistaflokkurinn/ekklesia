/**
 * Sync History Page - Epic #43 Phase 2
 *
 * Display history of member sync operations from Firestore sync_logs collection.
 */

// Import from member portal public directory (two levels up from /admin/js/)
import { initSession } from '../../session/init.js';
import { initNavigation } from '../../js/nav-interactions.js';
import { debug } from '../../js/utils/util-debug.js';
import { getFirebaseAuth, getFirebaseFirestore, collection, query, orderBy, limit, getDocs } from '../../firebase/app.js';
import { adminStrings } from './i18n/admin-strings-loader.js';
import { checkAdminAccess, calculateDuration } from './utils/admin-helpers.js';
import { el } from '../../js/utils/util-dom.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

// ============================================================================
// SESSION STORAGE CACHE - Cleared on browser close for security
// ============================================================================
const CACHE_KEY = 'admin_sync_history_cache';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached sync logs from sessionStorage
 * @returns {Object|null} { data, isStale } or null if no cache
 */
function getCache() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    return {
      data,
      isStale: age > CACHE_MAX_AGE_MS
    };
  } catch (e) {
    debug.warn('[Cache] Failed to read cache:', e);
    return null;
  }
}

/**
 * Save sync logs to sessionStorage cache
 * @param {Array} data - Sync logs array to cache
 */
function setCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    debug.log('[Cache] Sync logs cached:', data.length);
  } catch (e) {
    debug.warn('[Cache] Failed to write cache:', e);
  }
}

/**
 * Fetch sync logs from Firestore
 */
async function fetchSyncLogs() {
  const syncLogsRef = collection(db, 'sync_logs');
  const q = query(syncLogsRef, orderBy('created_at', 'desc'), limit(20));
  const querySnapshot = await getDocs(q);

  const logs = [];
  querySnapshot.forEach(doc => {
    logs.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return logs;
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('history-loading').classList.remove('u-hidden');
  document.getElementById('history-error').classList.add('u-hidden');
  document.getElementById('history-empty').classList.add('u-hidden');
  document.getElementById('history-content').classList.add('u-hidden');
}

/**
 * Show error state
 */
function showHistoryError(error) {
  const strings = adminStrings.strings;

  document.getElementById('history-loading').classList.add('u-hidden');
  document.getElementById('history-content').classList.add('u-hidden');
  document.getElementById('history-empty').classList.add('u-hidden');

  const errorContainer = document.getElementById('history-error');
  errorContainer.classList.remove('u-hidden');

  document.getElementById('error-message').textContent =
    strings.error_load_history.replace('%s', error.message);
  document.getElementById('retry-button').textContent = strings.btn_retry;
}

/**
 * Show empty state
 */
function showEmpty() {
  const strings = adminStrings.strings;

  document.getElementById('history-loading').classList.add('u-hidden');
  document.getElementById('history-error').classList.add('u-hidden');
  document.getElementById('history-content').classList.add('u-hidden');

  const emptyContainer = document.getElementById('history-empty');
  emptyContainer.classList.remove('u-hidden');

  document.getElementById('empty-message').textContent = strings.history_empty;
}

/**
 * Show history content
 */
function showContent() {
  document.getElementById('history-loading').classList.add('u-hidden');
  document.getElementById('history-error').classList.add('u-hidden');
  document.getElementById('history-empty').classList.add('u-hidden');
  document.getElementById('history-content').classList.remove('u-hidden');
}

/**
 * Render sync logs table
 */
function renderHistoryTable(logs) {
  const strings = adminStrings.strings;
  const tbody = document.getElementById('history-tbody');

  // Clear existing rows
  tbody.innerHTML = '';

  if (logs.length === 0) {
    showEmpty();
    return;
  }

  // Create table rows
  logs.forEach(log => {
    const row = createHistoryRow(log, strings);
    tbody.appendChild(row);
  });

  showContent();
}

/**
 * Create a table row for a sync log
 */
function createHistoryRow(log, strings) {
  // Format timestamp (use created_at from Firestore)
  const timestamp = log.created_at?.toDate?.() || (log.created_at ? new Date(log.created_at) : new Date());
  const formattedDate = timestamp.toLocaleString('is-IS', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Determine status
  const stats = log.stats || {};
  const statusText = stats.failed > 0 ? strings.history_status_failed : strings.history_status_success;
  const statusClass = stats.failed > 0 ? 'status-failed' : 'status-success';

  // Calculate duration
  const duration = calculateDuration(stats);

  // Build row using el() helper
  return el('tr', '', {},
    el('td', '', {}, formattedDate),
    el('td', '', {}, 
      el('span', `status-badge ${statusClass}`, {}, statusText)
    ),
    el('td', '', {}, String(stats.total_members || 0)),
    el('td', '', {}, String(stats.synced || 0)),
    el('td', '', {}, String(stats.failed || 0)),
    el('td', '', {}, duration)
  );
}

/**
 * Load and display sync history
 * @param {boolean} backgroundRefresh - If true, don't show loading spinner
 */
async function loadHistory(backgroundRefresh = false) {
  try {
    if (!backgroundRefresh) {
      showLoading();
    }

    const logs = await fetchSyncLogs();

    // Cache the results
    setCache(logs);

    renderHistoryTable(logs);

    debug.log(`✓ Loaded ${logs.length} sync logs`);

  } catch (error) {
    debug.error('Failed to load sync history:', error);
    if (!backgroundRefresh) {
      showHistoryError(error);
    }
  }
}

/**
 * Set page text from admin strings
 */
function setPageText(strings) {
  // Page title
  document.getElementById('page-title').textContent = strings.history_title;

  // Navigation - Handled by nav-header.js component
  // document.getElementById('nav-brand').textContent = strings.admin_brand;
  // document.getElementById('nav-admin-dashboard').textContent = strings.nav_admin_dashboard;
  // document.getElementById('nav-admin-members').textContent = strings.nav_admin_members;
  // document.getElementById('nav-admin-sync').textContent = strings.nav_admin_sync;
  // document.getElementById('nav-admin-history').textContent = strings.nav_admin_history;
  // document.getElementById('nav-back-to-member').textContent = strings.nav_back_to_member;
  // document.getElementById('nav-logout').textContent = strings.nav_logout;

  // Page header
  document.getElementById('history-title').textContent = strings.history_title;
  document.getElementById('history-subtitle').textContent = strings.history_subtitle;

  // Table headers
  document.getElementById('th-date').textContent = strings.history_table_date;
  document.getElementById('th-status').textContent = strings.history_table_status;
  document.getElementById('th-total').textContent = strings.history_table_total;
  document.getElementById('th-synced').textContent = strings.history_table_synced;
  document.getElementById('th-failed').textContent = strings.history_table_failed;
  document.getElementById('th-duration').textContent = strings.history_table_duration;

  // Loading message
  document.getElementById('loading-message').textContent = strings.loading_sync_logs;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Retry button (if error occurs)
  document.getElementById('retry-button').addEventListener('click', loadHistory);
}

/**
 * Initialize sync history page
 */
async function init() {
  try {
    // Check for cached data first - show immediately for instant load
    const cached = getCache();
    if (cached?.data && cached.data.length > 0) {
      debug.log('[Cache] Showing cached sync logs immediately:', cached.data.length);
      renderHistoryTable(cached.data);
    }

    // 1. Load admin strings
    const strings = await adminStrings.load();

    // 2. Init session (loads member portal strings + authenticates)
    const { user, userData } = await initSession();

    // 3. Check admin access (developer role required)
    checkAdminAccess(userData);

    // 4. Note: Navigation now initialized by nav-header component

    // 5. Set page text
    setPageText(strings);

    // 6. Setup event listeners
    setupEventListeners();

    // 7. Load sync history (background refresh if we have cached data)
    if (cached?.data) {
      if (cached.isStale) {
        debug.log('[Cache] Cache is stale, refreshing in background');
        loadHistory(true).catch(err => {
          debug.warn('[Cache] Background refresh failed:', err);
        });
      }
    } else {
      // No cache - load normally with loading spinner
      await loadHistory();
    }

    debug.log('✓ Sync history page initialized');

  } catch (error) {
    debug.error('Failed to initialize sync history page:', error);

    // Check if unauthorized
    if (error.message.includes('Unauthorized')) {
      alert(adminStrings.get('error_unauthorized_admin'));
      window.location.href = '/members-area/dashboard.html';
      return;
    }

    // Check if not authenticated
    if (error.message.includes('Not authenticated')) {
      window.location.href = '/';
      return;
    }

    // Other errors
    debug.error('Error loading sync history page:', error);
    alert(adminStrings.get('error_page_load').replace('%s', error.message));
  }
}

// Run on page load
init();
