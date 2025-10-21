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

import { R } from '/i18n/strings-loader.js';
import { initSession } from '/session/init.js';
import { signOut, AuthenticationError } from '/session/auth.js';
import { httpsCallable } from '/firebase/app.js';
import { updateNavigationStrings, setupLogoutHandler, validateNavigation } from '/ui/nav.js';
import { setTextContent, setInnerHTML, addEventListener, setDisabled, validateElements } from '/ui/dom.js';

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
  validateNavigation();
  validateElements(DASHBOARD_ELEMENTS, 'dashboard page');
}

/**
 * Update all dashboard-specific UI strings
 *
 * Pure function - takes strings object, updates DOM.
 * Side effects are explicit and localized.
 *
 * @param {Object} strings - i18n strings object
 */
function updateDashboardStrings(strings) {
  // Set page title
  document.title = strings.page_title_dashboard;

  // Update quick links
  setTextContent('quick-links-title', strings.quick_links_title, 'dashboard');
  setTextContent('quick-link-profile-label', strings.quick_links_profile_label, 'dashboard');
  setTextContent('quick-link-profile-desc', strings.quick_links_profile_desc, 'dashboard');
  setTextContent('quick-link-events-label', strings.quick_links_events_label, 'dashboard');
  setTextContent('quick-link-events-desc', strings.quick_links_events_desc, 'dashboard');
  setTextContent('quick-link-voting-label', strings.quick_links_voting_label, 'dashboard');
  setTextContent('quick-link-voting-desc', strings.quick_links_voting_desc, 'dashboard');

  // Update membership card
  setTextContent('membership-title', strings.membership_title, 'dashboard');
  setTextContent('membership-status', strings.membership_loading, 'dashboard');
  setTextContent('verify-membership-btn', strings.btn_verify_membership, 'dashboard');
  setInnerHTML('role-badges', '', 'dashboard');
}

function buildWelcomeMessage(displayName, strings) {
  const fallbackName = strings.dashboard_default_name;
  const rawName = (displayName || fallbackName).trim();
  const parts = rawName.split(/\s+/);
  const lastPart = parts.length ? parts[parts.length - 1] : '';
  const normalizedLast = lastPart
    ? lastPart.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    : '';

  let template = strings.dashboard_welcome_neutral;
  if (normalizedLast.endsWith('son')) {
    template = strings.dashboard_welcome_male;
  } else if (normalizedLast.endsWith('dottir')) {
    template = strings.dashboard_welcome_female;
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
 * @param {Object} strings - i18n strings object
 * @returns {string} HTML string for membership status
 */
export function formatMembershipStatus(isMember, strings) {
  if (isMember) {
    return `
      <div style="color: var(--color-success-text); font-weight: 500;">
        ✓ ${strings.membership_active}
      </div>
    `;
  } else {
    return `
      <div style="color: var(--color-gray-600);">
        ${strings.membership_not_verified}
      </div>
    `;
  }
}

/**
 * Update membership status UI based on verification state
 *
 * @param {boolean} isMember - Whether user is a verified member
 * @param {Object} strings - i18n strings object
 */
function updateMembershipUI(isMember, strings) {
  const html = formatMembershipStatus(isMember, strings);
  setInnerHTML('membership-status', html, 'dashboard');

  const verifyButtonContainer = document.getElementById('verify-button-container');
  verifyButtonContainer.style.display = 'block';

  const buttonLabel = isMember ? strings.btn_verify_membership_again : strings.btn_verify_membership;
  setTextContent('verify-membership-btn', buttonLabel, 'dashboard');
  setDisabled('verify-membership-btn', false, 'dashboard');
}

function renderRoleBadges(roles, strings) {
  const normalizedRoles = Array.isArray(roles) ? roles.filter(Boolean) : [];
  if (normalizedRoles.length === 0) {
    return '';
  }

  const badges = normalizedRoles.map((role) => {
    const key = `role_badge_${role}`;
    const label = strings[key] || role;
    return `<span class="role-badge">${label}</span>`;
  }).join('');

  return `
    <span class="role-badges__label">${strings.dashboard_roles_label}</span>
    <div class="role-badges__list">${badges}</div>
  `;
}

function updateRoleBadges(roles, strings) {
  const container = document.getElementById('role-badges');
  if (!container) {
    return;
  }

  const html = renderRoleBadges(roles, strings);
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
 * @param {Object} strings - i18n strings object
 * @returns {Promise<boolean>} Whether verification succeeded
 */
async function verifyMembership(user, strings) {
  const region = strings.config_firebase_region;
  const verifyMembershipFn = httpsCallable('verifyMembership', region);

  setDisabled('verify-membership-btn', true, 'dashboard');
  setTextContent('verify-membership-btn', strings.membership_verifying, 'dashboard');

  try {
    const result = await verifyMembershipFn();

    if (result.data.isMember) {
      const html = `
        <div style="color: var(--color-success-text); font-weight: 500;">
          ✓ ${strings.membership_active}
        </div>
      `;
      setInnerHTML('membership-status', html, 'dashboard');

      // Refresh user data to get updated claims and update role badges
      const refreshed = await user.getIdTokenResult(true);
      updateRoleBadges(refreshed.claims.roles, strings);

      setDisabled('verify-membership-btn', false, 'dashboard');
  setTextContent('verify-membership-btn', strings.btn_verify_membership_again, 'dashboard');

      return true;
    } else {
      const html = `
        <div style="color: var(--color-error-text);">
          ${strings.membership_inactive}
        </div>
      `;
      setInnerHTML('membership-status', html, 'dashboard');

      setDisabled('verify-membership-btn', false, 'dashboard');
  setTextContent('verify-membership-btn', strings.btn_verify_membership, 'dashboard');

      // Refresh token to ensure any downgraded claims propagate
      const refreshed = await user.getIdTokenResult(true);
      updateRoleBadges(refreshed.claims.roles, strings);

      return false;
    }
  } catch (error) {
    console.error('Membership verification error:', error);

    const html = `
      <div style="color: var(--color-error-text);">
        ${strings.membership_verification_failed}: ${error.message}
      </div>
    `;
    setInnerHTML('membership-status', html, 'dashboard');

    setDisabled('verify-membership-btn', false, 'dashboard');
      setTextContent('verify-membership-btn', strings.btn_verify_membership, 'dashboard');

    // Ensure claims stay in sync even after error
    try {
      const refreshed = await user.getIdTokenResult(true);
      updateRoleBadges(refreshed.claims.roles, strings);
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
 * @param {Object} strings - i18n strings object
 */
function setupMembershipVerification(user, strings) {
  addEventListener('verify-membership-btn', 'click', async () => {
    await verifyMembership(user, strings);
  }, 'dashboard');
}

/**
 * Initialize dashboard page
 *
 * New architecture - clear separation:
 * 1. Validate DOM structure (fail fast with helpful errors)
 * 2. Initialize session (pure data fetching)
 * 3. Update UI (explicit DOM manipulation)
 * 4. Setup event handlers
 *
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Validate DOM structure before doing anything
    validateDashboard();

    // Initialize session (pure data - no DOM dependencies)
    const { user, userData, strings } = await initSession();

    // Update navigation (shared UI)
    updateNavigationStrings(strings);
    setupLogoutHandler(signOut);

    // Update dashboard-specific UI
    updateDashboardStrings(strings);

    // Update welcome message with user's name
  const welcomeText = buildWelcomeMessage(userData.displayName, strings);
  setTextContent('welcome-title', welcomeText, 'dashboard');

    // Update membership status UI
    updateMembershipUI(userData.isMember, strings);

    // Show role badges for elevated users
    updateRoleBadges(userData.roles, strings);

    // Setup membership verification handler
    setupMembershipVerification(user, strings);
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
