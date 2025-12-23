/**
 * Election Share QR Code Component
 *
 * Generates a QR code for sharing election URLs.
 * Uses QR Server API (api.qrserver.com) for QR code generation.
 *
 * Features:
 * - QR code generation
 * - Copy URL to clipboard
 * - Modal display
 *
 * @module components/election-share-qr
 */

import { showModal } from './ui-modal.js';
import { showToast } from './ui-toast.js';
import { debug } from '../utils/util-debug.js';
import { el } from '../utils/util-dom.js';

/**
 * Default i18n strings
 */
const DEFAULT_STRINGS = {
  share_title: 'Deila kosningu',
  share_description: 'Skannaðu QR kóðann eða afritaðu hlekkinn til að deila kosningunni.',
  copy_url: 'Afrita hlekk',
  copied: 'Hlekkur afritaður!',
  copy_failed: 'Gat ekki afritað hlekk',
  close: 'Loka',
  download_qr: 'Sækja QR kóða'
};

/**
 * Get the public URL for an election
 * @param {string} electionId - Election ID
 * @returns {string} Public election URL
 */
export function getElectionPublicUrl(electionId) {
  const baseUrl = window.location.origin;
  return `${baseUrl}/elections/detail.html?id=${electionId}`;
}

/**
 * Generate QR code image URL using QR Server API
 * (Google Charts API was deprecated and shut down)
 * @param {string} data - Data to encode in QR code
 * @param {number} size - QR code size in pixels (default: 300)
 * @returns {string} QR code image URL
 */
function generateQRCodeUrl(data, size = 300) {
  const encodedData = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&format=png`;
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    debug.error('Failed to copy to clipboard:', error);
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch (fallbackError) {
      debug.error('Fallback copy failed:', fallbackError);
      return false;
    }
  }
}

/**
 * Show QR code share modal for an election
 * @param {Object} options - Options
 * @param {string} options.electionId - Election ID
 * @param {string} options.electionTitle - Election title (for display)
 * @param {Object} options.strings - i18n strings to override defaults
 * @returns {Object} Modal instance
 */
export function showElectionShareModal(options = {}) {
  const {
    electionId,
    electionTitle = '',
    strings = {}
  } = options;

  if (!electionId) {
    throw new Error('showElectionShareModal: electionId is required');
  }

  // Merge strings
  const i18n = { ...DEFAULT_STRINGS, ...strings };

  // Generate URL and QR code
  const electionUrl = getElectionPublicUrl(electionId);
  const qrCodeUrl = generateQRCodeUrl(electionUrl, 300);

  debug.log('[Share QR] Generating QR for:', electionUrl);

  // Create modal content
  const content = el('div', 'share-qr');

  // Description
  const description = el('p', 'share-qr__description', {}, i18n.share_description);
  content.appendChild(description);

  // QR Code container
  const qrContainer = el('div', 'share-qr__qr-container');
  const qrImage = el('img', 'share-qr__qr-image', {
    src: qrCodeUrl,
    alt: `QR kóði fyrir ${electionTitle || 'kosningu'}`,
    width: '300',
    height: '300'
  });
  qrContainer.appendChild(qrImage);
  content.appendChild(qrContainer);

  // URL display
  const urlContainer = el('div', 'share-qr__url-container');
  const urlInput = el('input', 'share-qr__url-input', {
    type: 'text',
    value: electionUrl,
    readonly: true
  });
  urlContainer.appendChild(urlInput);
  content.appendChild(urlContainer);

  // Action buttons
  const actions = el('div', 'share-qr__actions');

  // Copy button
  // Cleanup in modal.close() - elements removed when modal is closed
  const copyBtn = el('button', 'btn btn--primary share-qr__copy-btn', {
    type: 'button'
  }, i18n.copy_url);

  copyBtn.addEventListener('click', async () => {
    try {
      const success = await copyToClipboard(electionUrl);
      if (success) {
        showToast(i18n.copied, 'success');
        copyBtn.textContent = '✓ ' + i18n.copied;
        setTimeout(() => {
          copyBtn.textContent = i18n.copy_url;
        }, 2000);
      } else {
        showToast(i18n.copy_failed, 'error');
      }
    } catch (error) {
      showToast(i18n.copy_failed, 'error');
    }
  });

  actions.appendChild(copyBtn);

  // Download QR button
  const downloadBtn = el('button', 'btn btn--secondary share-qr__download-btn', {
    type: 'button'
  }, i18n.download_qr);

  downloadBtn.addEventListener('click', () => {
    // Open QR code in new tab for download
    window.open(qrCodeUrl, '_blank');
  });

  actions.appendChild(downloadBtn);
  content.appendChild(actions);

  // Show modal
  const modal = showModal({
    title: `${i18n.share_title}: ${electionTitle}`,
    content: content,
    size: 'md',
    buttons: [
      {
        text: i18n.close,
        onClick: () => modal.close()
      }
    ]
  });

  // Select URL on focus
  urlInput.addEventListener('focus', () => urlInput.select());

  return modal;
}

/**
 * Create a share button element
 * @param {Object} options - Options
 * @param {string} options.electionId - Election ID
 * @param {string} options.electionTitle - Election title
 * @param {string} options.buttonText - Button text (default: 'Deila')
 * @param {string} options.buttonClass - Additional button classes
 * @returns {HTMLButtonElement} Share button element
 */
export function createShareButton(options = {}) {
  const {
    electionId,
    electionTitle = '',
    buttonText = '📱 Deila',
    buttonClass = 'btn btn--secondary'
  } = options;

  const button = el('button', buttonClass, {
    type: 'button',
    title: 'Deila kosningu með QR kóða'
  }, buttonText);

  button.addEventListener('click', () => {
    showElectionShareModal({
      electionId,
      electionTitle
    });
  });

  return button;
}
