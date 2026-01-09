/**
 * Send Email Page - Issue #323
 *
 * Send a single email to a member or email address.
 * Supports two modes:
 * - Template mode: Select a saved template
 * - Quick send mode: Write subject and body directly
 *
 * Module cleanup not needed - page reloads on navigation.
 */

import { initSession, showAuthenticatedContent } from '../../../session/init.js';
import { AuthenticationError } from '../../../session/auth.js';
import { debug } from '../../../js/utils/util-debug.js';
import { adminStrings } from '../../js/i18n/admin-strings-loader.js';
import { requireAdmin } from '../../../js/rbac.js';
import { showToast, showError } from '../../../js/components/ui-toast.js';
import { escapeHTML } from '../../../js/utils/util-format.js';
import EmailAPI from './api/email-api.js';

// Use centralized escapeHTML from util-format.js
const escapeHtml = escapeHTML;

let strings = {};
let templates = [];
let selectedTemplate = null;
let currentMode = 'template';  // 'template' or 'quick'

/**
 * Set page text from admin strings
 */
function setPageText(s) {
  strings = s;

  // Page title
  document.getElementById('page-title').textContent = strings.email_send_title + ' - Ekklesia';

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
 * Setup mode toggle buttons
 */
function setupModeToggle() {
  const templateBtn = document.getElementById('mode-template');
  const quickBtn = document.getElementById('mode-quick');
  const templateFields = document.getElementById('template-mode-fields');
  const quickFields = document.getElementById('quick-mode-fields');

  function setMode(mode) {
    currentMode = mode;

    // Update button states
    templateBtn.classList.toggle('active', mode === 'template');
    quickBtn.classList.toggle('active', mode === 'quick');

    // Show/hide appropriate fields
    templateFields.classList.toggle('u-hidden', mode === 'quick');
    quickFields.classList.toggle('u-hidden', mode === 'template');

    debug.log('[EmailSend] Mode changed to:', mode);
  }

  templateBtn.addEventListener('click', () => setMode('template'));
  quickBtn.addEventListener('click', () => setMode('quick'));
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

    if (!recipient) {
      throw new Error('Vinsamlega sláðu inn viðtakanda');
    }

    // Build send data based on mode
    const sendData = {};

    // Check if unsubscribe link should be included (broadcast mode)
    const includeUnsubscribe = document.getElementById('include-unsubscribe').checked;
    if (includeUnsubscribe) {
      sendData.email_type = 'broadcast';
    }

    if (currentMode === 'template') {
      const templateId = document.getElementById('template-select').value;
      if (!templateId) {
        throw new Error('Vinsamlega veldu sniðmát');
      }
      sendData.template_id = templateId;
    } else {
      // Quick send mode
      const subject = document.getElementById('quick-subject').value.trim();
      const body = document.getElementById('quick-body').value.trim();

      if (!subject || !body) {
        throw new Error('Vinsamlega fylltu út efnislínu og meginmál');
      }

      sendData.subject = subject;
      sendData.body_html = body;
    }

    // Determine if recipient is email or kennitala
    const isEmail = recipient.includes('@');
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
    if (currentMode === 'template') {
      document.getElementById('template-select').value = '';
      document.getElementById('preview-section').classList.add('u-hidden');
    } else {
      document.getElementById('quick-subject').value = '';
      document.getElementById('quick-body').value = '';
    }

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

    // Auth verified - show page content
    showAuthenticatedContent();

    // 4. Set page text
    setPageText(s);

    // 5. Load templates
    await loadTemplates();

    // 6. Setup mode toggle
    setupModeToggle();

    // 7. Setup event handlers
    document.getElementById('template-select').addEventListener('change', onTemplateChange);
    document.getElementById('send-form').addEventListener('submit', sendEmail);

    debug.log('[EmailSend] Initialized');

  } catch (error) {
    debug.error('[EmailSend] Init failed:', error);

    // Auth error - redirect to login
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

// Run on page load
init();
