/**
 * Sync History Page - Epic #43 Phase 2
 *
 * Display history of member sync operations from Firestore sync_logs collection.
 */

// Import from member portal public directory (two levels up from /admin/js/)
import { initSession } from '../../session/init.js';
import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

/**
 * Load admin-specific strings from admin portal i18n
 */
class AdminStringsLoader {
  constructor() {
    this.strings = {};
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.strings;

    try {
      const response = await fetch('/admin/i18n/values-is/strings.xml');
      if (!response.ok) {
        throw new Error(`Failed to load admin strings: ${response.statusText}`);
      }

      const xmlText = await response.text();
      this.strings = this.parseXML(xmlText);
      this.loaded = true;

      return this.strings;
    } catch (error) {
      console.error('Failed to load admin strings:', error);
      throw error;
    }
  }

  parseXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`XML parsing error: ${parserError.textContent}`);
    }

    const strings = {};
    const stringElements = xmlDoc.querySelectorAll('string');

    stringElements.forEach(element => {
      const name = element.getAttribute('name');
      const value = element.textContent;
      if (name) {
        strings[name] = value;
      }
    });

    return strings;
  }

  get(key) {
    return this.strings[key] || key;
  }
}

const adminStrings = new AdminStringsLoader();

/**
 * Check if user has admin or superuser role
 */
function checkAdminAccess(userData) {
  const roles = userData.roles || [];
  const hasAccess = roles.includes('admin') || roles.includes('superuser');

  if (!hasAccess) {
    throw new Error('Unauthorized: Admin or superuser role required');
  }

  return true;
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
  const tr = document.createElement('tr');

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

  // Build row HTML
  tr.innerHTML = `
    <td>${formattedDate}</td>
    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
    <td>${stats.total_members || 0}</td>
    <td>${stats.synced || 0}</td>
    <td>${stats.failed || 0}</td>
    <td>${duration}</td>
  `;

  return tr;
}

/**
 * Calculate duration from stats
 */
function calculateDuration(stats) {
  if (!stats.started_at || !stats.completed_at) return 'N/A';

  const start = new Date(stats.started_at);
  const end = new Date(stats.completed_at);
  const durationSec = Math.floor((end - start) / 1000);

  if (durationSec < 60) return `${durationSec}s`;

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Load and display sync history
 */
async function loadHistory() {
  try {
    showLoading();

    const logs = await fetchSyncLogs();
    renderHistoryTable(logs);

    console.log(`✓ Loaded ${logs.length} sync logs`);

  } catch (error) {
    console.error('Failed to load sync history:', error);
    showHistoryError(error);
  }
}

/**
 * Set page text from admin strings
 */
function setPageText(strings) {
  // Page title
  document.getElementById('page-title').textContent = strings.history_title;

  // Navigation
  document.getElementById('nav-brand').textContent = strings.admin_brand;
  document.getElementById('nav-admin-dashboard').textContent = strings.nav_admin_dashboard;
  document.getElementById('nav-admin-sync').textContent = strings.nav_admin_sync;
  document.getElementById('nav-admin-history').textContent = strings.nav_admin_history;
  document.getElementById('nav-back-to-member').textContent = strings.nav_back_to_member;

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
    // 1. Load admin strings
    const strings = await adminStrings.load();

    // 2. Init session (loads member portal strings + authenticates)
    const { user, userData } = await initSession();

    // 3. Check admin access (developer role required)
    checkAdminAccess(userData);

    // 4. Set page text
    setPageText(strings);

    // 5. Setup event listeners
    setupEventListeners();

    // 6. Load sync history
    await loadHistory();

    console.log('✓ Sync history page initialized');

  } catch (error) {
    console.error('Failed to initialize sync history page:', error);

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
    console.error('Error loading sync history page:', error);
    alert(adminStrings.get('error_page_load').replace('%s', error.message));
  }
}

// Run on page load
init();
