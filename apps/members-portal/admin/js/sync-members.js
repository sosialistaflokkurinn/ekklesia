/**
 * Sync Members Page - Epic #43 Phase 2
 *
 * Trigger manual member sync from Django to Firestore.
 * Calls syncmembers Cloud Function and displays results.
 */

// Import from member portal public directory (two levels up from /admin/js/)
import { initSession } from '../../session/init.js';
import { initNavigation } from '../../js/nav.js';
import { debug } from '../../js/utils/debug.js';
import { getFirebaseAuth } from '../../firebase/app.js';
import { adminStrings } from './i18n/admin-strings-loader.js';
import { checkAdminAccess, calculateDuration } from './utils/admin-helpers.js';
import { showToast, showSuccess, showError } from '../../js/components/toast.js';
import { toggleButtonLoading } from '../../js/components/status.js';
import { showConfirm } from '../../js/components/modal.js';

// Initialize Firebase Auth
const auth = getFirebaseAuth();

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
  debug.log('showSyncSuccess called with result:', result);

  const strings = adminStrings.strings;
  const stats = result.stats || {};

  debug.log('Stats extracted:', stats);

  try {
    // Update title
    const titleEl = document.getElementById('sync-status-title');
    if (titleEl) {
      titleEl.textContent = strings.sync_success_title || 'Samstilling tókst';
    }

    // Hide progress
    const progressEl = document.getElementById('sync-progress');
    if (progressEl) {
      progressEl.classList.add('u-hidden');
      debug.log('Progress hidden');
    }

    // Show stats
    const statsContainer = document.getElementById('sync-stats');
    if (statsContainer) {
      statsContainer.classList.remove('u-hidden');
      debug.log('Stats container shown');
    }

    // Set stat labels
    const totalLabel = document.getElementById('stat-total-label');
    const syncedLabel = document.getElementById('stat-synced-label');
    const failedLabel = document.getElementById('stat-failed-label');
    const durationLabel = document.getElementById('stat-duration-label');

    if (totalLabel) totalLabel.textContent = strings.stat_total_label || 'Samtals';
    if (syncedLabel) syncedLabel.textContent = strings.stat_synced_label || 'Samstillt';
    if (failedLabel) failedLabel.textContent = strings.stat_failed_label || 'Mistókust';
    if (durationLabel) durationLabel.textContent = strings.stat_duration_label || 'Tímalengd';

    // Set stat values
    const totalValue = document.getElementById('stat-total-value');
    const syncedValue = document.getElementById('stat-synced-value');
    const failedValue = document.getElementById('stat-failed-value');
    const durationValue = document.getElementById('stat-duration-value');

    if (totalValue) totalValue.textContent = stats.total_members || 0;
    if (syncedValue) syncedValue.textContent = stats.synced || 0;
    if (failedValue) failedValue.textContent = stats.failed || 0;
    if (durationValue) durationValue.textContent = calculateDuration(stats);

    debug.log('Stats updated:', {
      total: stats.total_members,
      synced: stats.synced,
      failed: stats.failed
    });

    // Show action buttons
    const actionsContainer = document.getElementById('sync-actions');
    if (actionsContainer) {
      actionsContainer.classList.remove('u-hidden');
      debug.log('Actions shown');
    }

    const viewHistoryBtn = document.getElementById('view-history-btn');
    const backDashboardBtn = document.getElementById('back-dashboard-btn');

    if (viewHistoryBtn) viewHistoryBtn.textContent = strings.btn_view_history || 'Skoða keyrslusögu';
    if (backDashboardBtn) backDashboardBtn.textContent = strings.btn_back_to_dashboard || 'Aftur í yfirlit';

    debug.log('✓ showSyncSuccess completed successfully');

  } catch (error) {
    debug.error('Error in showSyncSuccess:', error);
    throw error;
  }
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
 * Handle sync trigger button click
 */
async function handleSyncTrigger() {
  const strings = adminStrings.strings;

  // Confirm with user
  const confirmed = await showConfirm(
    strings.sync_trigger_confirm_title,
    strings.sync_trigger_confirm_message,
    { confirmText: strings.sync_trigger_confirm_btn, confirmStyle: 'primary' }
  );
  
  if (!confirmed) {
    return;
  }

  try {
    // Show in progress
    showSyncInProgress();

    // Trigger sync
    const result = await triggerSync();

    debug.log('Sync completed:', result);

    // Show success
    showSyncSuccess(result);

  } catch (error) {
    debug.error('Sync failed:', error);
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
  document.getElementById('nav-logout').textContent = strings.nav_logout;

  // Page header
  document.getElementById('sync-title').textContent = strings.sync_members_title;
  document.getElementById('sync-subtitle').textContent = strings.sync_members_subtitle;

  // Trigger card
  document.getElementById('sync-trigger-title').textContent = strings.sync_trigger_title;
  document.getElementById('sync-description').textContent = strings.sync_trigger_description;


  document.getElementById('sync-trigger-btn').textContent = strings.sync_trigger_btn;

  // Sync status card (initial state)
  document.getElementById('sync-status-title').textContent = strings.sync_status_title;
  document.getElementById('sync-progress-message').textContent = strings.sync_progress_message;

  // Stats labels
  document.getElementById('stat-total-label').textContent = strings.stat_total_label;
  document.getElementById('stat-synced-label').textContent = strings.stat_synced_label;
  document.getElementById('stat-failed-label').textContent = strings.stat_failed_label;
  document.getElementById('stat-duration-label').textContent = strings.stat_duration_label;

  // Action buttons
  document.getElementById('view-history-btn').textContent = strings.btn_view_history;
  document.getElementById('back-dashboard-btn').textContent = strings.btn_back_to_dashboard;

  // Error card
  document.getElementById('sync-error-title').textContent = strings.sync_failed_title;
  document.getElementById('sync-retry-btn').textContent = strings.btn_retry;
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
    const { user, userData } = await initSession();

    // 3. Check admin access (developer role required)
    checkAdminAccess(userData);

    // 4. Initialize navigation (hamburger menu)
    initNavigation();

    // 5. Set page text
    setPageText(strings);

    // 6. Setup event listeners
    setupEventListeners();

    debug.log('✓ Sync members page initialized');

  } catch (error) {
    debug.error('Failed to initialize sync members page:', error);

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
    debug.error('Error loading sync members page:', error);
    alert(adminStrings.get('error_page_load').replace('%s', error.message));
  }
}

// Run on page load
init();
