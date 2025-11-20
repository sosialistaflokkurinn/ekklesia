/**
 * Sync Queue Page - Epic #43 Phase 2
 *
 * Display pending sync queue items from Firestore sync_queue collection.
 * Shows member profile changes waiting to be synced to Django.
 */

// Import from member portal public directory (two levels up from /admin/js/)
import { initSession } from '../../session/init.js';
import { initNavigation } from '../../js/nav.js';
import { debug } from '../../js/utils/debug.js';
import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { adminStrings } from './i18n/admin-strings-loader.js';
import { checkAdminAccess } from './utils/admin-helpers.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

/**
 * Fetch sync queue items from Firestore
 */
async function fetchSyncQueue() {
  const syncQueueRef = collection(db, 'sync_queue');
  const q = query(syncQueueRef, orderBy('created_at', 'desc'), limit(50));
  const querySnapshot = await getDocs(q);

  const items = [];
  querySnapshot.forEach(doc => {
    items.push({
      id: doc.id,
      ...doc.data()
    });
  });

  return items;
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('queue-loading').classList.remove('u-hidden');
  document.getElementById('queue-error').classList.add('u-hidden');
  document.getElementById('queue-empty').classList.add('u-hidden');
  document.getElementById('queue-content').classList.add('u-hidden');
}

/**
 * Show error state
 */
function showQueueError(error) {
  const strings = adminStrings.strings;

  document.getElementById('queue-loading').classList.add('u-hidden');
  document.getElementById('queue-content').classList.add('u-hidden');
  document.getElementById('queue-empty').classList.add('u-hidden');

  const errorContainer = document.getElementById('queue-error');
  errorContainer.classList.remove('u-hidden');

  document.getElementById('error-message').textContent =
    strings.error_load_queue.replace('%s', error.message);
  document.getElementById('retry-button').textContent = strings.btn_retry;
}

/**
 * Show empty state
 */
function showEmpty() {
  const strings = adminStrings.strings;

  document.getElementById('queue-loading').classList.add('u-hidden');
  document.getElementById('queue-error').classList.add('u-hidden');
  document.getElementById('queue-content').classList.add('u-hidden');

  const emptyContainer = document.getElementById('queue-empty');
  emptyContainer.classList.remove('u-hidden');

  document.getElementById('empty-message').textContent = strings.queue_empty;
}

/**
 * Show queue content
 */
function showContent() {
  document.getElementById('queue-loading').classList.add('u-hidden');
  document.getElementById('queue-error').classList.add('u-hidden');
  document.getElementById('queue-empty').classList.add('u-hidden');
  document.getElementById('queue-content').classList.remove('u-hidden');
}

/**
 * Render sync queue table
 */
function renderQueueTable(items) {
  const strings = adminStrings.strings;
  const tbody = document.getElementById('queue-tbody');

  // Clear existing rows
  tbody.innerHTML = '';

  if (items.length === 0) {
    showEmpty();
    return;
  }

  // Create table rows
  items.forEach(item => {
    const row = createQueueRow(item, strings);
    tbody.appendChild(row);
  });

  showContent();
}

/**
 * Mask kennitala for PII safety
 * Formats: DDMMYY-XXXX (display with hyphen, mask last 4 digits)
 */
function maskKennitala(kennitala) {
  if (!kennitala) return 'N/A';

  // Normalize to 10 digits (remove hyphen if present)
  const normalized = kennitala.replace(/-/g, '');

  if (normalized.length !== 10) return 'Invalid';

  // Format as DDMMYY-XXXX
  const first6 = normalized.substring(0, 6);
  return `${first6}-XXXX`;
}

/**
 * Get field name from changes object
 */
function getFieldName(changes) {
  if (!changes) return 'N/A';

  // Changes is object like { "profile.phone": "XXX-XXXX" }
  const keys = Object.keys(changes);
  if (keys.length === 0) return 'N/A';

  // Extract field name after "profile."
  const fullPath = keys[0];
  if (fullPath.startsWith('profile.')) {
    return fullPath.substring(8); // Remove "profile." prefix
  }

  return fullPath;
}

/**
 * Create a table row for a sync queue item
 */
function createQueueRow(item, strings) {
  const tr = document.createElement('tr');

  // Format timestamp (use created_at from Firestore)
  const timestamp = item.created_at?.toDate?.() || (item.created_at ? new Date(item.created_at) : new Date());
  const formattedDate = timestamp.toLocaleString('is-IS', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Mask kennitala for PII safety
  const maskedKennitala = maskKennitala(item.kennitala);

  // Get action (update, create, delete)
  const action = item.action || 'N/A';
  const actionText = strings[`queue_action_${action}`] || action;

  // Get field name from changes
  const fieldName = getFieldName(item.changes);
  const fieldText = strings[`profile_${fieldName}`] || fieldName;

  // Get sync status (pending, synced, failed)
  const status = item.sync_status || 'pending';
  const statusText = strings[`queue_status_${status}`] || status;
  const statusClass = status === 'synced' ? 'status-success' :
                     status === 'failed' ? 'status-failed' :
                     'status-pending';

  // Build row HTML
  tr.innerHTML = `
    <td>${formattedDate}</td>
    <td>${maskedKennitala}</td>
    <td>${actionText}</td>
    <td>${fieldText}</td>
    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
  `;

  return tr;
}

/**
 * Load and display sync queue
 */
async function loadQueue() {
  try {
    showLoading();

    const items = await fetchSyncQueue();
    renderQueueTable(items);

    debug.log(`✓ Loaded ${items.length} sync queue items`);

  } catch (error) {
    debug.error('Failed to load sync queue:', error);
    showQueueError(error);
  }
}

/**
 * Set page text from admin strings
 */
function setPageText(strings) {
  // Page title
  document.getElementById('page-title').textContent = strings.queue_title;

  // Navigation
  document.getElementById('nav-brand').textContent = strings.admin_brand;
  document.getElementById('nav-admin-dashboard').textContent = strings.nav_admin_dashboard;
  document.getElementById('nav-admin-members').textContent = strings.nav_admin_members;
  document.getElementById('nav-admin-sync').textContent = strings.nav_admin_sync;
  document.getElementById('nav-admin-queue').textContent = strings.nav_admin_queue;
  document.getElementById('nav-admin-history').textContent = strings.nav_admin_history;
  document.getElementById('nav-back-to-member').textContent = strings.nav_back_to_member;
  document.getElementById('nav-logout').textContent = strings.nav_logout;

  // Page header
  document.getElementById('queue-title').textContent = strings.queue_title;
  document.getElementById('queue-subtitle').textContent = strings.queue_subtitle;

  // Table headers
  document.getElementById('th-created').textContent = strings.queue_table_created;
  document.getElementById('th-member').textContent = strings.queue_table_member;
  document.getElementById('th-action').textContent = strings.queue_table_action;
  document.getElementById('th-field').textContent = strings.queue_table_field;
  document.getElementById('th-status').textContent = strings.queue_table_status;

  // Loading message
  document.getElementById('loading-message').textContent = strings.loading_queue;
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Retry button (if error occurs)
  document.getElementById('retry-button').addEventListener('click', loadQueue);
}

/**
 * Initialize sync queue page
 */
async function init() {
  try {
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

    // 7. Load sync queue
    await loadQueue();

    debug.log('✓ Sync queue page initialized');

  } catch (error) {
    debug.error('Failed to initialize sync queue page:', error);

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
    debug.error('Error loading sync queue page:', error);
    alert(adminStrings.get('error_page_load').replace('%s', error.message));
  }
}

// Run on page load
init();
