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
import { httpsCallable, getFirebaseFirestore } from '../firebase/app.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { setTextContent, validateElements } from '../ui/dom.js';
import { formatPhone, validatePhone, formatInternationalPhone, validateInternationalPhone, validateInternationalPostalCode, formatMembershipDuration } from './utils/format.js';
import { getCountryName, getCountriesSorted, searchCountries, getCountryFlag, getCountryCallingCode } from './utils/countries.js';
import { updateMemberProfile, updateMemberForeignAddress } from './api/members-client.js';
import { debug } from './utils/debug.js';

/**
 * Constants
 */
const MAX_NAME_LENGTH = 100;
const SUCCESS_MESSAGE_AUTO_HIDE_MS = 5000;

/**
 * =============================================================================
 * SHARED UTILITY FUNCTIONS FOR COLLAPSIBLE ITEM LISTS
 * =============================================================================
 *
 * These helper functions reduce code duplication between phone numbers and
 * addresses features. Both use the same collapsible UI pattern.
 */

/**
 * Expand a collapsible section (shared by phone numbers and addresses)
 *
 * @param {string} sectionId - ID of section to expand
 * @param {string} expandIconId - ID of expand/collapse icon
 * @param {string} simpleDisplayId - ID of simple display to hide
 */
function expandCollapsibleSection(sectionId, expandIconId, simpleDisplayId) {
  const section = document.getElementById(sectionId);
  const expandIcon = document.getElementById(expandIconId);
  const simpleDisplay = document.getElementById(simpleDisplayId);

  if (section && section.style.display === 'none') {
    debug.log(`   📂 Expanding section: ${sectionId}`);
    section.style.display = 'block';
    if (simpleDisplay) simpleDisplay.style.display = 'none';
    if (expandIcon) expandIcon.classList.add('expand-icon--expanded');
  }
}

/**
 * Set an item as default in a list (shared by phone numbers and addresses)
 *
 * @param {Array} items - Array of items
 * @param {number} index - Index of item to set as default
 * @param {Function} renderFn - Function to re-render the list
 * @param {Function} saveFn - Function to save the list to Firestore
 * @param {string} itemType - Type of item (for logging)
 */
async function setDefaultItem(items, index, renderFn, saveFn, itemType) {
  debug.log(`⭐ Set default ${itemType} (index ${index})`);
  debug.log(`   Current default: ${items.findIndex(item => item.is_default)}`);

  // Unset all other defaults
  items.forEach((item, i) => {
    item.is_default = (i === index);
  });

  debug.log(`   New default: ${index}`);
  debug.log(`   Updated ${itemType}s:`, items);

  // Save and re-render
  await saveFn();
  renderFn();
}

/**
 * Show status feedback on an element (loading → success → clear)
 *
 * @param {HTMLElement} statusElement - The status icon element
 * @param {string} state - 'loading', 'success', or 'error'
 * @param {number} clearDelayMs - Milliseconds before clearing (default 2000)
 */
function showStatusFeedback(statusElement, state, clearDelayMs = 2000) {
  if (!statusElement) return;

  // Clear all states first
  statusElement.className = 'profile-field__status';

  // Set new state
  if (state === 'loading') {
    statusElement.className = 'profile-field__status profile-field__status--loading';
  } else if (state === 'success') {
    statusElement.className = 'profile-field__status profile-field__status--success';

    // Auto-clear after delay
    setTimeout(() => {
      statusElement.className = 'profile-field__status';
    }, clearDelayMs);
  } else if (state === 'error') {
    statusElement.className = 'profile-field__status profile-field__status--error';

    // Auto-clear after delay (longer for errors)
    setTimeout(() => {
      statusElement.className = 'profile-field__status';
    }, clearDelayMs * 1.5);
  }
}

/**
 * Create a status icon element for inline feedback
 *
 * @returns {HTMLElement} Status icon span element
 */
function createStatusIcon() {
  const statusIcon = document.createElement('span');
  statusIcon.className = 'profile-field__status';
  return statusIcon;
}

/**
 * Required DOM elements for profile page (always-on edit mode)
 */
const PROFILE_ELEMENTS = [
  'profile-title',
  'section-personal-info',
  'membership-title',
  'label-name',
  'input-name',
  'label-kennitala',
  'value-kennitala',
  'label-email',
  'input-email',
  'label-phone-numbers',
  'value-phone-simple',
  'phone-numbers-section',
  'phone-numbers-list',
  'btn-add-phone',
  'label-addresses',
  'value-address-simple',
  'addresses-section',
  'addresses-list',
  'btn-add-address',
  'label-status',
  'membership-status',
  'label-django-id',
  'value-django-id',
  'label-date-joined',
  'value-date-joined',
  'label-member-since',
  'value-member-since',
  'label-uid',
  'value-uid'
];

/**
 * Edit mode state
 */
let isEditing = false;
let originalData = null;
let currentUserData = null;

/**
 * DOM elements for edit functionality (always-on edit mode)
 */
const editElements = {
  inputName: null,
  inputEmail: null,
  successMessage: null,
  errorMessage: null
};

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

  // Phone numbers label - preserve expand icon
  const phoneLabel = document.getElementById('label-phone-numbers');
  if (phoneLabel) {
    const expandIcon = phoneLabel.querySelector('.expand-icon');
    phoneLabel.textContent = R.string.label_phone_numbers || R.string.label_phone;
    if (expandIcon) {
      phoneLabel.appendChild(expandIcon);
    }
  }

  // Addresses label - preserve expand icon
  const addressLabel = document.getElementById('label-addresses');
  if (addressLabel) {
    const expandIcon = addressLabel.querySelector('.expand-icon');
    addressLabel.textContent = R.string.label_addresses || 'Heimilisföng';
    if (expandIcon) {
      addressLabel.appendChild(expandIcon);
    }
  }

  setTextContent('label-status', R.string.label_status, 'profile page');
  setTextContent('label-django-id', R.string.label_django_id, 'profile page');
  setTextContent('label-date-joined', R.string.label_date_joined, 'profile page');
  setTextContent('label-member-since', R.string.label_member_since, 'profile page');
  setTextContent('label-uid', R.string.label_uid, 'profile page');

  // Phone numbers button
  setTextContent('btn-add-phone-text', R.string.btn_add_phone_text, 'profile page');

  // Addresses button
  setTextContent('btn-add-address-text', R.string.btn_add_address_text, 'profile page');
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
 * Update user information in UI (always-on edit mode)
 *
 * Note: Name, email, phone are now populated by populateInputFields()
 * This function only updates read-only display fields
 *
 * @param {Object} userData - User data from Firebase token claims
 * @param {Object} memberData - Member data from Firestore /members/ collection
 */
function updateUserInfo(userData, memberData = null) {
  const placeholder = R.string.placeholder_not_available;

  // Read-only fields (kennitala and membership metadata)
  setTextContent('value-kennitala', formatFieldValue(userData.kennitala, placeholder), 'profile page');

  // Membership metadata
  const djangoId = memberData?.metadata?.django_id;
  setTextContent('value-django-id', djangoId ? `#${djangoId}` : placeholder, 'profile page');

  // Date joined
  const dateJoined = memberData?.membership?.date_joined;
  if (dateJoined && dateJoined.toDate) {
    const joinedDate = dateJoined.toDate();
    const formattedDate = joinedDate.toLocaleDateString('is-IS', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    setTextContent('value-date-joined', formattedDate, 'profile page');

    // Format membership duration using utility function
    const durationText = formatMembershipDuration(joinedDate);
    setTextContent('value-member-since', durationText, 'profile page');
  } else {
    setTextContent('value-date-joined', placeholder, 'profile page');
    setTextContent('value-member-since', placeholder, 'profile page');
  }

  setTextContent('value-uid', formatFieldValue(userData.uid, placeholder), 'profile page');
}

/**
 * Update address information display
 *
 * Shows either Iceland address or current foreign address based on foreign_addresses.current flag
 *
 * @param {Object} memberData - Member data from Firestore
 */
function updateAddressInfo(memberData) {
  const placeholder = R.string.placeholder_not_available;

  // Get address sections
  const icelandSection = document.getElementById('iceland-address-section');
  const foreignSection = document.getElementById('foreign-address-section');

  if (!memberData) {
    // No member data - hide both sections
    if (icelandSection) icelandSection.style.display = 'none';
    if (foreignSection) foreignSection.style.display = 'none';
    return;
  }

  // Check for current foreign address
  // In Firestore: memberData.profile.foreign_address (object)
  // From Django API: memberData.foreign_addresses (array)
  let currentForeignAddress = null;

  if (memberData.profile?.foreign_address) {
    // Firestore format
    currentForeignAddress = memberData.profile.foreign_address;
  } else if (memberData.foreign_addresses) {
    // Django API format
    const foreignAddresses = memberData.foreign_addresses || [];
    currentForeignAddress = foreignAddresses.find(fa => fa.current === true);
  }

  // Show Iceland address (always show if available)
  const address = memberData.address || {};
  const hasIcelandAddress = address.street || address.postal_code || address.city;

  if (hasIcelandAddress && icelandSection) {
    icelandSection.style.display = 'block';

    // Display Iceland address fields
    const fullAddress = [address.street, address.number, address.letter]
      .filter(Boolean)
      .join(' ') || placeholder;
    setTextContent('value-address', fullAddress, 'profile page');
    setTextContent('value-postal-code', address.postal_code || placeholder, 'profile page');
    setTextContent('value-city', address.city || placeholder, 'profile page');
  } else if (icelandSection) {
    icelandSection.style.display = 'none';
  }

  // Show foreign address if available
  if (currentForeignAddress && foreignSection) {
    foreignSection.style.display = 'block';

    // Display foreign address fields
    const countryName = getCountryName(currentForeignAddress.country);
    setTextContent('value-country', countryName || placeholder, 'profile page');
    setTextContent('value-foreign-address', currentForeignAddress.address || placeholder, 'profile page');
    setTextContent('value-foreign-postal', currentForeignAddress.postal_code || placeholder, 'profile page');
    setTextContent('value-foreign-municipality', currentForeignAddress.municipality || placeholder, 'profile page');
  } else if (foreignSection) {
    foreignSection.style.display = 'none';
  }
}

/**
 * Setup country autocomplete (replaces dropdown with search)
 *
 * Enhanced UX: User can search by:
 * - Icelandic name ("Banda" → Bandaríkin)
 * - English name ("United" → Bandaríkin)
 * - Country code ("US" → Bandaríkin)
 *
 * See: docs/development/DATA_QUALITY_POLICY.md (Pattern 2: Flexible Search)
 */
function setupCountryAutocomplete() {
  const countryInput = document.getElementById('input-country');
  const countryCodeInput = document.getElementById('input-country-code');
  const dropdown = document.getElementById('country-dropdown');

  if (!countryInput || !countryCodeInput || !dropdown) return;

  let selectedIndex = -1;  // Track keyboard selection

  // Input event: Search and show dropdown
  countryInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    // Clear selection when user types
    countryCodeInput.value = '';
    selectedIndex = -1;

    if (query.length === 0) {
      hideDropdown();
      return;
    }

    // Search countries (supports Icelandic, English, code)
    const results = searchCountries(query);

    if (results.length === 0) {
      showEmptyDropdown();
      return;
    }

    // Show dropdown with results
    showDropdown(results);
  });

  // Keyboard navigation (↑↓ Enter Escape)
  countryInput.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');

    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateSelection(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && items[selectedIndex]) {
        selectCountry(items[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideDropdown();
    }
  });

  // Click outside to close dropdown
  document.addEventListener('click', (e) => {
    if (!countryInput.contains(e.target) && !dropdown.contains(e.target)) {
      hideDropdown();
    }
  });

  // On blur: Auto-select first result if user typed text but didn't click
  countryInput.addEventListener('blur', (e) => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      const query = countryInput.value.trim();
      const hasSelectedCode = countryCodeInput.value.trim().length > 0;

      // If user typed something but hasn't selected (hidden field empty)
      if (query.length > 0 && !hasSelectedCode) {
        const results = searchCountries(query);

        // If exactly one result, auto-select it
        if (results.length === 1) {
          countryInput.value = results[0].nameIs;
          countryCodeInput.value = results[0].code;
          hideDropdown();
        }
        // If multiple results but first is exact match, auto-select it
        else if (results.length > 1) {
          const exactMatch = results.find(c =>
            c.nameIs.toLowerCase() === query.toLowerCase() ||
            c.code.toLowerCase() === query.toLowerCase()
          );
          if (exactMatch) {
            countryInput.value = exactMatch.nameIs;
            countryCodeInput.value = exactMatch.code;
            hideDropdown();
          } else {
            // Clear invalid input
            countryInput.value = '';
            countryCodeInput.value = '';
            hideDropdown();
          }
        }
      }
    }, 200);
  });

  // Helper: Show dropdown with results
  function showDropdown(countries) {
    dropdown.innerHTML = '';
    dropdown.style.display = 'block';
    countryInput.setAttribute('aria-expanded', 'true');

    countries.forEach((country, index) => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.textContent = country.nameIs;  // Show Icelandic name
      li.setAttribute('role', 'option');
      li.setAttribute('data-code', country.code);
      li.setAttribute('data-name', country.nameIs);

      // Click to select
      li.addEventListener('click', () => selectCountry(li));

      dropdown.appendChild(li);
    });
  }

  // Helper: Show empty state
  function showEmptyDropdown() {
    dropdown.innerHTML = '';  // Empty triggers CSS ::after with "Ekkert land fannst"
    dropdown.style.display = 'block';
    countryInput.setAttribute('aria-expanded', 'true');
  }

  // Helper: Hide dropdown
  function hideDropdown() {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    countryInput.setAttribute('aria-expanded', 'false');
    selectedIndex = -1;
  }

  // Helper: Update keyboard selection visual
  function updateSelection(items) {
    items.forEach((item, index) => {
      if (index === selectedIndex) {
        item.classList.add('autocomplete-item--selected');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('autocomplete-item--selected');
      }
    });
  }

  // Helper: Select country (via click or Enter)
  function selectCountry(item) {
    const code = item.getAttribute('data-code');
    const name = item.getAttribute('data-name');

    // Set visible input to Icelandic name
    countryInput.value = name;

    // Set hidden input to country code (for validation/saving)
    countryCodeInput.value = code;

    // Hide dropdown
    hideDropdown();

    // Clear any error
    const errorEl = document.getElementById('error-country');
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
    countryInput.classList.remove('error');
  }
}

/**
 * Show Iceland address form, hide foreign address form
 */
function showIcelandAddressForm() {
  const icelandSection = document.getElementById('iceland-address-section');
  const foreignForm = document.getElementById('foreign-address-form');

  if (icelandSection) icelandSection.style.display = 'block';
  if (foreignForm) foreignForm.style.display = 'none';
}

/**
 * Show foreign address form, hide Iceland address
 */
function showForeignAddressForm() {
  const icelandSection = document.getElementById('iceland-address-section');
  const foreignForm = document.getElementById('foreign-address-form');

  if (icelandSection) icelandSection.style.display = 'none';
  if (foreignForm) foreignForm.style.display = 'block';
}

/**
 * Show both Iceland and foreign address forms
 */
function showBothAddressForms() {
  const icelandSection = document.getElementById('iceland-address-section');
  const foreignForm = document.getElementById('foreign-address-form');

  if (icelandSection) icelandSection.style.display = 'block';
  if (foreignForm) foreignForm.style.display = 'block';
}

/**
 * Handle living status radio button change
 * @param {Event} event - Change event
 */
function handleLivingStatusChange(event) {
  const selectedValue = event.target.value;

  switch (selectedValue) {
    case 'iceland':
      showIcelandAddressForm();
      break;
    case 'abroad':
      showForeignAddressForm();
      break;
    case 'both':
      showBothAddressForms();
      break;
  }
}

/**
 * Setup event listeners for living status radio buttons
 */
function setupLivingStatusListeners() {
  const radioButtons = document.querySelectorAll('input[name="living-status"]');

  radioButtons.forEach(radio => {
    radio.addEventListener('change', handleLivingStatusChange);
  });

  // Trigger initial state based on checked radio
  const checkedRadio = document.querySelector('input[name="living-status"]:checked');
  if (checkedRadio) {
    handleLivingStatusChange({ target: checkedRadio });
  }
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
    debug.error('Failed to verify membership:', error);
    // Return false on error (conservative approach)
    return false;
  }
}

/**
 * Initialize edit DOM elements (simplified for always-on edit mode)
 */
function initEditElements() {
  // Note: No edit button in always-on mode
  editElements.inputName = document.getElementById('input-name');
  editElements.inputEmail = document.getElementById('input-email');
  editElements.successMessage = document.getElementById('profile-success');
  editElements.errorMessage = document.getElementById('profile-error');
}

/**
 * Populate input fields with user data (always-on edit mode)
 * Replaces old enableEditMode() - no UI toggle needed anymore
 */
function populateInputFields() {
  // Save original data from currentUserData (source of truth)
  originalData = {
    name: currentUserData?.profile?.name || '',
    email: currentUserData?.profile?.email || '',
    foreign_address: null // Will be populated if foreign address exists
  };

  // Check for foreign address in Firestore format
  if (currentUserData?.profile?.foreign_address) {
    originalData.foreign_address = {
      country: currentUserData.profile.foreign_address.country, // Country code (e.g., "US")
      address: currentUserData.profile.foreign_address.address,
      postal_code: currentUserData.profile.foreign_address.postal_code || '',
      municipality: currentUserData.profile.foreign_address.municipality || '',
      current: true
    };
  }

  // Populate input fields with current values
  editElements.inputName.value = originalData.name !== '-' ? originalData.name : '';
  editElements.inputEmail.value = originalData.email !== '-' ? originalData.email : '';

  // Populate foreign address fields if available
  if (originalData.foreign_address) {
    const countryInput = document.getElementById('input-country');
    const countryCodeInput = document.getElementById('input-country-code');
    const addressInput = document.getElementById('input-foreign-address');
    const postalInput = document.getElementById('input-foreign-postal');
    const municipalityInput = document.getElementById('input-foreign-municipality');

    // Set visible input to Icelandic country name (e.g., "Bandaríkin")
    // Set hidden input to country code (e.g., "US")
    if (countryInput && countryCodeInput) {
      const code = originalData.foreign_address.country;
      countryInput.value = getCountryName(code);  // Show name
      countryCodeInput.value = code;  // Store code
    }
    if (addressInput) addressInput.value = originalData.foreign_address.address;
    if (postalInput) postalInput.value = originalData.foreign_address.postal_code;
    if (municipalityInput) municipalityInput.value = originalData.foreign_address.municipality;
  }
}

/**
 * Validate form fields
 * @returns {boolean} True if valid
 */
function validateForm() {
  let isValid = true;
  clearErrors();

  // Name (required)
  const name = editElements.inputName.value.trim();
  if (!name || name.length === 0) {
    showFieldError('name', R.string.validation_name_required || 'Nafn má ekki vera tómt');
    isValid = false;
  } else if (name.length > MAX_NAME_LENGTH) {
    showFieldError('name', R.string.validation_name_too_long || 'Nafn má ekki vera lengra en 100 stafir');
    isValid = false;
  }

  // Email (optional, but must be valid if provided)
  const email = editElements.inputEmail.value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('email', R.string.validation_email_invalid || 'Ógilt netfang');
    isValid = false;
  }

  return isValid;
}

/**
 * Get selected living status
 * @returns {string} 'iceland', 'abroad', or 'both'
 */
function getLivingStatus() {
  const checkedRadio = document.querySelector('input[name="living-status"]:checked');
  return checkedRadio ? checkedRadio.value : 'iceland';
}

/**
 * Validation error messages (centralized)
 * Loaded from R.string, no hardcoded fallbacks
 */
const VALIDATION_MESSAGES = {
  countryRequired: () => R.string.validation_country_required,
  addressRequired: () => R.string.validation_address_required,
  postalCodeInvalid: () => R.string.validation_postal_code_invalid,
  foreignPhoneInvalid: () => R.string.validation_foreign_phone_invalid
};

/**
 * Validate foreign address fields
 * @returns {boolean} True if valid
 */
function validateForeignAddress() {
  let isValid = true;

  // Read from hidden input (country code, e.g., "US")
  const countryCode = document.getElementById('input-country-code')?.value;
  const address = document.getElementById('input-foreign-address')?.value.trim();
  const postalCode = document.getElementById('input-foreign-postal')?.value.trim();
  const municipality = document.getElementById('input-foreign-municipality')?.value.trim();

  // Country is required for foreign address
  if (!countryCode) {
    showFieldError('country', VALIDATION_MESSAGES.countryRequired());
    isValid = false;
  }

  // Address is required
  if (!address || address.length === 0) {
    showFieldError('foreign-address', VALIDATION_MESSAGES.addressRequired());
    isValid = false;
  }

  // Postal code validation (optional field, but if provided must be valid)
  if (postalCode && !validateInternationalPostalCode(postalCode, countryCode)) {
    showFieldError('foreign-postal', VALIDATION_MESSAGES.postalCodeInvalid());
    isValid = false;
  }

  return isValid;
}

/**
 * Save changes - optimistic update
 */
async function saveChanges() {
  // Validate basic fields
  if (!validateForm()) {
    return;
  }

  // Check living status and validate foreign address if needed
  const livingStatus = getLivingStatus();
  let foreignAddressData = null;

  if (livingStatus === 'abroad' || livingStatus === 'both') {
    if (!validateForeignAddress()) {
      return; // Validation failed
    }

    // Collect foreign address data (use hidden input for country code)
    foreignAddressData = {
      country: document.getElementById('input-country-code')?.value,  // ISO code (e.g., "US")
      address: document.getElementById('input-foreign-address')?.value.trim(),
      postal_code: document.getElementById('input-foreign-postal')?.value.trim() || '',
      municipality: document.getElementById('input-foreign-municipality')?.value.trim() || '',
      current: true // Always set to current when saving
    };
  }

  // Collect basic profile updates
  const updates = {};
  const name = editElements.inputName.value.trim();
  const email = editElements.inputEmail.value.trim();

  if (name !== originalData.name) updates.name = name;
  if (email !== originalData.email) updates.email = email;

  // Nothing changed?
  if (Object.keys(updates).length === 0 && !foreignAddressData) {
    showSuccess(R.string.profile_no_changes || 'Engar breytingar til að vista');
    cancelEdit();
    return;
  }

  // Disable buttons during save (optional - buttons may not exist if using auto-save)
  if (editElements.btnSave) editElements.btnSave.disabled = true;
  if (editElements.btnCancel) editElements.btnCancel.disabled = true;
  const saveText = editElements.btnSave?.querySelector('#btn-save-text');
  if (saveText) {
    saveText.textContent = R.string.profile_saving_button || 'Vistar...';
  }

  try {
    // Build original data structure for rollback
    const originalMemberData = {
      profile: {
        name: originalData.name !== '-' ? originalData.name : '',
        email: originalData.email !== '-' ? originalData.email : '',
        phone: originalData.phone !== '-' ? originalData.phone : ''
      }
    };

    // Update both Firestore and Django using shared client
    // (includes optimistic update + automatic rollback if Django fails)
    const region = R.string.config_firebase_region;
    await updateMemberProfile(currentUserData.kennitala, updates, originalMemberData, region);

    // If foreign address provided, save it separately
    if (foreignAddressData) {
      const originalForeignAddress = originalData.foreign_address || null;

      try {
        await updateMemberForeignAddress(
          currentUserData.kennitala,
          foreignAddressData,
          originalForeignAddress,
          region
        );

        // Update UI to show foreign address
        const countryValue = document.getElementById('value-country');
        const foreignAddressValue = document.getElementById('value-foreign-address');
        const foreignPostalValue = document.getElementById('value-foreign-postal');
        const foreignMunicipalityValue = document.getElementById('value-foreign-municipality');

        if (countryValue) countryValue.textContent = getCountryName(foreignAddressData.country);
        if (foreignAddressValue) foreignAddressValue.textContent = foreignAddressData.address;
        if (foreignPostalValue) foreignPostalValue.textContent = foreignAddressData.postal_code || '-';
        if (foreignMunicipalityValue) foreignMunicipalityValue.textContent = foreignAddressData.municipality || '-';

      } catch (foreignAddressError) {
        // Foreign address save failed (Django API not implemented yet)
        console.warn('Foreign address save failed:', foreignAddressError);

        // Show warning (basic profile was saved successfully)
        showError(
          R.string.profile_foreign_address_blocked ||
          'Grunnupplýsingar vistaðar, en erlent heimilisfang er ekki virkt ennþá. Vinsamlegast reyndu aftur síðar.'
        );

        // Re-enable buttons so user can try again (if buttons exist)
        if (editElements.btnSave) editElements.btnSave.disabled = false;
        if (editElements.btnCancel) editElements.btnCancel.disabled = false;
        if (saveText) {
          saveText.textContent = R.string.profile_save_button || 'Vista breytingar';
        }

        return; // Don't exit edit mode, let user try again
      }
    }

    // Show success message
    showSuccess(R.string.profile_save_success || 'Upplýsingar uppfærðar!');

    // Exit edit mode
    isEditing = false;
    document.body.classList.remove('profile-editing');
    editElements.btnEdit.style.display = 'inline-block';
    if (editElements.btnSave) editElements.btnSave.style.display = 'none';
    if (editElements.btnCancel) editElements.btnCancel.style.display = 'none';

    // Show values, hide inputs
    document.querySelectorAll('.profile-edit__value').forEach(el => {
      el.style.display = 'block';
    });
    document.querySelectorAll('.profile-edit__input-wrapper').forEach(el => {
      el.style.display = 'none';
    });

  } catch (error) {
    debug.error('Save failed:', error);

    showError('Villa við vistun í Django. Breytingar voru ekki vistaðar. Reyndu aftur.');
  } finally {
    // Re-enable buttons (if they exist)
    if (editElements.btnSave) editElements.btnSave.disabled = false;
    if (editElements.btnCancel) editElements.btnCancel.disabled = false;
    if (saveText) {
      saveText.textContent = R.string.profile_save_button || 'Vista breytingar';
    }
  }
}

/**
 * Helper: Check if there are unsaved changes
 */
function hasUnsavedChanges() {
  if (!originalData) return false;

  const currentName = editElements.inputName.value.trim();
  const currentEmail = editElements.inputEmail.value.trim();

  return (
    currentName !== originalData.name ||
    currentEmail !== originalData.email
  );
}

/**
 * Helper: Show field error
 */
function showFieldError(fieldName, message) {
  const errorEl = document.getElementById(`error-${fieldName}`);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  const inputEl = document.getElementById(`input-${fieldName}`);
  if (inputEl) {
    inputEl.classList.add('error');
  }
}

/**
 * Helper: Clear all errors
 */
function clearErrors() {
  document.querySelectorAll('.profile-edit__error').forEach(el => {
    el.style.display = 'none';
    el.textContent = '';
  });

  document.querySelectorAll('.profile-edit__input').forEach(el => {
    el.classList.remove('error');
  });
}

/**
 * Helper: Show success message
 */
function showSuccess(message) {
  const successEl = editElements.successMessage;
  if (successEl) {
    successEl.querySelector('#success-message').textContent = message;
    successEl.style.display = 'block';
  }

  const errorEl = editElements.errorMessage;
  if (errorEl) {
    errorEl.style.display = 'none';
  }

  // Auto-hide after 5 seconds
  setTimeout(() => {
    if (successEl) {
      successEl.style.display = 'none';
    }
  }, SUCCESS_MESSAGE_AUTO_HIDE_MS);
}

/**
 * Helper: Show error message
 */
function showError(message) {
  const errorEl = editElements.errorMessage;
  if (errorEl) {
    errorEl.querySelector('#error-message').textContent = message;
    errorEl.style.display = 'block';
  }

  const successEl = editElements.successMessage;
  if (successEl) {
    successEl.style.display = 'none';
  }
}

/**
 * Helper: Clear messages
 */
function clearMessages() {
  if (editElements.successMessage) {
    editElements.successMessage.style.display = 'none';
  }
  if (editElements.errorMessage) {
    editElements.errorMessage.style.display = 'none';
  }
}

/**
 * Show toast notification (auto-save feedback)
 *
 * Lightweight toast that appears top-right and auto-fades after 3 seconds.
 * Used for auto-save success/error feedback.
 *
 * @param {string} message - Toast message
 * @param {string} type - 'success' | 'error' | 'info'
 */
function showToast(message, type = 'success') {
  // Remove any existing toast
  const existingToast = document.querySelector('.profile-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `profile-toast profile-toast--${type}`;
  toast.textContent = message;

  // Add to body
  document.body.appendChild(toast);

  // Trigger animation (add 'show' class after append for CSS transition)
  setTimeout(() => toast.classList.add('profile-toast--show'), 10);

  // Auto-hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('profile-toast--show');
    // Remove from DOM after fade-out animation
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Auto-save a single field on blur
 *
 * @param {string} fieldName - Field name (name, email, phone, foreign_phone)
 * @param {string} newValue - New value to save
 */
async function autoSaveField(fieldName, newValue) {
  // Get the current original value
  const originalValue = originalData[fieldName] || '';

  // Check if value actually changed
  if (newValue === originalValue) {
    return; // No change, skip save
  }

  // Validate the field before saving
  let isValid = true;

  if (fieldName === 'name') {
    if (!newValue.trim()) {
      showFieldError('name', VALIDATION_MESSAGES.nameRequired());
      return;
    }
  } else if (fieldName === 'email') {
    // Email validation: optional, but must be valid if provided
    if (newValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newValue)) {
      showFieldError('email', VALIDATION_MESSAGES.emailInvalid());
      return;
    }
  }

  // Clear error for this field
  clearFieldError(fieldName);

  // Show loading spinner
  showFieldStatus(fieldName, 'loading');

  try {
    // Build the update object
    const updates = {};
    updates[fieldName] = newValue;

    // Build original data structure for rollback
    const originalMemberData = {
      profile: {
        name: originalData.name !== '-' ? originalData.name : '',
        email: originalData.email !== '-' ? originalData.email : '',
        phone: originalData.phone !== '-' ? originalData.phone : ''
      }
    };

    // Update both Firestore and Django using shared client
    const region = R.string.config_firebase_region;
    await updateMemberProfile(currentUserData.kennitala, updates, originalMemberData, region);

    // Update original data to new value (for future comparisons)
    originalData[fieldName] = newValue;

    // Show success checkmark (stays until user focuses field again)
    showFieldStatus(fieldName, 'success');

    // Optional: Keep toast for now (can remove later if inline feedback is enough)
    // showToast(R.string.profile_autosave_success || 'Uppfært sjálfkrafa', 'success');

  } catch (error) {
    debug.error(`Auto-save failed for ${fieldName}:`, error);

    // Show error icon
    showFieldStatus(fieldName, 'error');

    // Show error toast (important for errors)
    showToast(R.string.profile_autosave_error || 'Villa við vistun', 'error');
  }
}

/**
 * Show/hide status icon for a field (loading spinner, checkmark, or error)
 *
 * @param {string} fieldName - Field name (name, email, phone, foreign_phone)
 * @param {string} status - Status: '' (empty), 'loading', 'success', 'error'
 */
function showFieldStatus(fieldName, status) {
  const statusEl = document.getElementById(`status-${fieldName}`);
  if (!statusEl) return;

  // Remove all status classes
  statusEl.classList.remove(
    'profile-field__status--loading',
    'profile-field__status--success',
    'profile-field__status--error'
  );

  // Add new status class if not empty
  if (status) {
    statusEl.classList.add(`profile-field__status--${status}`);
  }
}

/**
 * Helper: Clear error for a specific field
 */
function clearFieldError(fieldName) {
  const errorEl = document.getElementById(`error-${fieldName}`);
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  const inputEl = document.getElementById(`input-${fieldName}`);
  if (inputEl) {
    inputEl.classList.remove('error');
  }
}

/**
 * Setup auto-save listeners for all editable fields
 * Also adds focus listeners to clear status icons when user starts editing
 */
function setupAutoSaveListeners() {
  const fields = ['name', 'email'];

  fields.forEach(fieldName => {
    const inputEl = document.getElementById(`input-${fieldName}`);
    if (!inputEl) return;

    // On blur: Auto-save
    inputEl.addEventListener('blur', (e) => {
      const newValue = e.target.value.trim();
      autoSaveField(fieldName, newValue);
    });

    // On focus: Clear status icon (user is editing again)
    inputEl.addEventListener('focus', () => {
      showFieldStatus(fieldName, '');
    });
  });
}

/**
 * Phone numbers state
 */
let phoneNumbers = [];  // Array of { country: 'IS', number: '7758493', is_default: true }

/**
 * Addresses state
 */
let addresses = [];  // Array of { country: 'IS', street: 'Laugavegur 10', postal_code: '101', city: 'Reykjavík', is_default: true }

/**
 * Migrate old phone/foreign_phone fields to phone_numbers array (lazy migration)
 *
 * Only runs if phone_numbers is empty but old fields exist.
 * Preserves backward compatibility.
 */
function migrateOldPhoneFields() {
  // If phone_numbers already exists, no migration needed
  if (currentUserData?.profile?.phone_numbers && currentUserData.profile.phone_numbers.length > 0) {
    phoneNumbers = [...currentUserData.profile.phone_numbers];
    return;
  }

  // Check for old fields
  const oldPhone = currentUserData?.profile?.phone;
  const oldForeignPhone = currentUserData?.profile?.foreign_phone;

  phoneNumbers = [];

  // Add old Icelandic phone (if exists)
  if (oldPhone && oldPhone.trim()) {
    phoneNumbers.push({
      country: 'IS',
      number: oldPhone.trim(),
      is_default: true  // First phone is default
    });
  }

  // Add old foreign phone (if exists)
  if (oldForeignPhone && oldForeignPhone.trim()) {
    // Parse E.164 format (+45..., +47..., etc.)
    // Extract country code from international phone
    let countryCode = 'IS';  // Default to Iceland if parsing fails
    let number = oldForeignPhone;

    // Try to detect country from calling code
    if (oldForeignPhone.startsWith('+')) {
      // Extract calling code (e.g., "+45" from "+4512345678")
      const match = oldForeignPhone.match(/^\+(\d{1,4})/);
      if (match) {
        const callingCode = `+${match[1]}`;
        // Find country by calling code (reverse lookup)
        const countries = getCountriesSorted();
        const foundCountry = countries.find(c => getCountryCallingCode(c.code) === callingCode);
        if (foundCountry) {
          countryCode = foundCountry.code;
          // Remove calling code from number
          number = oldForeignPhone.substring(match[0].length);
        }
      }
    }

    phoneNumbers.push({
      country: countryCode,
      number: number,
      is_default: phoneNumbers.length === 0  // If no Icelandic phone, this is default
    });
  }

  // If no phones at all, add empty array (user can add manually)
  // phoneNumbers remains []
}

/**
 * Migrate old address fields to addresses array (lazy migration)
 *
 * Migrates from old living_status system to new addresses array.
 * - living_status='iceland' → 1 IS address
 * - living_status='abroad' → 1 foreign address
 * - living_status='both' → 2 addresses (IS + foreign)
 */
function migrateOldAddressFields() {
  debug.log('🏠 Migrating old address fields...');
  debug.log('   Full currentUserData:', currentUserData);
  debug.log('   Profile data:', currentUserData?.profile);

  // If addresses already exists, no migration needed
  if (currentUserData?.profile?.addresses && currentUserData.profile.addresses.length > 0) {
    debug.log('   ✅ Using existing addresses array:', currentUserData.profile.addresses);
    addresses = [...currentUserData.profile.addresses];
    return;
  }

  debug.log('   📦 No addresses array found, checking old fields...');

  // Log all profile keys to see what's available
  if (currentUserData?.profile) {
    debug.log('   Available profile keys:', Object.keys(currentUserData.profile));
  }

  // Check for old fields in multiple possible locations
  const livingStatus = currentUserData?.profile?.living_status || currentUserData?.living_status;

  // Iceland address might be in different formats
  const icelandAddress = currentUserData?.profile?.address || currentUserData?.address;
  const addressIceland = currentUserData?.profile?.address_iceland;

  const postalCode = currentUserData?.profile?.postal_code || currentUserData?.postal_code;
  const city = currentUserData?.profile?.city || currentUserData?.city;
  const country = currentUserData?.profile?.country || currentUserData?.country;

  // Foreign address is an object
  const foreignAddressObj = currentUserData?.profile?.foreign_address || currentUserData?.foreign_address;

  debug.log(`   Living status: ${livingStatus}`);
  debug.log(`   Iceland address (string): ${icelandAddress}, ${postalCode} ${city}`);
  debug.log(`   Iceland address (object):`, addressIceland);
  debug.log(`   Foreign address (object):`, foreignAddressObj);

  addresses = [];

  // Check for Iceland address (might be in address_iceland object or flat fields)
  let hasIcelandAddress = false;
  if (addressIceland && typeof addressIceland === 'object') {
    // address_iceland object format
    const icelandAddr = {
      country: 'IS',
      street: addressIceland.street || addressIceland.address || '',
      postal_code: addressIceland.postal_code || '',
      city: addressIceland.city || addressIceland.municipality || '',
      is_default: true
    };
    if (icelandAddr.street || icelandAddr.postal_code) {
      addresses.push(icelandAddr);
      hasIcelandAddress = true;
      debug.log('   ✅ Migrated Iceland address (object):', icelandAddr);
    }
  } else if (icelandAddress || postalCode || city) {
    // Flat fields format
    const icelandAddr = {
      country: 'IS',
      street: icelandAddress?.trim() || '',
      postal_code: postalCode?.trim() || '',
      city: city?.trim() || '',
      is_default: true
    };
    addresses.push(icelandAddr);
    hasIcelandAddress = true;
    debug.log('   ✅ Migrated Iceland address (flat):', icelandAddr);
  }

  // Check for foreign address (object format)
  if (foreignAddressObj && typeof foreignAddressObj === 'object') {
    const foreignAddr = {
      country: foreignAddressObj.country || country || '',
      street: foreignAddressObj.address || foreignAddressObj.street || '',
      postal_code: foreignAddressObj.postal_code || '',
      city: foreignAddressObj.municipality || foreignAddressObj.city || '',
      is_default: !hasIcelandAddress  // Default if no Iceland address
    };
    if (foreignAddr.street || foreignAddr.country) {
      addresses.push(foreignAddr);
      debug.log('   ✅ Migrated foreign address:', foreignAddr);
    }
  }

  // If no addresses migrated, add one empty Iceland address for user to fill
  if (addresses.length === 0) {
    debug.log('   ℹ️ No old address data found, adding empty Iceland address');
    addresses.push({
      country: 'IS',
      street: '',
      postal_code: '',
      city: '',
      is_default: true
    });
  } else {
    debug.log(`   ✅ Migration complete: ${addresses.length} address(es) migrated`);
  }
}

/**
 * Update simple phone display (shows default phone only)
 */
function updateSimplePhoneDisplay() {
  const simpleDisplay = document.getElementById('value-phone-simple');
  if (!simpleDisplay) return;

  // Find default phone
  const defaultPhone = phoneNumbers.find(p => p.is_default);

  if (!defaultPhone) {
    simpleDisplay.textContent = R.string.placeholder_not_available || '-';
    return;
  }

  // Format: 🇮🇸 +354 775-8493
  const flag = getCountryFlag(defaultPhone.country);
  const callingCode = getCountryCallingCode(defaultPhone.country);
  const number = defaultPhone.number;

  simpleDisplay.textContent = `${flag} ${callingCode} ${number}`;
}

/**
 * Toggle phone numbers section (expand/collapse)
 */
function togglePhoneNumbersSection() {
  const section = document.getElementById('phone-numbers-section');
  const expandIcon = document.getElementById('phone-expand-icon');
  const simpleDisplay = document.getElementById('value-phone-simple');

  if (!section || !expandIcon || !simpleDisplay) return;

  const isExpanded = section.style.display !== 'none';

  if (isExpanded) {
    // Collapse
    section.style.display = 'none';
    simpleDisplay.style.display = 'block';
    expandIcon.classList.remove('expand-icon--expanded');
  } else {
    // Expand
    section.style.display = 'block';
    simpleDisplay.style.display = 'none';
    expandIcon.classList.add('expand-icon--expanded');
  }
}

/**
 * Setup toggle listener for phone numbers label
 */
function setupPhoneNumbersToggle() {
  const label = document.getElementById('label-phone-numbers');
  if (label) {
    label.addEventListener('click', togglePhoneNumbersSection);
  }
}

/**
 * Update simple address display (shows default address only)
 */
function updateSimpleAddressDisplay() {
  const simpleDisplay = document.getElementById('value-address-simple');
  if (!simpleDisplay) return;

  // Find default address
  const defaultAddress = addresses.find(a => a.is_default);

  if (!defaultAddress) {
    simpleDisplay.textContent = R.string.placeholder_not_available || '-';
    return;
  }

  // Format: 🇮🇸 Laugavegur 10, 101 Reykjavík
  const flag = getCountryFlag(defaultAddress.country);
  const street = defaultAddress.street || '';
  const postal = defaultAddress.postal_code || '';
  const city = defaultAddress.city || '';

  simpleDisplay.textContent = `${flag} ${street}, ${postal} ${city}`.trim();
}

/**
 * Toggle addresses section (expand/collapse)
 */
function toggleAddressesSection() {
  const section = document.getElementById('addresses-section');
  const expandIcon = document.getElementById('address-expand-icon');
  const simpleDisplay = document.getElementById('value-address-simple');

  if (!section || !expandIcon || !simpleDisplay) return;

  const isExpanded = section.style.display !== 'none';

  if (isExpanded) {
    // Collapse
    section.style.display = 'none';
    simpleDisplay.style.display = 'block';
    expandIcon.classList.remove('expand-icon--expanded');
  } else {
    // Expand
    section.style.display = 'block';
    simpleDisplay.style.display = 'none';
    expandIcon.classList.add('expand-icon--expanded');
  }
}

/**
 * Setup toggle listener for addresses label
 */
function setupAddressesToggle() {
  const label = document.getElementById('label-addresses');
  if (label) {
    label.addEventListener('click', toggleAddressesSection);
  }
}

/**
 * Render phone numbers list
 */
function renderPhoneNumbers() {
  const container = document.getElementById('phone-numbers-list');
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  // If no phone numbers, show message
  if (phoneNumbers.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = R.string.profile_no_phone_numbers || 'Engin símanúmer skráð';
    emptyMessage.style.color = 'var(--color-gray-500)';
    emptyMessage.style.fontSize = '0.9375rem';
    container.appendChild(emptyMessage);

    // Also update simple display
    updateSimplePhoneDisplay();
    return;
  }

  // Render each phone number
  phoneNumbers.forEach((phone, index) => {
    const phoneItem = document.createElement('div');
    phoneItem.className = 'phone-number-item';
    if (phone.is_default) {
      phoneItem.classList.add('phone-number-item--default');
    }

    // Country selector (dropdown with flag)
    const countrySelector = document.createElement('select');
    countrySelector.className = 'phone-country-selector';
    countrySelector.dataset.index = index;

    // Add all countries as options
    const countries = getCountriesSorted();
    countries.forEach(country => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = `${getCountryFlag(country.code)} ${getCountryCallingCode(country.code)}`;
      if (country.code === phone.country) {
        option.selected = true;
      }
      countrySelector.appendChild(option);
    });

    // Status icon for this phone number
    const statusIcon = createStatusIcon();

    // Auto-save on change
    countrySelector.addEventListener('change', async (e) => {
      const newCountry = e.target.value;
      debug.log(`🌍 Country change event (index ${index}): "${phone.country}" → "${newCountry}"`);

      if (newCountry !== phone.country) {
        debug.log(`✏️ Country changed, updating...`);
        phoneNumbers[index].country = newCountry;
        showStatusFeedback(statusIcon, 'loading');
        await savePhoneNumbers();
        showStatusFeedback(statusIcon, 'success');
        renderPhoneNumbers(); // Re-render to update flag display
      } else {
        debug.log('ℹ️ No change, skipping save');
      }
    });

    // Phone number input
    const numberInput = document.createElement('input');
    numberInput.type = 'tel';
    numberInput.className = 'phone-number-input';
    numberInput.value = phone.number;
    numberInput.placeholder = '7758493';
    numberInput.dataset.index = index;

    // Auto-save on blur
    numberInput.addEventListener('blur', async (e) => {
      const newNumber = e.target.value.trim();
      debug.log(`📱 Phone number blur event (index ${index}): "${phone.number}" → "${newNumber}"`);

      if (newNumber !== phone.number) {
        debug.log(`✏️ Phone number changed, updating...`);
        phoneNumbers[index].number = newNumber;
        showStatusFeedback(statusIcon, 'loading');
        await savePhoneNumbers();
        showStatusFeedback(statusIcon, 'success');
      } else {
        debug.log('ℹ️ No change, skipping save');
      }
    });

    // Default star icon (click to toggle)
    const defaultIcon = document.createElement('span');
    defaultIcon.className = 'phone-default-icon';
    defaultIcon.textContent = phone.is_default ? '⭐' : '☆';
    defaultIcon.title = phone.is_default
      ? (R.string.profile_phone_default_set || 'Aðalsímanúmer')
      : (R.string.profile_phone_set_default || 'Setja sem aðalsímanúmer');
    defaultIcon.style.cursor = 'pointer';

    defaultIcon.addEventListener('click', () => {
      setDefaultPhoneNumber(index);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'phone-delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = R.string.profile_phone_delete || 'Eyða símanúmeri';
    deleteBtn.disabled = phoneNumbers.length === 1;  // Can't delete last phone

    deleteBtn.addEventListener('click', () => {
      deletePhoneNumber(index);
    });

    // Assemble phone item
    phoneItem.appendChild(countrySelector);
    phoneItem.appendChild(numberInput);
    phoneItem.appendChild(statusIcon);  // Status feedback icon
    phoneItem.appendChild(defaultIcon);
    phoneItem.appendChild(deleteBtn);

    container.appendChild(phoneItem);
  });

  // Update simple phone display with default phone
  updateSimplePhoneDisplay();
}

/**
 * Render addresses list
 */
function renderAddresses() {
  const container = document.getElementById('addresses-list');
  if (!container) return;

  // Clear container
  container.innerHTML = '';

  // If no addresses, show message
  if (addresses.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = R.string.profile_no_addresses || 'Engin heimilisföng skráð';
    emptyMessage.style.color = 'var(--color-gray-500, #6b7280)';
    emptyMessage.style.fontStyle = 'italic';
    container.appendChild(emptyMessage);
    updateSimpleAddressDisplay();
    return;
  }

  // Render each address
  addresses.forEach((address, index) => {
    const addressItem = document.createElement('div');
    addressItem.className = 'address-item';
    if (address.is_default) {
      addressItem.classList.add('address-item--default');
    }

    // Row 1: Country selector + Status + Default star + Delete button
    const row1 = document.createElement('div');
    row1.className = 'address-item__row address-item__row--controls';

    // Status icon for this address
    const statusIcon = createStatusIcon();

    // Country selector
    const countrySelector = document.createElement('select');
    countrySelector.className = 'item-country-selector';
    const countries = getCountriesSorted();
    countries.forEach(country => {
      const option = document.createElement('option');
      option.value = country.code;
      option.textContent = `${getCountryFlag(country.code)} ${country.nameIs}`;
      if (country.code === address.country) {
        option.selected = true;
      }
      countrySelector.appendChild(option);
    });

    // Country change listener
    countrySelector.addEventListener('change', async (e) => {
      const newCountry = e.target.value;
      debug.log(`🌍 Country change (index ${index}): "${address.country}" → "${newCountry}"`);

      if (newCountry !== address.country) {
        debug.log('✏️ Country changed, updating...');
        addresses[index].country = newCountry;
        showStatusFeedback(statusIcon, 'loading');
        await saveAddresses();
        showStatusFeedback(statusIcon, 'success');
        renderAddresses();  // Re-render to update autocomplete behavior
      }
    });

    // Default star icon
    const defaultIcon = document.createElement('span');
    defaultIcon.className = 'item-default-icon';
    defaultIcon.textContent = address.is_default ? '⭐' : '☆';
    defaultIcon.title = address.is_default
      ? (R.string.profile_address_default_set || 'Aðalheimilisfang')
      : (R.string.profile_address_set_default || 'Setja sem aðalheimilisfang');
    defaultIcon.addEventListener('click', () => setDefaultAddress(index));

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'item-delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.title = R.string.profile_address_delete || 'Eyða heimilisfangi';
    deleteBtn.disabled = addresses.length === 1;
    deleteBtn.addEventListener('click', () => deleteAddress(index));

    row1.appendChild(countrySelector);
    row1.appendChild(statusIcon);  // Status feedback icon
    row1.appendChild(defaultIcon);
    row1.appendChild(deleteBtn);

    // Row 2: Street input
    const row2 = document.createElement('div');
    row2.className = 'address-item__row';

    const streetInput = document.createElement('input');
    streetInput.type = 'text';
    streetInput.className = 'address-input';
    streetInput.value = address.street || '';
    streetInput.placeholder = R.string.label_street || 'Götuheiti og húsnúmer';

    // Auto-save on blur
    streetInput.addEventListener('blur', async (e) => {
      const newStreet = e.target.value.trim();
      debug.log(`🏠 Street blur (index ${index}): "${address.street}" → "${newStreet}"`);

      if (newStreet !== address.street) {
        debug.log('✏️ Street changed, updating...');
        addresses[index].street = newStreet;
        showStatusFeedback(statusIcon, 'loading');
        await saveAddresses();
        showStatusFeedback(statusIcon, 'success');
      } else {
        debug.log('ℹ️ No change, skipping save');
      }
    });

    row2.appendChild(streetInput);

    // Row 3: Postal code + City
    const row3 = document.createElement('div');
    row3.className = 'address-item__row';

    const postalInput = document.createElement('input');
    postalInput.type = 'text';
    postalInput.className = 'address-input address-input--postal';
    postalInput.value = address.postal_code || '';
    postalInput.placeholder = R.string.label_postal_code || 'Póstnúmer';
    postalInput.id = `postal-code-${index}`;

    const cityInput = document.createElement('input');
    cityInput.type = 'text';
    cityInput.className = 'address-input address-input--city';
    cityInput.value = address.city || '';
    cityInput.placeholder = R.string.label_city || 'Bær/Sveitarfélag';
    cityInput.id = `city-${index}`;

    // Auto-save on blur
    postalInput.addEventListener('blur', async (e) => {
      const newPostal = e.target.value.trim();
      debug.log(`📮 Postal code blur (index ${index}): "${address.postal_code}" → "${newPostal}"`);

      if (newPostal !== address.postal_code) {
        debug.log('✏️ Postal code changed, updating...');
        addresses[index].postal_code = newPostal;
        showStatusFeedback(statusIcon, 'loading');
        await saveAddresses();
        showStatusFeedback(statusIcon, 'success');
      } else {
        debug.log('ℹ️ No change, skipping save');
      }
    });

    cityInput.addEventListener('blur', async (e) => {
      const newCity = e.target.value.trim();
      debug.log(`🏙️ City blur (index ${index}): "${address.city}" → "${newCity}"`);

      if (newCity !== address.city) {
        debug.log('✏️ City changed, updating...');
        addresses[index].city = newCity;
        showStatusFeedback(statusIcon, 'loading');
        await saveAddresses();
        showStatusFeedback(statusIcon, 'success');
      } else {
        debug.log('ℹ️ No change, skipping save');
      }
    });

    // TODO: Add Þjóðskrá autocomplete for IS addresses
    // if (address.country === 'IS') {
    //   setupPostalCodeAutocomplete(postalInput, cityInput);
    // }

    row3.appendChild(postalInput);
    row3.appendChild(cityInput);

    // Assemble address item
    addressItem.appendChild(row1);
    addressItem.appendChild(row2);
    addressItem.appendChild(row3);

    container.appendChild(addressItem);
  });

  // Update simple address display
  updateSimpleAddressDisplay();
}

/**
 * Add new phone number (defaults to Iceland)
 */
function addPhoneNumber() {
  debug.log('➕ Adding new phone number...');
  debug.log(`   Current phone count: ${phoneNumbers.length}`);

  // Expand section if collapsed (shared utility)
  expandCollapsibleSection('phone-numbers-section', 'phone-expand-icon', 'value-phone-simple');

  // Add new phone with Iceland as default country
  const newPhone = {
    country: 'IS',
    number: '',
    is_default: phoneNumbers.length === 0  // If first phone, mark as default
  };
  phoneNumbers.push(newPhone);

  debug.log(`   ✅ Added new phone: ${JSON.stringify(newPhone)}`);
  debug.log(`   New phone count: ${phoneNumbers.length}`);

  // Re-render
  renderPhoneNumbers();

  // Focus on new input
  const inputs = document.querySelectorAll('.phone-number-input');
  const lastInput = inputs[inputs.length - 1];
  if (lastInput) {
    lastInput.focus();
    debug.log('   🎯 Focused on new phone input');
  }
}

/**
 * Delete phone number by index
 */
async function deletePhoneNumber(index) {
  debug.log(`🗑️ Delete phone number requested (index ${index})`);

  // Can't delete if only one phone left
  if (phoneNumbers.length === 1) {
    debug.log('⚠️ Cannot delete last phone number');
    showToast(R.string.profile_phone_cannot_delete_last || 'Ekki hægt að eyða síðasta símanúmerinu', 'error');
    return;
  }

  const wasDefault = phoneNumbers[index].is_default;
  debug.log(`Deleting phone: ${JSON.stringify(phoneNumbers[index])}, was default: ${wasDefault}`);

  // Remove phone
  phoneNumbers.splice(index, 1);

  // If deleted phone was default, set first phone as new default
  if (wasDefault && phoneNumbers.length > 0) {
    phoneNumbers[0].is_default = true;
    debug.log(`Set new default: ${JSON.stringify(phoneNumbers[0])}`);
  }

  // Save and re-render
  await savePhoneNumbers();
  renderPhoneNumbers();
}

/**
 * Set phone number as default
 */
async function setDefaultPhoneNumber(index) {
  await setDefaultItem(phoneNumbers, index, renderPhoneNumbers, savePhoneNumbers, 'phone number');
  updateSimplePhoneDisplay(); // Update collapsed view
}

/**
 * Save phone numbers to Firestore (optimistic update)
 */
async function savePhoneNumbers() {
  debug.log('💾 Saving phone numbers to Firestore:', phoneNumbers);

  const statusIcon = document.getElementById('status-phone-numbers');

  try {
    // Show loading spinner
    if (statusIcon) {
      statusIcon.className = 'profile-field__status profile-field__status--loading';
      debug.log('⏳ Showing loading spinner...');
    }

    // Optimistic update: Firestore first
    const db = getFirebaseFirestore();
    const kennitalaKey = currentUserData.kennitala.replace(/-/g, '');
    const memberDocRef = doc(db, 'members', kennitalaKey);

    debug.log('📝 Firestore path: /members/' + kennitalaKey);

    // Update Firestore
    await updateDoc(memberDocRef, {
      'profile.phone_numbers': phoneNumbers,
      'profile.updated_at': new Date()
    });

    debug.log('✅ Phone numbers saved successfully to Firestore');

    // Show success checkmark
    if (statusIcon) {
      statusIcon.className = 'profile-field__status profile-field__status--success';
      debug.log('✓ Showing success checkmark');

      // Clear after 2 seconds
      setTimeout(() => {
        statusIcon.className = 'profile-field__status';
        debug.log('ℹ️ Cleared status icon');
      }, 2000);
    }

    // Update Django via Cloud Function
    // Note: Django may not have phone_numbers field yet (Epic #43)
    // For now, just update Firestore
    // TODO: Update Django when membership sync supports phone_numbers

    // Show success toast
    showToast(R.string.profile_phone_saved || 'Símanúmer uppfært', 'success');
    debug.log('🎉 Toast notification shown');

  } catch (error) {
    debug.error('❌ Failed to save phone numbers:', error);

    // Show error icon
    if (statusIcon) {
      statusIcon.className = 'profile-field__status profile-field__status--error';
      debug.log('✕ Showing error icon');

      // Clear after 3 seconds
      setTimeout(() => {
        statusIcon.className = 'profile-field__status';
      }, 3000);
    }

    showToast(R.string.profile_phone_save_error || 'Villa við vistun símanúmers', 'error');
    debug.log('⚠️ Error toast notification shown');
  }
}

/**
 * Add new address (defaults to Iceland)
 */
function addAddress() {
  debug.log('➕ Adding new address...');
  debug.log(`   Current address count: ${addresses.length}`);

  // Expand section if collapsed (shared utility)
  expandCollapsibleSection('addresses-section', 'address-expand-icon', 'value-address-simple');

  // Add new address with Iceland as default country
  const newAddress = {
    country: 'IS',
    street: '',
    postal_code: '',
    city: '',
    is_default: addresses.length === 0  // If first address, mark as default
  };
  addresses.push(newAddress);

  debug.log(`   ✅ Added new address: ${JSON.stringify(newAddress)}`);
  debug.log(`   New address count: ${addresses.length}`);

  // Re-render
  renderAddresses();

  // Focus on new street input
  const inputs = document.querySelectorAll('.address-input');
  if (inputs.length > 0) {
    const lastInput = inputs[inputs.length - 3];  // Street input (3rd from end)
    if (lastInput) {
      lastInput.focus();
      debug.log('   🎯 Focused on new street input');
    }
  }
}

/**
 * Delete address by index
 */
async function deleteAddress(index) {
  debug.log(`🗑️ Delete address requested (index ${index})`);

  // Can't delete if only one address left
  if (addresses.length === 1) {
    debug.log('⚠️ Cannot delete last address');
    showToast(R.string.profile_address_cannot_delete_last || 'Ekki hægt að eyða síðasta heimilisfanginu', 'error');
    return;
  }

  const wasDefault = addresses[index].is_default;
  debug.log(`Deleting address: ${JSON.stringify(addresses[index])}, was default: ${wasDefault}`);

  // Remove address
  addresses.splice(index, 1);

  // If deleted address was default, set first address as new default
  if (wasDefault && addresses.length > 0) {
    addresses[0].is_default = true;
    debug.log(`Set new default: ${JSON.stringify(addresses[0])}`);
  }

  // Save and re-render
  await saveAddresses();
  renderAddresses();
}

/**
 * Set address as default
 */
async function setDefaultAddress(index) {
  await setDefaultItem(addresses, index, renderAddresses, saveAddresses, 'address');
  updateSimpleAddressDisplay(); // Update collapsed view
}

/**
 * Save addresses to Firestore (optimistic update)
 */
async function saveAddresses() {
  debug.log('💾 Saving addresses to Firestore:', addresses);

  const statusIcon = document.getElementById('status-addresses');

  try {
    // Show loading spinner
    if (statusIcon) {
      statusIcon.className = 'profile-field__status profile-field__status--loading';
      debug.log('⏳ Showing loading spinner...');
    }

    // Optimistic update: Firestore first
    const db = getFirebaseFirestore();
    const kennitalaKey = currentUserData.kennitala.replace(/-/g, '');
    const memberDocRef = doc(db, 'members', kennitalaKey);

    debug.log('📝 Firestore path: /members/' + kennitalaKey);

    // Update Firestore
    await updateDoc(memberDocRef, {
      'profile.addresses': addresses,
      'profile.updated_at': new Date()
    });

    debug.log('✅ Addresses saved successfully to Firestore');

    // Show success checkmark
    if (statusIcon) {
      statusIcon.className = 'profile-field__status profile-field__status--success';
      debug.log('✓ Showing success checkmark');

      // Clear after 2 seconds
      setTimeout(() => {
        statusIcon.className = 'profile-field__status';
        debug.log('ℹ️ Cleared status icon');
      }, 2000);
    }

    // Update Django via Cloud Function
    // Note: Django may not have addresses field yet (Epic #43)
    // For now, just update Firestore
    // TODO: Update Django when membership sync supports addresses

    // Show success toast
    showToast(R.string.profile_address_saved || 'Heimilisfang uppfært', 'success');
    debug.log('🎉 Toast notification shown');

  } catch (error) {
    debug.error('❌ Failed to save addresses:', error);

    // Show error icon
    if (statusIcon) {
      statusIcon.className = 'profile-field__status profile-field__status--error';
      debug.log('✕ Showing error icon');

      // Clear after 3 seconds
      setTimeout(() => {
        statusIcon.className = 'profile-field__status';
      }, 3000);
    }

    showToast(R.string.profile_address_save_error || 'Villa við vistun heimilisfangs', 'error');
    debug.log('⚠️ Error toast notification shown');
  }
}

/**
 * Setup event listener for "Add address" button
 */
function setupAddressesListeners() {
  const addBtn = document.getElementById('btn-add-address');
  if (addBtn) {
    addBtn.addEventListener('click', addAddress);
  }
}

/**
 * Setup event listener for "Add phone" button
 */
function setupPhoneNumbersListeners() {
  const addBtn = document.getElementById('btn-add-phone');
  if (addBtn) {
    addBtn.addEventListener('click', addPhoneNumber);
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

    // Load member data from Firestore (source of truth for profile fields)
    let memberData = null;
    try {
      const db = getFirebaseFirestore();
      const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      const memberDocRef = doc(db, 'members', userData.kennitala.replace(/-/g, ''));
      const memberDoc = await getDoc(memberDocRef);
      if (memberDoc.exists()) {
        memberData = memberDoc.data();
      }
    } catch (error) {
      console.warn('Failed to load member data from Firestore:', error);
      // Continue with userData only
    }

    // Merge memberData into userData for edit functions
    // memberData.profile is source of truth, fallback to userData
    currentUserData = {
      ...userData,
      profile: memberData?.profile || {
        name: userData.displayName || '',
        email: userData.email || '',
        phone: userData.phoneNumber || '',
        foreign_phone: '',
        foreign_address: null
      },
      membership: memberData?.membership || {},
      metadata: memberData?.metadata || {}
    };

    // Initialize edit functionality
    initEditElements();

    // Setup auto-save listeners for all editable fields
    setupAutoSaveListeners();

    // Migrate old phone fields to phone_numbers array (lazy migration)
    migrateOldPhoneFields();

    // Setup phone numbers toggle (expand/collapse)
    setupPhoneNumbersToggle();

    // Setup phone numbers listeners (add button)
    setupPhoneNumbersListeners();

    // Render phone numbers list
    renderPhoneNumbers();

    // Migrate old address fields to addresses array (lazy migration)
    migrateOldAddressFields();

    // Setup addresses toggle (expand/collapse)
    setupAddressesToggle();

    // Setup addresses listeners (add button)
    setupAddressesListeners();

    // Render addresses list
    renderAddresses();

    // Update profile-specific UI
    updateProfileStrings();
    updateUserInfo(userData, memberData);

    // Populate input fields with current data (always-on edit mode)
    populateInputFields();

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
    debug.error('Profile page initialization failed:', error);
  }
}

// Run initialization
init();
