/**
 * Email Templates List - Issue #323
 *
 * Manage email templates: list, create, edit, delete.
 *
 * Module cleanup not needed - page reloads on navigation.
 */

import { initSession, showAuthenticatedContent } from '../../../session/init.js';
import { debug } from '../../../js/utils/util-debug.js';
import { adminStrings } from '../../js/i18n/admin-strings-loader.js';
import { requireAdmin } from '../../../js/rbac.js';
import { showToast, showError } from '../../../js/components/ui-toast.js';
import { escapeHTML } from '../../../js/utils/util-format.js';
// Note: showModal not used here - this page uses its own inline modal
import EmailAPI from './api/email-api.js';

// Use centralized escapeHTML from util-format.js
const escapeHtml = escapeHTML;

let strings = {};

/**
 * Set page text from admin strings
 */
function setPageText(s) {
  strings = s;

  // Page title
  document.getElementById('page-title').textContent = strings.email_templates_title + ' - Ekklesia';
  document.getElementById('templates-title').textContent = strings.email_templates_title;

  // Buttons
  document.getElementById('create-template-btn').textContent = strings.email_template_create;
  document.getElementById('create-first-template-btn').textContent = strings.email_template_create;
  document.getElementById('templates-empty-text').textContent = strings.email_template_empty;

  // Table headers
  document.getElementById('th-name').textContent = strings.email_template_name;
  document.getElementById('th-subject').textContent = strings.email_template_subject;
  document.getElementById('th-type').textContent = strings.email_template_type;
  document.getElementById('th-language').textContent = strings.email_template_language;
  document.getElementById('th-actions').textContent = strings.member_actions;

  // Modal
  document.getElementById('label-name').textContent = strings.email_template_name;
  document.getElementById('label-subject').textContent = strings.email_template_subject;
  document.getElementById('label-type').textContent = strings.email_template_type;
  document.getElementById('label-language').textContent = strings.email_template_language;
  document.getElementById('label-body').textContent = strings.email_template_body;
  document.getElementById('opt-transactional').textContent = strings.email_template_type_transactional;
  document.getElementById('opt-broadcast').textContent = strings.email_template_type_broadcast;
  document.getElementById('opt-lang-is').textContent = strings.email_template_lang_is;
  document.getElementById('opt-lang-en').textContent = strings.email_template_lang_en;
  document.getElementById('modal-cancel').textContent = strings.btn_cancel;
  document.getElementById('modal-save').textContent = strings.email_template_save;
}

/**
 * Load and display templates
 */
async function loadTemplates() {
  const loadingEl = document.getElementById('templates-loading');
  const emptyEl = document.getElementById('templates-empty');
  const tableEl = document.getElementById('templates-table');
  const tbodyEl = document.getElementById('templates-tbody');

  loadingEl.classList.remove('u-hidden');
  emptyEl.classList.add('u-hidden');
  tableEl.classList.add('u-hidden');

  try {
    const { templates } = await EmailAPI.listTemplates();

    loadingEl.classList.add('u-hidden');

    if (templates.length === 0) {
      emptyEl.classList.remove('u-hidden');
      return;
    }

    tableEl.classList.remove('u-hidden');

    tbodyEl.innerHTML = templates.map(t => `
      <tr data-id="${t.id}">
        <td data-label="${strings.email_template_name}"><strong>${escapeHtml(t.name)}</strong></td>
        <td data-label="${strings.email_template_subject}">${escapeHtml(t.subject)}</td>
        <td data-label="${strings.email_template_type}"><span class="badge badge--${t.type}">${t.type === 'transactional' ? strings.email_template_type_transactional : strings.email_template_type_broadcast}</span></td>
        <td data-label="${strings.email_template_language}">${t.language === 'is' ? strings.email_template_lang_is : strings.email_template_lang_en}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn--small btn--secondary edit-btn" data-id="${t.id}">${strings.email_template_edit}</button>
            <button class="btn btn--small btn--danger delete-btn" data-id="${t.id}">${strings.email_template_delete}</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Attach event handlers
    tbodyEl.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => editTemplate(btn.dataset.id));
    });

    tbodyEl.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteTemplate(btn.dataset.id));
    });

  } catch (error) {
    loadingEl.classList.add('u-hidden');
    debug.error('[TemplatesList] Load error:', error);
    showError(`Villa: ${error.message}`);
  }
}

/**
 * Open modal for creating new template
 */
function openCreateModal() {
  document.getElementById('modal-title').textContent = strings.email_template_create;
  document.getElementById('template-id').value = '';
  document.getElementById('template-name').value = '';
  document.getElementById('template-subject').value = '';
  document.getElementById('template-type').value = 'transactional';
  document.getElementById('template-language').value = 'is';
  document.getElementById('template-body').value = '';

  document.getElementById('template-modal').classList.remove('u-hidden');
}

/**
 * Open modal for editing existing template
 */
async function editTemplate(templateId) {
  try {
    const template = await EmailAPI.getTemplate(templateId);

    document.getElementById('modal-title').textContent = strings.email_template_edit;
    document.getElementById('template-id').value = template.id;
    document.getElementById('template-name').value = template.name || '';
    document.getElementById('template-subject').value = template.subject || '';
    document.getElementById('template-type').value = template.type || 'transactional';
    document.getElementById('template-language').value = template.language || 'is';
    document.getElementById('template-body').value = template.body_html || '';

    document.getElementById('template-modal').classList.remove('u-hidden');

  } catch (error) {
    debug.error('[TemplatesList] Edit error:', error);
    showError(`Villa: ${error.message}`);
  }
}

/**
 * Save template (create or update)
 */
async function saveTemplate() {
  const saveBtn = document.getElementById('modal-save');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = 'Vista...';
  saveBtn.disabled = true;

  try {
    const templateData = {
      name: document.getElementById('template-name').value,
      subject: document.getElementById('template-subject').value,
      body_html: document.getElementById('template-body').value,
      type: document.getElementById('template-type').value,
      language: document.getElementById('template-language').value
    };

    const templateId = document.getElementById('template-id').value;
    if (templateId) {
      templateData.template_id = templateId;
    }

    await EmailAPI.saveTemplate(templateData);

    showToast(strings.email_template_saved, 'success');
    closeModal();
    loadTemplates();

  } catch (error) {
    debug.error('[TemplatesList] Save error:', error);
    showError(`Villa: ${error.message}`);
  } finally {
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

/**
 * Delete template with confirmation
 */
async function deleteTemplate(templateId) {
  const confirmed = confirm(strings.email_template_delete_confirm);
  if (!confirmed) return;

  try {
    await EmailAPI.deleteTemplate(templateId);
    showToast('Sniðmáti eytt', 'success');
    loadTemplates();

  } catch (error) {
    debug.error('[TemplatesList] Delete error:', error);
    showError(`Villa: ${error.message}`);
  }
}

/**
 * Close modal
 */
function closeModal() {
  document.getElementById('template-modal').classList.add('u-hidden');
}

/**
 * Initialize templates page
 */
async function init() {
  try {
    // 1. Load admin strings
    const s = await adminStrings.load();

    // 2. Init session
    await initSession();

    // 3. Check admin access
    await requireAdmin();

    // Auth verified - show page content
    showAuthenticatedContent();

    // 4. Set page text
    setPageText(s);

    // 5. Load templates
    await loadTemplates();

    // 6. Setup event handlers
    document.getElementById('create-template-btn').addEventListener('click', openCreateModal);
    document.getElementById('create-first-template-btn').addEventListener('click', openCreateModal);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', saveTemplate);

    // Close modal on backdrop click
    document.querySelector('.modal__backdrop').addEventListener('click', closeModal);

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    debug.log('[TemplatesList] Initialized');

  } catch (error) {
    debug.error('[TemplatesList] Init failed:', error);

    if (error.message.includes('Unauthorized') || error.message.includes('Admin role required')) {
      window.location.href = '/members-area/';
      return;
    }

    if (error.message.includes('Not authenticated')) {
      window.location.href = '/';
      return;
    }

    showError(`Villa: ${error.message}`);
  }
}

// Run on page load
init();
