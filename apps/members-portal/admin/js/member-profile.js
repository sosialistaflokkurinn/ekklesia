/**
 * Admin Member Profile Page
 * 
 * Unified view/edit page for member profiles in admin area.
 * Uses PhoneManager and AddressManager from profile refactoring.
 */

import { getFirebaseAuth, getFirebaseFirestore, httpsCallable, doc, getDoc, updateDoc, collection, query, where, getDocs } from '../../firebase/app.js';
import { R } from '../../i18n/strings-loader.js';
import { adminStrings } from './i18n/admin-strings-loader.js';
import { showToast } from '../../js/components/ui-toast.js';
import { showStatus } from '../../js/components/ui-status.js';
import { debug } from '../../js/utils/util-debug.js';
import { debounce } from '../../js/utils/util-debounce.js';
import { initSearchableSelects } from '../../js/components/ui-searchable-select.js';
import { requireAdmin } from '../../js/rbac.js';
// Note: initNavigation import removed - now handled by nav-header component
import { PhoneManager } from '../../js/profile/phone-manager.js';
import { AddressManager } from '../../js/profile/address-manager.js';
import { migrateOldPhoneFields, migrateOldAddressFields } from '../../js/profile/migration.js';
import { getUnions, getJobTitles, getHousingSituationLabel } from '../../js/api/api-lookups.js';
import { formatDateOnlyIcelandic, formatDateIcelandic, formatMembershipDuration } from '../../js/utils/util-format.js';

// Initialize Firebase
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

// Cloud Functions
const updateMemberProfileFunction = httpsCallable('updatememberprofile', 'europe-west2');

// Constants
const SEARCHABLE_SELECT_INIT_DELAY = 100; // ms to wait for DOM ready before initializing SearchableSelect
const AUTO_SAVE_SUCCESS_DURATION = 2000; // ms to show success status
const AUTO_SAVE_ERROR_DURATION = 3000; // ms to show error status

// State
let currentKennitala = null;
let currentDjangoId = null;  // For URL security - lookup by django_id instead of kennitala
let memberData = null;
let phoneManager = null;
let addressManager = null;

/**
 * Set all i18n strings on the page
 */
function setI18nStrings() {
  // Page title
  document.title = R.string.member_profile_page_title || 'Félagsupplýsingar - Ekklesia';

  // Navigation (back button)
  const backToMembersText = document.getElementById('back-to-members-text');
  if (backToMembersText) backToMembersText.textContent = R.string.back_to_members || 'Til baka til félaga';

  // Note: Page header removed - nav brand shows context

  // Loading state
  const memberLoadingText = document.getElementById('member-loading-text');
  if (memberLoadingText) memberLoadingText.textContent = R.string.member_loading_text || 'Hleð upplýsingum...';

  // Error state
  const btnRetry = document.getElementById('btn-retry');
  if (btnRetry) btnRetry.textContent = R.string.btn_retry || 'Reyna aftur';

  // Not found state
  const memberNotFoundMessage = document.getElementById('member-not-found-message');
  if (memberNotFoundMessage) memberNotFoundMessage.textContent = R.string.member_not_found_message || 'Félagi fannst ekki';

  const btnBackToMembers = document.getElementById('btn-back-to-members');
  if (btnBackToMembers) btnBackToMembers.textContent = R.string.back_to_members || 'Til baka til félaga';

  // Section titles
  const sectionPersonalInfo = document.getElementById('section-personal-info');
  if (sectionPersonalInfo) sectionPersonalInfo.textContent = R.string.section_personal_info || 'Grunnupplýsingar';

  const sectionMembership = document.getElementById('section-membership');
  if (sectionMembership) sectionMembership.textContent = R.string.section_membership || 'Félagsaðild';

  // Labels
  const labelName = document.getElementById('label-name');
  if (labelName) labelName.textContent = R.string.label_name || 'Nafn';

  const labelKennitala = document.getElementById('label-kennitala');
  if (labelKennitala) labelKennitala.textContent = R.string.label_kennitala || 'Kennitala';

  const labelEmail = document.getElementById('label-email');
  if (labelEmail) labelEmail.textContent = R.string.label_email || 'Netfang';

  const labelBirthday = document.getElementById('label-birthday');
  if (labelBirthday) labelBirthday.textContent = R.string.label_birthday || 'Fæðingardagur';

  const labelGender = document.getElementById('label-gender');
  if (labelGender) labelGender.textContent = R.string.label_gender || 'Kyn';

  const labelStatus = document.getElementById('label-status');
  if (labelStatus) labelStatus.textContent = R.string.label_status || 'Staða';

  const labelJoined = document.getElementById('label-joined');
  if (labelJoined) labelJoined.textContent = R.string.label_joined || 'Skráður';

  const labelDjangoId = document.getElementById('label-django-id');
  if (labelDjangoId) labelDjangoId.textContent = R.string.label_django_id || 'Django ID';

  const labelSyncedAt = document.getElementById('label-synced-at');
  if (labelSyncedAt) labelSyncedAt.textContent = R.string.label_synced_at || 'Síðast samstillt';

  const labelUid = document.getElementById('label-uid');
  if (labelUid) labelUid.textContent = R.string.label_uid || 'Firebase UID';

  // Gender options
  const optionGenderNone = document.getElementById('option-gender-none');
  if (optionGenderNone) optionGenderNone.textContent = R.string.option_gender_none || 'Veldu...';

  const optionGenderM = document.getElementById('option-gender-m');
  if (optionGenderM) optionGenderM.textContent = R.string.option_gender_m || 'Karl';

  const optionGenderF = document.getElementById('option-gender-f');
  if (optionGenderF) optionGenderF.textContent = R.string.option_gender_f || 'Kona';

  // Phone numbers section
  const phoneNumbersTitle = document.getElementById('phone-numbers-title');
  if (phoneNumbersTitle) phoneNumbersTitle.textContent = R.string.phone_numbers_title || 'Símanúmer';

  const btnAddPhoneText = document.getElementById('btn-add-phone-text');
  if (btnAddPhoneText) btnAddPhoneText.textContent = R.string.btn_add_phone || '+ Bæta við símanúmeri';

  // Addresses section
  const addressesTitle = document.getElementById('addresses-title');
  if (addressesTitle) addressesTitle.textContent = R.string.addresses_title || 'Heimilisföng';

  const btnAddAddressText = document.getElementById('btn-add-address-text');
  if (btnAddAddressText) btnAddAddressText.textContent = R.string.btn_add_address || '+ Bæta við heimilisfangi';

  // Communication preferences section
  const sectionCommunication = document.getElementById('section-communication');
  if (sectionCommunication) sectionCommunication.textContent = R.string.section_communication || 'Samskiptastillingar';

  const labelReachable = document.getElementById('label-reachable');
  if (labelReachable) labelReachable.textContent = R.string.label_reachable || 'Má hafa samband';

  const labelReachableDescription = document.getElementById('label-reachable-description');
  if (labelReachableDescription) labelReachableDescription.textContent = R.string.label_reachable_description || 'Leyfir flokknum að hafa samband vegna frétta og atburða';

  const labelGroupable = document.getElementById('label-groupable');
  if (labelGroupable) labelGroupable.textContent = R.string.label_groupable || 'Má bæta í hópa';

  const labelGroupableDescription = document.getElementById('label-groupable-description');
  if (labelGroupableDescription) labelGroupableDescription.textContent = R.string.label_groupable_description || 'Leyfir flokknum að bæta þér í vinnuhópa og póstlista';

  // Email placeholder
  const inputEmail = document.getElementById('input-email');
  if (inputEmail) inputEmail.placeholder = R.string.placeholder_email || 'nafn@example.is';
}

/**
 * Initialize page
 */
async function init() {
  debug.log('🚀 Member Profile Init');

  // Note: Navigation now initialized by nav-header component

  // Load i18n strings first
  await R.load('is');
  await adminStrings.load();

  // Set all i18n strings
  setI18nStrings();

  // Get ID from URL - can be django_id (preferred for security) or kennitala (legacy)
  const urlParams = new URLSearchParams(window.location.search);
  const idParam = urlParams.get('id');

  debug.log(`📋 URL parameter 'id':`, idParam);

  if (!idParam) {
    showError('Ekkert ID í URL');
    return;
  }

  // Detect if ID is kennitala (10 digits) or django_id (smaller number)
  // Kennitala format: DDMMYYNNNN (10 digits) or DDMMYY-NNNN (with dash)
  const isKennitala = idParam.length === 10 || (idParam.length === 11 && idParam.includes('-'));

  if (isKennitala) {
    // Legacy: kennitala in URL (less secure but backwards compatible)
    currentKennitala = idParam;
    debug.log(`🔑 Detected kennitala format (legacy)`);

    // Handle both formats: with dash (999999-9999) or without (9999999999)
    if (currentKennitala && !currentKennitala.includes('-') && currentKennitala.length === 10) {
      currentKennitala = `${currentKennitala.slice(0, 6)}-${currentKennitala.slice(6)}`;
      debug.log(`   Formatted kennitala:`, currentKennitala);
    }
  } else {
    // New: django_id in URL (more secure - kennitala not exposed)
    currentDjangoId = parseInt(idParam, 10);
    debug.log(`🔐 Detected django_id format (secure):`, currentDjangoId);
  }

  // Check authentication
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    // Check if user has admin permissions
    try {
      await requireAdmin();
    } catch (error) {
      debug.error('Access denied:', error);
      window.location.href = '/';
      return;
    }

    // Load member data
    await loadMemberData();
  });

  // Initialize SearchableSelects
  initSearchableSelects({
    searchPlaceholder: R.string.search_country,
    noResultsText: R.string.no_results
  });
}

/**
 * Load member data from Firestore
 * Supports two lookup methods:
 * 1. By kennitala (document ID) - legacy, less secure
 * 2. By django_id (query) - new, more secure
 *
 * @returns {Promise<void>}
 */
async function loadMemberData() {
  try {
    showLoading();

    let memberDoc = null;

    if (currentDjangoId) {
      // NEW: Lookup by django_id (more secure - kennitala not in URL)
      debug.log(`🔍 Loading member by django_id: ${currentDjangoId}`);

      const membersRef = collection(db, 'members');
      const q = query(membersRef, where('metadata.django_id', '==', currentDjangoId));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        debug.warn(`⚠️ Member not found with django_id: ${currentDjangoId}`);
        showNotFound();
        return;
      }

      memberDoc = querySnapshot.docs[0];
      // Set kennitala from document ID for save operations
      currentKennitala = memberDoc.id;
      if (currentKennitala.length === 10 && !currentKennitala.includes('-')) {
        currentKennitala = `${currentKennitala.slice(0, 6)}-${currentKennitala.slice(6)}`;
      }
      debug.log(`   Found kennitala: ${currentKennitala.slice(0, 6)}****`);

    } else if (currentKennitala) {
      // LEGACY: Lookup by kennitala (document ID)
      const kennitalaWithoutDash = currentKennitala.replace(/-/g, '');
      const kennitalaWithDash = currentKennitala;

      debug.log(`🔍 Loading member with kennitala: ${currentKennitala}`);
      debug.log(`   Trying keys: ["${kennitalaWithoutDash}", "${kennitalaWithDash}"]`);

      // Try without dash first (most common format)
      let memberDocRef = doc(db, 'members', kennitalaWithoutDash);
      memberDoc = await getDoc(memberDocRef);

      // If not found, try with dash
      if (!memberDoc.exists()) {
        debug.log(`   ℹ️ Not found with key: ${kennitalaWithoutDash}, trying with dash...`);
        memberDocRef = doc(db, 'members', kennitalaWithDash);
        memberDoc = await getDoc(memberDocRef);
      }

      if (!memberDoc.exists()) {
        debug.warn(`⚠️ Member not found with either key format`);
        debug.warn(`   Tried: ${kennitalaWithoutDash}, ${kennitalaWithDash}`);
        showNotFound();
        return;
      }
    } else {
      showError('Ekkert ID til að leita að');
      return;
    }

    memberData = {
      uid: memberDoc.id,
      kennitala: currentKennitala,
      ...memberDoc.data()
    };

    debug.log('📦 Member data loaded:', memberData);

    // Render profile
    await renderProfile();
    showProfile();

  } catch (error) {
    debug.error('❌ Error loading member:', error);
    debug.error('   ID:', currentDjangoId || currentKennitala);
    debug.error('   Error details:', error.message);
    showError(R.string.error_loading);
  }
}

/**
 * Render profile data to the page
 * Reads from nested memberData structure (profile.*, membership.*, metadata.*)
 *
 * @returns {Promise<void>}
 */
async function renderProfile() {
  // Get profile data (data is in memberData.profile.*)
  const profile = memberData.profile || {};
  
  // Basic info
  document.getElementById('input-name').value = profile.name || memberData.name || '';
  document.getElementById('value-kennitala').textContent = memberData.kennitala || '-';
  document.getElementById('input-email').value = profile.email || memberData.email || '';
  document.getElementById('input-birthday').value = profile.birthday || memberData.birthday || '';
  
  // Gender will be set after SearchableSelect initializes
  const genderValue = profile.gender !== undefined ? profile.gender : (memberData.gender !== undefined ? memberData.gender : '');

  // Membership info (readonly)
  const membership = memberData.membership || {};
  const statusBadge = document.getElementById('status-badge');

  // Get membership status: 'active', 'unpaid', or 'inactive'
  let membershipStatus = 'inactive';
  if (membership.status !== undefined) {
    membershipStatus = membership.status;
  } else if (membership.is_active !== undefined) {
    membershipStatus = membership.is_active ? 'active' : 'inactive';
  } else if (memberData.active !== undefined) {
    membershipStatus = memberData.active ? 'active' : 'inactive';
  }

  // Display status with appropriate styling
  // Check for soft-delete first - takes priority over other statuses
  if (membership.deleted_at) {
    const deletedDate = membership.deleted_at.toDate ? membership.deleted_at.toDate() : new Date(membership.deleted_at);
    const formattedDate = formatDateOnlyIcelandic(deletedDate);
    statusBadge.textContent = `Eytt ${formattedDate}`;
    statusBadge.className = 'admin-badge admin-badge--error';
  } else {
    switch (membershipStatus) {
      case 'active':
        statusBadge.textContent = adminStrings.get('membership_status_active') || 'Virkur';
        statusBadge.className = 'admin-badge admin-badge--success';
        break;
      case 'unpaid':
        statusBadge.textContent = adminStrings.get('membership_status_unpaid') || 'Ógreitt';
        statusBadge.className = 'admin-badge admin-badge--warning';
        break;
      case 'inactive':
      default:
        statusBadge.textContent = adminStrings.get('membership_status_inactive') || 'Óvirkur';
        statusBadge.className = 'admin-badge admin-badge--inactive';
        break;
    }
  }

  // Format joined date
  const joinedDate = membership.date_joined || membership.joined_date || memberData.joined_date;
  if (joinedDate) {
    const joined = joinedDate.toDate ? joinedDate.toDate() : new Date(joinedDate);
    document.getElementById('value-joined').textContent = formatDateOnlyIcelandic(joined);

    // Calculate membership duration
    const durationText = formatMembershipDuration(joined);
    document.getElementById('value-member-since').textContent = durationText;
  } else {
    document.getElementById('value-joined').textContent = '-';
    document.getElementById('value-member-since').textContent = '-';
  }
  
  const metadata = memberData.metadata || {};
  document.getElementById('value-django-id').textContent = metadata.django_id || memberData.django_id || '-';
  
  if (metadata.synced_at || memberData.synced_at) {
    const syncedAt = metadata.synced_at || memberData.synced_at;
    const syncDate = syncedAt.toDate ? syncedAt.toDate() : new Date(syncedAt);
    document.getElementById('value-synced-at').textContent = formatDateIcelandic(syncDate);
  } else {
    document.getElementById('value-synced-at').textContent = '-';
  }

  // Firebase UID - shows if member has logged into the system
  const uid = memberData.uid || metadata.firebase_uid || '';
  if (uid) {
    document.getElementById('value-uid').textContent = uid;
  } else {
    document.getElementById('value-uid').textContent = R.string.member_not_logged_in || 'Ekki skráð/ur inn';
  }

  // Initialize Phone Manager
  phoneManager = new PhoneManager(memberData);
  const migratedPhones = migrateOldPhoneFields(memberData);
  phoneManager.initialize(migratedPhones);
  phoneManager.setupListeners();
  phoneManager.render();

  // Initialize Address Manager
  addressManager = new AddressManager(memberData);
  const migratedAddresses = migrateOldAddressFields(memberData);
  addressManager.initialize(migratedAddresses);
  addressManager.setupListeners();
  addressManager.render();

  // Auto-save if migration patched addresses (added missing fields)
  // Use silent mode to avoid showing "Address updated" toast when user didn't change anything
  if (migratedAddresses._needsSave) {
    debug.log('🔄 Migration patched addresses, auto-saving to Firestore (silent mode)...');
    await addressManager.save({ silent: true });
  }

  // Communication preferences (reachable/groupable)
  const reachableInput = document.getElementById('input-reachable');
  if (reachableInput) {
    // Default to true if not set
    reachableInput.checked = profile.reachable !== false;
  }

  const groupableInput = document.getElementById('input-groupable');
  if (groupableInput) {
    // Default to true if not set
    groupableInput.checked = profile.groupable !== false;
  }

  // Membership details: cell, union, title, housing
  await renderMembershipDetails();

  // Setup field listeners for auto-save
  setupFieldListeners();

  // Initialize SearchableSelects after DOM is ready, then set gender value
  setTimeout(() => {
    initSearchableSelects({
      searchPlaceholder: R.string.search_country,
      noResultsText: R.string.no_results
    });

    // Set gender value after SearchableSelect has initialized
    if (genderValue !== '') {
      const genderSelect = document.getElementById('input-gender');
      genderSelect.value = genderValue;
      // Trigger change event to update SearchableSelect display
      genderSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, SEARCHABLE_SELECT_INIT_DELAY);
}

/**
 * Render membership details: cell, union, job title, housing situation
 */
async function renderMembershipDetails() {
  const profile = memberData.profile || {};
  const membership = memberData.membership || {};

  // Cell/Svæði (readonly display)
  const cellValue = document.getElementById('value-cell');
  if (cellValue) {
    // Cell is stored as a string (svæði name) in Firestore
    if (membership.cell) {
      cellValue.textContent = membership.cell;
    } else {
      cellValue.textContent = '-';
    }
  }

  // Union dropdown - populate and select current value
  const unionSelect = document.getElementById('input-union');
  if (unionSelect) {
    try {
      const unions = await getUnions();
      // Clear and repopulate
      unionSelect.innerHTML = `<option value="">${adminStrings.get('select_union_placeholder') || 'Veldu stéttarfélag...'}</option>`;
      unions.forEach(union => {
        const option = document.createElement('option');
        option.value = union.id;
        option.textContent = union.name;
        unionSelect.appendChild(option);
      });

      // Select current union if set
      const currentUnions = membership.unions || [];
      if (currentUnions.length > 0) {
        // Use first union (most members have one)
        const firstUnion = currentUnions[0];
        unionSelect.value = firstUnion.id || firstUnion;
      }
    } catch (error) {
      debug.error('Failed to load unions:', error);
    }
  }

  // Job Title dropdown - populate and select current value
  const titleSelect = document.getElementById('input-title');
  if (titleSelect) {
    try {
      const titles = await getJobTitles();
      // Clear and repopulate
      titleSelect.innerHTML = `<option value="">${adminStrings.get('select_job_title_placeholder') || 'Veldu starfsheiti...'}</option>`;
      titles.forEach(title => {
        const option = document.createElement('option');
        option.value = title.id;
        option.textContent = title.name;
        titleSelect.appendChild(option);
      });

      // Select current title if set
      const currentTitles = membership.titles || [];
      if (currentTitles.length > 0) {
        // Use first title
        const firstTitle = currentTitles[0];
        titleSelect.value = firstTitle.id || firstTitle;
      }
    } catch (error) {
      debug.error('Failed to load job titles:', error);
    }
  }

  // Housing situation - select current value
  const housingSelect = document.getElementById('input-housing');
  if (housingSelect && profile.housing_situation !== undefined) {
    housingSelect.value = profile.housing_situation;
  }

  debug.log('✅ Membership details rendered');
}

/**
 * Setup auto-save listeners for editable fields
 * Compares values against nested profile structure and triggers save on change
 * Uses debouncing for text inputs to prevent excessive saves
 * 
 * @returns {void}
 */
function setupFieldListeners() {
  const profile = memberData.profile || {};
  
  // Create debounced save function (500ms delay)
  const debouncedSave = debounce(saveField, 500);
  
  // Name (debounced on input, immediate on blur)
  const nameInput = document.getElementById('input-name');
  const nameStatus = document.getElementById('status-name');
  
  nameInput.addEventListener('input', (e) => {
    const newName = e.target.value.trim();
    const currentName = profile.name || memberData.name || '';
    if (newName && newName !== currentName) {
      debouncedSave('name', newName, nameStatus);
    }
  });
  
  nameInput.addEventListener('blur', async (e) => {
    const newName = e.target.value.trim();
    const currentName = profile.name || memberData.name || '';
    if (newName && newName !== currentName) {
      await saveField('name', newName, nameStatus);
    }
  });

  // Email (debounced on input, immediate on blur)
  const emailInput = document.getElementById('input-email');
  const emailStatus = document.getElementById('status-email');
  
  emailInput.addEventListener('input', (e) => {
    const newEmail = e.target.value.trim();
    const currentEmail = profile.email || memberData.email || '';
    if (newEmail !== currentEmail) {
      debouncedSave('email', newEmail, emailStatus);
    }
  });
  
  emailInput.addEventListener('blur', async (e) => {
    const newEmail = e.target.value.trim();
    const currentEmail = profile.email || memberData.email || '';
    if (newEmail !== currentEmail) {
      await saveField('email', newEmail, emailStatus);
    }
  });

  // Birthday (immediate save on change)
  const birthdayInput = document.getElementById('input-birthday');
  const birthdayStatus = document.getElementById('status-birthday');
  birthdayInput.addEventListener('change', async (e) => {
    const newBirthday = e.target.value;
    const currentBirthday = profile.birthday || memberData.birthday || '';
    if (newBirthday !== currentBirthday) {
      await saveField('birthday', newBirthday, birthdayStatus);
    }
  });

  // Gender (immediate save on change)
  const genderInput = document.getElementById('input-gender');
  const genderStatus = document.getElementById('status-gender');
  genderInput.addEventListener('change', async (e) => {
    const newGender = e.target.value === '' ? null : parseInt(e.target.value);
    const currentGender = profile.gender !== undefined ? profile.gender : memberData.gender;
    if (newGender !== currentGender) {
      await saveField('gender', newGender, genderStatus);
    }
  });

  // Reachable (immediate save on change)
  const reachableInput = document.getElementById('input-reachable');
  const reachableStatus = document.getElementById('status-reachable');
  if (reachableInput) {
    reachableInput.addEventListener('change', async (e) => {
      const newReachable = e.target.checked;
      await saveField('reachable', newReachable, reachableStatus);
      showToast(R.string.profile_preferences_saved || 'Stillingar vistaðar', 'success');
    });
  }

  // Groupable (immediate save on change)
  const groupableInput = document.getElementById('input-groupable');
  const groupableStatus = document.getElementById('status-groupable');
  if (groupableInput) {
    groupableInput.addEventListener('change', async (e) => {
      const newGroupable = e.target.checked;
      await saveField('groupable', newGroupable, groupableStatus);
      showToast(R.string.profile_preferences_saved || 'Stillingar vistaðar', 'success');
    });
  }

  // Union (immediate save on change)
  const unionInput = document.getElementById('input-union');
  const unionStatus = document.getElementById('status-union');
  if (unionInput) {
    unionInput.addEventListener('change', async (e) => {
      const unionId = e.target.value ? parseInt(e.target.value) : null;
      const unionName = e.target.selectedOptions[0]?.textContent || '';
      const unionValue = unionId ? [{ id: unionId, name: unionName }] : [];
      await saveMembershipField('unions', unionValue, unionStatus);
    });
  }

  // Job Title (immediate save on change)
  const titleInput = document.getElementById('input-title');
  const titleStatus = document.getElementById('status-title');
  if (titleInput) {
    titleInput.addEventListener('change', async (e) => {
      const titleId = e.target.value ? parseInt(e.target.value) : null;
      const titleName = e.target.selectedOptions[0]?.textContent || '';
      const titleValue = titleId ? [{ id: titleId, name: titleName }] : [];
      await saveMembershipField('titles', titleValue, titleStatus);
    });
  }

  // Housing Situation (immediate save on change)
  const housingInput = document.getElementById('input-housing');
  const housingStatus = document.getElementById('status-housing');
  if (housingInput) {
    housingInput.addEventListener('change', async (e) => {
      const housingValue = e.target.value !== '' ? parseInt(e.target.value) : null;
      await saveField('housing_situation', housingValue, housingStatus);
    });
  }
}

/**
 * Save a single field to Firestore with nested path
 * 
 * @param {string} fieldName - Field name to save (e.g., 'name', 'email')
 * @param {any} value - Value to save (string, number, boolean, etc.)
 * @param {HTMLElement} statusElement - Status indicator element for visual feedback
 * @returns {Promise<void>}
 */
async function saveField(fieldName, value, statusElement) {
  try {
    debug.log(`💾 Saving ${fieldName}:`, value);

    showStatus(statusElement, 'loading', { baseClass: 'profile-field__status' });

    const kennitalaKey = currentKennitala.replace(/-/g, '');
    const memberDocRef = doc(db, 'members', kennitalaKey);

    // Save to profile.* path in Firestore
    await updateDoc(memberDocRef, {
      [`profile.${fieldName}`]: value,
      updated_at: new Date()
    });

    // Update local state
    if (!memberData.profile) memberData.profile = {};
    memberData.profile[fieldName] = value;

    // Sync to Django via Cloud Function
    try {
      debug.log(`🔄 Syncing ${fieldName} to Django...`);

      // Map Firestore field names to Django API field names
      const fieldMapping = {
        'name': 'name',
        'email': 'email',
        'phone': 'phone',
        'reachable': 'reachable',
        'groupable': 'groupable',
        'gender': 'gender',
        'birthday': 'birthday'
      };

      const djangoFieldName = fieldMapping[fieldName];
      if (djangoFieldName) {
        const updates = { [djangoFieldName]: value };
        const syncResult = await updateMemberProfileFunction({
          kennitala: currentKennitala,
          updates: updates
        });
        debug.log(`✅ Django sync result:`, syncResult.data);
      } else {
        debug.log(`ℹ️ Field ${fieldName} not mapped for Django sync`);
      }
    } catch (syncError) {
      // Log sync error but don't fail the save (Firestore was already updated)
      debug.warn(`⚠️ Failed to sync to Django:`, syncError);
    }

    showStatus(statusElement, 'success', { baseClass: 'profile-field__status' });
    showToast(R.string.saved, 'success');

    debug.log(`✅ ${fieldName} saved`);

  } catch (error) {
    debug.error(`❌ Error saving ${fieldName}:`, error);
    showStatus(statusElement, 'error', { baseClass: 'profile-field__status' });
    showToast(R.string.save_error, 'error');
  }
}

/**
 * Save a membership field to Firestore (membership.* path)
 *
 * @param {string} fieldName - Field name to save (e.g., 'unions', 'titles', 'cell')
 * @param {any} value - Value to save
 * @param {HTMLElement} statusElement - Status indicator element
 * @returns {Promise<void>}
 */
async function saveMembershipField(fieldName, value, statusElement) {
  try {
    debug.log(`💾 Saving membership.${fieldName}:`, value);

    showStatus(statusElement, 'loading', { baseClass: 'profile-field__status' });

    const kennitalaKey = currentKennitala.replace(/-/g, '');
    const memberDocRef = doc(db, 'members', kennitalaKey);

    // Save to membership.* path in Firestore
    await updateDoc(memberDocRef, {
      [`membership.${fieldName}`]: value,
      updated_at: new Date()
    });

    // Update local state
    if (!memberData.membership) memberData.membership = {};
    memberData.membership[fieldName] = value;

    showStatus(statusElement, 'success', { baseClass: 'profile-field__status' });
    showToast(R.string.saved || 'Vistað', 'success');

    debug.log(`✅ membership.${fieldName} saved`);

  } catch (error) {
    debug.error(`❌ Error saving membership.${fieldName}:`, error);
    showStatus(statusElement, 'error', { baseClass: 'profile-field__status' });
    showToast(R.string.save_error || 'Villa við vistun', 'error');
  }
}

/**
 * UI State Management
 */
function showLoading() {
  document.getElementById('member-loading').style.display = 'block';
  document.getElementById('member-error').style.display = 'none';
  document.getElementById('member-not-found').style.display = 'none';
  document.getElementById('member-profile').style.display = 'none';
}

function showError(message) {
  document.getElementById('member-loading').style.display = 'none';
  document.getElementById('member-error').style.display = 'block';
  document.getElementById('member-not-found').style.display = 'none';
  document.getElementById('member-profile').style.display = 'none';
  document.getElementById('member-error-message').textContent = message;
}

function showNotFound() {
  document.getElementById('member-loading').style.display = 'none';
  document.getElementById('member-error').style.display = 'none';
  document.getElementById('member-not-found').style.display = 'block';
  document.getElementById('member-profile').style.display = 'none';
}

function showProfile() {
  document.getElementById('member-loading').style.display = 'none';
  document.getElementById('member-error').style.display = 'none';
  document.getElementById('member-not-found').style.display = 'none';
  document.getElementById('member-profile').style.display = 'block';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
