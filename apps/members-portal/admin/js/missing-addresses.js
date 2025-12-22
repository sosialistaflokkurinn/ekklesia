/**
 * Missing Addresses Page
 *
 * Admin tool to identify and fix members without addresses.
 * Provides inline editing with address autocomplete.
 *
 * Issue: #341 - Admin tool for missing addresses
 */

import { getFirebaseAuth, getFirebaseFirestore, httpsCallable, doc, updateDoc } from '../../firebase/app.js';
import { debug } from '../../js/utils/util-debug.js';
import { formatPhone, maskKennitala } from '../../js/utils/util-format.js';
import { showToast } from '../../js/components/ui-toast.js';
import { AddressAutocomplete } from '../../js/components/member-address-autocomplete.js';
import { el } from '../../js/utils/util-dom.js';
import MembersAPI from './api/members-api.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

// Cloud Function for syncing profile updates to Django
const updateMemberProfileFunction = httpsCallable('updatememberprofile', 'europe-west2');

// State
let members = [];
let totalMembers = 0;

// DOM Elements
const elements = {
  loadingState: null,
  errorState: null,
  emptyState: null,
  tableContainer: null,
  tableBody: null,
  statCount: null,
  statPercentage: null,
  btnRetry: null
};

/**
 * Check if a member has a valid address with municipality
 */
function memberHasAddress(member) {
  const addresses = member?.profile?.addresses || member?.addresses || [];
  if (addresses.length === 0) return false;

  const primaryAddress = addresses.find(a => a.is_default || a.is_primary) || addresses[0];
  return Boolean(primaryAddress?.municipality);
}

/**
 * Initialize the page
 */
async function init() {
  debug.log('Initializing missing addresses page...');

  // Initialize DOM elements
  initElements();

  // Check authentication
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/login.html';
      return;
    }

    // Check admin role
    const token = await user.getIdTokenResult();
    const roles = token.claims.roles || [];
    const hasAdminAccess = roles.includes('admin') || roles.includes('superuser');

    if (!hasAdminAccess) {
      showError('Aðgangur bannaður. Þú þarft admin réttindi.');
      return;
    }

    // Set up event listeners
    setupEventListeners();

    // Load data
    await loadMembers();
  });
}

/**
 * Initialize DOM element references
 */
function initElements() {
  elements.loadingState = document.getElementById('loading-state');
  elements.errorState = document.getElementById('error-state');
  elements.emptyState = document.getElementById('empty-state');
  elements.tableContainer = document.getElementById('table-container');
  elements.tableBody = document.getElementById('table-body');
  elements.statCount = document.getElementById('stat-count');
  elements.statPercentage = document.getElementById('stat-percentage');
  elements.btnRetry = document.getElementById('btn-retry');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  elements.btnRetry?.addEventListener('click', () => loadMembers());
}

/**
 * Show loading state
 */
function showLoading() {
  elements.loadingState.style.display = 'flex';
  elements.errorState.style.display = 'none';
  elements.emptyState.style.display = 'none';
  elements.tableContainer.style.display = 'none';
}

/**
 * Show error state
 */
function showError(message) {
  elements.loadingState.style.display = 'none';
  elements.errorState.style.display = 'block';
  elements.emptyState.style.display = 'none';
  elements.tableContainer.style.display = 'none';

  const errorMessage = document.getElementById('error-message');
  if (errorMessage) {
    errorMessage.textContent = message;
  }
}

/**
 * Show empty state (all members have addresses)
 */
function showEmpty() {
  elements.loadingState.style.display = 'none';
  elements.errorState.style.display = 'none';
  elements.emptyState.style.display = 'block';
  elements.tableContainer.style.display = 'none';
}

/**
 * Show content
 */
function showContent() {
  elements.loadingState.style.display = 'none';
  elements.errorState.style.display = 'none';
  elements.emptyState.style.display = 'none';
  elements.tableContainer.style.display = 'block';
}

/**
 * Load members without addresses
 */
async function loadMembers() {
  showLoading();

  try {
    // Load all members (we need to filter client-side)
    const result = await MembersAPI.fetchMembers({
      limit: 5000,
      status: 'all',
      search: '',
      startAfter: null
    });

    totalMembers = result.members.length;

    // Filter to only members without addresses
    members = result.members.filter(member => !memberHasAddress(member));

    debug.log(`Found ${members.length} members without addresses out of ${totalMembers} total`);

    // Update stats
    updateStats();

    if (members.length === 0) {
      showEmpty();
    } else {
      renderMembers();
      showContent();
    }

  } catch (error) {
    debug.error('Error loading members:', error);
    showError(error.message || 'Villa við að hlaða félögum');
  }
}

/**
 * Update stats display
 */
function updateStats() {
  if (elements.statCount) {
    elements.statCount.textContent = members.length.toLocaleString('is-IS');
  }

  if (elements.statPercentage && totalMembers > 0) {
    const percentage = ((members.length / totalMembers) * 100).toFixed(1);
    elements.statPercentage.textContent = `${percentage}%`;
  }
}

/**
 * Render members table
 */
function renderMembers() {
  elements.tableBody.innerHTML = '';

  members.forEach((member, index) => {
    const row = createMemberRow(member, index);
    elements.tableBody.appendChild(row);
  });
}

/**
 * Create a member row with inline edit capability
 */
function createMemberRow(member, index) {
  const row = el('tr', 'members-table__row', { 'data-kennitala': member.kennitala });

  // ID column
  const idCell = el('td', 'members-table__cell', {},
    member.metadata?.django_id || '-'
  );
  row.appendChild(idCell);

  // Name column
  const nameCell = el('td', 'members-table__cell', {}, member.name || '-');
  row.appendChild(nameCell);

  // Phone column
  const phoneCell = el('td', 'members-table__cell', {}, formatPhone(member.phone) || '-');
  row.appendChild(phoneCell);

  // Email column
  const emailCell = el('td', 'members-table__cell', {}, member.email || '-');
  row.appendChild(emailCell);

  // Actions column
  const actionsCell = el('td', 'members-table__cell members-table__cell--actions');

  const editBtn = el('button', 'btn btn--outline btn--sm', {
    type: 'button'
  }, 'Breyta');

  editBtn.addEventListener('click', () => toggleInlineEdit(row, member, index));

  actionsCell.appendChild(editBtn);
  row.appendChild(actionsCell);

  return row;
}

/**
 * Toggle inline edit row
 */
function toggleInlineEdit(row, member, index) {
  // Check if edit row already exists
  const existingEditRow = row.nextElementSibling;
  if (existingEditRow && existingEditRow.classList.contains('inline-edit-row')) {
    existingEditRow.remove();
    return;
  }

  // Remove any other open edit rows
  document.querySelectorAll('.inline-edit-row').forEach(r => r.remove());

  // Create inline edit row
  const editRow = createInlineEditRow(row, member, index);
  row.after(editRow);
}

/**
 * Create inline edit row with address autocomplete
 */
function createInlineEditRow(parentRow, member, index) {
  const editRow = el('tr', 'inline-edit-row');
  const editCell = el('td', '', { colspan: '5' });

  const form = el('div', 'inline-edit__form');

  // Address input wrapper (for autocomplete positioning)
  const addressWrapper = el('div', 'inline-edit__address-wrapper');

  const addressInput = el('input', 'inline-edit__input', {
    type: 'text',
    id: `address-input-${index}`,
    placeholder: 'Sláðu inn heimilisfang...',
    autocomplete: 'off'
  });
  addressWrapper.appendChild(addressInput);

  // Apartment input
  const aptInput = el('input', 'inline-edit__input inline-edit__input--apt', {
    type: 'text',
    placeholder: 'Íbúð',
    maxlength: '10'
  });

  // Buttons container
  const buttons = el('div', 'inline-edit__buttons');

  const saveBtn = el('button', 'inline-edit__btn inline-edit__btn--save', {
    type: 'button',
    disabled: true
  }, 'Vista');

  const cancelBtn = el('button', 'inline-edit__btn inline-edit__btn--cancel', {
    type: 'button'
  }, 'Hætta við');

  buttons.appendChild(saveBtn);
  buttons.appendChild(cancelBtn);

  form.appendChild(addressWrapper);
  form.appendChild(aptInput);
  form.appendChild(buttons);

  editCell.appendChild(form);
  editRow.appendChild(editCell);

  // State for selected address
  let selectedAddress = null;

  // Initialize autocomplete
  const autocomplete = new AddressAutocomplete(addressInput, {
    onSelect: (address) => {
      debug.log('Address selected:', address);
      selectedAddress = address;
      saveBtn.disabled = false;

      // Update input to show full address
      const display = `${address.street} ${address.number || ''}${address.letter || ''}, ${address.postal_code} ${address.city}`;
      addressInput.value = display.trim();
    }
  });

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    autocomplete.destroy();
    editRow.remove();
  });

  // Save button
  saveBtn.addEventListener('click', async () => {
    if (!selectedAddress) return;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="inline-edit__loading"></span>';

    try {
      await saveAddress(member, selectedAddress, aptInput.value.trim());

      // Remove member from list
      members = members.filter(m => m.kennitala !== member.kennitala);
      updateStats();

      // Mark row as saved and remove
      parentRow.classList.add('row-saved');
      autocomplete.destroy();
      editRow.remove();

      setTimeout(() => {
        parentRow.remove();

        // Check if list is now empty
        if (members.length === 0) {
          showEmpty();
        }
      }, 500);

      showToast('Heimilisfang vistað', 'success');

    } catch (error) {
      debug.error('Failed to save address:', error);
      showToast('Villa við að vista heimilisfang', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Vista';
    }
  });

  // Focus the input
  setTimeout(() => addressInput.focus(), 100);

  return editRow;
}

/**
 * Save address to Firestore and sync to Django
 */
async function saveAddress(member, addressData, apartment) {
  const kennitala = member.kennitala.replace(/-/g, '');

  debug.log(`Saving address for ${kennitala}:`, addressData);

  // Build address object
  const newAddress = {
    country: 'IS',
    street: addressData.street,
    number: String(addressData.number || ''),
    letter: addressData.letter || '',
    postal_code: String(addressData.postal_code || ''),
    city: addressData.city || '',
    municipality: addressData.municipality || '',
    apartment: apartment || '',
    latitude: addressData.latitude,
    longitude: addressData.longitude,
    hnitnum: addressData.hnitnum,
    is_default: true,
    validated: true,
    validatedAt: new Date().toISOString()
  };

  // Update Firestore
  const memberDocRef = doc(db, 'members', kennitala);
  await updateDoc(memberDocRef, {
    'profile.addresses': [newAddress],
    'profile.updated_at': new Date()
  });

  debug.log('Address saved to Firestore');

  // Sync to Django (non-blocking)
  try {
    await updateMemberProfileFunction({
      kennitala: member.kennitala,
      updates: {
        addresses: [newAddress]
      }
    });
    debug.log('Address synced to Django');
  } catch (syncError) {
    debug.warn('Django sync failed (Firestore save succeeded):', syncError.message);
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
