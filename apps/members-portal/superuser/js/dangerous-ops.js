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
import { formatDateOnlyIcelandic } from '../../js/utils/util-format.js';

// State
let currentOperation = null;
let confirmationStep = 1;
let countdownTimer = null;
let deletedMembersList = []; // Cached list of deleted members
let selectedMember = null; // Currently selected member for preview
let initialized = false; // Guard against multiple init calls

/**
 * Validate kennitala format (10 digits)
 */
function isValidKennitala(kt) {
  return /^\d{10}$/.test(kt);
}

/**
 * Setup tab switching
 */
function setupTabs() {
  const tabs = document.querySelectorAll('.dangerous-tabs__tab');
  const contents = document.querySelectorAll('.dangerous-tabs__content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = `tab-${tab.dataset.tab}`;

      // Update tab buttons
      tabs.forEach(t => t.classList.remove('dangerous-tabs__tab--active'));
      tab.classList.add('dangerous-tabs__tab--active');

      // Update content panels
      contents.forEach(c => c.classList.remove('dangerous-tabs__content--active'));
      document.getElementById(targetId).classList.add('dangerous-tabs__content--active');

      // Clear selection when switching tabs
      clearSelection();
    });
  });
}

/**
 * Clear member selection
 */
function clearSelection() {
  selectedMember = null;

  // Clear all selected rows
  document.querySelectorAll('.data-table--selectable tr.selected').forEach(row => {
    row.classList.remove('selected');
  });

  // Hide all preview panels
  document.querySelectorAll('.dangerous-ops__preview').forEach(panel => {
    panel.style.display = 'none';
  });

  // Clear inputs
  const deleteInput = document.getElementById('delete-member-id');
  const anonymizeInput = document.getElementById('anonymize-member-id');
  if (deleteInput) deleteInput.value = '';
  if (anonymizeInput) anonymizeInput.value = '';

  // Disable buttons
  const deleteBtn = document.getElementById('delete-member-btn');
  const anonymizeBtn = document.getElementById('anonymize-member-btn');
  if (deleteBtn) deleteBtn.disabled = true;
  if (anonymizeBtn) anonymizeBtn.disabled = true;
}

/**
 * Select a member and show preview
 */
function selectMember(member, tabType) {
  selectedMember = member;

  // Clear previous selections in this tab
  document.querySelectorAll(`#deleted-members-tbody-${tabType} tr.selected`).forEach(row => {
    row.classList.remove('selected');
  });

  // Highlight the clicked row
  const rows = document.querySelectorAll(`#deleted-members-tbody-${tabType} tr`);
  rows.forEach(row => {
    if (row.dataset.memberId === String(member.id)) {
      row.classList.add('selected');
      debug.log('Row selected:', row);
    }
  });

  // Show preview panel
  const previewPanel = document.getElementById(`preview-${tabType}`);
  if (previewPanel) {
    previewPanel.style.display = 'block';

    // Update preview content
    document.getElementById(`preview-name-${tabType}`).textContent = member.name || '-';
    document.getElementById(`preview-kt-${tabType}`).textContent = member.kennitala_masked || '-';
    document.getElementById(`preview-date-${tabType}`).textContent =
      member.deleted_at ? formatDateOnlyIcelandic(member.deleted_at) : '-';
  }

  // Enable the action button since member is selected from table
  // We'll use member.id for the backend call
  const btnId = tabType === 'delete' ? 'delete-member-btn' : 'anonymize-member-btn';
  const btn = document.getElementById(btnId);
  if (btn) {
    btn.disabled = false;
  }

  // Update input to show masked kennitala (for display only)
  const inputId = tabType === 'delete' ? 'delete-member-id' : 'anonymize-member-id';
  const input = document.getElementById(inputId);
  if (input) {
    input.value = member.kennitala_masked || '';
    input.dataset.memberId = String(member.id);
  }
}

/**
 * Enable/disable buttons based on input validation
 * Note: When a member is selected from the table, the button should stay enabled
 * even if the displayed kennitala is masked. We check for selectedMember first.
 */
function setupInputValidation() {
  const deleteInput = document.getElementById('delete-member-id');
  const deleteBtn = document.getElementById('delete-member-btn');
  const anonymizeInput = document.getElementById('anonymize-member-id');
  const anonymizeBtn = document.getElementById('anonymize-member-btn');

  if (deleteInput && deleteBtn) {
    deleteInput.addEventListener('input', (e) => {
      // If member was selected from table, keep button enabled
      // Only validate manual input (when no member is selected)
      if (selectedMember) {
        // Check if user is typing manually (cleared the selection)
        const typedValue = deleteInput.value;
        if (typedValue !== selectedMember.kennitala_masked) {
          // User is typing manually, clear selection
          selectedMember = null;
          document.querySelectorAll('#deleted-members-tbody-delete tr.selected').forEach(row => {
            row.classList.remove('selected');
          });
          document.getElementById('preview-delete').style.display = 'none';
          deleteBtn.disabled = !isValidKennitala(typedValue);
        }
        // Otherwise keep button enabled (selection is valid)
      } else {
        deleteBtn.disabled = !isValidKennitala(deleteInput.value);
      }
    });
  }

  if (anonymizeInput && anonymizeBtn) {
    anonymizeInput.addEventListener('input', (e) => {
      // If member was selected from table, keep button enabled
      if (selectedMember) {
        const typedValue = anonymizeInput.value;
        if (typedValue !== selectedMember.kennitala_masked) {
          selectedMember = null;
          document.querySelectorAll('#deleted-members-tbody-anonymize tr.selected').forEach(row => {
            row.classList.remove('selected');
          });
          document.getElementById('preview-anonymize').style.display = 'none';
          anonymizeBtn.disabled = !isValidKennitala(typedValue);
        }
      } else {
        anonymizeBtn.disabled = !isValidKennitala(anonymizeInput.value);
      }
    });
  }
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
  document.getElementById('confirm-input').classList.remove('confirmation-input--valid');

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
          member_id: currentOperation.memberId,
          confirmation: 'EYÐA VARANLEGA'
        });
        break;
      }

      case 'anonymize-member': {
        const anonymizeMember = httpsCallable('anonymizeMember', 'europe-west2');
        result = await anonymizeMember({
          member_id: currentOperation.memberId,
          confirmation: 'NAFNHREINSA'
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
    clearSelection();

    // Refresh data
    loadDeletedCounts();
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

    // Update purge tab counts
    document.getElementById('deleted-members-count').textContent = String(counts.members);
    document.getElementById('deleted-votes-count').textContent = String(counts.votes);

    // Update counts in delete/anonymize tabs
    const deleteCount = document.getElementById('deleted-count-delete');
    const anonymizeCount = document.getElementById('deleted-count-anonymize');
    if (deleteCount) deleteCount.textContent = String(counts.members);
    if (anonymizeCount) anonymizeCount.textContent = String(counts.members);

    // Enable purge button if there are deleted records
    const totalDeleted = counts.members + counts.votes;
    document.getElementById('purge-deleted-btn').disabled = totalDeleted === 0;

    // Cache and populate deleted members tables
    deletedMembersList = result.data.deleted_members || [];
    populateDeletedMembersTables(deletedMembersList);

  } catch (error) {
    debug.error('Failed to load deleted counts:', error);
    document.getElementById('deleted-members-count').textContent = '?';
    document.getElementById('deleted-votes-count').textContent = '?';
    document.getElementById('purge-deleted-btn').disabled = true;
  }
}

/**
 * Populate deleted members tables in all tabs
 */
function populateDeletedMembersTables(members) {
  // Tables to populate
  const tableConfigs = [
    { tbodyId: 'deleted-members-tbody-delete', emptyId: 'no-deleted-delete', type: 'delete', selectable: true },
    { tbodyId: 'deleted-members-tbody-anonymize', emptyId: 'no-deleted-anonymize', type: 'anonymize', selectable: true },
    { tbodyId: 'deleted-members-tbody', emptyId: null, type: 'purge', selectable: false }
  ];

  tableConfigs.forEach(config => {
    const tbody = document.getElementById(config.tbodyId);
    if (!tbody) return;

    // Clear existing rows
    tbody.textContent = '';

    if (!members || members.length === 0) {
      if (config.emptyId) {
        document.getElementById(config.emptyId).style.display = 'block';
      }
      const section = document.getElementById('deleted-members-section');
      if (section && config.type === 'purge') {
        section.style.display = 'none';
      }
      return;
    }

    // Hide empty state
    if (config.emptyId) {
      document.getElementById(config.emptyId).style.display = 'none';
    }

    // Show purge section
    if (config.type === 'purge') {
      const section = document.getElementById('deleted-members-section');
      if (section) section.style.display = 'block';
    }

    // Populate table
    members.forEach(member => {
      const row = document.createElement('tr');
      row.dataset.memberId = String(member.id);

      if (config.selectable) {
        row.classList.add('data-table__row--clickable');
        row.addEventListener('click', () => {
          selectMember(member, config.type);
        });

        // Checkbox cell
        const checkCell = document.createElement('td');
        checkCell.className = 'data-table__td--checkbox';
        const checkbox = document.createElement('span');
        checkbox.className = 'data-table__checkbox';
        checkCell.appendChild(checkbox);
        row.appendChild(checkCell);
      }

      // Name cell
      const nameCell = document.createElement('td');
      nameCell.textContent = member.name || '-';
      row.appendChild(nameCell);

      // Kennitala cell (masked)
      const ktCell = document.createElement('td');
      ktCell.textContent = member.kennitala_masked || '-';
      row.appendChild(ktCell);

      // Deleted at cell
      const dateCell = document.createElement('td');
      if (member.deleted_at) {
        dateCell.textContent = formatDateOnlyIcelandic(member.deleted_at);
      } else {
        dateCell.textContent = '-';
      }
      row.appendChild(dateCell);

      tbody.appendChild(row);
    });
  });
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
        timeCell.textContent = formatDateOnlyIcelandic(log.timestamp);
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
    if (!selectedMember) return;
    openConfirmModal({
      type: 'delete-member',
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      kennitala: selectedMember.kennitala_masked
    });
  });

  // Anonymize member button
  document.getElementById('anonymize-member-btn').addEventListener('click', () => {
    if (!selectedMember) return;
    openConfirmModal({
      type: 'anonymize-member',
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      kennitala: selectedMember.kennitala_masked
    });
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
  // Prevent multiple initializations (module can be loaded multiple times)
  if (initialized) return;
  initialized = true;

  try {
    await R.load('is');
    await superuserStrings.load();
    superuserStrings.translatePage();
    await initSession();
    await requireSuperuser();

    setupTabs();
    setupInputValidation();
    setupEventListeners();
    loadDeletedCounts();
    loadRecentOperations();

  } catch (error) {
    debug.error('Failed to initialize dangerous ops:', error);

    if (error.message.includes('Superuser role required')) {
      return;
    }

    showToast(superuserStrings.get('dangerous_op_error').replace('%s', error.message), 'error');
  }
}

init();
