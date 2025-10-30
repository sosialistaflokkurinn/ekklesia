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
import { httpsCallable, getFirebaseAuth, getFirebaseFirestore } from '../firebase/app.js';
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
 * Check for discrepancies between Kenni.is data (userData) and Firestore /members/ collection
 *
 * Compares:
 * - Full name
 * - Email
 * - Phone number
 *
 * If differences found, prompts user to update both Firestore and Django backend.
 *
 * @param {Object} userData - User data from Firebase Auth token (Kenni.is claims)
 * @returns {Promise<void>}
 */
async function checkProfileDiscrepancies(userData) {
  try {
    // Get member data from Firestore /members/ collection
    const db = getFirebaseFirestore();
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const memberDocRef = doc(db, 'members', userData.kennitala.replace(/-/g, ''));
    const memberDoc = await getDoc(memberDocRef);

    if (!memberDoc.exists()) {
      console.log('No member document found - skipping profile check');
      return;
    }

    const memberData = memberDoc.data();
    const memberProfile = memberData.profile || {};

    // Compare fields
    const discrepancies = [];

    // Name comparison
    if (userData.displayName && memberProfile.name !== userData.displayName) {
      discrepancies.push({
        field: 'name',
        label: R.string.nav_profile, // "Prófíll" - we reuse this for "Nafn"
        kenni: userData.displayName,
        members: memberProfile.name || R.string.profile_empty_value
      });
    }

    // Email comparison
    if (userData.email && memberProfile.email !== userData.email) {
      discrepancies.push({
        field: 'email',
        label: R.string.profile_email_label, // From existing strings
        kenni: userData.email,
        members: memberProfile.email || R.string.profile_empty_value
      });
    }

    // Phone comparison (normalize format - remove spaces/dashes)
    const normalizePhone = (phone) => phone ? phone.replace(/[\s-]/g, '') : '';
    const kenniPhone = normalizePhone(userData.phoneNumber);
    const membersPhone = normalizePhone(memberProfile.phone);

    if (kenniPhone && kenniPhone !== membersPhone) {
      discrepancies.push({
        field: 'phone',
        label: R.string.profile_phone_label,
        kenni: userData.phoneNumber,
        members: memberProfile.phone || R.string.profile_empty_value
      });
    }

    // If discrepancies found, show modal
    if (discrepancies.length > 0) {
      console.log('Profile discrepancies found:', discrepancies);
      await showProfileUpdateModal(discrepancies, userData, memberData);
    }

  } catch (error) {
    console.error('Error checking profile discrepancies:', error);
    // Don't block dashboard load on error
  }
}

/**
 * Show modal dialog for profile update confirmation
 *
 * @param {Array} discrepancies - Array of field discrepancies
 * @param {Object} userData - Current user data from Kenni.is
 * @param {Object} memberData - Current member data from Firestore
 * @returns {Promise<void>}
 */
async function showProfileUpdateModal(discrepancies, userData, memberData) {
  // Set modal text using i18n
  setTextContent('profile-update-modal-title', R.string.profile_update_title);
  setTextContent('profile-update-modal-desc', R.string.profile_update_description);
  setTextContent('btn-cancel-profile-update', R.string.profile_update_cancel);
  setTextContent('btn-confirm-profile-update', R.string.profile_update_confirm);

  // Build discrepancies list HTML
  const discrepanciesList = document.getElementById('profile-discrepancies-list');
  discrepanciesList.innerHTML = discrepancies.map(d => `
    <div class="profile-discrepancy">
      <div class="profile-discrepancy__label">${d.label}:</div>
      <div class="profile-discrepancy__values">
        <div class="profile-discrepancy__old">
          <strong>${R.string.profile_discrepancy_old_label}</strong> ${d.members}
        </div>
        <div class="profile-discrepancy__new">
          <strong>${R.string.profile_discrepancy_new_label}</strong> ${d.kenni}
        </div>
      </div>
    </div>
  `).join('');

  // Show modal
  const modal = document.getElementById('profile-update-modal');
  modal.style.display = 'block';

  // Return promise that resolves when user makes choice
  return new Promise((resolve) => {
    const btnConfirm = document.getElementById('btn-confirm-profile-update');
    const btnCancel = document.getElementById('btn-cancel-profile-update');

    const handleConfirm = async () => {
      btnConfirm.disabled = true;
      btnConfirm.textContent = R.string.profile_updating;

      try {
        // Update both Firestore and Django
        await updateProfileData(userData, discrepancies);

        // Close modal
        modal.style.display = 'none';

        // Show success message
        alert(R.string.profile_updated_success);

        resolve(true);
      } catch (error) {
        console.error('Failed to update profile:', error);
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        alert(R.string.profile_update_error.replace('%s', error.message || error));
        btnConfirm.disabled = false;
        btnConfirm.textContent = R.string.profile_update_confirm;
        resolve(false);
      }

      // Cleanup
      btnConfirm.removeEventListener('click', handleConfirm);
      btnCancel.removeEventListener('click', handleCancel);
    };

    const handleCancel = () => {
      modal.style.display = 'none';
      resolve(false);

      // Cleanup
      btnConfirm.removeEventListener('click', handleConfirm);
      btnCancel.removeEventListener('click', handleCancel);
    };

    btnConfirm.addEventListener('click', handleConfirm);
    btnCancel.addEventListener('click', handleCancel);
  });
}

/**
 * Update profile data in both Firestore and Django backend
 *
 * @param {Object} userData - User data from Kenni.is (source of truth)
 * @param {Array} discrepancies - List of fields that need updating
 * @returns {Promise<void>}
 */
async function updateProfileData(userData, discrepancies) {
  const kennitala = userData.kennitala.replace(/-/g, '');

  // Build update data from discrepancies
  const updates = {};
  discrepancies.forEach(d => {
    if (d.field === 'name') updates.name = userData.displayName;
    if (d.field === 'email') updates.email = userData.email;
    if (d.field === 'phone') updates.phone = userData.phoneNumber;
  });

  // 1. Update Firestore /members/ collection
  await updateFirestoreMember(kennitala, updates);

  // 2. Update Django backend
  await updateDjangoMember(kennitala, updates);
}

/**
 * Update member profile in Firestore
 *
 * @param {string} kennitala - Member's kennitala (normalized, no hyphen)
 * @param {Object} updates - Fields to update {name, email, phone}
 * @returns {Promise<void>}
 */
async function updateFirestoreMember(kennitala, updates) {
  const db = getFirebaseFirestore();
  const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

  const memberDocRef = doc(db, 'members', kennitala);

  // Build Firestore update object (nested under profile)
  const firestoreUpdates = {};
  if (updates.name) firestoreUpdates['profile.name'] = updates.name;
  if (updates.email) firestoreUpdates['profile.email'] = updates.email;
  if (updates.phone) firestoreUpdates['profile.phone'] = updates.phone;

  await updateDoc(memberDocRef, firestoreUpdates);

  console.log('✅ Updated Firestore member:', kennitala, firestoreUpdates);
}

/**
 * Update member profile in Django backend
 *
 * @param {string} kennitala - Member's kennitala (normalized, no hyphen)
 * @param {Object} updates - Fields to update {name, email, phone}
 * @returns {Promise<void>}
 */
async function updateDjangoMember(kennitala, updates) {
  // Call Cloud Function using Firebase callable function API
  // Function is deployed in europe-west2 region
  const updateMemberProfile = httpsCallable('updatememberprofile', 'europe-west2');

  try {
    const result = await updateMemberProfile({
      kennitala: kennitala,
      updates: updates
    });

    console.log('✅ Updated Django member:', result.data);
  } catch (error) {
    console.error('Django update failed:', error);
    throw new Error(`Villa við uppfærslu Django gagnagrunns: ${error.message}`);
  }
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

    // Check for profile data discrepancies between Kenni.is and Firestore
    await checkProfileDiscrepancies(userData);

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
