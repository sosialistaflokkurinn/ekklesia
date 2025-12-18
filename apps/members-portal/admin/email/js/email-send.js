/**
 * Send Email Page - Issue #323
 *
 * Send a single email to a member or email address.
 */

import { initSession } from '../../../session/init.js';
import { debug } from '../../../js/utils/util-debug.js';
import { adminStrings } from '../../js/i18n/admin-strings-loader.js';
import { requireAdmin } from '../../../js/rbac.js';
import { showToast, showError } from '../../../js/components/ui-toast.js';
import EmailAPI from './api/email-api.js';

let strings = {};
let templates = [];
let selectedTemplate = null;

/**
 * Set page text from admin strings
 */
function setPageText(s) {
  strings = s;

  // Page title
  document.getElementById('page-title').textContent = strings.email_send_title + ' - Ekklesia';
  document.getElementById('send-title').textContent = strings.email_send_title;
  document.getElementById('send-subtitle').textContent = strings.email_send_subtitle;

  // Form labels
  document.getElementById('label-recipient').textContent = strings.email_send_recipient;
  document.getElementById('recipient').placeholder = strings.email_send_recipient_placeholder;
  document.getElementById('label-template').textContent = strings.email_send_template;
  document.getElementById('opt-select-template').textContent = strings.email_send_template_placeholder;
  document.getElementById('send-btn').textContent = strings.email_send_btn;
}

/**
 * Load templates for select dropdown
 */
async function loadTemplates() {
  try {
    const { templates: templateList } = await EmailAPI.listTemplates();
    templates = templateList;

    const select = document.getElementById('template-select');

    templates.forEach(t => {
      const option = document.createElement('option');
      option.value = t.id;
      option.textContent = `${t.name} (${t.type === 'transactional' ? 'Viðskipta' : 'Fjölda'})`;
      select.appendChild(option);
    });

    debug.log('[EmailSend] Loaded templates:', templates.length);

  } catch (error) {
    debug.error('[EmailSend] Failed to load templates:', error);
    showError('Gat ekki hlaðið sniðmátum');
  }
}

/**
 * Show template preview when selected
 */
async function onTemplateChange(e) {
  const templateId = e.target.value;
  const previewSection = document.getElementById('preview-section');
  const previewBox = document.getElementById('template-preview');

  if (!templateId) {
    previewSection.classList.add('u-hidden');
    selectedTemplate = null;
    return;
  }

  try {
    selectedTemplate = await EmailAPI.getTemplate(templateId);

    previewBox.innerHTML = `
      <div class="preview-subject"><strong>Efni:</strong> ${escapeHtml(selectedTemplate.subject)}</div>
      <hr>
      <div class="preview-body">${selectedTemplate.body_html}</div>
    `;

    previewSection.classList.remove('u-hidden');

  } catch (error) {
    debug.error('[EmailSend] Preview error:', error);
    previewSection.classList.add('u-hidden');
  }
}

/**
 * Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

/**
 * Send email
 */
async function sendEmail(e) {
  e.preventDefault();

  const sendBtn = document.getElementById('send-btn');
  const originalText = sendBtn.textContent;
  sendBtn.textContent = 'Sendi...';
  sendBtn.disabled = true;

  const resultCard = document.getElementById('result-card');
  resultCard.classList.add('u-hidden');

  try {
    const recipient = document.getElementById('recipient').value.trim();
    const templateId = document.getElementById('template-select').value;

    if (!recipient || !templateId) {
      throw new Error('Vinsamlega fylltu út alla reiti');
    }

    // Determine if recipient is email or kennitala
    const isEmail = recipient.includes('@');
    const sendData = {
      template_id: templateId
    };

    if (isEmail) {
      sendData.recipient_email = recipient;
    } else {
      // Assume kennitala
      sendData.recipient_kennitala = recipient.replace(/-/g, '');
    }

    const result = await EmailAPI.sendEmail(sendData);

    // Show success
    resultCard.classList.remove('u-hidden');
    document.getElementById('result-content').innerHTML = `
      <div class="alert alert--success">
        <strong>${strings.email_send_success}</strong>
        <p>Póstur sendur til ${escapeHtml(result.recipient)}</p>
        <p class="text-muted">Message ID: ${result.message_id}</p>
      </div>
    `;

    showToast(strings.email_send_success, 'success');

    // Clear form
    document.getElementById('recipient').value = '';
    document.getElementById('template-select').value = '';
    document.getElementById('preview-section').classList.add('u-hidden');

  } catch (error) {
    debug.error('[EmailSend] Send error:', error);

    resultCard.classList.remove('u-hidden');
    document.getElementById('result-content').innerHTML = `
      <div class="alert alert--error">
        <strong>${strings.email_send_error}</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;

    showError(error.message);

  } finally {
    sendBtn.textContent = originalText;
    sendBtn.disabled = false;
  }
}

/**
 * Initialize send page
 */
async function init() {
  try {
    // 1. Load admin strings
    const s = await adminStrings.load();

    // 2. Init session
    await initSession();

    // 3. Check admin access
    await requireAdmin();

    // 4. Set page text
    setPageText(s);

    // 5. Load templates
    await loadTemplates();

    // 6. Setup event handlers
    document.getElementById('template-select').addEventListener('change', onTemplateChange);
    document.getElementById('send-form').addEventListener('submit', sendEmail);

    debug.log('[EmailSend] Initialized');

  } catch (error) {
    debug.error('[EmailSend] Init failed:', error);

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
