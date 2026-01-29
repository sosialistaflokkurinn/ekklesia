/**
 * Sysadmin AI Chat Widget for Superuser Dashboard
 *
 * Floating chat widget that provides AI-powered system administration help.
 *
 * Module cleanup not needed - widget persists for page lifetime.
 * i18n: Strings loaded by HTML before this module - initI18n not needed here.
 */

import { debug } from '../../js/utils/util-debug.js';
import { R } from '../../i18n/strings-loader.js';
import { authenticatedFetch } from '../../js/auth.js';
import { SERVICES } from '../../js/config/config.js';

// Chat state
let isOpen = false;
let isLoading = false;
let isExpanded = false;
let chatHistory = [];
let selectedModel = 'fast';
let availableModels = [];

/**
 * Create the chat widget HTML
 */
function createChatWidget() {
  const widget = document.createElement('div');
  widget.id = 'sysadmin-chat-widget';
  widget.innerHTML = `
    <button id="sysadmin-chat-toggle" class="sysadmin-chat__toggle" title="${R.string.sysadmin_chat_title}">
      <span class="sysadmin-chat__toggle-icon">🤖</span>
    </button>
    <div id="sysadmin-chat-panel" class="sysadmin-chat__panel sysadmin-chat__panel--hidden">
      <div class="sysadmin-chat__header">
        <span class="sysadmin-chat__title">${R.string.sysadmin_chat_header}</span>
        <div class="sysadmin-chat__header-actions">
          <select id="sysadmin-chat-model" class="sysadmin-chat__model-select" title="${R.string.sysadmin_chat_select_model}">
            <option value="fast">${R.string.sysadmin_chat_model_fast}</option>
            <option value="thinking">${R.string.sysadmin_chat_model_accurate}</option>
          </select>
          <button id="sysadmin-chat-clear" class="sysadmin-chat__clear" title="${R.string.member_assistant_new_chat}">🗑️</button>
          <button id="sysadmin-chat-expand" class="sysadmin-chat__expand" title="${R.string.member_assistant_expand}">⛶</button>
          <button id="sysadmin-chat-close" class="sysadmin-chat__close" title="${R.string.member_assistant_close}">&times;</button>
        </div>
      </div>
      <div id="sysadmin-chat-messages" class="sysadmin-chat__messages">
        <div class="sysadmin-chat__message sysadmin-chat__message--assistant">
          <div class="sysadmin-chat__bubble">
            ${R.string.sysadmin_chat_welcome}
          </div>
        </div>
      </div>
      <div class="sysadmin-chat__input-area">
        <textarea
          id="sysadmin-chat-input"
          class="sysadmin-chat__input"
          placeholder="${R.string.sysadmin_chat_placeholder}"
          rows="1"
        ></textarea>
        <button id="sysadmin-chat-send" class="sysadmin-chat__send" title="${R.string.member_assistant_send}">
          <span>➤</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(widget);
  return widget;
}

/**
 * Add chat widget styles
 */
function addChatStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #sysadmin-chat-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: inherit;
    }

    .sysadmin-chat__toggle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--color-burgundy, #722f37);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sysadmin-chat__toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0,0,0,0.4);
    }

    .sysadmin-chat__toggle-icon {
      font-size: 28px;
    }

    .sysadmin-chat__panel {
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 380px;
      max-width: calc(100vw - 40px);
      height: 500px;
      max-height: calc(100vh - 100px);
      background: var(--color-surface, #fff);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: opacity 0.2s, transform 0.2s;
    }

    .sysadmin-chat__panel--hidden {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
    }

    .sysadmin-chat__header {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sysadmin-chat__title {
      font-weight: 600;
      font-size: 1rem;
    }

    .sysadmin-chat__header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sysadmin-chat__model-select {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.3);
      color: inherit;
      font-size: 11px;
      padding: 4px 6px;
      border-radius: 4px;
      cursor: pointer;
      outline: none;
      max-width: 120px;
    }

    .sysadmin-chat__model-select:hover {
      background: rgba(255,255,255,0.25);
    }

    .sysadmin-chat__model-select option {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
    }

    .sysadmin-chat__clear,
    .sysadmin-chat__expand,
    .sysadmin-chat__close {
      background: none;
      border: none;
      color: inherit;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      line-height: 1;
      opacity: 0.8;
      border-radius: 4px;
    }

    .sysadmin-chat__expand,
    .sysadmin-chat__close {
      font-size: 20px;
    }

    .sysadmin-chat__clear:hover,
    .sysadmin-chat__expand:hover,
    .sysadmin-chat__close:hover {
      opacity: 1;
      background: rgba(255,255,255,0.1);
    }

    /* Expanded state */
    .sysadmin-chat__panel--expanded {
      width: 700px;
      max-width: calc(100vw - 40px);
      height: 80vh;
      max-height: calc(100vh - 100px);
    }

    @media (min-width: 1200px) {
      .sysadmin-chat__panel--expanded {
        width: 900px;
        height: 85vh;
      }
    }

    .sysadmin-chat__messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sysadmin-chat__message {
      display: flex;
      max-width: 85%;
    }

    .sysadmin-chat__message--user {
      align-self: flex-end;
    }

    .sysadmin-chat__message--assistant {
      align-self: flex-start;
    }

    .sysadmin-chat__bubble {
      padding: 10px 14px;
      border-radius: 16px;
      line-height: 1.4;
      font-size: 0.9rem;
      white-space: pre-wrap;
      word-break: break-word;
      overflow: hidden;
      max-width: 100%;
    }

    .sysadmin-chat__message--user .sysadmin-chat__bubble {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      border-bottom-right-radius: 4px;
    }

    .sysadmin-chat__message--assistant .sysadmin-chat__bubble {
      background: var(--color-surface-secondary, #f5f5f5);
      color: var(--color-text, #333);
      border-bottom-left-radius: 4px;
    }

    .sysadmin-chat__bubble code {
      background: rgba(0,0,0,0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85em;
      word-break: break-all;
    }

    .sysadmin-chat__bubble pre {
      background: rgba(0,0,0,0.1);
      padding: 8px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0;
      max-width: 100%;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .sysadmin-chat__bubble pre code {
      background: none;
      padding: 0;
    }

    .sysadmin-chat__input-area {
      padding: 12px;
      border-top: 1px solid var(--color-border, #ddd);
      display: flex;
      gap: 8px;
      background: var(--color-surface, #fff);
    }

    .sysadmin-chat__input {
      flex: 1;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 0.9rem;
      resize: none;
      max-height: 100px;
      font-family: inherit;
    }

    .sysadmin-chat__input:focus {
      outline: none;
      border-color: var(--color-burgundy, #722f37);
    }

    .sysadmin-chat__send {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: opacity 0.2s;
    }

    .sysadmin-chat__send:hover {
      opacity: 0.9;
    }

    .sysadmin-chat__send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .sysadmin-chat__loading {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px;
    }

    .sysadmin-chat__loading-dot {
      width: 8px;
      height: 8px;
      background: var(--color-burgundy, #722f37);
      border-radius: 50%;
      animation: sysadmin-bounce 1.4s infinite ease-in-out both;
    }

    .sysadmin-chat__loading-dot:nth-child(1) { animation-delay: -0.32s; }
    .sysadmin-chat__loading-dot:nth-child(2) { animation-delay: -0.16s; }

    .sysadmin-chat__loading-text {
      margin-left: 8px;
      font-size: 0.85rem;
      color: var(--color-text-muted, #666);
      animation: sysadmin-fade-in 0.3s ease-in;
    }

    @keyframes sysadmin-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    @keyframes sysadmin-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Format markdown-like text to HTML
 */
function formatMessage(text) {
  // Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  return html;
}

/**
 * Add a message to the chat
 */
function addMessage(role, content) {
  const messagesEl = document.getElementById('sysadmin-chat-messages');
  const msgEl = document.createElement('div');
  msgEl.className = `sysadmin-chat__message sysadmin-chat__message--${role}`;
  msgEl.innerHTML = `<div class="sysadmin-chat__bubble">${formatMessage(content)}</div>`;
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Cold start detection
let coldStartTimer = null;

/**
 * Show loading indicator
 */
function showLoading() {
  const messagesEl = document.getElementById('sysadmin-chat-messages');
  const loadingEl = document.createElement('div');
  loadingEl.id = 'sysadmin-chat-loading';
  loadingEl.className = 'sysadmin-chat__message sysadmin-chat__message--assistant';
  loadingEl.innerHTML = `
    <div class="sysadmin-chat__bubble sysadmin-chat__loading">
      <div class="sysadmin-chat__loading-dot"></div>
      <div class="sysadmin-chat__loading-dot"></div>
      <div class="sysadmin-chat__loading-dot"></div>
      <span class="sysadmin-chat__loading-text"></span>
    </div>
  `;
  messagesEl.appendChild(loadingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Show cold start message after 3 seconds
  coldStartTimer = setTimeout(() => {
    const textEl = loadingEl.querySelector('.sysadmin-chat__loading-text');
    if (textEl) {
      textEl.textContent = ` ${R.string.sysadmin_chat_waking_up}`;
    }
  }, 3000);

  // Update message after 8 seconds
  setTimeout(() => {
    const textEl = loadingEl.querySelector('.sysadmin-chat__loading-text');
    if (textEl && textEl.textContent) {
      textEl.textContent = ` ${R.string.sysadmin_chat_fetching_data}`;
    }
  }, 8000);
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  if (coldStartTimer) {
    clearTimeout(coldStartTimer);
    coldStartTimer = null;
  }
  const loadingEl = document.getElementById('sysadmin-chat-loading');
  if (loadingEl) loadingEl.remove();
}

/**
 * Custom error class for API errors with structured data
 */
class SysadminApiError extends Error {
  constructor(message, type, retryAfter = null, status = 500) {
    super(message);
    this.name = 'SysadminApiError';
    this.type = type;
    this.retryAfter = retryAfter;
    this.status = status;
  }
}

/**
 * Parse API response and convert errors to SysadminApiError
 * @param {Response} response - Fetch response from authenticatedFetch
 * @returns {Promise<object>} Parsed JSON data
 */
async function parseSysadminResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || R.string.sysadmin_chat_error_generic;
    const errorType = data.error || 'unknown';
    const retryAfter = data.retryAfter || parseInt(response.headers.get('Retry-After')) || null;

    throw new SysadminApiError(errorMsg, errorType, retryAfter, response.status);
  }

  return data;
}

/**
 * Send message to sysadmin chat API
 */
async function sendMessage(message) {
  if (isLoading || !message.trim()) return;

  isLoading = true;
  const sendBtn = document.getElementById('sysadmin-chat-send');
  const inputEl = document.getElementById('sysadmin-chat-input');

  sendBtn.disabled = true;
  inputEl.value = '';

  // Add user message
  addMessage('user', message);
  chatHistory.push({ role: 'user', content: message });

  // Show loading
  showLoading();

  try {
    const modelSelect = document.getElementById('sysadmin-chat-model');
    const model = modelSelect ? modelSelect.value : selectedModel;

    const response = await authenticatedFetch(`${SERVICES.EVENTS}/api/sysadmin/chat`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        history: chatHistory.slice(-10),
        model
      })
    });

    const data = await parseSysadminResponse(response);

    const reply = data.reply;

    // Add assistant message
    hideLoading();
    addMessage('assistant', reply);
    chatHistory.push({ role: 'assistant', content: reply });

  } catch (error) {
    debug.error('Sysadmin chat error:', error);
    hideLoading();

    // Build user-friendly error message
    let errorMsg = error.message || R.string.sysadmin_chat_error_generic;

    // Add retry info if available
    if (error.retryAfter) {
      errorMsg += ` ${R.string.sysadmin_chat_retry_format.replace('%d', error.retryAfter)}`;
    }

    // Add helpful hints based on error type
    if (error.type === 'context_exceeded') {
      errorMsg += `\n\n${R.string.sysadmin_chat_hint_context}`;
    } else if (error.type === 'rate_limit') {
      errorMsg += `\n\n${R.string.sysadmin_chat_hint_rate_limit}`;
    }

    addMessage('assistant', errorMsg);
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

/**
 * Toggle chat panel
 */
function toggleChat() {
  isOpen = !isOpen;
  const panel = document.getElementById('sysadmin-chat-panel');
  const toggle = document.getElementById('sysadmin-chat-toggle');

  if (isOpen) {
    panel.classList.remove('sysadmin-chat__panel--hidden');
    toggle.style.display = 'none';
    document.getElementById('sysadmin-chat-input').focus();
  } else {
    panel.classList.add('sysadmin-chat__panel--hidden');
    toggle.style.display = 'flex';
  }
}

/**
 * Toggle expanded state
 */
function toggleExpand() {
  isExpanded = !isExpanded;
  const panel = document.getElementById('sysadmin-chat-panel');
  const expandBtn = document.getElementById('sysadmin-chat-expand');

  if (isExpanded) {
    panel.classList.add('sysadmin-chat__panel--expanded');
    expandBtn.textContent = '⛶';
    expandBtn.title = R.string.member_assistant_shrink;
  } else {
    panel.classList.remove('sysadmin-chat__panel--expanded');
    expandBtn.textContent = '⛶';
    expandBtn.title = R.string.member_assistant_expand;
  }
}

/**
 * Clear chat history and reset UI
 */
function clearChat() {
  // Reset history
  chatHistory = [];

  // Reset messages UI
  const messagesEl = document.getElementById('sysadmin-chat-messages');
  messagesEl.innerHTML = `
    <div class="sysadmin-chat__message sysadmin-chat__message--assistant">
      <div class="sysadmin-chat__bubble">
        ${R.string.sysadmin_chat_welcome}
      </div>
    </div>
  `;

  debug.log('Sysadmin chat cleared');
}

/**
 * Initialize chat widget
 */
export function initSysadminChat() {
  // Add styles
  addChatStyles();

  // Create widget
  createChatWidget();

  // Event listeners
  document.getElementById('sysadmin-chat-toggle').addEventListener('click', toggleChat);
  document.getElementById('sysadmin-chat-close').addEventListener('click', toggleChat);
  document.getElementById('sysadmin-chat-expand').addEventListener('click', toggleExpand);
  document.getElementById('sysadmin-chat-clear').addEventListener('click', clearChat);

  document.getElementById('sysadmin-chat-send').addEventListener('click', () => {
    const input = document.getElementById('sysadmin-chat-input');
    sendMessage(input.value);
  });

  document.getElementById('sysadmin-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e.target.value);
    }
  });

  // Auto-resize textarea
  document.getElementById('sysadmin-chat-input').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  });

  debug.log('Sysadmin chat widget initialized');
}
