/**
 * Profile Page Logic
 *
 * User profile page displaying personal information and membership status.
 * Reads from Cloud SQL (source of truth) via getMemberSelf Cloud Function.
 * Writes via updatememberprofile Cloud Function.
 *
 * Module cleanup not needed - page reloads on navigation.
 *
 * @module profile
 */

import { R } from '../i18n/strings-loader.js';
import { initAuthenticatedPage } from './page-init.js';
import { requireAuth, getUserData, signOut, AuthenticationError } from '../session/auth.js';
import { httpsCallable } from '../firebase/app.js';
import { setTextContent, validateElements } from '../ui/dom.js';
import { el } from './utils/util-dom.js';
import { formatPhone, validatePhone, formatInternationalPhone, validateInternationalPhone, validateInternationalPostalCode, formatMembershipDuration, formatDateOnlyIcelandic } from './utils/util-format.js';
import { getCountryName, getCountriesSorted, searchCountries, getCountryFlag, getCountryCallingCode } from './utils/util-countries.js';
import { debug } from './utils/util-debug.js';
import { showToast } from './components/ui-toast.js';
import { showStatus } from './components/ui-status.js';
import { showModal } from './components/ui-modal.js';
import { SearchableSelect } from './components/ui-searchable-select.js';
import { PhoneManager } from './profile/phone-manager.js';
import { AddressManager } from './profile/address-manager.js';
import { migrateOldPhoneFields, migrateOldAddressFields } from './profile/migration.js';
import { getUnions, getJobTitles } from './api/api-lookups.js';

/**
 * Constants
 */
const REGION = 'europe-west2';
const MAX_NAME_LENGTH = 100;
const SUCCESS_MESSAGE_AUTO_HIDE_MS = 5000;

// Cloud Functions
const getMemberSelfFn = httpsCallable('getMemberSelf', REGION);
const updateMemberProfileFn = httpsCallable('updatememberprofile', REGION);
const updateEmailPreferencesFn = httpsCallable('updateEmailPreferences', REGION);

/**
 * Required DOM elements for profile page
 */
const PROFILE_ELEMENTS = [
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
 * State
 */
let originalData = null;
let currentUserData = null;
let phoneManager = null;
let addressManager = null;

/**
 * Edit mode DOM elements
 */
const editElements = {
  inputName: null,
  inputEmail: null,
  successMessage: null,
  errorMessage: null
};

/**
 * Validate profile page DOM structure
 */
function validateProfilePage() {
  validateElements(PROFILE_ELEMENTS, 'profile page');
}

/**
 * Update profile page strings from i18n
 */
function updateProfileStrings() {
  document.title = R.string.page_title_profile;
  setTextContent('section-personal-info', R.string.section_personal_info, 'profile page');
  setTextContent('membership-title', R.string.membership_title, 'profile page');
  setTextContent('membership-status', R.string.membership_loading, 'profile page');
  setTextContent('label-name', R.string.label_name, 'profile page');
  setTextContent('label-kennitala', R.string.label_kennitala, 'profile page');
  setTextContent('label-email', R.string.label_email, 'profile page');

  // Phone numbers label
  const phoneLabel = document.getElementById('label-phone-numbers');
  if (phoneLabel) {
    const expandIcon = phoneLabel.querySelector('.expand-icon');
    phoneLabel.textContent = R.string.label_phone_numbers || R.string.label_phone;
    if (expandIcon) phoneLabel.appendChild(expandIcon);
  }

  // Addresses label
  const addressLabel = document.getElementById('label-addresses');
  if (addressLabel) {
    const expandIcon = addressLabel.querySelector('.expand-icon');
    addressLabel.textContent = R.string.label_addresses;
    if (expandIcon) addressLabel.appendChild(expandIcon);
  }

  setTextContent('label-status', R.string.label_status, 'profile page');
  setTextContent('label-django-id', R.string.label_django_id, 'profile page');
  setTextContent('label-date-joined', R.string.label_date_joined, 'profile page');
  setTextContent('label-member-since', R.string.label_member_since, 'profile page');
  setTextContent('label-uid', R.string.label_uid, 'profile page');
  setTextContent('btn-add-phone-text', R.string.btn_add_phone_text, 'profile page');
  setTextContent('btn-add-address-text', R.string.btn_add_address_text, 'profile page');

  // Communication preferences
  setTextContent('section-communication', R.string.section_communication || 'Samskiptastillingar', 'profile page');
  setTextContent('label-reachable', R.string.label_reachable || 'Má hafa samband', 'profile page');
  setTextContent('label-reachable-description', R.string.label_reachable_description || 'Leyfir flokknum að hafa samband vegna frétta og atburða', 'profile page');
  setTextContent('label-groupable', R.string.label_groupable || 'Má bæta í hópa', 'profile page');
  setTextContent('label-groupable-description', R.string.label_groupable_description || 'Leyfir flokknum að bæta þér í vinnuhópa og póstlista', 'profile page');
  setTextContent('label-email-marketing', R.string.label_email_marketing || 'Fá fjöldapóst', 'profile page');
  setTextContent('label-email-marketing-description', R.string.label_email_marketing_description || 'Fá tölvupóst um fréttir, viðburði og atkvæðagreiðslur', 'profile page');
}

/**
 * Format field value with placeholder
 */
export function formatFieldValue(value, placeholder) {
  return value || placeholder;
}

/**
 * Format membership status
 */
export function formatMembershipStatus(status) {
  switch (status) {
    case 'active':
      return { text: R.string.membership_active, color: 'var(--color-success-text)' };
    case 'unpaid':
      return { text: R.string.membership_unpaid, color: 'var(--color-warning-text, #b45309)' };
    case 'inactive':
    default:
      return { text: R.string.membership_inactive, color: 'var(--color-burgundy)' };
  }
}

/**
 * Update user information in UI
 */
function updateUserInfo(userData, memberData = null) {
  const placeholder = R.string.placeholder_not_available;

  // Kennitala (read-only)
  setTextContent('value-kennitala', formatFieldValue(userData.kennitala, placeholder), 'profile page');

  // Django ID
  const djangoId = memberData?.metadata?.django_id || memberData?.django_id;
  setTextContent('value-django-id', djangoId ? `#${djangoId}` : placeholder, 'profile page');

  // Date joined
  const dateJoined = memberData?.membership?.date_joined || memberData?.date_joined;
  if (dateJoined) {
    const joinedDate = typeof dateJoined === 'string' ? new Date(dateJoined) : dateJoined;
    setTextContent('value-date-joined', formatDateOnlyIcelandic(joinedDate), 'profile page');
    setTextContent('value-member-since', formatMembershipDuration(joinedDate), 'profile page');
  } else {
    setTextContent('value-date-joined', placeholder, 'profile page');
    setTextContent('value-member-since', placeholder, 'profile page');
  }

  // UID
  setTextContent('value-uid', formatFieldValue(userData.uid, placeholder), 'profile page');

  // Cloud SQL source of truth indicator
  const syncedAtEl = document.getElementById('value-synced-at');
  if (syncedAtEl) {
    syncedAtEl.textContent = 'Cloud SQL (source of truth)';
  }
}

/**
 * Update membership status display
 */
function updateMembershipStatus(membershipStatus) {
  const membershipElement = document.getElementById('membership-status');
  if (!membershipElement) return;

  membershipElement.style.color = '';

  // Check for soft-delete
  const membership = currentUserData?.membership || {};
  if (membership.deleted_at) {
    const deletedDate = typeof membership.deleted_at === 'string'
      ? new Date(membership.deleted_at)
      : membership.deleted_at;
    const formattedDate = formatDateOnlyIcelandic(deletedDate);
    membershipElement.innerHTML = `<span class="admin-badge admin-badge--error">Eytt ${formattedDate}</span>`;
    return;
  }

  switch (membershipStatus) {
    case 'active':
      membershipElement.innerHTML = `<span class="admin-badge admin-badge--success">${R.string.membership_badge_active}</span>`;
      break;
    case 'unpaid':
      membershipElement.innerHTML = `<span class="admin-badge admin-badge--warning">${R.string.membership_badge_unpaid}</span>`;
      break;
    case 'inactive':
    default:
      membershipElement.innerHTML = `<span class="admin-badge admin-badge--inactive">${R.string.membership_badge_inactive}</span>`;
      break;
  }
}

/**
 * Initialize edit DOM elements
 */
function initEditElements() {
  editElements.inputName = document.getElementById('input-name');
  editElements.inputEmail = document.getElementById('input-email');
  editElements.successMessage = document.getElementById('profile-success');
  editElements.errorMessage = document.getElementById('profile-error');
}

/**
 * Populate input fields with current data
 */
function populateInputFields() {
  const profile = currentUserData?.profile || {};

  originalData = {
    name: profile.name || currentUserData?.name || '',
    email: profile.email || currentUserData?.email || ''
  };

  editElements.inputName.value = originalData.name;
  editElements.inputEmail.value = originalData.email;

  // Birthday
  const birthdayInput = document.getElementById('input-birthday');
  if (birthdayInput && profile.birthday) {
    const birthday = profile.birthday;
    if (typeof birthday === 'string') {
      birthdayInput.value = birthday.split('T')[0];
    }
  }

  // Gender
  const genderInput = document.getElementById('input-gender');
  if (genderInput && profile.gender !== undefined && profile.gender !== null) {
    genderInput.value = profile.gender.toString();
  }
}

/**
 * Save a field to Cloud SQL via Cloud Function
 */
async function saveProfileField(fieldName, value, statusElement) {
  try {
    debug.log(`💾 Saving ${fieldName}:`, value);
    showStatus(statusElement, 'loading', { baseClass: 'profile-field__status' });

    // Map field names
    const fieldMapping = {
      'name': 'name',
      'email': 'email',
      'phone': 'phone',
      'reachable': 'reachable',
      'groupable': 'groupable',
      'gender': 'gender',
      'birthday': 'birthday',
      'housing_situation': 'housing_situation'
    };

    const djangoFieldName = fieldMapping[fieldName];
    if (!djangoFieldName) {
      debug.log(`ℹ️ Field ${fieldName} not mapped`);
      showStatus(statusElement, 'success', { baseClass: 'profile-field__status' });
      return;
    }

    // Save via Cloud Function
    const result = await updateMemberProfileFn({
      kennitala: currentUserData.kennitala,
      updates: { [djangoFieldName]: value }
    });

    debug.log(`✅ Cloud SQL update result:`, result.data);

    // Update local state
    if (!currentUserData.profile) currentUserData.profile = {};
    currentUserData.profile[fieldName] = value;

    showStatus(statusElement, 'success', { baseClass: 'profile-field__status' });
    showToast(R.string.profile_autosave_success || 'Vistað', 'success');

  } catch (error) {
    debug.error(`❌ Error saving ${fieldName}:`, error);
    showStatus(statusElement, 'error', { baseClass: 'profile-field__status' });
    showToast(R.string.profile_autosave_error || 'Villa við vistun', 'error');
  }
}

/**
 * Save a membership field to Cloud SQL via Cloud Function
 */
async function saveMembershipField(fieldName, value, statusElement) {
  try {
    debug.log(`💾 Saving membership.${fieldName}:`, value);
    showStatus(statusElement, 'loading', { baseClass: 'profile-field__status' });

    const result = await updateMemberProfileFn({
      kennitala: currentUserData.kennitala,
      updates: { [fieldName]: value }
    });

    debug.log(`✅ Cloud SQL update result:`, result.data);

    // Update local state
    if (!currentUserData.membership) currentUserData.membership = {};
    currentUserData.membership[fieldName] = value;

    showStatus(statusElement, 'success', { baseClass: 'profile-field__status' });
    showToast(R.string.profile_autosave_success || 'Vistað', 'success');

  } catch (error) {
    debug.error(`❌ Error saving membership.${fieldName}:`, error);
    showStatus(statusElement, 'error', { baseClass: 'profile-field__status' });
    showToast(R.string.profile_autosave_error || 'Villa við vistun', 'error');
  }
}

/**
 * Show field status indicator
 */
function showFieldStatus(fieldName, status) {
  const statusEl = document.getElementById(`status-${fieldName}`);
  if (!statusEl) return;

  statusEl.classList.remove(
    'profile-field__status--loading',
    'profile-field__status--success',
    'profile-field__status--error'
  );

  if (status) {
    statusEl.classList.add(`profile-field__status--${status}`);
  }
}

/**
 * Clear field error
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
 * Show field error
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
 * Auto-save a single field
 */
async function autoSaveField(fieldName, newValue) {
  const originalValue = originalData[fieldName] || '';

  if (newValue === originalValue) {
    return;
  }

  // Validation
  if (fieldName === 'name' && !newValue.trim()) {
    showFieldError('name', R.string.validation_name_required);
    return;
  }

  if (fieldName === 'email' && newValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newValue)) {
    showFieldError('email', R.string.validation_email_invalid);
    return;
  }

  clearFieldError(fieldName);
  showFieldStatus(fieldName, 'loading');

  try {
    const result = await updateMemberProfileFn({
      kennitala: currentUserData.kennitala,
      updates: { [fieldName]: newValue }
    });

    originalData[fieldName] = newValue;
    showFieldStatus(fieldName, 'success');

  } catch (error) {
    debug.error(`Auto-save failed for ${fieldName}:`, error);
    showFieldStatus(fieldName, 'error');
    showToast(R.string.profile_autosave_error, 'error');
  }
}

/**
 * Setup auto-save listeners
 */
function setupAutoSaveListeners() {
  const fields = ['name', 'email'];

  fields.forEach(fieldName => {
    const inputEl = document.getElementById(`input-${fieldName}`);
    const saveBtn = document.getElementById(`save-${fieldName}`);
    if (!inputEl) return;

    inputEl.addEventListener('blur', (e) => {
      autoSaveField(fieldName, e.target.value.trim());
    });

    inputEl.addEventListener('focus', () => {
      showFieldStatus(fieldName, '');
    });

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        inputEl.blur();
        showFieldStatus(fieldName, 'success');
      });
    }
  });

  // Birthday
  const birthdayInput = document.getElementById('input-birthday');
  const birthdayStatus = document.getElementById('status-birthday');
  const birthdaySaveBtn = document.getElementById('save-birthday');
  if (birthdayInput) {
    birthdayInput.addEventListener('change', (e) => {
      if (e.target.value) {
        saveProfileField('birthday', e.target.value, birthdayStatus);
      }
    });

    if (birthdaySaveBtn) {
      birthdaySaveBtn.addEventListener('click', () => {
        if (birthdayInput.value) {
          saveProfileField('birthday', birthdayInput.value, birthdayStatus);
        }
      });
    }
  }

  // Gender
  const genderInput = document.getElementById('input-gender');
  const genderStatus = document.getElementById('status-gender');
  const genderSaveBtn = document.getElementById('save-gender');
  if (genderInput) {
    genderInput.addEventListener('change', (e) => {
      const genderValue = e.target.value !== '' ? parseInt(e.target.value) : null;
      saveProfileField('gender', genderValue, genderStatus);
    });

    if (genderSaveBtn) {
      genderSaveBtn.addEventListener('click', () => {
        const genderValue = genderInput.value !== '' ? parseInt(genderInput.value) : null;
        saveProfileField('gender', genderValue, genderStatus);
      });
    }
  }
}

/**
 * Update simple phone display
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

  const flag = getCountryFlag(defaultPhone.country);
  const callingCode = getCountryCallingCode(defaultPhone.country);
  simpleDisplay.textContent = `${flag} ${callingCode} ${defaultPhone.number}`;
}

/**
 * Update simple address display
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
 * Initialize communication preferences
 */
function initCommunicationPreferences() {
  const profile = currentUserData?.profile || {};

  // Reachable toggle
  const reachableInput = document.getElementById('input-reachable');
  const reachableStatus = document.getElementById('status-reachable');

  if (reachableInput) {
    reachableInput.checked = profile.reachable !== false;

    reachableInput.addEventListener('change', async (e) => {
      const newValue = e.target.checked;
      debug.log(`📞 Reachable changed: ${newValue}`);

      try {
        await saveProfileField('reachable', newValue, reachableStatus);
      } catch (error) {
        reachableInput.checked = !newValue;
      }
    });
  }

  // Groupable toggle
  const groupableInput = document.getElementById('input-groupable');
  const groupableStatus = document.getElementById('status-groupable');

  if (groupableInput) {
    groupableInput.checked = profile.groupable !== false;

    groupableInput.addEventListener('change', async (e) => {
      const newValue = e.target.checked;
      debug.log(`👥 Groupable changed: ${newValue}`);

      try {
        await saveProfileField('groupable', newValue, groupableStatus);
      } catch (error) {
        groupableInput.checked = !newValue;
      }
    });
  }

  // Email marketing toggle
  const emailMarketingInput = document.getElementById('input-email-marketing');
  const emailMarketingStatus = document.getElementById('status-email-marketing');

  if (emailMarketingInput) {
    // Default to true
    emailMarketingInput.checked = currentUserData?.preferences?.email_marketing !== false;

    emailMarketingInput.addEventListener('change', async (e) => {
      const newValue = e.target.checked;
      debug.log(`📧 Email marketing changed: ${newValue}`);

      showStatus(emailMarketingStatus, 'loading', { baseClass: 'profile-field__status' });
      try {
        // Email marketing is stored in Cloud SQL via dedicated function
        await updateEmailPreferencesFn({
          email_marketing: newValue
        });

        if (!currentUserData.preferences) currentUserData.preferences = {};
        currentUserData.preferences.email_marketing = newValue;

        showStatus(emailMarketingStatus, 'success', { baseClass: 'profile-field__status' });
        showToast(R.string.profile_preferences_saved || 'Stillingar vistaðar', 'success');
      } catch (error) {
        debug.error('Failed to save email marketing preference:', error);
        showStatus(emailMarketingStatus, 'error', { baseClass: 'profile-field__status' });
        emailMarketingInput.checked = !newValue;
      }
    });
  }

  debug.log('✅ Communication preferences initialized');
}

/**
 * Initialize membership details (cell, union, title, housing)
 */
async function initMembershipDetails() {
  const profile = currentUserData?.profile || {};
  const membership = currentUserData?.membership || {};

  // Cell (readonly)
  const cellValue = document.getElementById('value-cell');
  if (cellValue) {
    const address = currentUserData?.address || {};
    cellValue.textContent = address.municipality || membership.cell || '-';
  }

  // Union dropdown
  const unionSelect = document.getElementById('input-union');
  const unionStatus = document.getElementById('status-union');
  if (unionSelect) {
    try {
      const unions = await getUnions();
      unionSelect.innerHTML = `<option value="">${R.string.profile_select_union_placeholder || 'Veldu stéttarfélag...'}</option>`;
      unions.forEach(union => {
        const option = document.createElement('option');
        option.value = union.id;
        option.textContent = union.name;
        unionSelect.appendChild(option);
      });

      // Select current union
      const currentUnions = membership.unions || currentUserData?.unions || [];
      if (currentUnions.length > 0) {
        const firstUnion = currentUnions[0];
        unionSelect.value = firstUnion.id || firstUnion;
      }

      unionSelect.addEventListener('change', async (e) => {
        const unionId = e.target.value ? parseInt(e.target.value) : null;
        const unionName = e.target.selectedOptions[0]?.textContent || '';
        const unionValue = unionId ? [{ id: unionId, name: unionName }] : [];
        await saveMembershipField('unions', unionValue, unionStatus);
      });
    } catch (error) {
      debug.error('Failed to load unions:', error);
    }
  }

  // Job Title dropdown
  const titleSelect = document.getElementById('input-title');
  const titleStatus = document.getElementById('status-title');
  if (titleSelect) {
    try {
      const titles = await getJobTitles();
      titleSelect.innerHTML = `<option value="">${R.string.uppstilling_select_job_title || 'Veldu starfsheiti...'}</option>`;
      titles.forEach(title => {
        const option = document.createElement('option');
        option.value = title.id;
        option.textContent = title.name;
        titleSelect.appendChild(option);
      });

      // Select current title
      const currentTitles = membership.titles || currentUserData?.titles || [];
      if (currentTitles.length > 0) {
        const firstTitle = currentTitles[0];
        titleSelect.value = firstTitle.id || firstTitle;
      }

      titleSelect.addEventListener('change', async (e) => {
        try {
          const titleId = e.target.value ? parseInt(e.target.value) : null;
          const titleName = e.target.selectedOptions[0]?.textContent || '';
          const titleValue = titleId ? [{ id: titleId, name: titleName }] : [];
          await saveMembershipField('titles', titleValue, titleStatus);
        } catch (error) {
          debug.error('Failed to save title:', error);
        }
      });
    } catch (error) {
      debug.error('Failed to load job titles:', error);
    }
  }

  // Housing situation
  const housingSelect = document.getElementById('input-housing');
  const housingStatus = document.getElementById('status-housing');
  if (housingSelect) {
    if (profile.housing_situation !== undefined) {
      housingSelect.value = profile.housing_situation;
    }

    housingSelect.addEventListener('change', async (e) => {
      try {
        const housingValue = e.target.value !== '' ? parseInt(e.target.value) : null;
        await saveProfileField('housing_situation', housingValue, housingStatus);
      } catch (error) {
        debug.error('Failed to save housing situation:', error);
      }
    });
  }

  debug.log('✅ Membership details initialized');
}

/**
 * Initialize delete account button
 */
function initDeleteAccountButton() {
  const deleteBtn = document.getElementById('btn-delete-account');
  if (!deleteBtn) return;

  deleteBtn.addEventListener('click', () => {
    showDeleteAccountModal();
  });
}

/**
 * Show delete account confirmation modal
 */
function showDeleteAccountModal() {
  let modal = null;

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="modal__message">
      <p><strong>Ertu viss um að þú viljir eyða aðganginum þínum?</strong></p>
      <ul style="margin: 1rem 0; padding-left: 1.5rem; color: var(--color-text-muted);">
        <li>Þú verður ekki lengur sýnileg/ur í félagaskrá</li>
        <li>Þú getur ekki tekið þátt í kosningum</li>
        <li>Þú getur endurvakið aðganginn seinna</li>
      </ul>
      <p style="margin-top: 1rem;"><strong>Skrifaðu "EYÐA" til að staðfesta:</strong></p>
      <input type="text" id="confirm-delete-input" class="profile-field__input" placeholder="${R.string.profile_delete_confirm_placeholder || 'EYÐA'}" style="margin-top: 0.5rem; width: 100%;">
    </div>
  `;

  modal = showModal({
    title: '🗑️ Eyða aðgangi',
    content,
    size: 'md',
    buttons: [
      {
        text: 'Hætta við',
        onClick: () => modal.close()
      },
      {
        text: 'Eyða aðgangi',
        primary: false,
        onClick: async () => {
          await handleDeleteAccount(modal);
        }
      }
    ]
  });

  setTimeout(() => {
    const confirmInput = document.getElementById('confirm-delete-input');
    const buttons = modal.element.querySelectorAll('.modal__footer .btn');
    const confirmBtn = buttons[buttons.length - 1];

    if (confirmBtn) {
      confirmBtn.classList.remove('btn--secondary');
      confirmBtn.classList.add('btn--danger');
      confirmBtn.disabled = true;
    }

    if (confirmInput) {
      confirmInput.addEventListener('input', () => {
        const isValid = confirmInput.value.toUpperCase() === 'EYÐA';
        if (confirmBtn) confirmBtn.disabled = !isValid;
      });
      confirmInput.focus();
    }
  }, 100);
}

/**
 * Handle account deletion
 */
async function handleDeleteAccount(modal) {
  const confirmInput = document.getElementById('confirm-delete-input');
  if (!confirmInput || confirmInput.value.toUpperCase() !== 'EYÐA') {
    showToast(R.string('profile_delete_confirm_error'), 'error');
    return;
  }

  const buttons = modal.element.querySelectorAll('.modal__footer .btn');
  const cancelBtn = buttons[0];
  const confirmBtn = buttons[1];
  const originalText = confirmBtn?.textContent;

  try {
    debug.log('🗑️ Initiating soft delete...');

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `<span class="spinner spinner--small"></span> ${R.string.profile_deleting_account || 'Eyði...'}`;
    }
    if (cancelBtn) cancelBtn.disabled = true;
    if (confirmInput) confirmInput.disabled = true;

    const softDeleteSelf = httpsCallable('softDeleteSelf', REGION);
    const result = await softDeleteSelf({ confirmation: 'EYÐA' });

    debug.log('✅ Soft delete successful:', result);

    if (confirmBtn) {
      confirmBtn.innerHTML = `✅ ${R.string.profile_account_deleted || 'Eytt'}`;
      confirmBtn.classList.remove('btn--danger');
      confirmBtn.classList.add('btn--success');
    }

    showToast('Aðgangur þinn hefur verið gerður óvirkur', 'success');

    setTimeout(async () => {
      modal.close();
      await signOut();
      window.location.href = '/';
    }, 1500);

  } catch (error) {
    debug.error('❌ Soft delete failed:', error);

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }
    if (cancelBtn) cancelBtn.disabled = false;
    if (confirmInput) confirmInput.disabled = false;

    showToast(error.message || R.string.profile_delete_error, 'error');
  }
}

/**
 * Initialize profile page
 */
async function init() {
  debug.log('🚀 INIT FUNCTION STARTED');
  try {
    validateProfilePage();

    // Load i18n
    await R.load('is');
    R.translatePage();

    // Initialize page
    await initAuthenticatedPage();

    // Get authenticated user
    const currentUser = await requireAuth();
    const userData = await getUserData(currentUser);

    // Load member data from Cloud SQL via Cloud Function
    debug.log('📦 Loading member data from Cloud SQL...');
    let memberData = null;
    try {
      const result = await getMemberSelfFn();
      memberData = result.data.member;
      debug.log('📦 memberData from Cloud SQL:', memberData);
    } catch (error) {
      debug.error('Failed to load member data from Cloud SQL:', error);
      // Continue with userData only
    }

    // Merge into currentUserData
    currentUserData = {
      ...userData,
      ...memberData,
      kennitala: memberData?.kennitala || userData.kennitala,
      profile: memberData?.profile || {
        name: userData.displayName || '',
        email: userData.email || '',
        phone: userData.phoneNumber || ''
      },
      membership: memberData?.membership || {},
      metadata: memberData?.metadata || {},
      address: memberData?.address || {},
      unions: memberData?.unions || [],
      titles: memberData?.titles || [],
      preferences: memberData?.preferences || {}
    };

    // Initialize edit functionality
    initEditElements();
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

    // Initialize communication preferences
    initCommunicationPreferences();

    // Initialize membership details
    await initMembershipDetails();

    // Initialize delete account button
    initDeleteAccountButton();

    // Update UI
    updateProfileStrings();
    updateUserInfo(userData, memberData);
    populateInputFields();

    // Show membership status
    const membershipStatus = currentUserData?.membership?.status || currentUserData?.status || 'inactive';
    debug.log('📊 Membership status:', membershipStatus);
    updateMembershipStatus(membershipStatus);

  } catch (error) {
    if (error instanceof AuthenticationError) {
      window.location.href = error.redirectTo;
      return;
    }
    debug.error('Profile page initialization failed:', error);
  }
}

// Run initialization
init();
