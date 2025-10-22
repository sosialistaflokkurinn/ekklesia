/**
 * Dashboard Page Logic
 *
 * Main dashboard for authenticated members. Displays welcome message,
 * quick links to other pages, and membership verification status.
 *
 * @module dashboard
 */

import { R } from '/i18n/strings-loader.js';
import { initAuthenticatedPage } from '/js/page-init.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

/**
 * Update all dashboard-specific UI strings
 */
function updateDashboardStrings() {
  // Set page title
  document.title = R.string.page_title_dashboard;

  // Update welcome message
  document.getElementById('welcome-message').textContent = R.string.dashboard_subtitle;

  // Update quick links
  document.getElementById('quick-links-title').textContent = R.string.quick_links_title;
  document.getElementById('quick-link-profile-label').textContent = R.string.quick_links_profile_label;
  document.getElementById('quick-link-profile-desc').textContent = R.string.quick_links_profile_desc;
  document.getElementById('quick-link-events-label').textContent = R.string.quick_links_events_label;
  document.getElementById('quick-link-events-desc').textContent = R.string.quick_links_events_desc;
  document.getElementById('quick-link-voting-label').textContent = R.string.quick_links_voting_label;
  document.getElementById('quick-link-voting-desc').textContent = R.string.quick_links_voting_desc;

  // Update membership card
  document.getElementById('membership-title').textContent = R.string.membership_title;
  document.getElementById('membership-status').textContent = R.string.membership_loading;
  document.getElementById('verify-membership-btn').textContent = R.string.btn_verify_membership;
}

/**
 * Update membership status UI based on verification state
 *
 * @param {boolean} isMember - Whether user is a verified member
 */
function updateMembershipUI(isMember) {
  const membershipCard = document.getElementById('membership-status');
  const verifyButtonContainer = document.getElementById('verify-button-container');

  if (isMember) {
    membershipCard.innerHTML = `
      <div style="color: var(--color-success-text); font-weight: 500;">
        ✓ ${R.string.membership_active}
      </div>
    `;
    verifyButtonContainer.style.display = 'none';
  } else {
    membershipCard.innerHTML = `
      <div style="color: var(--color-gray-600);">
        ${R.string.membership_not_verified}
      </div>
    `;
    verifyButtonContainer.style.display = 'block';
  }
}

/**
 * Setup membership verification button handler
 *
 * Calls Cloud Function to verify membership against kennitalas.txt
 * and updates UI based on result.
 *
 * @param {Object} user - Firebase user object
 * @param {Object} functions - Firebase Functions instance
 */
function setupMembershipVerification(user, functions) {
  const btn = document.getElementById('verify-membership-btn');
  const membershipCard = document.getElementById('membership-status');
  const verifyButtonContainer = document.getElementById('verify-button-container');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = R.string.membership_verifying;

    try {
      const verifyMembership = httpsCallable(functions, 'verifyMembership');
      const result = await verifyMembership();

      if (result.data.isMember) {
        membershipCard.innerHTML = `
          <div style="color: var(--color-success-text); font-weight: 500;">
            ✓ ${R.string.membership_active}
          </div>
        `;
        verifyButtonContainer.style.display = 'none';

        // Refresh user data to get updated claims
        await user.getIdToken(true);
      } else {
        membershipCard.innerHTML = `
          <div style="color: var(--color-error-text);">
            ${R.string.membership_inactive}
          </div>
        `;
        btn.disabled = false;
        btn.textContent = R.string.btn_verify_membership;
      }
    } catch (error) {
      console.error('Membership verification error:', error);
      membershipCard.innerHTML = `
        <div style="color: var(--color-error-text);">
          ${R.string.membership_verification_failed}: ${error.message}
        </div>
      `;
      btn.disabled = false;
      btn.textContent = R.string.btn_verify_membership;
    }
  });
}

/**
 * Initialize dashboard page
 *
 * Loads i18n, sets up navigation, authenticates user,
 * and displays personalized dashboard content.
 *
 * @returns {Promise<void>}
 */
async function init() {
  // Common page initialization (i18n, navigation, auth)
  const { user, userData } = await initAuthenticatedPage();

  // Update dashboard-specific strings
  updateDashboardStrings();

  // Get Firebase app and functions
  const app = getApp();
  const functions = getFunctions(app, R.string.config_firebase_region);

  // Update welcome message with user's name
  const displayName = userData.displayName || R.string.dashboard_default_name;
  document.getElementById('welcome-title').textContent =
    R.format(R.string.dashboard_welcome_user, R.string.dashboard_welcome, displayName);

  // Update membership status UI
  updateMembershipUI(userData.isMember);

  // Setup membership verification handler
  setupMembershipVerification(user, functions);
}

// Run initialization
init().catch(error => {
  console.error('Dashboard initialization failed:', error);
});
