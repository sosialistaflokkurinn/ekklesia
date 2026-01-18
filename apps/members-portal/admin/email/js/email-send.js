/**
 * Send Email Page - Issue #323
 *
 * Send emails to members. Supports three modes:
 * - Template mode: Select a saved template, send to single recipient
 * - Quick send mode: Write subject and body directly, send to single recipient
 * - Campaign mode: Send to multiple recipients filtered by municipality
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
let currentMode = 'template';  // 'template', 'quick', or 'campaign'
let recipientType = 'single';  // 'single' or 'bulk'
let municipalities = [];

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
 * Load municipalities for select dropdown
 */
async function loadMunicipalities() {
  try {
    const { municipalities: municipalityList } = await EmailAPI.getMunicipalities();
    municipalities = municipalityList;

    const select = document.getElementById('municipality-select');

    municipalities.forEach(m => {
      const option = document.createElement('option');
      option.value = m.name;
      option.textContent = `${m.name} (${m.count} félagar)`;
      select.appendChild(option);
    });

    debug.log('[EmailSend] Loaded municipalities:', municipalities.length);

  } catch (error) {
    debug.error('[EmailSend] Failed to load municipalities:', error);
    // Non-critical - campaign mode still works with "all members"
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
 * Update recipient count preview based on current filter
 */
async function updateRecipientCount() {
  const countEl = document.getElementById('recipient-count');
  const refreshBtn = document.getElementById('refresh-count-btn');

  countEl.textContent = '...';
  countEl.classList.add('loading');
  refreshBtn.disabled = true;

  try {
    const municipality = document.getElementById('municipality-select').value;
    const filter = { status: 'active' };

    if (municipality) {
      filter.municipalities = [municipality];
    }

    const { count } = await EmailAPI.previewRecipientCount({ recipient_filter: filter });

    countEl.textContent = count;
    countEl.classList.remove('loading');

    debug.log('[EmailSend] Recipient count:', count);

  } catch (error) {
    debug.error('[EmailSend] Failed to get recipient count:', error);
    countEl.textContent = '?';
    countEl.classList.remove('loading');
  } finally {
    refreshBtn.disabled = false;
  }
}

/**
 * Setup recipient type toggle (single vs bulk)
 */
function setupRecipientTypeToggle() {
  const singleBtn = document.getElementById('recipient-single');
  const bulkBtn = document.getElementById('recipient-bulk');
  const singleSection = document.getElementById('single-recipient-section');
  const bulkSection = document.getElementById('bulk-recipient-section');
  const recipientInput = document.getElementById('recipient');
  const unsubscribeSection = document.getElementById('unsubscribe-section');

  function setRecipientType(type) {
    recipientType = type;

    // Update button states
    singleBtn.classList.toggle('active', type === 'single');
    bulkBtn.classList.toggle('active', type === 'bulk');

    // Show/hide appropriate sections
    singleSection.classList.toggle('u-hidden', type === 'bulk');
    bulkSection.classList.toggle('u-hidden', type === 'single');

    // Update required attribute
    if (type === 'single') {
      recipientInput.setAttribute('required', '');
      unsubscribeSection.classList.remove('u-hidden');
    } else {
      recipientInput.removeAttribute('required');
      // Auto-check unsubscribe for bulk sends
      document.getElementById('include-unsubscribe').checked = true;
      unsubscribeSection.classList.add('u-hidden');
      // Update recipient count
      updateRecipientCount();
    }

    // Update send button text
    updateSendButtonText();

    debug.log('[EmailSend] Recipient type changed to:', type);
  }

  singleBtn.addEventListener('click', () => setRecipientType('single'));
  bulkBtn.addEventListener('click', () => setRecipientType('bulk'));
}

/**
 * Update send button text based on mode and recipient type
 */
function updateSendButtonText() {
  const sendBtn = document.getElementById('send-btn');
  if (recipientType === 'bulk' || currentMode === 'campaign') {
    sendBtn.textContent = 'Senda fjöldapóst';
  } else {
    sendBtn.textContent = strings.email_send_btn || 'Senda póst';
  }
}

/**
 * Setup mode toggle buttons
 */
function setupModeToggle() {
  const templateBtn = document.getElementById('mode-template');
  const quickBtn = document.getElementById('mode-quick');
  const campaignBtn = document.getElementById('mode-campaign');
  const templateFields = document.getElementById('template-mode-fields');
  const quickFields = document.getElementById('quick-mode-fields');
  const campaignFields = document.getElementById('campaign-mode-fields');
  const recipientTypeSection = document.getElementById('recipient-type-section');

  function setMode(mode) {
    currentMode = mode;

    // Update button states
    templateBtn.classList.toggle('active', mode === 'template');
    quickBtn.classList.toggle('active', mode === 'quick');
    campaignBtn.classList.toggle('active', mode === 'campaign');

    // Show/hide appropriate fields
    templateFields.classList.toggle('u-hidden', mode === 'quick');
    quickFields.classList.toggle('u-hidden', mode !== 'quick');
    campaignFields.classList.toggle('u-hidden', mode !== 'campaign');

    // In campaign mode: hide recipient type toggle, force bulk mode
    if (mode === 'campaign') {
      recipientTypeSection.classList.add('u-hidden');
      // Force bulk recipient mode
      document.getElementById('recipient-bulk').click();
    } else {
      recipientTypeSection.classList.remove('u-hidden');
    }

    // Update send button text
    updateSendButtonText();

    debug.log('[EmailSend] Mode changed to:', mode);
  }

  templateBtn.addEventListener('click', () => setMode('template'));
  quickBtn.addEventListener('click', () => setMode('quick'));
  campaignBtn.addEventListener('click', () => setMode('campaign'));
}

/**
 * Send single email (template or quick mode)
 */
async function sendSingleEmail() {
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

  return {
    type: 'single',
    recipient: result.recipient,
    message_id: result.message_id
  };
}

/**
 * Send bulk email (campaign mode, or template/quick mode with bulk recipients)
 */
async function sendBulkEmail() {
  const templateId = document.getElementById('template-select').value;
  const municipality = document.getElementById('municipality-select').value;

  // Validate template selection (required for bulk sends)
  if (!templateId) {
    throw new Error('Vinsamlega veldu sniðmát');
  }

  // Quick send mode doesn't support bulk yet
  if (currentMode === 'quick') {
    throw new Error('Fljótpóstur styður ekki marga viðtakendur ennþá. Notaðu sniðmát.');
  }

  // Build recipient filter
  const recipientFilter = { status: 'active' };
  if (municipality) {
    recipientFilter.municipalities = [municipality];
  }

  // Campaign name: use provided name in campaign mode, auto-generate otherwise
  let campaignName;
  if (currentMode === 'campaign') {
    campaignName = document.getElementById('campaign-name').value.trim();
    if (!campaignName) {
      throw new Error('Vinsamlega sláðu inn heiti herferðar');
    }
  } else {
    // Auto-generate name for template mode bulk sends
    const timestamp = new Date().toLocaleString('is-IS', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    campaignName = `${selectedTemplate?.name || 'Sniðmát'} - ${timestamp}`;
  }

  // Create campaign
  const createResult = await EmailAPI.createCampaign({
    name: campaignName,
    template_id: templateId,
    recipient_filter: recipientFilter
  });

  debug.log('[EmailSend] Campaign created:', createResult);

  // Confirm before sending
  const recipientCount = createResult.recipient_count;
  const confirmed = confirm(`Ertu viss um að þú viljir senda til ${recipientCount} viðtakenda?`);

  if (!confirmed) {
    throw new Error('Hætt við að senda');
  }

  // Send campaign
  const sendResult = await EmailAPI.sendCampaign(createResult.campaign_id);

  return {
    type: 'campaign',
    campaign_id: createResult.campaign_id,
    sent_count: sendResult.sent_count,
    failed_count: sendResult.failed_count
  };
}

/**
 * Handle form submission
 */
async function handleSubmit(e) {
  e.preventDefault();

  const sendBtn = document.getElementById('send-btn');
  const originalText = sendBtn.textContent;
  sendBtn.textContent = 'Sendi...';
  sendBtn.disabled = true;

  const resultCard = document.getElementById('result-card');
  resultCard.classList.add('u-hidden');

  try {
    let result;

    // Determine send type based on mode and recipient type
    if (currentMode === 'campaign' || recipientType === 'bulk') {
      result = await sendBulkEmail();
    } else {
      result = await sendSingleEmail();
    }

    // Show success
    resultCard.classList.remove('u-hidden');

    if (result.type === 'campaign') {
      document.getElementById('result-content').innerHTML = `
        <div class="alert alert--success">
          <strong>Fjöldapóstur sendur!</strong>
          <p>Sent til ${result.sent_count} viðtakenda.</p>
          ${result.failed_count > 0 ? `<p class="text-muted">Mistókst: ${result.failed_count}</p>` : ''}
        </div>
      `;
      showToast(`Fjöldapóstur sendur til ${result.sent_count} viðtakenda`, 'success');

      // Clear form
      document.getElementById('campaign-name').value = '';
      document.getElementById('municipality-select').value = '';
      document.getElementById('template-select').value = '';
      document.getElementById('preview-section').classList.add('u-hidden');
      updateRecipientCount();

    } else {
      document.getElementById('result-content').innerHTML = `
        <div class="alert alert--success">
          <strong>${strings.email_send_success}</strong>
          <p>Póstur sendur til ${escapeHtml(result.recipient)}</p>
          <p class="text-muted">Message ID: ${result.message_id}</p>
        </div>
      `;
      showToast(strings.email_send_success, 'success');

      // Clear single recipient form
      document.getElementById('recipient').value = '';
      if (currentMode === 'template') {
        document.getElementById('template-select').value = '';
        document.getElementById('preview-section').classList.add('u-hidden');
      } else {
        document.getElementById('quick-subject').value = '';
        document.getElementById('quick-body').value = '';
      }
    }

  } catch (error) {
    debug.error('[EmailSend] Send error:', error);

    resultCard.classList.remove('u-hidden');
    document.getElementById('result-content').innerHTML = `
      <div class="alert alert--error">
        <strong>${strings.email_send_error || 'Villa'}</strong>
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

    // 5. Load templates and municipalities in parallel
    await Promise.all([
      loadTemplates(),
      loadMunicipalities()
    ]);

    // 6. Setup toggles
    setupModeToggle();
    setupRecipientTypeToggle();

    // 7. Setup event handlers
    document.getElementById('template-select').addEventListener('change', onTemplateChange);
    document.getElementById('send-form').addEventListener('submit', handleSubmit);
    document.getElementById('municipality-select').addEventListener('change', updateRecipientCount);
    document.getElementById('refresh-count-btn').addEventListener('click', updateRecipientCount);

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
