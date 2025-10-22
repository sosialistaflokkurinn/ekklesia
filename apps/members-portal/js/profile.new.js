/**
 * Profile Page Logic
 *
 * User profile page displaying personal information and membership status.
 *
 * New architecture:
 * - Pure session init from /session/init.js
 * - Reusable UI from /ui/nav.js
 * - Validated DOM from /ui/dom.js
 * - Testable pure functions
 *
 * @module profile
 */

import { R } from '/i18n/strings-loader.js';
import { httpsCallable } from '/firebase/app.js';
import { initSession } from '/session/init.js';
import { signOut, AuthenticationError } from '/session/auth.js';
import { updateNavigationStrings, setupLogoutHandler, validateNavigation } from '/ui/nav.js';
import { setTextContent, validateElements } from '/ui/dom.js';

/**
 * Required DOM elements for profile page
 */
const PROFILE_ELEMENTS = [
  'profile-title',
  'section-personal-info',
  'membership-title',
  'label-name',
  'value-name',
  'label-kennitala',
  'value-kennitala',
  'label-email',
  'value-email',
  'label-phone',
  'value-phone',
  'label-status',
  'membership-status',
  'label-uid',
  'value-uid'
];

/**
 * Validate profile page DOM structure
 *
 * @throws {Error} If required elements are missing
 */
function validateProfilePage() {
  validateNavigation();
  validateElements(PROFILE_ELEMENTS, 'profile page');
}

/**
 * Update profile page strings
 *
 * @param {Object} strings - i18n strings object
 */
function updateProfileStrings(strings) {
  document.title = strings.page_title_profile;
  setTextContent('profile-title', strings.profile_title, 'profile page');
  setTextContent('section-personal-info', strings.section_personal_info, 'profile page');
  setTextContent('membership-title', strings.membership_title, 'profile page');
  setTextContent('membership-status', strings.membership_loading, 'profile page');
  setTextContent('label-name', strings.label_name, 'profile page');
  setTextContent('label-kennitala', strings.label_kennitala, 'profile page');
  setTextContent('label-email', strings.label_email, 'profile page');
  setTextContent('label-phone', strings.label_phone, 'profile page');
  setTextContent('label-status', strings.label_status, 'profile page');
  setTextContent('label-uid', strings.label_uid, 'profile page');
}

/**
 * Format user data field value
 *
 * Pure function - returns display value or placeholder.
 *
 * @param {*} value - Field value
 * @param {string} placeholder - Placeholder text for null/undefined
 * @returns {string} Display value
 */
export function formatFieldValue(value, placeholder) {
  return value || placeholder;
}

/**
 * Format membership status text
 *
 * Pure function - returns status text and color.
 *
 * @param {boolean} isMember - Whether user is a verified member
 * @param {Object} strings - i18n strings object
 * @returns {{text: string, color: string}} Status text and color
 */
export function formatMembershipStatus(isMember, strings) {
  if (isMember) {
    return {
      text: strings.membership_active,
      color: 'var(--color-success-text)'
    };
  } else {
    return {
      text: strings.membership_inactive,
      color: 'var(--color-gray-600)'
    };
  }
}

/**
 * Update user information in UI
 *
 * @param {Object} userData - User data from Firebase token claims
 * @param {Object} strings - i18n strings object
 */
function updateUserInfo(userData, strings) {
  const placeholder = strings.placeholder_not_available;

  setTextContent('value-name', formatFieldValue(userData.displayName, placeholder), 'profile page');
  setTextContent('value-kennitala', formatFieldValue(userData.kennitala, placeholder), 'profile page');
  setTextContent('value-email', formatFieldValue(userData.email, placeholder), 'profile page');
  setTextContent('value-phone', formatFieldValue(userData.phoneNumber, placeholder), 'profile page');
  setTextContent('value-uid', formatFieldValue(userData.uid, placeholder), 'profile page');
}

/**
 * Update membership status display
 *
 * @param {boolean} isMember - Whether user is a verified member
 * @param {Object} strings - i18n strings object
 */
function updateMembershipStatus(isMember, strings) {
  const status = formatMembershipStatus(isMember, strings);
  const membershipElement = document.getElementById('membership-status');

  membershipElement.textContent = status.text;
  membershipElement.style.color = status.color;
}

/**
 * Verify membership status by calling Cloud Function
 *
 * @param {Object} strings - i18n strings object
 * @returns {Promise<boolean>} Whether user is a member
 */
async function verifyMembership(strings) {
  const region = strings.config_firebase_region;
  const verifyMembershipFn = httpsCallable('verifyMembership', region);

  try {
    const result = await verifyMembershipFn();
    return result.data.isMember;
  } catch (error) {
    console.error('Failed to verify membership:', error);
    // Return false on error (conservative approach)
    return false;
  }
}

/**
 * Initialize profile page
 *
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Validate DOM structure
    validateProfilePage();

    // Initialize session (pure data - no DOM dependencies)
    const { userData, strings } = await initSession();

    // Update navigation (shared UI)
    updateNavigationStrings(strings);
    setupLogoutHandler(signOut);

    // Update profile-specific UI
    updateProfileStrings(strings);
    updateUserInfo(userData, strings);

    // Show loading state while verifying membership
    const membershipElement = document.getElementById('membership-status');
  membershipElement.textContent = strings.membership_verifying || strings.loading;
    membershipElement.style.color = 'var(--color-primary)';

    // Verify membership status via Cloud Function
    const isMember = await verifyMembership(strings);
    updateMembershipStatus(isMember, strings);
  } catch (error) {
    // Handle authentication error (redirect to login)
    if (error instanceof AuthenticationError) {
      window.location.href = error.redirectTo;
      return;
    }

    // Other errors
    console.error('Profile page initialization failed:', error);
  }
}

// Run initialization
init();
