/**
 * Admin Dashboard - Epic #43 Phase 2
 *
 * Main admin page with role-based access control.
 * Only users with 'admin' or 'superuser' role can access admin portal.
 */

// Import from member portal public directory (two levels up from /admin/js/)
import { initSession, showAuthenticatedContent } from '../../session/init.js';
import { initNavigation } from '../../js/nav-interactions.js';
import { debug } from '../../js/utils/util-debug.js';
import { getFirebaseAuth, getFirebaseFirestore, collection, getDocs } from '../../firebase/app.js';
import { adminStrings } from './i18n/admin-strings-loader.js';
import { requireAdmin } from '../../js/rbac.js';
import { showToast, showError } from '../../js/components/ui-toast.js';
// Note: R import removed - was only used for role badges in welcome card which was removed

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

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

// Note: renderRoleBadges and updateRoleBadges removed - welcome card was removed

/**
 * Load and display member registry statistics
 */
async function loadMemberStats() {
  try {
    const membersRef = collection(db, 'members');
    const snapshot = await getDocs(membersRef);

    // Skip patterns for test accounts
    const skipPatterns = ['9999', '0101', '0212'];
    const skipNames = ['Próf', 'próf', 'Test', 'Debug', 'test'];

    const stats = {
      total: 0,
      withAddress: 0,
      thjodskraFound: 0,
      thjodskraNotFound: 0,
      invalidKt: 0,
      needsReview: 0
    };

    // Lists for display
    const invalidKtList = [];
    const needsReviewList = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const kt = docSnap.id;
      const name = data.name || '';

      // Skip test accounts
      if (skipPatterns.some(p => kt.startsWith(p))) return;
      if (skipNames.some(s => name.includes(s))) return;

      stats.total++;

      // Check address
      const addresses = data.profile?.addresses || [];
      if (addresses.length > 0 && addresses[0]?.street) {
        stats.withAddress++;
      }

      // Check Þjóðskrá status
      if (data.thjodskra_lookup_date) {
        if (data.thjodskra_not_found) {
          stats.thjodskraNotFound++;
        } else {
          stats.thjodskraFound++;
        }
      }

      // Check invalid kennitala
      if (data.kennitala_invalid_checksum) {
        stats.invalidKt++;
        invalidKtList.push({
          kt,
          name: name || '(ekkert nafn)',
          error: data.kennitala_checksum_error || 'Ógild checksum'
        });
      }

      // Check needs review
      if (data.needs_review) {
        stats.needsReview++;
        // Determine reason
        let reason = '';
        if (data.thjodskra_not_found) reason = 'Ekki fundið í Þjóðskrá';
        else if (data.kennitala_invalid_checksum) reason = 'Ógild kennitala';
        else reason = 'Þarfnast yfirferðar';

        needsReviewList.push({
          kt,
          name: name || '(ekkert nafn)',
          reason
        });
      }
    });

    // Update stats UI
    document.getElementById('stat-total').textContent = stats.total.toLocaleString('is-IS');
    document.getElementById('stat-with-address').textContent =
      `${stats.withAddress.toLocaleString('is-IS')} (${Math.round(stats.withAddress / stats.total * 100)}%)`;
    document.getElementById('stat-thjodskra-found').textContent =
      `${stats.thjodskraFound.toLocaleString('is-IS')} (${Math.round(stats.thjodskraFound / stats.total * 100)}%)`;
    document.getElementById('stat-thjodskra-not-found').textContent = stats.thjodskraNotFound.toLocaleString('is-IS');
    document.getElementById('stat-invalid-kt').textContent = stats.invalidKt.toLocaleString('is-IS');
    document.getElementById('stat-needs-review').textContent = stats.needsReview.toLocaleString('is-IS');

    // Render invalid kennitala list
    if (invalidKtList.length > 0) {
      const invalidKtCard = document.getElementById('invalid-kt-card');
      const invalidKtListEl = document.getElementById('invalid-kt-list');
      invalidKtCard.style.display = 'block';
      invalidKtListEl.innerHTML = invalidKtList.map(m => `
        <tr>
          <td><a href="/admin/member-profile.html?kt=${m.kt}">${m.kt}</a></td>
          <td>${m.name}</td>
          <td>${m.error}</td>
        </tr>
      `).join('');
    }

    // Render needs review list
    if (needsReviewList.length > 0) {
      const needsReviewCard = document.getElementById('needs-review-card');
      const needsReviewListEl = document.getElementById('needs-review-list');
      needsReviewCard.style.display = 'block';
      needsReviewListEl.innerHTML = needsReviewList.map(m => `
        <tr>
          <td><a href="/admin/member-profile.html?kt=${m.kt}">${m.kt}</a></td>
          <td>${m.name}</td>
          <td>${m.reason}</td>
        </tr>
      `).join('');
    }

    debug.log('Member stats loaded:', stats);

  } catch (error) {
    debug.error('Failed to load member stats:', error);
    document.getElementById('stat-total').textContent = 'Villa';
  }
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

  // Note: Welcome card removed - user info shown on member dashboard

  // Quick actions
  document.getElementById('admin-actions-title').textContent = strings.admin_actions_title;
  document.getElementById('quick-action-members-label').textContent = strings.quick_action_members_label;
  document.getElementById('quick-action-members-desc').textContent = strings.quick_action_members_desc;
  document.getElementById('quick-action-elections-label').textContent = strings.quick_action_elections_label;
  document.getElementById('quick-action-elections-desc').textContent = strings.quick_action_elections_desc;
  document.getElementById('quick-action-events-label').textContent = strings.quick_action_events_label;
  document.getElementById('quick-action-events-desc').textContent = strings.quick_action_events_desc;
  document.getElementById('quick-action-email-label').textContent = strings.quick_action_email_label;
  document.getElementById('quick-action-email-desc').textContent = strings.quick_action_email_desc;
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

    // Auth verified - show page content
    showAuthenticatedContent();

    // 4. Note: Navigation now initialized by nav-header component

    // 5. Set page text (with personalized greeting)
    setPageText(strings, userData);

    // 6. Load member statistics
    loadMemberStats();

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
