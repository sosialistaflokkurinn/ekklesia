/**
 * Dangerous Operations - Superuser Console
 *
 * Handles irreversible operations with multi-step confirmation.
 * All operations are logged to Cloud Logging for audit trail.
 *
 * Backend Status:
 * ✅ hardDeleteMember - IMPLEMENTED (superuser_functions.py)
 * ✅ anonymizeMember - IMPLEMENTED (superuser_functions.py)
 * ❌ purgeDeleted - Permanently delete soft-deleted records
 * ❌ loadDeletedCounts() - MOCK: Returns hardcoded 0
 * ❌ loadRecentOperations() - MOCK: Shows placeholder text
 */

import { initSession } from '../../session/init.js';
import { debug } from '../../js/utils/util-debug.js';
import { getFunctions } from '../../firebase/app.js';
import { requireSuperuser } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { R } from '../../i18n/strings-loader.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';

// State
let currentOperation = null;
let confirmationStep = 1;
let countdownTimer = null;

/**
 * Validate kennitala format (10 digits)
 */
function isValidKennitala(kt) {
  return /^\d{10}$/.test(kt);
}

/**
 * Enable/disable buttons based on input validation
 */
function setupInputValidation() {
  const deleteInput = document.getElementById('delete-member-id');
  const deleteBtn = document.getElementById('delete-member-btn');
  const anonymizeInput = document.getElementById('anonymize-member-id');
  const anonymizeBtn = document.getElementById('anonymize-member-btn');

  deleteInput.addEventListener('input', () => {
    deleteBtn.disabled = !isValidKennitala(deleteInput.value);
  });

  anonymizeInput.addEventListener('input', () => {
    anonymizeBtn.disabled = !isValidKennitala(anonymizeInput.value);
  });
}

/**
 * Open confirmation modal
 */
function openConfirmModal(operation) {
  currentOperation = operation;
  confirmationStep = 1;

  const modal = document.getElementById('confirm-modal');
  const title = document.getElementById('confirm-modal-title');
  const description = document.getElementById('confirm-modal-description');
  const phrase = document.getElementById('confirm-phrase');

  // Set modal content based on operation
  // Note: Using textContent for security - kennitala is user input
  // Even though validated as digits-only, we avoid innerHTML with user data
  switch (operation.type) {
    case 'delete-member':
      title.textContent = superuserStrings.get('dangerous_delete_member_title');
      description.textContent = superuserStrings.get('dangerous_delete_member_desc').replace('%s', operation.kennitala);
      phrase.textContent = superuserStrings.get('dangerous_delete_member_phrase');
      break;

    case 'anonymize-member':
      title.textContent = superuserStrings.get('dangerous_anonymize_member_title');
      description.textContent = superuserStrings.get('dangerous_anonymize_member_desc').replace('%s', operation.kennitala);
      phrase.textContent = superuserStrings.get('dangerous_anonymize_member_phrase');
      break;

    case 'purge-deleted':
      title.textContent = superuserStrings.get('dangerous_purge_deleted_title');
      description.textContent = superuserStrings.get('dangerous_purge_deleted_desc');
      phrase.textContent = superuserStrings.get('dangerous_purge_deleted_phrase');
      break;
  }

  // Reset steps
  document.getElementById('confirm-step-1').classList.remove('u-hidden');
  document.getElementById('confirm-step-2').classList.add('u-hidden');
  document.getElementById('confirm-step-3').classList.add('u-hidden');
  document.getElementById('confirm-proceed-btn').disabled = true;
  document.getElementById('confirm-input').value = '';

  // Show modal
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('modal--open');

  // Start countdown
  startCountdown();
}

/**
 * Close confirmation modal
 */
function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('modal--open');

  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  currentOperation = null;
}

/**
 * Start countdown timer (Step 1)
 */
function startCountdown() {
  let count = 5;
  const countdownEl = document.getElementById('confirm-countdown');
  countdownEl.textContent = count;

  countdownTimer = setInterval(() => {
    count--;
    countdownEl.textContent = count;

    if (count <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      advanceToStep2();
    }
  }, 1000);
}

/**
 * Advance to Step 2 (type confirmation phrase)
 */
function advanceToStep2() {
  confirmationStep = 2;
  document.getElementById('confirm-step-1').classList.add('u-hidden');
  document.getElementById('confirm-step-2').classList.remove('u-hidden');
  document.getElementById('confirm-proceed-btn').disabled = true;

  // Focus input
  document.getElementById('confirm-input').focus();
}

/**
 * Advance to Step 3 (final confirmation)
 */
function advanceToStep3() {
  confirmationStep = 3;
  document.getElementById('confirm-step-2').classList.add('u-hidden');
  document.getElementById('confirm-step-3').classList.remove('u-hidden');
  document.getElementById('confirm-proceed-btn').disabled = false;
  document.getElementById('confirm-proceed-btn').textContent = superuserStrings.get('dangerous_confirm_btn');
}

/**
 * Check if typed phrase matches
 */
function checkConfirmationPhrase() {
  const input = document.getElementById('confirm-input');
  const phrase = document.getElementById('confirm-phrase').textContent;

  if (input.value.toUpperCase() === phrase) {
    input.classList.add('confirmation-input--valid');
    advanceToStep3();
  } else {
    input.classList.remove('confirmation-input--valid');
  }
}

/**
 * Execute the confirmed operation
 */
async function executeOperation() {
  if (!currentOperation || confirmationStep !== 3) return;

  const proceedBtn = document.getElementById('confirm-proceed-btn');
  proceedBtn.disabled = true;
  proceedBtn.textContent = superuserStrings.get('dangerous_executing_btn');

  try {
    const functions = getFunctions('europe-west2');
    let result;

    switch (currentOperation.type) {
      case 'delete-member': {
        const hardDeleteMember = httpsCallable(functions, 'hardDeleteMember');
        result = await hardDeleteMember({
          kennitala: currentOperation.kennitala,
          confirmation: 'EYÐA VARANLEGA'
        });
        break;
      }

      case 'anonymize-member': {
        const anonymizeMember = httpsCallable(functions, 'anonymizeMember');
        result = await anonymizeMember({
          kennitala: currentOperation.kennitala,
          confirmation: 'NAFNLAUSA'
        });
        break;
      }

      case 'purge-deleted': {
        const purgeDeleted = httpsCallable(functions, 'purgedeleted');
        result = await purgeDeleted();
        break;
      }

      default:
        throw new Error(superuserStrings.get('dangerous_unknown_op'));
    }

    debug.log('Operation result:', result.data);

    if (result.data.success) {
      showToast(result.data.message || superuserStrings.get('dangerous_op_success'), 'success');
    } else {
      showToast(result.data.message || superuserStrings.get('dangerous_op_failed'), 'error');
    }

    closeConfirmModal();

    // Clear input fields
    document.getElementById('delete-member-id').value = '';
    document.getElementById('anonymize-member-id').value = '';
    document.getElementById('delete-member-btn').disabled = true;
    document.getElementById('anonymize-member-btn').disabled = true;

    // Refresh audit trail
    loadRecentOperations();

  } catch (error) {
    debug.error('Operation failed:', error);
    showToast(superuserStrings.get('dangerous_op_error').replace('%s', error.message), 'error');
    proceedBtn.disabled = false;
    proceedBtn.textContent = superuserStrings.get('dangerous_confirm_btn');
  }
}

/**
 * Load deleted records count
 *
 * MOCK: Returns hardcoded 0 values
 * TODO: Implement Cloud Function 'getDeletedCounts' to query:
 *   - Firestore members with deletedAt != null
 *   - Firestore votes with deletedAt != null
 */
async function loadDeletedCounts() {
  // MOCK: Hardcoded values - no backend implementation yet
  document.getElementById('deleted-members-count').textContent = '0';
  document.getElementById('deleted-votes-count').textContent = '0';
  document.getElementById('purge-deleted-btn').disabled = true;
}

/**
 * Load recent dangerous operations for audit trail
 *
 * MOCK: Shows placeholder text only
 * TODO: Call getAuditLogs Cloud Function with filter:
 *   - action IN ['hard_delete_member', 'anonymize_member', 'purge_deleted']
 *   - Display in table format with timestamp, action, target, caller
 */
async function loadRecentOperations() {
  const container = document.getElementById('recent-dangerous-ops');

  // MOCK: Placeholder - should call getAuditLogs with dangerous ops filter
  container.innerHTML = `
    <div class="audit-placeholder">
      <p>${superuserStrings.get('dangerous_no_ops')}</p>
      <p class="u-text-muted">${superuserStrings.get('dangerous_logs_info')}</p>
    </div>
  `;
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Delete member button
  document.getElementById('delete-member-btn').addEventListener('click', () => {
    const kennitala = document.getElementById('delete-member-id').value;
    openConfirmModal({ type: 'delete-member', kennitala });
  });

  // Anonymize member button
  document.getElementById('anonymize-member-btn').addEventListener('click', () => {
    const kennitala = document.getElementById('anonymize-member-id').value;
    openConfirmModal({ type: 'anonymize-member', kennitala });
  });

  // Purge deleted button
  document.getElementById('purge-deleted-btn').addEventListener('click', () => {
    openConfirmModal({ type: 'purge-deleted' });
  });

  // Modal cancel button
  document.getElementById('confirm-cancel-btn').addEventListener('click', closeConfirmModal);

  // Modal backdrop click
  document.querySelector('.modal__backdrop').addEventListener('click', closeConfirmModal);

  // Modal proceed button
  document.getElementById('confirm-proceed-btn').addEventListener('click', executeOperation);

  // Confirmation input
  document.getElementById('confirm-input').addEventListener('input', checkConfirmationPhrase);

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConfirmModal();
    }
  });
}

/**
 * Initialize page
 */
async function init() {
  try {
    await R.load('is');
    await superuserStrings.load();
    superuserStrings.translatePage();  // Translate data-i18n elements
    await initSession();
    await requireSuperuser();

    setupInputValidation();
    setupEventListeners();
    loadDeletedCounts();
    loadRecentOperations();

    debug.log('Dangerous operations page initialized');

  } catch (error) {
    debug.error('Failed to initialize dangerous ops:', error);

    if (error.message.includes('Superuser role required')) {
      return;
    }

    showToast(superuserStrings.get('dangerous_op_error').replace('%s', error.message), 'error');
  }
}

init();
