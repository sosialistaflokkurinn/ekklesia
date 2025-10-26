/**
 * Sync Members Page - Epic #43 Phase 2
 *
 * Trigger manual member sync from Django to Firestore.
 * Calls syncmembers Cloud Function and displays results.
 */

// Import from member portal public directory (two levels up from /admin/js/)
import { initSession } from '../../session/init.js';
import { auth } from '../../firebase/app.js';
import { initNav } from '../../ui/nav.js';
import { showError } from '../../ui/dom.js';

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
 * Check if user has developer role
 */
function checkAdminAccess(user) {
  return user.getIdTokenResult().then(idTokenResult => {
    const roles = idTokenResult.claims.roles || [];
    const isAdmin = roles.includes('developer');

    if (!isAdmin) {
      throw new Error('Unauthorized: Developer role required');
    }

    return idTokenResult;
  });
}

/**
 * Call syncmembers Cloud Function
 */
async function triggerSync() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  // Get Firebase ID token
  const token = await user.getIdToken();

  // Call Cloud Function
  const response = await fetch(
    'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/syncmembers',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data: {} })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  return result.result;  // Cloud Functions wrap response in { result: ... }
}

/**
 * Show sync trigger card, hide others
 */
function showTriggerCard() {
  document.getElementById('sync-trigger-card').classList.remove('u-hidden');
  document.getElementById('sync-status-card').classList.add('u-hidden');
  document.getElementById('sync-error-card').classList.add('u-hidden');
}

/**
 * Show sync in progress
 */
function showSyncInProgress() {
  const strings = adminStrings.strings;

  document.getElementById('sync-trigger-card').classList.add('u-hidden');
  document.getElementById('sync-error-card').classList.add('u-hidden');

  const statusCard = document.getElementById('sync-status-card');
  statusCard.classList.remove('u-hidden');

  document.getElementById('sync-status-title').textContent = strings.sync_status_title;
  document.getElementById('sync-progress-message').textContent = strings.sync_progress_message;

  // Show progress, hide stats and actions
  document.getElementById('sync-progress').classList.remove('u-hidden');
  document.getElementById('sync-stats').classList.add('u-hidden');
  document.getElementById('sync-actions').classList.add('u-hidden');
}

/**
 * Show sync success with stats
 */
function showSyncSuccess(result) {
  const strings = adminStrings.strings;
  const stats = result.stats || {};

  // Update title
  document.getElementById('sync-status-title').textContent = strings.sync_success_title;

  // Hide progress
  document.getElementById('sync-progress').classList.add('u-hidden');

  // Show stats
  const statsContainer = document.getElementById('sync-stats');
  statsContainer.classList.remove('u-hidden');

  // Set stat labels
  document.getElementById('stat-total-label').textContent = strings.stat_total_label;
  document.getElementById('stat-synced-label').textContent = strings.stat_synced_label;
  document.getElementById('stat-failed-label').textContent = strings.stat_failed_label;
  document.getElementById('stat-duration-label').textContent = strings.stat_duration_label;

  // Set stat values
  document.getElementById('stat-total-value').textContent = stats.total_members || 0;
  document.getElementById('stat-synced-value').textContent = stats.synced || 0;
  document.getElementById('stat-failed-value').textContent = stats.failed || 0;
  document.getElementById('stat-duration-value').textContent = calculateDuration(stats);

  // Show action buttons
  const actionsContainer = document.getElementById('sync-actions');
  actionsContainer.classList.remove('u-hidden');

  document.getElementById('view-history-btn').textContent = strings.btn_view_history;
  document.getElementById('back-dashboard-btn').textContent = strings.btn_back_to_dashboard;
}

/**
 * Show sync error
 */
function showSyncError(error) {
  const strings = adminStrings.strings;

  document.getElementById('sync-trigger-card').classList.add('u-hidden');
  document.getElementById('sync-status-card').classList.add('u-hidden');

  const errorCard = document.getElementById('sync-error-card');
  errorCard.classList.remove('u-hidden');

  document.getElementById('sync-error-title').textContent = strings.sync_failed_title;
  document.getElementById('sync-error-message').textContent =
    strings.error_sync_trigger.replace('%s', error.message);
  document.getElementById('sync-retry-btn').textContent = strings.btn_retry;
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
 * Handle sync trigger button click
 */
async function handleSyncTrigger() {
  const strings = adminStrings.strings;

  // Confirm with user
  if (!confirm(strings.sync_trigger_confirm)) {
    return;
  }

  try {
    // Show in progress
    showSyncInProgress();

    // Trigger sync
    const result = await triggerSync();

    console.log('Sync completed:', result);

    // Show success
    showSyncSuccess(result);

  } catch (error) {
    console.error('Sync failed:', error);
    showSyncError(error);
  }
}

/**
 * Set page text from admin strings
 */
function setPageText(strings) {
  // Page title
  document.getElementById('page-title').textContent = strings.sync_members_title;

  // Navigation
  document.getElementById('nav-brand').textContent = strings.admin_brand;
  document.getElementById('nav-admin-dashboard').textContent = strings.nav_admin_dashboard;
  document.getElementById('nav-admin-sync').textContent = strings.nav_admin_sync;
  document.getElementById('nav-admin-history').textContent = strings.nav_admin_history;
  document.getElementById('nav-back-to-member').textContent = strings.nav_back_to_member;

  // Page header
  document.getElementById('sync-title').textContent = strings.sync_members_title;
  document.getElementById('sync-subtitle').textContent = strings.sync_members_subtitle;

  // Trigger card
  document.getElementById('sync-trigger-title').textContent = strings.sync_trigger_title;
  document.getElementById('sync-trigger-btn').textContent = strings.sync_trigger_btn;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Trigger sync button
  document.getElementById('sync-trigger-btn').addEventListener('click', handleSyncTrigger);

  // Retry button (if error occurs)
  document.getElementById('sync-retry-btn').addEventListener('click', () => {
    showTriggerCard();
  });

  // View history button
  document.getElementById('view-history-btn').addEventListener('click', () => {
    window.location.href = '/admin/sync-history.html';
  });

  // Back to dashboard button
  document.getElementById('back-dashboard-btn').addEventListener('click', () => {
    window.location.href = '/admin/admin.html';
  });
}

/**
 * Initialize sync members page
 */
async function init() {
  try {
    // 1. Load admin strings
    const strings = await adminStrings.load();

    // 2. Init session (loads member portal strings + authenticates)
    const user = await initSession();

    // 3. Check admin access (developer role required)
    await checkAdminAccess(user);

    // 4. Set page text
    setPageText(strings);

    // 5. Initialize navigation
    initNav();

    // 6. Setup event listeners
    setupEventListeners();

    console.log('✓ Sync members page initialized');

  } catch (error) {
    console.error('Failed to initialize sync members page:', error);

    // Check if unauthorized
    if (error.message.includes('Unauthorized')) {
      alert('Þú hefur ekki aðgang að stjórnkerfi. Aðeins notendur með developer role hafa aðgang.');
      window.location.href = '/dashboard.html';
      return;
    }

    // Check if not authenticated
    if (error.message.includes('Not authenticated')) {
      window.location.href = '/';
      return;
    }

    // Other errors
    showError(`Villa við að hlaða síðu: ${error.message}`);
  }
}

// Run on page load
init();
