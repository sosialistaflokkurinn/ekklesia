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

import { R } from '../i18n/strings-loader.js';
import { initAuthenticatedPage } from './page-init.js';
import { requireAuth, getUserData, signOut, AuthenticationError } from '../session/auth.js';
import { httpsCallable } from '../firebase/app.js';
import { setTextContent, validateElements } from '../ui/dom.js';

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
  validateElements(PROFILE_ELEMENTS, 'profile page');
}

/**
 * Update profile page strings
 */
function updateProfileStrings() {
  document.title = R.string.page_title_profile;
  setTextContent('profile-title', R.string.profile_title, 'profile page');
  setTextContent('section-personal-info', R.string.section_personal_info, 'profile page');
  setTextContent('membership-title', R.string.membership_title, 'profile page');
  setTextContent('membership-status', R.string.membership_loading, 'profile page');
  setTextContent('label-name', R.string.label_name, 'profile page');
  setTextContent('label-kennitala', R.string.label_kennitala, 'profile page');
  setTextContent('label-email', R.string.label_email, 'profile page');
  setTextContent('label-phone', R.string.label_phone, 'profile page');
  setTextContent('label-status', R.string.label_status, 'profile page');
  setTextContent('label-uid', R.string.label_uid, 'profile page');
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
 * @returns {{text: string, color: string}} Status text and color
 */
export function formatMembershipStatus(isMember) {
  if (isMember) {
    return {
      text: R.string.membership_active,
      color: 'var(--color-success-text)'
    };
  } else {
    return {
      text: R.string.membership_inactive,
      color: 'var(--color-gray-600)'
    };
  }
}

/**
 * Update user information in UI
 *
 * @param {Object} userData - User data from Firebase token claims
 */
function updateUserInfo(userData) {
  const placeholder = R.string.placeholder_not_available;

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
 */
function updateMembershipStatus(isMember) {
  const status = formatMembershipStatus(isMember);
  const membershipElement = document.getElementById('membership-status');

  membershipElement.textContent = status.text;
  membershipElement.style.color = status.color;
}

/**
 * Verify membership status by calling Cloud Function
 *
 * @returns {Promise<boolean>} Whether user is a member
 */
async function verifyMembership() {
  const region = R.string.config_firebase_region;
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

    // Load i18n strings
    await R.load('is');

    // Initialize page: auth check, nav setup, logout handler
    await initAuthenticatedPage();

    // Get authenticated user
    const currentUser = await requireAuth();

    // Get user data from custom claims
    const userData = await getUserData(currentUser);

    // Update profile-specific UI
    updateProfileStrings();
    updateUserInfo(userData);

    // Show loading state while verifying membership
    const membershipElement = document.getElementById('membership-status');
    membershipElement.textContent = R.string.membership_verifying || R.string.loading;
    membershipElement.style.color = 'var(--color-primary)';

    // Verify membership status via Cloud Function
    const isMember = await verifyMembership();
    updateMembershipStatus(isMember);
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
