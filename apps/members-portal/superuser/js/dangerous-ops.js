/**
 * Dangerous Operations - Superuser Console
 *
 * Handles irreversible operations with multi-step confirmation.
 * All operations are logged to Cloud Logging for audit trail.
 *
 * Module cleanup not needed - page reloads on navigation.
 *
 * Backend Status:
 * ✅ hardDeleteMember - IMPLEMENTED (fn_superuser.py)
 * ✅ anonymizeMember - IMPLEMENTED (fn_superuser.py)
 * ✅ purgeDeleted - IMPLEMENTED (fn_superuser.py) - Purges soft-deleted records
 * ✅ getDeletedCounts - IMPLEMENTED (fn_superuser.py) - Counts soft-deleted records
 * ✅ getAuditLogs - IMPLEMENTED (fn_superuser.py) - Query Cloud Logging
 */

import { initSession } from '../../session/init.js';
import { debug } from '../../js/utils/util-debug.js';
import { httpsCallable } from '../../firebase/app.js';
import { requireSuperuser } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { R } from '../../i18n/strings-loader.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';

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
    let result;

    switch (currentOperation.type) {
      case 'delete-member': {
        const hardDeleteMember = httpsCallable('hardDeleteMember', 'europe-west2');
        result = await hardDeleteMember({
          kennitala: currentOperation.kennitala,
          confirmation: 'EYÐA VARANLEGA'
        });
        break;
      }

      case 'anonymize-member': {
        const anonymizeMember = httpsCallable('anonymizeMember', 'europe-west2');
        result = await anonymizeMember({
          kennitala: currentOperation.kennitala,
          confirmation: 'NAFNLAUSA'
        });
        break;
      }

      case 'purge-deleted': {
        const purgeDeleted = httpsCallable('purgedeleted', 'europe-west2');
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
 * Load deleted records count from Cloud Function
 */
async function loadDeletedCounts() {
  try {
    const getDeletedCounts = httpsCallable('getDeletedCounts', 'europe-west2');
    const result = await getDeletedCounts();

    const counts = result.data.counts || { members: 0, votes: 0 };
    document.getElementById('deleted-members-count').textContent = String(counts.members);
    document.getElementById('deleted-votes-count').textContent = String(counts.votes);

    // Enable purge button if there are deleted records
    const totalDeleted = counts.members + counts.votes;
    document.getElementById('purge-deleted-btn').disabled = totalDeleted === 0;

  } catch (error) {
    debug.error('Failed to load deleted counts:', error);
    document.getElementById('deleted-members-count').textContent = '?';
    document.getElementById('deleted-votes-count').textContent = '?';
    document.getElementById('purge-deleted-btn').disabled = true;
  }
}

/**
 * Load recent dangerous operations for audit trail
 */
async function loadRecentOperations() {
  const container = document.getElementById('recent-dangerous-ops');
  container.textContent = '';

  try {
    const getAuditLogs = httpsCallable('getAuditLogs', 'europe-west2');
    const result = await getAuditLogs({
      hours: 168, // Last 7 days
      limit: 20
    });

    const logs = (result.data.logs || []).filter(log => {
      const action = (log.action || '').toLowerCase();
      const message = (log.message || '').toLowerCase();
      return action.includes('delete') ||
             action.includes('anonymize') ||
             action.includes('purge') ||
             message.includes('dangerous') ||
             message.includes('hard delete') ||
             message.includes('anonymiz');
    });

    if (logs.length === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'audit-placeholder';

      const noOpsMsg = document.createElement('p');
      noOpsMsg.textContent = superuserStrings.get('dangerous_no_ops');
      placeholder.appendChild(noOpsMsg);

      container.appendChild(placeholder);
      return;
    }

    // Create table
    const table = document.createElement('table');
    table.className = 'audit-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Tími', 'Aðgerð', 'Notandi'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    logs.forEach(log => {
      const row = document.createElement('tr');

      const timeCell = document.createElement('td');
      if (log.timestamp) {
        const date = new Date(log.timestamp);
        timeCell.textContent = date.toLocaleString('is-IS', { dateStyle: 'short', timeStyle: 'short' });
      } else {
        timeCell.textContent = '-';
      }
      row.appendChild(timeCell);

      const actionCell = document.createElement('td');
      actionCell.textContent = log.action || log.message || '-';
      row.appendChild(actionCell);

      const userCell = document.createElement('td');
      userCell.textContent = log.user || '-';
      row.appendChild(userCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    container.appendChild(table);

  } catch (error) {
    debug.error('Failed to load recent operations:', error);

    const errorMsg = document.createElement('p');
    errorMsg.className = 'u-text-muted';
    errorMsg.textContent = superuserStrings.get('dangerous_logs_info');
    container.appendChild(errorMsg);
  }
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
