/**
 * Admin Dashboard - Epic #43 Phase 2
 *
 * Main admin page with role-based access control.
 * Only users with 'admin' or 'superuser' role can access admin portal.
 */

// Import from member portal public directory (two levels up from /admin/js/)
import { initSession } from '../../session/init.js';
import { initNavigation } from '../../js/nav-interactions.js';
import { debug } from '../../js/utils/util-debug.js';
import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { adminStrings } from './i18n/admin-strings-loader.js';
import { requireAdmin } from '../../js/rbac.js';
import { showToast, showError } from '../../js/components/ui-toast.js';
import { R } from '../../i18n/strings-loader.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

/**
 * Calculate duration between two timestamps
 * @param {Object} stats - Object with started_at and completed_at timestamps
 * @returns {string} - Formatted duration string (e.g., "2m 15s" or "45s")
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
 * Load recent sync status from Firestore
 */
async function loadRecentSync() {
  try {
    const syncLogsRef = collection(db, 'sync_logs');
    const q = query(syncLogsRef, orderBy('created_at', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // No recent sync, hide the card
      document.getElementById('recent-sync-card').classList.add('u-hidden');
      return;
    }

    const recentLog = querySnapshot.docs[0].data();
    displayRecentSync(recentLog);
  } catch (error) {
    debug.error('Failed to load recent sync:', error);
    // Don't show error, just hide the card
    document.getElementById('recent-sync-card').classList.add('u-hidden');
  }
}

/**
 * Display recent sync summary
 */
function displayRecentSync(log) {
  const card = document.getElementById('recent-sync-card');
  const summary = document.getElementById('recent-sync-summary');

  // Format timestamp (use created_at from Firestore)
  const timestamp = log.created_at?.toDate?.() || (log.created_at ? new Date(log.created_at) : new Date());
  const formattedDate = timestamp.toLocaleString('is-IS', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Build summary HTML
  const stats = log.stats || {};
  const status = stats.failed > 0 ? adminStrings.get('sync_status_with_errors') : adminStrings.get('sync_status_success_simple');

  // Build detailed stats grid
  let gridItems = `
    <div class="info-grid__item">
      <div class="info-grid__label">${adminStrings.get('history_table_date')}</div>
      <div class="info-grid__value">${formattedDate}</div>
    </div>
    <div class="info-grid__item">
      <div class="info-grid__label">${adminStrings.get('stat_status_label')}</div>
      <div class="info-grid__value">${status}</div>
    </div>
    <div class="info-grid__item">
      <div class="info-grid__label">${adminStrings.get('stat_total_label')}</div>
      <div class="info-grid__value">${stats.total_members || 0}</div>
    </div>
    <div class="info-grid__item">
      <div class="info-grid__label">${adminStrings.get('stat_synced_label')}</div>
      <div class="info-grid__value">${stats.synced || 0}</div>
    </div>
  `;

  // Add failed count if there are failures
  if (stats.failed > 0) {
    gridItems += `
      <div class="info-grid__item">
        <div class="info-grid__label">${adminStrings.get('stat_failed_label')}</div>
        <div class="info-grid__value" style="color: var(--color-error, #dc2626)">${stats.failed}</div>
      </div>
    `;
  }

  // Add skipped count if there are skipped members
  if (stats.skipped > 0) {
    gridItems += `
      <div class="info-grid__item">
        <div class="info-grid__label">${adminStrings.get('stat_skipped_label')}</div>
        <div class="info-grid__value" style="color: var(--color-muted, #6b7280)">${stats.skipped}</div>
      </div>
    `;
  }

  // Add duration
  gridItems += `
    <div class="info-grid__item">
      <div class="info-grid__label">${adminStrings.get('stat_time_label')}</div>
      <div class="info-grid__value">${calculateDuration(stats)}</div>
    </div>
  `;

  summary.innerHTML = `
    <div class="info-grid">
      ${gridItems}
    </div>
    <div style="margin-top: 1.5rem; text-align: center;">
      <a href="/admin/sync-history.html" class="btn btn--outline">
        ${adminStrings.get('btn_view_history')}
      </a>
    </div>
  `;

  card.classList.remove('u-hidden');
}

/**
 * Build welcome message with proper Icelandic grammar
 * (same logic as member dashboard)
 */
function buildWelcomeMessage(displayName, strings) {
  const fallbackName = 'notandi';
  const rawName = (displayName || fallbackName).trim();
  const parts = rawName.split(/\s+/);
  const lastPart = parts.length ? parts[parts.length - 1] : '';
  const normalizedLast = lastPart
    ? lastPart.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    : '';

  let template = strings.admin_welcome_neutral;
  if (normalizedLast.endsWith('son')) {
    template = strings.admin_welcome_male;
  } else if (normalizedLast.endsWith('dottir')) {
    template = strings.admin_welcome_female;
  }

  // Simple string replacement for %s
  return template.replace('%s', rawName);
}

/**
 * Render role badges HTML
 */
function renderRoleBadges(roles) {
  const normalizedRoles = Array.isArray(roles) ? roles.filter(Boolean) : [];
  if (normalizedRoles.length === 0) {
    return '';
  }

  const badges = normalizedRoles.map((role) => {
    const key = `role_badge_${role}`;
    const label = R.string[key] || role;
    
    // Create a class modifier for each role type
    const roleClass = role === 'superuser' ? 'role-badge--developer' : 'role-badge--admin';
    return `<span class="role-badge ${roleClass}">${label}</span>`;
  }).join('');

  return badges;
}

/**
 * Update role badges display
 */
function updateRoleBadges(roles) {
  const container = document.getElementById('role-badges');
  if (!container) {
    return;
  }

  const html = renderRoleBadges(roles);
  if (!html) {
    container.innerHTML = '';
    container.classList.add('u-hidden');
    return;
  }

  container.innerHTML = html;
  container.classList.remove('u-hidden');
}

/**
 * Set page text from admin strings
 */
function setPageText(strings, userData) {
  // Page title
  document.getElementById('page-title').textContent = strings.admin_dashboard_title;

  // Navigation - Handled by nav-header.js component
  // document.getElementById('nav-brand').textContent = strings.admin_brand;
  // document.getElementById('nav-admin-dashboard').textContent = strings.nav_admin_dashboard;
  // document.getElementById('nav-admin-members').textContent = strings.nav_admin_members;
  // document.getElementById('nav-admin-sync').textContent = strings.nav_admin_sync;
  // document.getElementById('nav-admin-queue').textContent = strings.nav_admin_queue;
  // document.getElementById('nav-admin-history').textContent = strings.nav_admin_history;
  // document.getElementById('nav-back-to-member').textContent = strings.nav_back_to_member;
  // document.getElementById('nav-logout').textContent = strings.nav_logout;

  // Welcome card - with personalized greeting
  debug.log('Building welcome message for:', userData.displayName);
  const welcomeMessage = buildWelcomeMessage(userData.displayName, strings);
  debug.log('Welcome message result:', welcomeMessage);
  document.getElementById('admin-welcome-title').textContent = welcomeMessage;
  document.getElementById('admin-welcome-subtitle').textContent = strings.admin_welcome_subtitle;

  // Role badges
  updateRoleBadges(userData.roles);

  // Quick actions
  document.getElementById('admin-actions-title').textContent = strings.admin_actions_title;
  document.getElementById('quick-action-members-label').textContent = strings.quick_action_members_label;
  document.getElementById('quick-action-members-desc').textContent = strings.quick_action_members_desc;
  document.getElementById('quick-action-elections-label').textContent = strings.quick_action_elections_label;
  document.getElementById('quick-action-elections-desc').textContent = strings.quick_action_elections_desc;
  document.getElementById('quick-action-sync-label').textContent = strings.quick_action_sync_label;
  document.getElementById('quick-action-sync-desc').textContent = strings.quick_action_sync_desc;
  document.getElementById('quick-action-history-label').textContent = strings.quick_action_history_label;
  document.getElementById('quick-action-history-desc').textContent = strings.quick_action_history_desc;

  // Other titles
  document.getElementById('last-sync-title').textContent = strings.last_sync_title;
}

/**
 * Initialize admin dashboard
 */
async function init() {
  try {
    // 1. Load admin strings
    const strings = await adminStrings.load();

    // 2. Init session (loads member portal strings + authenticates)
    const { user, userData } = await initSession();

    debug.log('userData from initSession:', userData);
    debug.log('userData.roles:', userData.roles);

    // 3. Check admin access using unified RBAC (requires admin or superuser)
    await requireAdmin();

    // 4. Note: Navigation now initialized by nav-header component

    // 5. Set page text (with personalized greeting)
    setPageText(strings, userData);

    // 6. Load recent sync status
    await loadRecentSync();

    debug.log('✓ Admin dashboard initialized');

  } catch (error) {
    debug.error('Failed to initialize admin dashboard:', error);

    // Check if unauthorized (requireAdmin already redirects, but handle edge cases)
    if (error.message.includes('Unauthorized') || error.message.includes('Admin role required')) {
      alert(adminStrings.get('error_unauthorized_developer') || 'Þú hefur ekki aðgang.');
      window.location.href = '/members-area/';
      return;
    }

    // Check if not authenticated
    if (error.message.includes('Not authenticated')) {
      window.location.href = '/';
      return;
    }

    // Other errors
    debug.error('Error loading admin dashboard:', error);
    alert(adminStrings.get('error_page_load')?.replace('%s', error.message) || `Villa: ${error.message}`);
  }
}

// Run on page load
init();
