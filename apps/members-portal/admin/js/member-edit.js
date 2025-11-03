/**
 * Member Edit Page - Epic #116, Issue #137
 *
 * Allows admins to edit member information via Django API.
 * Uses Cloud Function to securely access Django API token.
 */

import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getMemberByDjangoId, updateMember, validateMemberData } from './django-api.js';
import { formatPhone, maskKennitala, validatePhone } from '../../js/utils/format.js';
import { createMemberPageStates } from './utils/ui-states.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

// Global i18n storage
const adminStrings = new Map();

(function() {
  'use strict';

  // State
  let currentKennitala = null;
  let djangoId = null;
  let memberData = null;
  let isSaving = false;

  // DOM Elements
  const elements = {
    loading: null,
    error: null,
    notFound: null,
    formContainer: null,
    form: null,
    errorMessage: null,
    btnRetry: null,
    btnSave: null,
    btnCancel: null,
    formErrors: null,
    successMessage: null
  };

  // UI State Manager
  let uiStates = null;

  // Initialize page
  async function init() {
    // Initialize DOM elements
    initElements();

    // Initialize UI state manager (use formContainer as content)
    uiStates = createMemberPageStates({
      ...elements,
      details: elements.formContainer
    });

    // Load i18n strings early
    await loadStrings();

    // Get kennitala from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentKennitala = urlParams.get('id');

    if (!currentKennitala) {
      // No kennitala in URL - redirect to members list
      window.location.href = '/admin/members.html';
      return;
    }

    // Check authentication
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = '/login.html';
        return;
      }

      // Check admin or developer role
      const token = await user.getIdTokenResult();
      const roles = token.claims.roles || [];
      const hasAdminAccess = roles.includes('admin') || roles.includes('superuser');

      if (!hasAdminAccess) {
        uiStates.showError(adminStrings.get('error_permission_denied'));
        return;
      }

      // Set up event listeners
      setupEventListeners();

      // Load member data
      await loadMemberData();
    });
  }

  // Initialize DOM element references
  function initElements() {
    elements.loading = document.getElementById('member-loading');
    elements.error = document.getElementById('member-error');
    elements.notFound = document.getElementById('member-not-found');
    elements.formContainer = document.getElementById('member-form-container');
    elements.form = document.getElementById('member-edit-form');
    elements.errorMessage = document.getElementById('member-error-message');
    elements.btnRetry = document.getElementById('btn-retry');
    elements.btnSave = document.getElementById('btn-save');
    elements.btnCancel = document.getElementById('btn-cancel');
    elements.formErrors = document.getElementById('form-errors');
    elements.successMessage = document.getElementById('success-message');
  }

  // Load i18n strings
  async function loadStrings() {
    try {
      const response = await fetch('/admin/i18n/values-is/strings.xml');
      if (!response.ok) {
        console.warn('Could not load admin i18n strings');
        return;
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const stringElements = xmlDoc.getElementsByTagName('string');

      const R = { string: {} };
      for (const el of stringElements) {
        const name = el.getAttribute('name');
        const value = el.textContent;
        if (name) {
          R.string[name] = value;
          adminStrings.set(name, value);
        }
      }

      // Apply strings to DOM
      applyStrings(R);
    } catch (error) {
      console.warn('Error loading i18n strings:', error);
    }
  }

  // Apply i18n strings to DOM elements
  function applyStrings(R) {
    if (!R || !R.string) return;

    // Navigation (reuse from common)
    const navBrand = document.getElementById('nav-brand');
    if (navBrand) navBrand.textContent = R.string.app_name || 'Ekklesia';

    // Page strings
    const pageTitle = document.getElementById('page-header-title');
    if (pageTitle) pageTitle.textContent = R.string.member_edit_title || 'Breyta félaga';

    const pageSubtitle = document.getElementById('page-header-subtitle');
    if (pageSubtitle) pageSubtitle.textContent = R.string.member_edit_subtitle || 'Uppfæra upplýsingar um félaga';

    // Button strings
    const btnSaveText = document.getElementById('btn-save-text');
    if (btnSaveText) btnSaveText.textContent = R.string.member_edit_save_button || 'Vista breytingar';

    const btnCancelText = document.getElementById('btn-cancel-text');
    if (btnCancelText) btnCancelText.textContent = R.string.member_edit_cancel_button || 'Hætta við';

    // Section titles
    const sectionBasic = document.getElementById('section-basic-info');
    if (sectionBasic) sectionBasic.textContent = R.string.member_detail_basic_info || 'Grunnupplýsingar';

    const sectionAddress = document.getElementById('section-address');
    if (sectionAddress) sectionAddress.textContent = R.string.member_detail_address || 'Heimilisfang';

    // Field labels - use existing strings or defaults
    setText('label-name', R.string.member_edit_field_name || 'Nafn *');
    setText('label-kennitala', R.string.member_kennitala || 'Kennitala');
    setText('label-email', R.string.member_edit_field_email || 'Netfang');
    setText('label-phone', R.string.member_edit_field_phone || 'Sími');
    setText('label-birthday', R.string.member_edit_field_birthday || 'Fæðingardagur');
    setText('label-gender', R.string.member_edit_field_gender || 'Kyn');
    setText('label-street', R.string.member_edit_field_street || 'Gata');
    setText('label-number', R.string.member_edit_field_number || 'Númer');
    setText('label-postal-code', R.string.member_edit_field_postal_code || 'Póstnúmer');
    setText('label-city', R.string.member_edit_field_city || 'Staður');

    // Gender options
    const optionM = document.getElementById('option-gender-m');
    if (optionM) optionM.textContent = R.string.member_edit_field_gender_m || 'Karl';

    const optionF = document.getElementById('option-gender-f');
    if (optionF) optionF.textContent = R.string.member_edit_field_gender_f || 'Kona';

    const optionX = document.getElementById('option-gender-x');
    if (optionX) optionX.textContent = R.string.member_edit_field_gender_x || 'Annað';

    // Readonly note
    const readonlyNote = document.getElementById('readonly-note');
    if (readonlyNote) readonlyNote.textContent = R.string.member_edit_readonly_note || '* Kennitala og ID er ekki hægt að breyta';
  }

  // Set up event listeners
  function setupEventListeners() {
    // Form submit
    elements.form?.addEventListener('submit', handleFormSubmit);

    // Cancel button
    elements.btnCancel?.addEventListener('click', handleCancel);

    // Retry button
    elements.btnRetry?.addEventListener('click', () => {
      loadMemberData();
    });

    // Back to detail link
    const backToDetail = document.getElementById('back-to-detail');
    backToDetail?.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = `/admin/member-detail.html?id=${currentKennitala}`;
    });

    // Logout
    const navLogout = document.getElementById('nav-logout');
    navLogout?.addEventListener('click', async (e) => {
      e.preventDefault();
      await auth.signOut();
      window.location.href = '/login.html';
    });

    // Real-time validation
    const inputs = elements.form?.querySelectorAll('input, select');
    inputs?.forEach(input => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        // Clear error on input
        const errorElement = document.getElementById(`error-${input.name}`);
        if (errorElement) {
          errorElement.classList.remove('visible');
          input.classList.remove('error');
        }
      });
    });
  }

  // Load member data from Firestore and Django
  async function loadMemberData() {
    uiStates.showLoading();

    try {
      // CRITICAL FIX (Issue #166): Normalize kennitala (remove hyphen) before using as document ID
      const kennitalaNoHyphen = currentKennitala.replace(/-/g, '');

      // First, get Django ID from Firestore
      const docRef = doc(db, 'members', kennitalaNoHyphen);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        uiStates.show('notFound');
        return;
      }

      const firestoreData = docSnap.data();
      djangoId = firestoreData.metadata?.django_id;

      if (!djangoId) {
        console.error('No Django ID found for member');
        uiStates.showError(adminStrings.get('member_edit_missing_django_id'));
        return;
      }

      // Then, get full data from Django API
      memberData = await getMemberByDjangoId(djangoId);

      // Populate form
      populateForm(memberData);
      uiStates.showContent();

    } catch (error) {
      console.error('Error loading member:', error);
      uiStates.showError(`${adminStrings.get('member_edit_loading_error')}: ${error.message}`);
    }
  }

  // Populate form with member data
  function populateForm(data) {
    // Basic info
    setValue('input-name', data.name);
    setValue('input-kennitala', maskKennitala(data.ssn || currentKennitala));
    setValue('input-email', data.contact_info?.email);
    // Format phone for display (XXX-XXXX)
    setValue('input-phone', formatPhone(data.contact_info?.phone));
    setValue('input-birthday', data.birthday);
    setValue('input-gender', data.gender);

    // Address
    setValue('input-street', data.local_address?.street);
    setValue('input-number', data.local_address?.number);
    setValue('input-postal-code', data.local_address?.postal_code);
    setValue('input-city', data.local_address?.city);
  }

  // Handle form submission
  async function handleFormSubmit(e) {
    e.preventDefault();

    if (isSaving) return;

    // Clear previous errors
    clearFormErrors();
    hideSuccess();

    // Validate all fields
    const isValid = validateAllFields();
    if (!isValid) {
      showFormError(adminStrings.get('member_edit_validation_error'));
      return;
    }

    // Collect form data
    const formData = collectFormData();

    // Validate with django-api validator
    const validation = validateMemberData(formData);
    if (!validation.valid) {
      showFormErrors(validation.errors);
      return;
    }

    // Save to Django API
    isSaving = true;
    setSavingState(true);

    try {
      const updatedData = await updateMember(djangoId, formData);
      console.log('Member updated successfully:', updatedData);

      // Show success message
      showSuccess();

      // Redirect to detail page after 2 seconds
      setTimeout(() => {
        window.location.href = `/admin/member-detail.html?id=${currentKennitala}`;
      }, 2000);

    } catch (error) {
      console.error('Error saving member:', error);
      showFormError(`${adminStrings.get('member_edit_error')}: ${error.message}`);
    } finally {
      isSaving = false;
      setSavingState(false);
    }
  }

  // Collect form data
  function collectFormData() {
    const formData = {};

    // Basic info
    const name = getValue('input-name');
    if (name) formData.name = name;

    const birthday = getValue('input-birthday');
    if (birthday) formData.birthday = birthday;

    const gender = getValue('input-gender');
    if (gender !== '') formData.gender = parseInt(gender, 10);  // Convert to integer (allow 0)

    // Contact info
    const email = getValue('input-email');
    const phone = getValue('input-phone');
    if (email || phone) {
      formData.contact_info = {};
      if (email) formData.contact_info.email = email;
      // Remove dashes from phone before saving to Django
      if (phone) formData.contact_info.phone = phone.replace(/-/g, '');
    }

    // Address - Skip for now (complex nested model)
    // TODO: Implement local_address update via Django admin API
    // const street = getValue('input-street');
    // const number = getValue('input-number');
    // const postal_code = getValue('input-postal-code');
    // const city = getValue('input-city');

    return formData;
  }

  // Validate all form fields
  function validateAllFields() {
    const inputs = elements.form.querySelectorAll('input:not([readonly]), select');
    let isValid = true;

    inputs.forEach(input => {
      if (!validateField(input)) {
        isValid = false;
      }
    });

    return isValid;
  }

  // Validate single field
  function validateField(input) {
    const name = input.name;
    const value = input.value.trim();
    const errorElement = document.getElementById(`error-${name}`);

    if (!errorElement) return true;

    let errorMessage = '';

    // Required field validation
    if (input.hasAttribute('required') && !value) {
      errorMessage = adminStrings.get('validation_required');
    }

    // Email validation
    if (name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errorMessage = adminStrings.get('validation_invalid_email');
    }

    // Phone validation (use shared utility - accepts various formats)
    if (name === 'phone' && value && !validatePhone(value)) {
      errorMessage = adminStrings.get('validation_invalid_phone');
    }

    // Postal code validation
    if (name === 'postal_code' && value && !/^[0-9]{3}$/.test(value)) {
      errorMessage = adminStrings.get('validation_invalid_postal_code');
    }

    if (errorMessage) {
      errorElement.textContent = errorMessage;
      errorElement.classList.add('visible');
      input.classList.add('error');
      return false;
    } else {
      errorElement.classList.remove('visible');
      input.classList.remove('error');
      return true;
    }
  }

  // Handle cancel button
  function handleCancel(e) {
    e.preventDefault();
    if (confirm(adminStrings.get('member_edit_cancel_confirm'))) {
      window.location.href = `/admin/member-detail.html?id=${currentKennitala}`;
    }
  }

  // Helper: Set input value
  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  // Helper: Get input value
  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  // Helper: Set text content
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Clear all form errors
  function clearFormErrors() {
    const errorElements = elements.form?.querySelectorAll('.member-edit__error-text');
    errorElements?.forEach(el => el.classList.remove('visible'));

    const inputs = elements.form?.querySelectorAll('input, select');
    inputs?.forEach(input => input.classList.remove('error'));

    elements.formErrors.style.display = 'none';
    elements.formErrors.innerHTML = '';
  }

  // Show form error
  function showFormError(message) {
    elements.formErrors.innerHTML = `<p>${message}</p>`;
    elements.formErrors.style.display = 'block';
  }

  // Show multiple form errors
  function showFormErrors(errors) {
    elements.formErrors.innerHTML = '<ul>' + errors.map(err => `<li>${err}</li>`).join('') + '</ul>';
    elements.formErrors.style.display = 'block';
  }

  // Show success message
  function showSuccess() {
    elements.successMessage.style.display = 'block';
  }

  // Hide success message
  function hideSuccess() {
    elements.successMessage.style.display = 'none';
  }

  // Set saving state
  function setSavingState(saving) {
    const btnSaveText = document.getElementById('btn-save-text');
    if (saving) {
      elements.btnSave.disabled = true;
      elements.btnCancel.disabled = true;
      if (btnSaveText) btnSaveText.textContent = adminStrings.get('member_edit_saving');
    } else {
      elements.btnSave.disabled = false;
      elements.btnCancel.disabled = false;
      if (btnSaveText) btnSaveText.textContent = adminStrings.get('member_edit_save_button');
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
