/**
 * Admin Member Profile Page
 * 
 * Unified view/edit page for member profiles in admin area.
 * Uses PhoneManager and AddressManager from profile refactoring.
 */

import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app.js';
import { doc, getDoc, updateDoc, addDoc, collection } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { R } from '../../i18n/strings-loader.js';
import { showToast } from '../../js/components/toast.js';
import { showStatus } from '../../js/components/status.js';
import { debug } from '../../js/utils/debug.js';
import { debounce } from '../../js/utils/debounce.js';
import { initSearchableSelects } from '../../js/components/searchable-select.js';
import { PhoneManager } from '../../js/profile/phone-manager.js';
import { AddressManager } from '../../js/profile/address-manager.js';
import { migrateOldPhoneFields, migrateOldAddressFields } from '../../js/profile/migration.js';

// Initialize Firebase
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

// Constants
const SEARCHABLE_SELECT_INIT_DELAY = 100; // ms to wait for DOM ready before initializing SearchableSelect
const AUTO_SAVE_SUCCESS_DURATION = 2000; // ms to show success status
const AUTO_SAVE_ERROR_DURATION = 3000; // ms to show error status

// State
let currentKennitala = null;
let memberData = null;
let phoneManager = null;
let addressManager = null;

/**
 * Initialize page
 */
async function init() {
  debug.log('🚀 Member Profile Init');

  // Load i18n strings first
  await R.load('is');

  // Get kennitala from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentKennitala = urlParams.get('id');

  debug.log(`📋 URL parameter 'id':`, currentKennitala);

  if (!currentKennitala) {
    showError('Engin kennitala í URL');
    return;
  }

  // Handle both formats: with dash (010300-3390) or without (0103003390)
  if (currentKennitala && !currentKennitala.includes('-') && currentKennitala.length === 10) {
    // Add dash if missing
    currentKennitala = `${currentKennitala.slice(0, 6)}-${currentKennitala.slice(6)}`;
    debug.log(`   Formatted kennitala:`, currentKennitala);
  }

  // Check authentication
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    // TODO: Check if user has admin permissions
    // For now, just check if user is authenticated

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
 * Try multiple document ID formats to handle different data structures
 * 
 * @returns {Promise<void>}
 */
async function loadMemberData() {
  try {
    showLoading();

    // Try multiple key formats
    const kennitalaWithoutDash = currentKennitala.replace(/-/g, '');
    const kennitalaWithDash = currentKennitala;
    
    debug.log(`🔍 Loading member with kennitala: ${currentKennitala}`);
    debug.log(`   Trying keys: ["${kennitalaWithoutDash}", "${kennitalaWithDash}"]`);
    
    // Try without dash first (most common format)
    let memberDocRef = doc(db, 'members', kennitalaWithoutDash);
    let memberDoc = await getDoc(memberDocRef);

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

    memberData = {
      uid: memberDoc.id,
      kennitala: currentKennitala,
      ...memberDoc.data()
    };

    debug.log('📦 Member data loaded:', memberData);

    // Render profile
    renderProfile();
    showProfile();

  } catch (error) {
    debug.error('❌ Error loading member:', error);
    debug.error('   Kennitala:', currentKennitala);
    debug.error('   Error details:', error.message);
    showError(R.string.error_loading);
  }
}

/**
 * Render profile data to the page
 * Reads from nested memberData structure (profile.*, membership.*, metadata.*)
 * 
 * @returns {void}
 */
function renderProfile() {
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
  
  // Check both is_active (boolean) and status (string "active"/"inactive")
  let isActive = false;
  if (membership.is_active !== undefined) {
    isActive = membership.is_active;
  } else if (membership.status !== undefined) {
    isActive = membership.status === 'active';
  } else if (memberData.active !== undefined) {
    isActive = memberData.active;
  }
  
  if (isActive) {
    statusBadge.textContent = 'Virkur';
    statusBadge.className = 'admin-badge admin-badge--success';
  } else {
    statusBadge.textContent = 'Óvirkur';
    statusBadge.className = 'admin-badge admin-badge--inactive';
  }

  // Format joined date
  const joinedDate = membership.date_joined || membership.joined_date || memberData.joined_date;
  if (joinedDate) {
    const joined = joinedDate.toDate ? joinedDate.toDate() : new Date(joinedDate);
    document.getElementById('value-joined').textContent = joined.toLocaleDateString('is-IS');
  } else {
    document.getElementById('value-joined').textContent = '-';
  }
  
  const metadata = memberData.metadata || {};
  document.getElementById('value-django-id').textContent = metadata.django_id || memberData.django_id || '-';
  
  if (metadata.synced_at || memberData.synced_at) {
    const syncedAt = metadata.synced_at || memberData.synced_at;
    const syncDate = syncedAt.toDate ? syncedAt.toDate() : new Date(syncedAt);
    document.getElementById('value-synced-at').textContent = syncDate.toLocaleString('is-IS');
  } else {
    document.getElementById('value-synced-at').textContent = '-';
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

    // Add to sync queue for bi-directional sync to Django
    try {
      await addDoc(collection(db, 'sync_queue'), {
        source: 'firestore',
        target: 'django',
        collection: 'members',
        docId: kennitalaKey,
        kennitala: currentKennitala,
        django_id: memberData.metadata?.django_id || null,
        action: 'update',
        changes: {
          [`profile.${fieldName}`]: value
        },
        created_at: new Date(),
        synced_at: null,
        sync_status: 'pending'
      });
      debug.log(`📝 Added to sync queue for field: ${fieldName}`);
    } catch (syncError) {
      // Log sync queue error but don't fail the save
      debug.warn(`⚠️ Failed to add to sync queue:`, syncError);
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
