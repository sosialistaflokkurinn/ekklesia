/**
 * Profile Page Logic
 *
 * User profile page displaying personal information and membership status.
 *
 * Refactored architecture:
 * - PhoneManager and AddressManager handle CRUD operations
 * - Migration utilities handle legacy data conversion
 * - Pure session init from /session/init.js
 * - Reusable UI from /ui/nav.js
 *
 * @module profile
 */

import { R } from '../i18n/strings-loader.js';
import { initAuthenticatedPage } from './page-init.js';
import { requireAuth, getUserData, signOut, AuthenticationError } from '../session/auth.js';
import { httpsCallable, getFirebaseFirestore } from '../firebase/app.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { setTextContent, validateElements } from '../ui/dom.js';
import { el } from './utils/util-dom.js';
import { formatPhone, validatePhone, formatInternationalPhone, validateInternationalPhone, validateInternationalPostalCode, formatMembershipDuration } from './utils/util-format.js';
import { getCountryName, getCountriesSorted, searchCountries, getCountryFlag, getCountryCallingCode } from './utils/util-countries.js';
import { updateMemberProfile } from './api/api-members.js';
import { debug } from './utils/util-debug.js';
import { showToast } from './components/ui-toast.js';
import { showStatus, createStatusIcon } from './components/ui-status.js';
import { SearchableSelect } from './components/ui-searchable-select.js';
import { PhoneManager } from './profile/phone-manager.js';
import { AddressManager } from './profile/address-manager.js';
import { migrateOldPhoneFields, migrateOldAddressFields } from './profile/migration.js';

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
    addressLabel.textContent = R.string.label_addresses;
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

  // Communication preferences section
  setTextContent('section-communication', R.string.section_communication || 'Samskiptastillingar', 'profile page');
  setTextContent('label-reachable', R.string.label_reachable || 'Má hafa samband', 'profile page');
  setTextContent('label-reachable-description', R.string.label_reachable_description || 'Leyfir flokknum að hafa samband vegna frétta og atburða', 'profile page');
  setTextContent('label-groupable', R.string.label_groupable || 'Má bæta í hópa', 'profile page');
  setTextContent('label-groupable-description', R.string.label_groupable_description || 'Leyfir flokknum að bæta þér í vinnuhópa og póstlista', 'profile page');
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
      const li = el('li', 'autocomplete-item', {
        role: 'option',
        'data-code': country.code,
        'data-name': country.nameIs,
        onclick: () => selectCountry(li)
      }, country.nameIs);

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
    showFieldError('name', R.string.validation_name_required);
    isValid = false;
  } else if (name.length > MAX_NAME_LENGTH) {
    showFieldError('name', R.string.validation_name_too_long);
    isValid = false;
  }

  // Email (optional, but must be valid if provided)
  const email = editElements.inputEmail.value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('email', R.string.validation_email_invalid);
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
    showSuccess(R.string.profile_no_changes);
    cancelEdit();
    return;
  }

  // Disable buttons during save (optional - buttons may not exist if using auto-save)
  if (editElements.btnSave) editElements.btnSave.disabled = true;
  if (editElements.btnCancel) editElements.btnCancel.disabled = true;
  const saveText = editElements.btnSave?.querySelector('#btn-save-text');
  if (saveText) {
    saveText.textContent = R.string.profile_saving_button;
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



    // Show success message
    showSuccess(R.string.profile_save_success);

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
      saveText.textContent = R.string.profile_save_button;
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
    // showToast(R.string.profile_autosave_success, 'success');

  } catch (error) {
    debug.error(`Auto-save failed for ${fieldName}:`, error);

    // Show error icon
    showFieldStatus(fieldName, 'error');

    // Show error toast (important for errors)
    showToast(R.string.profile_autosave_error, 'error');
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
    const saveBtn = document.getElementById(`save-${fieldName}`);
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

    // Save button click: Trigger blur to save
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        inputEl.blur();
        // Show brief success feedback
        showFieldStatus(fieldName, 'success');
      });
    }
  });
}

/**
 * Phone and Address Managers
 */
let phoneManager = null;
let addressManager = null;

/**
 * Update simple phone display (shows default phone only)
 * NOTE: This is a legacy function, will be removed once refactor is complete
 */
function updateSimplePhoneDisplay() {
  const simpleDisplay = document.getElementById('value-phone-simple');
  if (!simpleDisplay) return;

  const phoneNumbers = phoneManager?.getPhoneNumbers() || [];
  const defaultPhone = phoneNumbers.find(p => p.is_default);

  if (!defaultPhone) {
    simpleDisplay.textContent = R.string.placeholder_not_available;
    return;
  }

  // Format: 🇮🇸 +354 555-1234
  const flag = getCountryFlag(defaultPhone.country);
  const callingCode = getCountryCallingCode(defaultPhone.country);
  const number = defaultPhone.number;

  simpleDisplay.textContent = `${flag} ${callingCode} ${number}`;
}

/**
 * Update simple address display (shows default address only)
 * NOTE: This is a legacy function, will be removed once refactor is complete
 */
function updateSimpleAddressDisplay() {
  const simpleDisplay = document.getElementById('value-address-simple');
  if (!simpleDisplay) return;

  const addresses = addressManager?.getAddresses() || [];
  const defaultAddress = addresses.find(a => a.is_default);

  if (!defaultAddress) {
    simpleDisplay.textContent = R.string.placeholder_not_available;
    return;
  }

  const flag = getCountryFlag(defaultAddress.country);
  const street = defaultAddress.street || '';
  const postal = defaultAddress.postal_code || '';
  const city = defaultAddress.city || '';

  simpleDisplay.textContent = `${flag} ${street}, ${postal} ${city}`.trim();
}

/**
 * Initialize communication preferences (reachable/groupable toggles)
 * Sets initial values and adds change listeners for auto-save
 */
function initCommunicationPreferences() {
  const profile = currentUserData?.profile || {};

  // Reachable toggle
  const reachableInput = document.getElementById('input-reachable');
  const reachableStatus = document.getElementById('status-reachable');

  if (reachableInput) {
    // Default to true if not set
    reachableInput.checked = profile.reachable !== false;

    reachableInput.addEventListener('change', async (e) => {
      const newValue = e.target.checked;
      debug.log(`📞 Reachable changed: ${newValue}`);

      showStatus(reachableStatus, 'loading', { baseClass: 'profile-field__status' });
      try {
        const db = getFirebaseFirestore();
        const kennitalaKey = currentUserData.kennitala.replace(/-/g, '');
        const memberDocRef = doc(db, 'members', kennitalaKey);

        await updateDoc(memberDocRef, {
          'profile.reachable': newValue,
          'profile.updated_at': new Date()
        });

        // Update local state
        if (!currentUserData.profile) currentUserData.profile = {};
        currentUserData.profile.reachable = newValue;

        showStatus(reachableStatus, 'success', { baseClass: 'profile-field__status' });
        showToast(R.string.profile_preferences_saved || 'Stillingar vistaðar', 'success');
      } catch (error) {
        debug.error('Failed to save reachable preference:', error);
        showStatus(reachableStatus, 'error', { baseClass: 'profile-field__status' });
        // Revert UI
        reachableInput.checked = !newValue;
      }
    });
  }

  // Groupable toggle
  const groupableInput = document.getElementById('input-groupable');
  const groupableStatus = document.getElementById('status-groupable');

  if (groupableInput) {
    // Default to true if not set
    groupableInput.checked = profile.groupable !== false;

    groupableInput.addEventListener('change', async (e) => {
      const newValue = e.target.checked;
      debug.log(`👥 Groupable changed: ${newValue}`);

      showStatus(groupableStatus, 'loading', { baseClass: 'profile-field__status' });
      try {
        const db = getFirebaseFirestore();
        const kennitalaKey = currentUserData.kennitala.replace(/-/g, '');
        const memberDocRef = doc(db, 'members', kennitalaKey);

        await updateDoc(memberDocRef, {
          'profile.groupable': newValue,
          'profile.updated_at': new Date()
        });

        // Update local state
        if (!currentUserData.profile) currentUserData.profile = {};
        currentUserData.profile.groupable = newValue;

        showStatus(groupableStatus, 'success', { baseClass: 'profile-field__status' });
        showToast(R.string.profile_preferences_saved || 'Stillingar vistaðar', 'success');
      } catch (error) {
        debug.error('Failed to save groupable preference:', error);
        showStatus(groupableStatus, 'error', { baseClass: 'profile-field__status' });
        // Revert UI
        groupableInput.checked = !newValue;
      }
    });
  }

  debug.log('✅ Communication preferences initialized');
}

/**
 * Initialize profile page
 *
 * @returns {Promise<void>}
 */
async function init() {
  debug.log('🚀 INIT FUNCTION STARTED');
  try {
    debug.log('🔍 About to validate profile page...');
    // Validate DOM structure
    validateProfilePage();

    debug.log('🔍 About to load i18n...');
    // Load i18n strings
    await R.load('is');
    
    // Translate elements with data-i18n attributes
    R.translatePage();

    debug.log('🔍 About to test SearchableSelect...');
    // Test SearchableSelect import
    debug.log('🔍 Testing SearchableSelect availability...');
    if (typeof SearchableSelect === 'undefined') {
      debug.error('❌ SearchableSelect is not defined! Import failed.');
      console.error('SearchableSelect import failed - check file path and exports');
    } else {
      debug.log('✅ SearchableSelect class is available:', SearchableSelect);
    }

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
        debug.log('📦 memberData from Firestore:', memberData);
        debug.log('📦 memberData.address:', memberData?.address);
      }
    } catch (error) {
      console.warn('Failed to load member data from Firestore:', error);
      // Continue with userData only
    }

    // Merge memberData into userData for edit functions
    // memberData.profile is source of truth, fallback to userData
    currentUserData = {
      ...userData,
      address: memberData?.address,  // OLD address structure (for ONE-TIME migration)
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

    // Initialize Phone Manager
    phoneManager = new PhoneManager(currentUserData);
    const migratedPhones = migrateOldPhoneFields(currentUserData);
    phoneManager.initialize(migratedPhones);
    phoneManager.setupListeners();
    phoneManager.render();

    // Initialize Address Manager
    addressManager = new AddressManager(currentUserData);
    const migratedAddresses = migrateOldAddressFields(currentUserData);
    addressManager.initialize(migratedAddresses);
    addressManager.setupListeners();
    addressManager.render();

    // Auto-save if migration patched addresses (added missing fields)
    if (migratedAddresses._needsSave) {
      debug.log('🔄 Migration patched addresses, auto-saving to Firestore...');
      await addressManager.save();
    }

    // Initialize communication preferences (reachable/groupable)
    initCommunicationPreferences();

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
