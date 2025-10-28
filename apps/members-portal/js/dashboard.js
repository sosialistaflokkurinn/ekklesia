/**
 * Dashboard Page Logic
 *
 * Main dashboard for authenticated members. Displays welcome message,
 * quick links to other pages, and membership verification status.
 *
 * New architecture:
 * - Uses firebase/app.js for Firebase services (single import point)
 * - Uses session/init.js for authentication (pure data)
 * - Uses ui/nav.js + ui/dom.js for DOM manipulation (validated)
 * - Testable pure functions separated from side effects
 *
 * @module dashboard
 */

import { R } from '../i18n/strings-loader.js';
import { initAuthenticatedPage } from './page-init.js';
import { requireAuth, getUserData, signOut, AuthenticationError } from '../session/auth.js';
import { httpsCallable } from '../firebase/app.js';
import { setTextContent, setInnerHTML, addEventListener, setDisabled, validateElements } from '../ui/dom.js';

/**
 * Required DOM elements for dashboard page
 */
const DASHBOARD_ELEMENTS = [
  'welcome-title',
  'quick-links-title',
  'quick-link-profile-label',
  'quick-link-profile-desc',
  'quick-link-events-label',
  'quick-link-events-desc',
  'quick-link-voting-label',
  'quick-link-voting-desc',
  'membership-title',
  'membership-status',
  'verify-membership-btn',
  'verify-button-container',
  'role-badges'
];

/**
 * Validate dashboard DOM structure
 *
 * @throws {Error} If required elements are missing
 */
function validateDashboard() {
  validateElements(DASHBOARD_ELEMENTS, 'dashboard page');
}

/**
 * Update all dashboard-specific UI strings
 *
 * Uses R.string for i18n localization.
 */
function updateDashboardStrings() {
  // Set page title
  document.title = R.string.page_title_dashboard;

  // Update quick links
  setTextContent('quick-links-title', R.string.quick_links_title, 'dashboard');
  setTextContent('quick-link-profile-label', R.string.quick_links_profile_label, 'dashboard');
  setTextContent('quick-link-profile-desc', R.string.quick_links_profile_desc, 'dashboard');
  setTextContent('quick-link-events-label', R.string.quick_links_events_label, 'dashboard');
  setTextContent('quick-link-events-desc', R.string.quick_links_events_desc, 'dashboard');
  setTextContent('quick-link-voting-label', R.string.quick_links_voting_label, 'dashboard');
  setTextContent('quick-link-voting-desc', R.string.quick_links_voting_desc, 'dashboard');

  // Update membership card
  setTextContent('membership-title', R.string.membership_title, 'dashboard');
  setTextContent('membership-status', R.string.membership_loading, 'dashboard');
  setTextContent('verify-membership-btn', R.string.btn_verify_membership, 'dashboard');
  setInnerHTML('role-badges', '', 'dashboard');
}

function buildWelcomeMessage(displayName) {
  const fallbackName = R.string.dashboard_default_name;
  const rawName = (displayName || fallbackName).trim();
  const parts = rawName.split(/\s+/);
  const lastPart = parts.length ? parts[parts.length - 1] : '';
  const normalizedLast = lastPart
    ? lastPart.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    : '';

  let template = R.string.dashboard_welcome_neutral;
  if (normalizedLast.endsWith('son')) {
    template = R.string.dashboard_welcome_male;
  } else if (normalizedLast.endsWith('dottir')) {
    template = R.string.dashboard_welcome_female;
  }

  return R.format(template, rawName);
}

/**
 * Format membership status HTML
 *
 * Pure function - returns HTML string based on state.
 * Separated for testing.
 *
 * @param {boolean} isMember - Whether user is a verified member
 * @returns {string} HTML string for membership status
 */
export function formatMembershipStatus(isMember) {
  if (isMember) {
    return `
      <div style="color: var(--color-success-text); font-weight: 500;">
        ✓ ${R.string.membership_active}
      </div>
    `;
  } else {
    return `
      <div style="color: var(--color-gray-600);">
        ${R.string.membership_not_verified}
      </div>
    `;
  }
}

/**
 * Update membership status UI based on verification state
 *
 * @param {boolean} isMember - Whether user is a verified member
 */
function updateMembershipUI(isMember) {
  const html = formatMembershipStatus(isMember);
  setInnerHTML('membership-status', html, 'dashboard');

  const verifyButtonContainer = document.getElementById('verify-button-container');
  verifyButtonContainer.style.display = 'block';

  const buttonLabel = isMember ? R.string.btn_verify_membership_again : R.string.btn_verify_membership;
  setTextContent('verify-membership-btn', buttonLabel, 'dashboard');
  setDisabled('verify-membership-btn', false, 'dashboard');
}

function renderRoleBadges(roles) {
  const normalizedRoles = Array.isArray(roles) ? roles.filter(Boolean) : [];
  if (normalizedRoles.length === 0) {
    return '';
  }

  const badges = normalizedRoles.map((role) => {
    const key = `role_badge_${role}`;
    const label = R.string[key] || role;

    // Make admin/developer badges clickable links to admin portal
    if (role === 'admin' || role === 'developer') {
      return `<a href="/admin/admin.html" class="role-badge role-badge--clickable" title="Opna stjórnborð">${label}</a>`;
    }

    return `<span class="role-badge">${label}</span>`;
  }).join('');

  return `
    <span class="role-badges__label">${R.string.dashboard_roles_label}</span>
    <div class="role-badges__list">${badges}</div>
  `;
}

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
 * Handle membership verification
 *
 * Separated from setup for testing.
 *
 * @param {Object} user - Firebase user object
 * @returns {Promise<boolean>} Whether verification succeeded
 */
async function verifyMembership(user) {
  const region = R.string.config_firebase_region;
  const verifyMembershipFn = httpsCallable('verifyMembership', region);

  setDisabled('verify-membership-btn', true, 'dashboard');
  setTextContent('verify-membership-btn', R.string.membership_verifying, 'dashboard');

  try {
    const result = await verifyMembershipFn();

    if (result.data.isMember) {
      const html = `
        <div style="color: var(--color-success-text); font-weight: 500;">
          ✓ ${R.string.membership_active}
        </div>
      `;
      setInnerHTML('membership-status', html, 'dashboard');

      // Refresh user data to get updated claims and update role badges
      const refreshed = await user.getIdTokenResult(true);
      updateRoleBadges(refreshed.claims.roles);

      setDisabled('verify-membership-btn', false, 'dashboard');
  setTextContent('verify-membership-btn', R.string.btn_verify_membership_again, 'dashboard');

      return true;
    } else {
      const html = `
        <div style="color: var(--color-error-text);">
          ${R.string.membership_inactive}
        </div>
      `;
      setInnerHTML('membership-status', html, 'dashboard');

      setDisabled('verify-membership-btn', false, 'dashboard');
  setTextContent('verify-membership-btn', R.string.btn_verify_membership, 'dashboard');

      // Refresh token to ensure any downgraded claims propagate
      const refreshed = await user.getIdTokenResult(true);
      updateRoleBadges(refreshed.claims.roles);

      return false;
    }
  } catch (error) {
    console.error('Membership verification error:', error);

    const html = `
      <div style="color: var(--color-error-text);">
        ${R.string.membership_verification_failed}: ${error.message}
      </div>
    `;
    setInnerHTML('membership-status', html, 'dashboard');

    setDisabled('verify-membership-btn', false, 'dashboard');
      setTextContent('verify-membership-btn', R.string.btn_verify_membership, 'dashboard');

    // Ensure claims stay in sync even after error
    try {
      const refreshed = await user.getIdTokenResult(true);
      updateRoleBadges(refreshed.claims.roles);
    } catch (refreshError) {
      console.warn('Failed to refresh claims after verification error', refreshError);
    }

    throw error;
  }
}

/**
 * Setup membership verification button handler
 *
 * @param {Object} user - Firebase user object
 */
function setupMembershipVerification(user) {
  addEventListener('verify-membership-btn', 'click', async () => {
    await verifyMembership(user);
  }, 'dashboard');
}

/**
 * Initialize dashboard page
 *
 * New architecture - clear separation:
 * 1. Validate DOM structure (fail fast with helpful errors)
 * 2. Load i18n and initialize page
 * 3. Fetch user data
 * 4. Update UI (explicit DOM manipulation)
 * 5. Setup event handlers
 *
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Validate DOM structure before doing anything
    validateDashboard();

    // Load i18n strings (note: initAuthenticatedPage also calls R.load, but explicit here)
    await R.load('is');

    // Initialize page: auth check, nav setup, logout handler
    await initAuthenticatedPage();

    // Get authenticated user
    const currentUser = await requireAuth();

    // Get user data from custom claims
    const userData = await getUserData(currentUser);

    // Update dashboard-specific UI
    updateDashboardStrings();

    // Update welcome message with user's name
    const welcomeText = buildWelcomeMessage(userData.displayName);
    setTextContent('welcome-title', welcomeText, 'dashboard');

    // Update membership status UI
    updateMembershipUI(userData.isMember);

    // Show role badges for elevated users
    updateRoleBadges(userData.roles);

    // Setup membership verification handler
    setupMembershipVerification(currentUser);
  } catch (error) {
    // Handle authentication error (redirect to login)
    if (error instanceof AuthenticationError) {
      window.location.href = error.redirectTo;
      return;
    }

    // Other errors
    console.error('Dashboard initialization failed:', error);
  }
}

// Run initialization
init();
