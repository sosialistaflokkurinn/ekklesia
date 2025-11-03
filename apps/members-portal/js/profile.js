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
import { formatPhone, validatePhone, formatInternationalPhone, validateInternationalPhone, validateInternationalPostalCode } from './utils/format.js';
import { getCountryName, getCountriesSorted } from './utils/countries.js';
import { updateMemberProfile, updateMemberForeignAddress } from './api/members-client.js';

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
 * Edit mode state
 */
let isEditing = false;
let originalData = null;
let currentUserData = null;

/**
 * DOM elements for edit functionality
 */
const editElements = {
  btnEdit: null,
  btnSave: null,
  btnCancel: null,
  inputName: null,
  inputEmail: null,
  inputPhone: null,
  valueName: null,
  valueEmail: null,
  valuePhone: null,
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
  setTextContent('section-address-info', R.string.section_address, 'profile page');
  setTextContent('membership-title', R.string.membership_title, 'profile page');
  setTextContent('membership-status', R.string.membership_loading, 'profile page');
  setTextContent('label-name', R.string.label_name, 'profile page');
  setTextContent('label-kennitala', R.string.label_kennitala, 'profile page');
  setTextContent('label-email', R.string.label_email, 'profile page');
  setTextContent('label-phone', R.string.label_phone, 'profile page');
  setTextContent('label-status', R.string.label_status, 'profile page');
  setTextContent('label-uid', R.string.label_uid, 'profile page');

  // Address labels
  setTextContent('label-living-status', R.string.label_living_status, 'profile page');
  setTextContent('living-status-iceland', R.string.living_status_iceland, 'profile page');
  setTextContent('living-status-abroad', R.string.living_status_abroad, 'profile page');
  setTextContent('living-status-both', R.string.living_status_both, 'profile page');
  setTextContent('label-address', R.string.label_address, 'profile page');
  setTextContent('label-postal-code', R.string.label_postal_code, 'profile page');
  setTextContent('label-city', R.string.label_city, 'profile page');
  setTextContent('label-country', R.string.label_country, 'profile page');
  setTextContent('label-foreign-address', R.string.label_foreign_address, 'profile page');
  setTextContent('label-foreign-postal', R.string.label_foreign_postal_code, 'profile page');
  setTextContent('label-foreign-municipality', R.string.label_foreign_municipality, 'profile page');
  setTextContent('label-foreign-phone', R.string.label_foreign_phone, 'profile page');

  // Address input labels (edit mode)
  setTextContent('label-country-select', R.string.label_country, 'profile page');
  setTextContent('label-foreign-address-input', R.string.label_foreign_address, 'profile page');
  setTextContent('label-foreign-postal-input', R.string.label_foreign_postal_code, 'profile page');
  setTextContent('label-foreign-municipality-input', R.string.label_foreign_municipality, 'profile page');
  setTextContent('label-foreign-phone-input', R.string.label_foreign_phone, 'profile page');
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
 * @param {Object} memberData - Member data from Firestore /members/ collection
 */
function updateUserInfo(userData, memberData = null) {
  const placeholder = R.string.placeholder_not_available;

  // Prefer memberData.profile values over userData (memberData is source of truth)
  const memberProfile = memberData?.profile || {};

  setTextContent('value-name', formatFieldValue(memberProfile.name || userData.displayName, placeholder), 'profile page');
  setTextContent('value-kennitala', formatFieldValue(userData.kennitala, placeholder), 'profile page');
  setTextContent('value-email', formatFieldValue(memberProfile.email || userData.email, placeholder), 'profile page');
  // Format phone for display (XXX-XXXX) - prefer memberData phone
  const phone = memberProfile.phone || userData.phoneNumber;
  setTextContent('value-phone', formatPhone(phone) || placeholder, 'profile page');
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
  const foreignAddresses = memberData.foreign_addresses || [];
  const currentForeignAddress = foreignAddresses.find(fa => fa.current === true);

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

    // Display foreign phone (from profile, not address)
    const foreignPhone = memberData.profile?.foreign_phone || '';
    setTextContent('value-foreign-phone', formatInternationalPhone(foreignPhone) || placeholder, 'profile page');
  } else if (foreignSection) {
    foreignSection.style.display = 'none';
  }
}

/**
 * Populate country dropdown for foreign address form
 */
function populateCountryDropdown() {
  const countrySelect = document.getElementById('input-country');
  if (!countrySelect) return;

  // Get sorted countries
  const countries = getCountriesSorted();

  // Clear existing options (except the first placeholder)
  while (countrySelect.options.length > 1) {
    countrySelect.remove(1);
  }

  // Add country options
  countries.forEach(country => {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = country.name;
    countrySelect.appendChild(option);
  });
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
    console.error('Failed to verify membership:', error);
    // Return false on error (conservative approach)
    return false;
  }
}

/**
 * Initialize edit DOM elements
 */
function initEditElements() {
  editElements.btnEdit = document.getElementById('btn-edit');
  editElements.btnSave = document.getElementById('btn-save');
  editElements.btnCancel = document.getElementById('btn-cancel');
  editElements.inputName = document.getElementById('input-name');
  editElements.inputEmail = document.getElementById('input-email');
  editElements.inputPhone = document.getElementById('input-phone');
  editElements.valueName = document.getElementById('value-name');
  editElements.valueEmail = document.getElementById('value-email');
  editElements.valuePhone = document.getElementById('value-phone');
  editElements.successMessage = document.getElementById('profile-success');
  editElements.errorMessage = document.getElementById('profile-error');

  // Add event listeners
  editElements.btnEdit?.addEventListener('click', enableEditMode);
  editElements.btnSave?.addEventListener('click', saveChanges);
  editElements.btnCancel?.addEventListener('click', cancelEdit);
}

/**
 * Enable edit mode - show inputs, hide values
 */
function enableEditMode() {
  isEditing = true;

  // Save original data for cancel/revert
  const foreignPhoneValue = document.getElementById('value-foreign-phone')?.textContent || '';
  const countryValue = document.getElementById('value-country')?.textContent || '';
  const foreignAddressValue = document.getElementById('value-foreign-address')?.textContent || '';
  const foreignPostalValue = document.getElementById('value-foreign-postal')?.textContent || '';
  const foreignMunicipalityValue = document.getElementById('value-foreign-municipality')?.textContent || '';

  originalData = {
    name: editElements.valueName.textContent,
    email: editElements.valueEmail.textContent,
    phone: editElements.valuePhone.textContent,
    foreign_phone: foreignPhoneValue !== '-' ? foreignPhoneValue : '',
    foreign_address: null // Will be populated if foreign address exists
  };

  // Check if foreign address exists and save it for rollback
  if (countryValue && countryValue !== '-' && foreignAddressValue && foreignAddressValue !== '-') {
    originalData.foreign_address = {
      country: countryValue, // This is the display name, we'll need to map back to code
      address: foreignAddressValue,
      postal_code: foreignPostalValue !== '-' ? foreignPostalValue : '',
      municipality: foreignMunicipalityValue !== '-' ? foreignMunicipalityValue : '',
      current: true
    };
  }

  // Populate input fields with current values
  editElements.inputName.value = originalData.name !== '-' ? originalData.name : '';
  editElements.inputEmail.value = originalData.email !== '-' ? originalData.email : '';
  editElements.inputPhone.value = originalData.phone !== '-' ? originalData.phone : '';

  // Populate foreign phone if available
  const foreignPhoneInput = document.getElementById('input-foreign-phone');
  if (foreignPhoneInput) {
    foreignPhoneInput.value = originalData.foreign_phone;
  }

  // Populate foreign address fields if available
  if (originalData.foreign_address) {
    const countryInput = document.getElementById('input-country');
    const addressInput = document.getElementById('input-foreign-address');
    const postalInput = document.getElementById('input-foreign-postal');
    const municipalityInput = document.getElementById('input-foreign-municipality');

    // Note: We need to map country display name back to country code
    // For now, we'll just populate the fields - TODO: add country code lookup
    if (addressInput) addressInput.value = originalData.foreign_address.address;
    if (postalInput) postalInput.value = originalData.foreign_address.postal_code;
    if (municipalityInput) municipalityInput.value = originalData.foreign_address.municipality;
  }

  // Toggle UI
  document.body.classList.add('profile-editing');
  editElements.btnEdit.style.display = 'none';
  editElements.btnSave.style.display = 'inline-block';
  editElements.btnCancel.style.display = 'inline-block';

  // Hide values, show inputs
  document.querySelectorAll('.profile-edit__value').forEach(el => {
    el.style.display = 'none';
  });
  document.querySelectorAll('.profile-edit__input-wrapper').forEach(el => {
    el.style.display = 'block';
  });

  // Focus on first input
  editElements.inputName.focus();

  // Clear any previous messages
  clearMessages();
}

/**
 * Cancel edit mode - revert to view mode
 */
function cancelEdit() {
  // Check for unsaved changes
  if (hasUnsavedChanges()) {
    if (!confirm(R.string.profile_cancel_confirm || 'Hætta við breytingar?')) {
      return;
    }
  }

  // Reset state
  isEditing = false;
  originalData = null;

  // Toggle UI back
  document.body.classList.remove('profile-editing');
  editElements.btnEdit.style.display = 'inline-block';
  editElements.btnSave.style.display = 'none';
  editElements.btnCancel.style.display = 'none';

  // Show values, hide inputs
  document.querySelectorAll('.profile-edit__value').forEach(el => {
    el.style.display = 'block';
  });
  document.querySelectorAll('.profile-edit__input-wrapper').forEach(el => {
    el.style.display = 'none';
  });

  // Clear errors
  clearErrors();
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
  } else if (name.length > 100) {
    showFieldError('name', R.string.validation_name_too_long || 'Nafn má ekki vera lengra en 100 stafir');
    isValid = false;
  }

  // Email (optional, but must be valid if provided)
  const email = editElements.inputEmail.value.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('email', R.string.validation_email_invalid || 'Ógilt netfang');
    isValid = false;
  }

  // Phone (optional, but must be valid if provided)
  const phone = editElements.inputPhone.value.trim();
  if (phone && !validatePhone(phone)) {
    showFieldError('phone', R.string.validation_phone_invalid || 'Ógilt símanúmer (7 tölustafir)');
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
 * Validate foreign address fields
 * @returns {boolean} True if valid
 */
function validateForeignAddress() {
  let isValid = true;

  const country = document.getElementById('input-country')?.value;
  const address = document.getElementById('input-foreign-address')?.value.trim();
  const postalCode = document.getElementById('input-foreign-postal')?.value.trim();
  const municipality = document.getElementById('input-foreign-municipality')?.value.trim();
  const foreignPhone = document.getElementById('input-foreign-phone')?.value.trim();

  // Country is required for foreign address
  if (!country) {
    showFieldError('country', R.string.validation_country_required || 'Vinsamlegast veldu land');
    isValid = false;
  }

  // Address is required
  if (!address || address.length === 0) {
    showFieldError('foreign-address', R.string.validation_address_required || 'Heimilisfang má ekki vera tómt');
    isValid = false;
  }

  // Postal code validation (optional field, but if provided must be valid)
  if (postalCode && !validateInternationalPostalCode(postalCode, country)) {
    showFieldError('foreign-postal', R.string.validation_postal_code_invalid || 'Ógilt póstnúmer');
    isValid = false;
  }

  // Foreign phone validation (optional, but if provided must be valid E.164)
  if (foreignPhone && !validateInternationalPhone(foreignPhone)) {
    showFieldError('foreign-phone', R.string.validation_foreign_phone_invalid || 'Ógilt alþjóðlegt símanúmer');
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

    // Collect foreign address data
    foreignAddressData = {
      country: document.getElementById('input-country')?.value,
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
  const phone = editElements.inputPhone.value.trim();
  const foreignPhone = document.getElementById('input-foreign-phone')?.value.trim() || '';

  if (name !== originalData.name) updates.name = name;
  if (email !== originalData.email) updates.email = email;
  if (phone !== originalData.phone) updates.phone = phone;

  // Add foreign phone to updates (even if empty, to allow clearing)
  if (foreignPhone !== (originalData.foreign_phone || '')) {
    updates.foreign_phone = foreignPhone;
  }

  // Nothing changed?
  if (Object.keys(updates).length === 0 && !foreignAddressData) {
    showSuccess(R.string.profile_no_changes || 'Engar breytingar til að vista');
    cancelEdit();
    return;
  }

  // Disable buttons during save
  editElements.btnSave.disabled = true;
  editElements.btnCancel.disabled = true;
  const saveText = editElements.btnSave.querySelector('#btn-save-text');
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
        const foreignPhoneValue = document.getElementById('value-foreign-phone');

        if (countryValue) countryValue.textContent = getCountryName(foreignAddressData.country);
        if (foreignAddressValue) foreignAddressValue.textContent = foreignAddressData.address;
        if (foreignPostalValue) foreignPostalValue.textContent = foreignAddressData.postal_code || '-';
        if (foreignMunicipalityValue) foreignMunicipalityValue.textContent = foreignAddressData.municipality || '-';
        if (foreignPhoneValue) {
          foreignPhoneValue.textContent = foreignPhone || '-';
        }

      } catch (foreignAddressError) {
        // Foreign address save failed (Django API not implemented yet)
        console.warn('Foreign address save failed:', foreignAddressError);

        // Show warning (basic profile was saved successfully)
        showError(
          R.string.profile_foreign_address_blocked ||
          'Grunnupplýsingar vistaðar, en erlent heimilisfang er ekki virkt ennþá. Vinsamlegast reyndu aftur síðar.'
        );

        // Re-enable buttons so user can try again
        editElements.btnSave.disabled = false;
        editElements.btnCancel.disabled = false;
        if (saveText) {
          saveText.textContent = R.string.profile_save_button || 'Vista breytingar';
        }

        return; // Don't exit edit mode, let user try again
      }
    }

    // Success! Update UI to reflect saved changes
    if (updates.name) editElements.valueName.textContent = updates.name;
    if (updates.email) editElements.valueEmail.textContent = updates.email;
    if (updates.phone) editElements.valuePhone.textContent = formatPhone(updates.phone) || updates.phone;

    // Show success message
    showSuccess(R.string.profile_save_success || 'Upplýsingar uppfærðar!');

    // Exit edit mode
    isEditing = false;
    document.body.classList.remove('profile-editing');
    editElements.btnEdit.style.display = 'inline-block';
    editElements.btnSave.style.display = 'none';
    editElements.btnCancel.style.display = 'none';

    // Show values, hide inputs
    document.querySelectorAll('.profile-edit__value').forEach(el => {
      el.style.display = 'block';
    });
    document.querySelectorAll('.profile-edit__input-wrapper').forEach(el => {
      el.style.display = 'none';
    });

  } catch (error) {
    console.error('Save failed:', error);

    // Revert UI to original values (Firestore already rolled back by shared client)
    editElements.valueName.textContent = originalData.name;
    editElements.valueEmail.textContent = originalData.email;
    editElements.valuePhone.textContent = originalData.phone;

    showError('Villa við vistun í Django. Breytingar voru ekki vistaðar. Reyndu aftur.');
  } finally {
    // Re-enable buttons
    editElements.btnSave.disabled = false;
    editElements.btnCancel.disabled = false;
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
  const currentPhone = editElements.inputPhone.value.trim();

  return (
    currentName !== originalData.name ||
    currentEmail !== originalData.email ||
    currentPhone !== originalData.phone
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
  }, 5000);
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

    // Save user data for edit functions
    currentUserData = userData;

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

    // Initialize edit functionality
    initEditElements();

    // Populate country dropdown for foreign address form
    populateCountryDropdown();

    // Setup living status radio button listeners
    setupLivingStatusListeners();

    // Update profile-specific UI
    updateProfileStrings();
    updateUserInfo(userData, memberData);
    updateAddressInfo(memberData);

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
