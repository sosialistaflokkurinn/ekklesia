/**
 * Template Editor AI Assistant Component
 *
 * AI-powered assistant to help write email templates.
 * Provides text improvements, variable help, and formatting suggestions.
 *
 * @module admin/email/js/template-editor-assistant
 */

import { debug } from '../../../js/utils/util-debug.js';
import { getFirebaseAuth } from '../../../firebase/app.js';
import { escapeHTML } from '../../../js/utils/util-format.js';

const EVENTS_API_BASE = 'https://events-service-521240388393.europe-west1.run.app';

// Quick action prompts (Icelandic) - focus on formatting, not changing words
const QUICK_ACTIONS = {
  socialist: `Sníðið þennan texta sem fallegan HTML tölvupóst í Sósíalistaflokksstíl. Notaðu NÁKVÆMLEGA þessa uppbyggingu:

1. YTRI WRAPPER: <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;">

2. HEADER (ef fyrirsögn er í textanum): <div style="background-color: #c41e3a; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;"><h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">FYRIRSÖGN</h1></div>

3. EFNISSVÆÐI: <div style="padding: 30px; background-color: #f9f9f9; border: 1px solid #e0e0e0; border-top: none;">

4. UPPLÝSINGAKASSI (fyrir dagsetningu, tíma, stað): <div style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin: 20px 0;">
   <p style="margin: 8px 0; font-size: 15px; color: #444;"><strong style="color: #c41e3a;">📅 Dagsetning:</strong> 14. janúar 2026</p>
   <p style="margin: 8px 0; font-size: 15px; color: #444;"><strong style="color: #c41e3a;">🕐 Tími:</strong> 18:00</p>
   <p style="margin: 8px 0; font-size: 15px; color: #444;"><strong style="color: #c41e3a;">📍 Staður:</strong> Félagsheimilið, Reykjavík</p>
</div>

5. UNDIRFYRIRSAGNIR: <h2 style="color: #c41e3a; font-size: 20px; margin: 25px 0 15px 0; border-left: 4px solid #c41e3a; padding-left: 15px;">

6. MÁLSGREINAR: <p style="font-size: 16px; color: #444; line-height: 1.6;">

7. LISTAR: <ul style="font-size: 15px; color: #444; line-height: 1.8; padding-left: 20px;">

8. TENGLAR: <a href="..." style="color: #c41e3a; font-weight: 600;">

EKKI breyta orðunum. Skilaðu BARA HTML.`,
  format: 'Sníðið þennan texta með fallegu HTML útliti. Notaðu fyrirsagnir, áherslur og skipulag - EN BREYTTU EKKI orðunum. Skilaðu BARA HTML kóðanum, engar útskýringar, engin ``` merki.',
  list: 'Breyttu þessu í fallegan HTML lista (<ul> eða <ol>) ef það á við. EKKI breyta orðunum. Skilaðu BARA HTML, engar útskýringar.',
  variables: 'Útskýrðu stuttlega hvaða breytur eru tiltækar ({{ member.name }} o.s.frv.) og hvernig ég nota þær.',
};

/**
 * Template Editor Assistant class
 */
export class TemplateEditorAssistant {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.messagesContainer - Container for chat messages
   * @param {HTMLInputElement} options.inputField - User input field
   * @param {HTMLButtonElement} options.sendButton - Send button
   * @param {HTMLElement} options.quickActionsContainer - Container for quick action buttons
   * @param {HTMLTextAreaElement} options.templateTextarea - Template body textarea (for context)
   */
  constructor({
    messagesContainer,
    inputField,
    sendButton,
    quickActionsContainer,
    templateTextarea,
  }) {
    this.messagesEl = messagesContainer;
    this.inputEl = inputField;
    this.sendBtn = sendButton;
    this.quickActionsEl = quickActionsContainer;
    this.textareaEl = templateTextarea;

    this.chatHistory = [];
    this.isLoading = false;

    this.init();
  }

  /**
   * Initialize event listeners
   */
  init() {
    // Send button click
    this.sendBtn?.addEventListener('click', () => this.handleSend());

    // Enter key to send
    this.inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Quick action buttons
    this.quickActionsEl?.querySelectorAll('.assistant__quick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action && QUICK_ACTIONS[action]) {
          this.sendMessage(QUICK_ACTIONS[action]);
        }
      });
    });

    debug.log('[TemplateAssistant] Initialized');
  }

  /**
   * Handle send button click
   */
  handleSend() {
    const message = this.inputEl?.value?.trim();
    if (!message || this.isLoading) return;

    this.inputEl.value = '';
    this.sendMessage(message);
  }

  /**
   * Send message to AI assistant
   * @param {string} message - User message or quick action prompt
   */
  async sendMessage(message) {
    if (this.isLoading) return;

    // Add user message to UI (only if not a quick action)
    const isQuickAction = Object.values(QUICK_ACTIONS).includes(message);
    if (!isQuickAction) {
      this.addMessage('user', message);
    } else {
      // Show what action was triggered
      const actionName = Object.entries(QUICK_ACTIONS).find(([_, v]) => v === message)?.[0];
      const actionLabels = { socialist: 'Sósíalistasnið', format: 'Sníða', list: 'Listi', variables: 'Breytur' };
      this.addMessage('user', `[${actionLabels[actionName] || actionName}]`);
    }

    // Add to history
    this.chatHistory.push({ role: 'user', content: message });

    this.showLoading();

    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Þú þarft að vera innskráð/ur');
      }

      const token = await user.getIdToken();

      // Get current template content for context
      const templateContent = this.textareaEl?.value || '';

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch(`${EVENTS_API_BASE}/api/email-template-assistant/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message,
          templateContent,
          history: this.chatHistory.slice(-4)
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Villa kom upp');
      }

      const data = await response.json();
      this.hideLoading();

      // Format and display response with "Use this" button
      const formattedReply = this.formatMarkdown(data.reply);
      this.addMessage('assistant', formattedReply, data.reply);

      // Add to history (unformatted)
      this.chatHistory.push({ role: 'assistant', content: data.reply });

    } catch (error) {
      this.hideLoading();
      debug.error('[TemplateAssistant] Error:', error);

      let errorMsg = error.message;
      if (error.name === 'AbortError') {
        errorMsg = 'Beiðnin tók of langan tíma. Reyndu aftur.';
      }

      this.addMessage('assistant', `Villa: ${errorMsg}`);
    }
  }

  /**
   * Add message to chat display
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content (may contain HTML for assistant)
   * @param {string} rawText - Raw unformatted text (for "Use this" button)
   */
  addMessage(role, content, rawText = null) {
    const messageEl = document.createElement('div');
    messageEl.className = `assistant__message assistant__message--${role}`;

    if (role === 'user') {
      messageEl.textContent = content;
    } else {
      messageEl.innerHTML = content;

      // Add "Use this" button for assistant responses with raw text
      if (rawText && this.textareaEl) {
        const useBtn = document.createElement('button');
        useBtn.className = 'assistant__use-btn';
        useBtn.textContent = 'Nota þetta';
        useBtn.title = 'Setja þennan texta inn í sniðmátið';
        useBtn.addEventListener('click', () => {
          this.insertIntoTemplate(rawText);
        });
        messageEl.appendChild(useBtn);
      }
    }

    this.messagesEl?.appendChild(messageEl);

    // Scroll to bottom
    this.messagesEl?.scrollTo({
      top: this.messagesEl.scrollHeight,
      behavior: 'smooth'
    });
  }

  /**
   * Insert text into template textarea
   * @param {string} text - Text to insert
   */
  insertIntoTemplate(text) {
    if (!this.textareaEl) return;

    // Strip markdown code block markers if present
    let cleanText = text
      .replace(/^```html\s*/i, '')  // Remove opening ```html
      .replace(/^```\s*/i, '')       // Remove opening ``` without language
      .replace(/\s*```$/i, '')       // Remove closing ```
      .trim();

    this.textareaEl.value = cleanText;

    // Trigger input event to update preview
    this.textareaEl.dispatchEvent(new Event('input', { bubbles: true }));

    // Visual feedback
    this.textareaEl.focus();
    this.textareaEl.classList.add('assistant__inserted');
    setTimeout(() => {
      this.textareaEl.classList.remove('assistant__inserted');
    }, 1000);

    debug.log('[TemplateAssistant] Text inserted into template');
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    this.isLoading = true;
    this.setButtonsDisabled(true);

    const loadingEl = document.createElement('div');
    loadingEl.className = 'assistant__loading';
    loadingEl.id = 'assistant-loading';
    loadingEl.innerHTML = `
      <div class="assistant__loading-dots">
        <span class="assistant__loading-dot"></span>
        <span class="assistant__loading-dot"></span>
        <span class="assistant__loading-dot"></span>
      </div>
      <span>Hugsa...</span>
    `;

    this.messagesEl?.appendChild(loadingEl);
    this.messagesEl?.scrollTo({ top: this.messagesEl.scrollHeight, behavior: 'smooth' });
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.isLoading = false;
    this.setButtonsDisabled(false);

    const loadingEl = document.getElementById('assistant-loading');
    loadingEl?.remove();
  }

  /**
   * Enable/disable input and buttons
   * @param {boolean} disabled
   */
  setButtonsDisabled(disabled) {
    if (this.inputEl) this.inputEl.disabled = disabled;
    if (this.sendBtn) this.sendBtn.disabled = disabled;

    this.quickActionsEl?.querySelectorAll('.assistant__quick-btn').forEach(btn => {
      btn.disabled = disabled;
    });
  }

  /**
   * Format basic markdown in assistant response
   * @param {string} text - Raw text with markdown
   * @returns {string} - HTML string
   */
  formatMarkdown(text) {
    let html = escapeHTML(text);

    // Code blocks (```)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code (`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold (**text**)
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic (*text*)
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  /**
   * Clear chat history and messages
   */
  clearChat() {
    this.chatHistory = [];

    // Keep only the welcome message
    if (this.messagesEl) {
      const welcomeMessage = this.messagesEl.querySelector('.assistant__message--assistant');
      this.messagesEl.innerHTML = '';
      if (welcomeMessage) {
        this.messagesEl.appendChild(welcomeMessage.cloneNode(true));
      }
    }
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.chatHistory = [];
  }
}

export default TemplateEditorAssistant;
