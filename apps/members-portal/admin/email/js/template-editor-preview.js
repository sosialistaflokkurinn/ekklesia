/**
 * Template Editor Preview Component
 *
 * Live preview that updates as user types in the template editor.
 * Replaces template variables with sample data.
 *
 * @module admin/email/js/template-editor-preview
 */

import { escapeHTML } from '../../../js/utils/util-format.js';

// Sample data for variable replacement
const SAMPLE_DATA = {
  'member.name': 'Jón Jónsson',
  'member.first_name': 'Jón',
  'member.email': 'jon@example.com',
  'member.kennitala': '010190-2939',
  'cell.name': 'Sella Reykjavíkur',
  'party.name': 'Sósíalistaflokkurinn',
  'unsubscribe_url': '#afthakka',
};

/**
 * Template Preview class
 * Updates an iframe with rendered template content
 */
export class TemplatePreview {
  /**
   * @param {Object} options
   * @param {HTMLIFrameElement} options.iframe - The preview iframe
   * @param {HTMLTextAreaElement} options.bodyTextarea - Template body textarea
   * @param {HTMLInputElement} options.subjectInput - Template subject input
   * @param {number} options.debounceMs - Debounce delay (default: 300ms)
   */
  constructor({ iframe, bodyTextarea, subjectInput, debounceMs = 300 }) {
    this.iframe = iframe;
    this.bodyEl = bodyTextarea;
    this.subjectEl = subjectInput;
    this.debounceMs = debounceMs;
    this.debounceTimer = null;

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    // Store bound handlers for cleanup
    this._handleBodyInput = () => this.scheduleUpdate();
    this._handleSubjectInput = () => this.scheduleUpdate();

    // Listen for input changes
    this.bodyEl?.addEventListener('input', this._handleBodyInput);
    this.subjectEl?.addEventListener('input', this._handleSubjectInput);

    // Initial render
    this.update();
  }

  /**
   * Schedule an update with debouncing
   */
  scheduleUpdate() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.update(), this.debounceMs);
  }

  /**
   * Force immediate update
   */
  forceUpdate() {
    clearTimeout(this.debounceTimer);
    this.update();
  }

  /**
   * Update the preview iframe
   */
  update() {
    const subject = this.replaceVariables(this.subjectEl?.value || '');
    const body = this.replaceVariables(this.bodyEl?.value || '');

    const html = this.buildEmailHtml(subject, body);
    this.renderToIframe(html);
  }

  /**
   * Replace template variables with sample data
   * @param {string} text - Text with variables
   * @returns {string} - Text with replaced variables
   */
  replaceVariables(text) {
    let result = text;

    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      // Match {{ variable }} with optional whitespace
      const pattern = new RegExp(`\\{\\{\\s*${key.replace('.', '\\.')}\\s*\\}\\}`, 'g');
      result = result.replace(pattern, value);
    }

    return result;
  }

  /**
   * Build complete email HTML for preview
   * @param {string} subject - Email subject
   * @param {string} body - Email body (may contain HTML)
   * @returns {string} - Complete HTML document
   */
  buildEmailHtml(subject, body) {
    // Check if body appears to be HTML
    const isHtml = /<[^>]+>/.test(body);

    // If plain text, convert newlines to <br>
    const processedBody = isHtml ? body : this.plainTextToHtml(body);

    return `<!DOCTYPE html>
<html lang="is">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      padding: 16px;
      background: #fff;
    }
    .email-subject {
      font-size: 16px;
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    .email-body {
      color: #444;
    }
    .email-body a {
      color: #722f37;
    }
    .email-body p {
      margin-bottom: 1em;
    }
    .email-body ul, .email-body ol {
      margin-bottom: 1em;
      padding-left: 1.5em;
    }
    .sample-badge {
      display: inline-block;
      background: #722f37;
      color: #fff;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: 8px;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  <div class="email-subject">
    <strong>Efni:</strong> ${escapeHTML(subject) || '<em style="color:#999">Engin efnislína</em>'}
    <span class="sample-badge">Sýnidæmi</span>
  </div>
  <div class="email-body">
    ${processedBody || '<em style="color:#999">Ekkert efni enn...</em>'}
  </div>
</body>
</html>`;
  }

  /**
   * Convert plain text to HTML (preserve line breaks)
   * @param {string} text - Plain text
   * @returns {string} - HTML with <br> for newlines
   */
  plainTextToHtml(text) {
    return escapeHTML(text).replace(/\n/g, '<br>');
  }

  /**
   * Render HTML to iframe
   * @param {string} html - Complete HTML document
   */
  renderToIframe(html) {
    try {
      const doc = this.iframe.contentDocument || this.iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
      }
    } catch (error) {
      console.error('[TemplatePreview] Failed to render:', error);
    }
  }

  /**
   * Open preview in a new window
   */
  openInNewWindow() {
    const subject = this.replaceVariables(this.subjectEl?.value || '');
    const body = this.replaceVariables(this.bodyEl?.value || '');
    const html = this.buildEmailHtml(subject, body);

    const newWindow = window.open('', '_blank', 'width=800,height=600');
    if (newWindow) {
      newWindow.document.open();
      newWindow.document.write(html);
      newWindow.document.close();
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    clearTimeout(this.debounceTimer);

    // Remove event listeners
    this.bodyEl?.removeEventListener('input', this._handleBodyInput);
    this.subjectEl?.removeEventListener('input', this._handleSubjectInput);
  }
}

export default TemplatePreview;
