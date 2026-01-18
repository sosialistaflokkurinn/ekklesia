/**
 * SMS Send Page
 *
 * Form for sending single SMS or creating campaigns.
 */

import { initSession, showAuthenticatedContent } from '../../../session/init.js';
import { AuthenticationError } from '../../../session/auth.js';
import { debug } from '../../../js/utils/util-debug.js';
import { requireAdmin } from '../../../js/rbac.js';
import { showToast, showError } from '../../../js/components/ui-toast.js';
import SmsAPI from './api/sms-api.js';
// Reuse email API for municipalities
import EmailAPI from '../../../admin/email/js/api/email-api.js';

// State
let currentMode = 'template';  // 'template' or 'quick'
let recipientType = 'single';  // 'single' or 'bulk'
let templates = [];
let recipientCount = 0;
let segmentCount = 1;

// DOM Elements
const templateFields = document.getElementById('template-fields');
const quickFields = document.getElementById('quick-fields');
const singleRecipientSection = document.getElementById('single-recipient-section');
const bulkRecipientSection = document.getElementById('bulk-recipient-section');
const templateSelect = document.getElementById('template-select');
const municipalitySelect = document.getElementById('municipality-select');
const recipientCountEl = document.getElementById('recipient-count');
const costEstimateEl = document.getElementById('cost-estimate');
const smsBodyTextarea = document.getElementById('sms-body');
const charCountEl = document.getElementById('char-count');
const sendBtn = document.getElementById('send-btn');
const resultCard = document.getElementById('result-card');
const resultContent = document.getElementById('result-content');

/**
 * Calculate segments
 */
function calculateSegments(text) {
  const length = text.length;
  if (length === 0) return 0;
  const charsPerSegment = length <= 160 ? 160 : 153;
  return Math.ceil(length / charsPerSegment);
}

/**
 * Update character count
 */
function updateCharCount() {
  const text = smsBodyTextarea.value;
  const chars = text.length;
  charCountEl.textContent = chars;
  segmentCount = calculateSegments(text);
}

/**
 * Load templates
 */
async function loadTemplates() {
  try {
    const result = await SmsAPI.listTemplates();
    templates = result.templates || [];

    templateSelect.innerHTML = '<option value="">Veldu sniðmát...</option>';
    templates.forEach(t => {
      const segments = Math.ceil((t.char_count || 160) / 160);
      templateSelect.innerHTML += `<option value="${t.id}" data-segments="${segments}">${t.name} (${t.char_count || 0} stafir)</option>`;
    });
  } catch (error) {
    debug.error('[SmsSend] Load templates error:', error);
    showError('Gat ekki sótt sniðmát');
  }
}

/**
 * Load municipalities
 */
async function loadMunicipalities() {
  try {
    const result = await EmailAPI.getMunicipalities();
    const municipalities = result.municipalities || [];

    municipalitySelect.innerHTML = '<option value="">Öll sveitarfélög</option>';
    municipalities.forEach(m => {
      municipalitySelect.innerHTML += `<option value="${m.name}">${m.name} (${m.count})</option>`;
    });
  } catch (error) {
    debug.error('[SmsSend] Load municipalities error:', error);
  }
}

/**
 * Update recipient count for bulk
 */
async function updateRecipientCount() {
  if (recipientType !== 'bulk') return;

  recipientCountEl.textContent = '...';
  costEstimateEl.textContent = '...';

  const filter = { status: 'active' };
  const municipality = municipalitySelect.value;
  if (municipality) {
    filter.municipalities = [municipality];
  }

  try {
    const result = await SmsAPI.previewRecipientCount({ recipient_filter: filter });
    recipientCount = result.count || 0;
    recipientCountEl.textContent = recipientCount;

    // Calculate cost estimate
    const selectedOption = templateSelect.selectedOptions[0];
    const segments = selectedOption?.dataset?.segments || segmentCount || 1;
    const cost = recipientCount * segments * 0.08;
    costEstimateEl.textContent = `~$${cost.toFixed(2)}`;
  } catch (error) {
    debug.error('[SmsSend] Preview count error:', error);
    recipientCountEl.textContent = 'Villa';
    costEstimateEl.textContent = '-';
  }
}

/**
 * Set mode (template vs quick)
 */
function setMode(mode) {
  currentMode = mode;

  // Update toggle buttons
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  // Show/hide fields
  templateFields.classList.toggle('u-hidden', mode === 'quick');
  quickFields.classList.toggle('u-hidden', mode === 'template');

  updateSendButtonText();
}

/**
 * Set recipient type (single vs bulk)
 */
function setRecipientType(type) {
  recipientType = type;

  // Update toggle buttons
  document.querySelectorAll('[data-recipient]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.recipient === type);
  });

  // Show/hide sections
  singleRecipientSection.classList.toggle('u-hidden', type === 'bulk');
  bulkRecipientSection.classList.toggle('u-hidden', type === 'single');

  if (type === 'bulk') {
    updateRecipientCount();
  }

  updateSendButtonText();
}

/**
 * Update send button text
 */
function updateSendButtonText() {
  if (recipientType === 'bulk') {
    sendBtn.textContent = 'Búa til herferð';
  } else {
    sendBtn.textContent = 'Senda SMS';
  }
}

/**
 * Send single SMS
 */
async function sendSingleSms() {
  const recipientInput = document.getElementById('recipient-input').value.trim();
  const isBroadcast = document.getElementById('broadcast-checkbox').checked;

  if (!recipientInput) {
    showError('Sláðu inn símanúmer eða kennitala');
    return;
  }

  // Determine if phone or kennitala
  const isKennitala = /^\d{10}$/.test(recipientInput.replace('-', ''));

  const payload = {
    variables: {},
    sms_type: isBroadcast ? 'broadcast' : 'transactional'
  };

  if (isKennitala) {
    payload.recipient_kennitala = recipientInput.replace('-', '');
  } else {
    payload.recipient_phone = recipientInput;
  }

  // Template or quick mode
  if (currentMode === 'template') {
    const templateId = templateSelect.value;
    if (!templateId) {
      showError('Veldu sniðmát');
      return;
    }
    payload.template_id = templateId;
  } else {
    const body = smsBodyTextarea.value.trim();
    if (!body) {
      showError('Sláðu inn skilaboð');
      return;
    }
    payload.body = body;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sendi...';

  try {
    const result = await SmsAPI.sendSms(payload);

    if (result.success) {
      showResult('success', `SMS sent! (${result.segment_count || 1} hlutar)`);
      showToast('SMS sent', 'success');
    } else if (result.skipped) {
      showResult('warning', `SMS ekki sent: ${result.reason}`);
    } else {
      showResult('error', 'SMS ekki sent');
    }
  } catch (error) {
    debug.error('[SmsSend] Send error:', error);
    showResult('error', `Villa: ${error.message}`);
    showError(error.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Senda SMS';
  }
}

/**
 * Create SMS campaign
 */
async function createCampaign() {
  const campaignName = document.getElementById('campaign-name').value.trim();
  const templateId = templateSelect.value;
  const municipality = municipalitySelect.value;

  if (!campaignName) {
    showError('Sláðu inn nafn herferðar');
    return;
  }
  if (!templateId) {
    showError('Veldu sniðmát');
    return;
  }

  if (recipientCount === 0) {
    showError('Engir viðtakendur fundust');
    return;
  }

  // Confirm before creating
  const segments = templateSelect.selectedOptions[0]?.dataset?.segments || 1;
  const cost = recipientCount * segments * 0.08;
  if (!confirm(`Búa til herferð til ${recipientCount} viðtakenda?\nÁætlaður kostnaður: ~$${cost.toFixed(2)}`)) {
    return;
  }

  sendBtn.disabled = true;
  sendBtn.textContent = 'Bý til...';

  try {
    const filter = { status: 'active' };
    if (municipality) {
      filter.municipalities = [municipality];
    }

    const result = await SmsAPI.createCampaign({
      name: campaignName,
      template_id: templateId,
      recipient_filter: filter
    });

    if (result.success) {
      showResult('success', `
        <p>Herferð búin til!</p>
        <p>Viðtakendur: ${result.recipient_count}</p>
        <p>Áætlaður kostnaður: $${result.estimated_cost}</p>
        <p><a href="/admin/sms/campaigns.html">Fara í herferðir til að senda</a></p>
      `);
      showToast('Herferð búin til', 'success');
    }
  } catch (error) {
    debug.error('[SmsSend] Create campaign error:', error);
    showResult('error', `Villa: ${error.message}`);
    showError(error.message);
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Búa til herferð';
  }
}

/**
 * Show result
 */
function showResult(type, message) {
  resultCard.classList.remove('u-hidden');
  resultContent.innerHTML = message;
  resultContent.className = type === 'error' ? 'error-text' : '';
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Mode toggle
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  // Recipient type toggle
  document.querySelectorAll('[data-recipient]').forEach(btn => {
    btn.addEventListener('click', () => setRecipientType(btn.dataset.recipient));
  });

  // Municipality change - update count
  municipalitySelect.addEventListener('change', updateRecipientCount);

  // Template change - update cost estimate
  templateSelect.addEventListener('change', () => {
    if (recipientType === 'bulk') {
      updateRecipientCount();
    }
  });

  // Character count
  smsBodyTextarea.addEventListener('input', updateCharCount);

  // Form submit
  document.getElementById('sms-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (recipientType === 'bulk') {
      await createCampaign();
    } else {
      await sendSingleSms();
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
    await Promise.all([loadTemplates(), loadMunicipalities()]);

    debug.log('[SmsSend] Initialized');
  } catch (error) {
    debug.error('[SmsSend] Init failed:', error);

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
