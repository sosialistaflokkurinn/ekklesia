/**
 * Profile Page Logic
 *
 * User profile page displaying personal information (name, kennitala, email, phone)
 * and membership status from Firebase custom token claims.
 *
 * @module profile
 */

import { R } from '/i18n/strings-loader.js';
import { initAuthenticatedPage } from '/js/page-init.js';

/**
 * Update all profile-specific UI strings
 */
function updateProfileStrings() {
  // Set page title
  document.title = R.string.page_title_profile;

  // Update page header
  document.getElementById('page-title').textContent = R.string.profile_title;
  document.getElementById('page-subtitle').textContent = R.string.profile_subtitle;

  // Update personal info section
  document.getElementById('section-personal-info').textContent = R.string.section_personal_info;
  document.getElementById('label-name').textContent = R.string.label_display_name;
  document.getElementById('label-kennitala').textContent = R.string.label_kennitala;
  document.getElementById('label-email').textContent = R.string.label_email;
  document.getElementById('label-phone').textContent = R.string.label_phone;

  // Update membership section
  document.getElementById('membership-title').textContent = R.string.membership_status;
  document.getElementById('label-status').textContent = R.string.label_status;
  document.getElementById('label-uid').textContent = R.string.label_uid;
}

/**
 * Update user information in UI
 *
 * @param {Object} userData - User data from Firebase token claims
 * @param {string} userData.displayName - User's display name
 * @param {string} userData.kennitala - User's Icelandic national ID
 * @param {string} userData.email - User's email address
 * @param {string} userData.phoneNumber - User's phone number
 * @param {string} userData.uid - Firebase user ID
 */
function updateUserInfo(userData) {
  document.getElementById('value-name').textContent =
    userData.displayName || R.string.placeholder_not_available;

  document.getElementById('value-kennitala').textContent =
    userData.kennitala || R.string.placeholder_not_found;

  document.getElementById('value-email').textContent =
    userData.email || R.string.placeholder_not_available;

  document.getElementById('value-phone').textContent =
    userData.phoneNumber || R.string.placeholder_not_available;

  document.getElementById('value-uid').textContent = userData.uid;
}

/**
 * Update membership status display
 *
 * @param {boolean} isMember - Whether user is a verified member
 */
function updateMembershipStatus(isMember) {
  const membershipStatus = document.getElementById('membership-status');

  if (isMember) {
    membershipStatus.textContent = R.string.membership_active;
    membershipStatus.style.color = 'var(--color-success-text)';
    membershipStatus.style.fontWeight = '500';
  } else {
    membershipStatus.textContent = R.string.membership_inactive;
    membershipStatus.style.color = 'var(--color-gray-600)';
  }
}

/**
 * Initialize profile page
 *
 * Loads i18n, sets up navigation, authenticates user,
 * and displays user profile information.
 *
 * @returns {Promise<void>}
 */
async function init() {
  // Common page initialization (i18n, navigation, auth)
  const { userData } = await initAuthenticatedPage();

  // Update profile-specific strings
  updateProfileStrings();

  // Update user information
  updateUserInfo(userData);

  // Update membership status
  updateMembershipStatus(userData.isMember);
}

// Run initialization
init().catch(error => {
  console.error('Profile initialization failed:', error);
});
