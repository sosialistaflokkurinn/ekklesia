/**
 * SMS Templates List
 *
 * Template management for SMS.
 */

import { initSession, showAuthenticatedContent } from '../../../session/init.js';
import { AuthenticationError } from '../../../session/auth.js';
import { debug } from '../../../js/utils/util-debug.js';
import { requireAdmin } from '../../../js/rbac.js';
import { showToast, showError } from '../../../js/components/ui-toast.js';
import { escapeHTML } from '../../../js/utils/util-format.js';
import SmsAPI from './api/sms-api.js';

// State
let templates = [];
let selectedTemplate = null;

// DOM Elements
const loadingEl = document.getElementById('templates-loading');
const emptyEl = document.getElementById('templates-empty');
const tableEl = document.getElementById('templates-table');
const tbodyEl = document.getElementById('templates-tbody');
const modalEl = document.getElementById('template-modal');

// Modal elements
const modalTitle = document.getElementById('modal-title');
const templateIdInput = document.getElementById('template-id');
const templateNameInput = document.getElementById('template-name');
const templateTypeSelect = document.getElementById('template-type');
const templateLanguageSelect = document.getElementById('template-language');
const templateBodyTextarea = document.getElementById('template-body');
const charCountEl = document.getElementById('char-count');
const saveBtn = document.getElementById('modal-save');
const deleteBtn = document.getElementById('modal-delete');

/**
 * Calculate SMS segments
 */
function calculateSegments(text) {
  const length = text.length;
  if (length === 0) return { chars: 0, segments: 0 };

  // GSM-7 encoding: 160 chars per segment, or 153 for multi-part
  // Unicode: 70 chars per segment, or 67 for multi-part
  // For simplicity, assume GSM-7 (most Icelandic chars work)
  const charsPerSegment = length <= 160 ? 160 : 153;
  const segments = Math.ceil(length / charsPerSegment);

  return { chars: length, segments };
}

/**
 * Update character counter
 */
function updateCharCount() {
  const text = templateBodyTextarea.value;
  const { chars, segments } = calculateSegments(text);

  charCountEl.textContent = chars;

  // Update color based on length
  charCountEl.classList.remove('char-count--warning', 'char-count--danger');
  if (chars > 320) {
    charCountEl.classList.add('char-count--danger');
  } else if (chars > 160) {
    charCountEl.classList.add('char-count--warning');
  }

  // Update segment info
  const segmentInfo = document.getElementById('segment-info');
  if (segments > 1) {
    segmentInfo.textContent = `= ${segments} hlutar (~$${(segments * 0.08).toFixed(2)}/SMS)`;
  } else {
    segmentInfo.textContent = 'Lengri skilaboð skiptast í marga hluta.';
  }
}

/**
 * Load templates from API
 */
async function loadTemplates() {
  loadingEl.classList.remove('u-hidden');
  emptyEl.classList.add('u-hidden');
  tableEl.classList.add('u-hidden');

  try {
    const result = await SmsAPI.listTemplates();
    templates = result.templates || [];

    loadingEl.classList.add('u-hidden');

    if (templates.length === 0) {
      emptyEl.classList.remove('u-hidden');
    } else {
      renderTemplates();
      tableEl.classList.remove('u-hidden');
    }
  } catch (error) {
    debug.error('[SmsTemplates] Load error:', error);
    loadingEl.classList.add('u-hidden');
    showError(`Villa við að sækja sniðmát: ${error.message}`);
  }
}

/**
 * Render templates table
 */
function renderTemplates() {
  tbodyEl.innerHTML = templates.map(template => {
    const typeLabel = template.type === 'transactional' ? 'Transactional' : 'Broadcast';
    const typeBadge = template.type === 'transactional'
      ? 'badge--transactional'
      : 'badge--broadcast';

    return `
      <tr data-id="${escapeHTML(template.id)}">
        <td>${escapeHTML(template.name)}</td>
        <td><span class="badge ${typeBadge}">${typeLabel}</span></td>
        <td>${template.char_count || 0} stafir</td>
        <td class="table-actions">
          <button class="btn btn--small btn--secondary edit-btn">Breyta</button>
          <button class="btn btn--small btn--danger delete-btn">Eyða</button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach event listeners
  tbodyEl.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      const template = templates.find(t => t.id === row.dataset.id);
      if (template) openEditModal(template);
    });
  });

  tbodyEl.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('tr');
      const template = templates.find(t => t.id === row.dataset.id);
      if (template && confirm(`Ertu viss um að þú viljir eyða "${template.name}"?`)) {
        await deleteTemplate(template.id);
      }
    });
  });
}

/**
 * Open modal for creating new template
 */
function openCreateModal() {
  selectedTemplate = null;
  modalTitle.textContent = 'Nýtt SMS sniðmát';

  // Clear form
  templateIdInput.value = '';
  templateNameInput.value = '';
  templateTypeSelect.value = 'transactional';
  templateLanguageSelect.value = 'is';
  templateBodyTextarea.value = '';

  // Hide delete button for new templates
  deleteBtn.classList.add('u-hidden');

  updateCharCount();
  showModal();
}

/**
 * Open modal for editing template
 */
async function openEditModal(template) {
  selectedTemplate = template;
  modalTitle.textContent = 'Breyta sniðmáti';

  // Load full template data
  try {
    const fullTemplate = await SmsAPI.getTemplate(template.id);

    templateIdInput.value = fullTemplate.id;
    templateNameInput.value = fullTemplate.name || '';
    templateTypeSelect.value = fullTemplate.type || 'transactional';
    templateLanguageSelect.value = fullTemplate.language || 'is';
    templateBodyTextarea.value = fullTemplate.body || '';

    // Show delete button for existing templates
    deleteBtn.classList.remove('u-hidden');

    updateCharCount();
    showModal();
  } catch (error) {
    debug.error('[SmsTemplates] Load template error:', error);
    showError(`Villa við að sækja sniðmát: ${error.message}`);
  }
}

/**
 * Save template
 */
async function saveTemplate() {
  const templateData = {
    name: templateNameInput.value.trim(),
    body: templateBodyTextarea.value,
    type: templateTypeSelect.value,
    language: templateLanguageSelect.value
  };

  // Include template_id if editing
  if (templateIdInput.value) {
    templateData.template_id = templateIdInput.value;
  }

  // Validate
  if (!templateData.name) {
    showError('Heiti er skylt');
    return;
  }
  if (!templateData.body) {
    showError('Skilaboð eru skylt');
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Vista...';

  try {
    await SmsAPI.saveTemplate(templateData);
    showToast('Sniðmát vistað', 'success');
    hideModal();
    await loadTemplates();
  } catch (error) {
    debug.error('[SmsTemplates] Save error:', error);
    showError(`Villa við að vista: ${error.message}`);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Vista';
  }
}

/**
 * Delete template
 */
async function deleteTemplate(templateId) {
  try {
    await SmsAPI.deleteTemplate(templateId);
    showToast('Sniðmáti eytt', 'success');
    hideModal();
    await loadTemplates();
  } catch (error) {
    debug.error('[SmsTemplates] Delete error:', error);
    showError(`Villa við að eyða: ${error.message}`);
  }
}

/**
 * Show modal
 */
function showModal() {
  modalEl.classList.remove('u-hidden');
  requestAnimationFrame(() => {
    modalEl.classList.add('modal-overlay--show');
    templateNameInput.focus();
  });
}

/**
 * Hide modal
 */
function hideModal() {
  modalEl.classList.remove('modal-overlay--show');
  setTimeout(() => {
    modalEl.classList.add('u-hidden');
  }, 200);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Create template buttons
  document.getElementById('create-template-btn').addEventListener('click', openCreateModal);
  document.getElementById('create-first-template-btn')?.addEventListener('click', openCreateModal);

  // Modal buttons
  document.getElementById('modal-close').addEventListener('click', hideModal);
  document.getElementById('modal-cancel').addEventListener('click', hideModal);
  document.getElementById('modal-save').addEventListener('click', saveTemplate);
  document.getElementById('modal-delete').addEventListener('click', async () => {
    if (selectedTemplate && confirm(`Ertu viss um að þú viljir eyða "${selectedTemplate.name}"?`)) {
      await deleteTemplate(selectedTemplate.id);
    }
  });

  // Character counter
  templateBodyTextarea.addEventListener('input', updateCharCount);

  // Close modal on backdrop click
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) hideModal();
  });

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalEl.classList.contains('u-hidden')) {
      hideModal();
    }
  });
}

/**
 * Initialize
 */
async function init() {
  try {
    await initSession();
    await requireAdmin();
    showAuthenticatedContent();

    setupEventListeners();
    await loadTemplates();

    debug.log('[SmsTemplates] Initialized');
  } catch (error) {
    debug.error('[SmsTemplates] Init failed:', error);

    if (error instanceof AuthenticationError) {
      window.location.href = '/';
      return;
    }

    if (error.message?.includes('Unauthorized') || error.message?.includes('Admin role required')) {
      return;
    }

    showError(`Villa: ${error.message}`);
  }
}

init();
