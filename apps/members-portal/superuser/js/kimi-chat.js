/**
 * Kimi AI Chat Widget for Superuser Dashboard
 *
 * Floating chat widget that provides AI-powered system administration help.
 */

import { debug } from '../../js/utils/util-debug.js';
import { getFirebaseAuth } from '../../firebase/app.js';

const EVENTS_API_BASE = 'https://events-service-521240388393.europe-west1.run.app';

// Chat state
let isOpen = false;
let isLoading = false;
let isExpanded = false;
let chatHistory = [];

/**
 * Create the chat widget HTML
 */
function createChatWidget() {
  const widget = document.createElement('div');
  widget.id = 'kimi-chat-widget';
  widget.innerHTML = `
    <button id="kimi-chat-toggle" class="kimi-chat__toggle" title="Kimi aðstoð">
      <span class="kimi-chat__toggle-icon">🤖</span>
    </button>
    <div id="kimi-chat-panel" class="kimi-chat__panel kimi-chat__panel--hidden">
      <div class="kimi-chat__header">
        <span class="kimi-chat__title">🤖 Kimi Aðstoð</span>
        <div class="kimi-chat__header-actions">
          <button id="kimi-chat-clear" class="kimi-chat__clear" title="Nýtt samtal">🗑️</button>
          <button id="kimi-chat-expand" class="kimi-chat__expand" title="Stækka">⛶</button>
          <button id="kimi-chat-close" class="kimi-chat__close" title="Loka">&times;</button>
        </div>
      </div>
      <div id="kimi-chat-messages" class="kimi-chat__messages">
        <div class="kimi-chat__message kimi-chat__message--assistant">
          <div class="kimi-chat__bubble">
            Hæ! Ég er Kimi, gervigreindaraðstoðarmaður fyrir Ekklesia kerfið. Hvernig get ég aðstoðað þig?
          </div>
        </div>
      </div>
      <div class="kimi-chat__input-area">
        <textarea
          id="kimi-chat-input"
          class="kimi-chat__input"
          placeholder="Skrifaðu spurningu..."
          rows="1"
        ></textarea>
        <button id="kimi-chat-send" class="kimi-chat__send" title="Senda">
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
    #kimi-chat-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: inherit;
    }

    .kimi-chat__toggle {
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

    .kimi-chat__toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0,0,0,0.4);
    }

    .kimi-chat__toggle-icon {
      font-size: 28px;
    }

    .kimi-chat__panel {
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

    .kimi-chat__panel--hidden {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
    }

    .kimi-chat__header {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .kimi-chat__title {
      font-weight: 600;
      font-size: 1rem;
    }

    .kimi-chat__header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .kimi-chat__clear,
    .kimi-chat__expand,
    .kimi-chat__close {
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

    .kimi-chat__expand,
    .kimi-chat__close {
      font-size: 20px;
    }

    .kimi-chat__clear:hover,
    .kimi-chat__expand:hover,
    .kimi-chat__close:hover {
      opacity: 1;
      background: rgba(255,255,255,0.1);
    }

    /* Expanded state */
    .kimi-chat__panel--expanded {
      width: 700px;
      max-width: calc(100vw - 40px);
      height: 80vh;
      max-height: calc(100vh - 100px);
    }

    @media (min-width: 1200px) {
      .kimi-chat__panel--expanded {
        width: 900px;
        height: 85vh;
      }
    }

    .kimi-chat__messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .kimi-chat__message {
      display: flex;
      max-width: 85%;
    }

    .kimi-chat__message--user {
      align-self: flex-end;
    }

    .kimi-chat__message--assistant {
      align-self: flex-start;
    }

    .kimi-chat__bubble {
      padding: 10px 14px;
      border-radius: 16px;
      line-height: 1.4;
      font-size: 0.9rem;
      white-space: pre-wrap;
      word-break: break-word;
      overflow: hidden;
      max-width: 100%;
    }

    .kimi-chat__message--user .kimi-chat__bubble {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      border-bottom-right-radius: 4px;
    }

    .kimi-chat__message--assistant .kimi-chat__bubble {
      background: var(--color-surface-secondary, #f5f5f5);
      color: var(--color-text, #333);
      border-bottom-left-radius: 4px;
    }

    .kimi-chat__bubble code {
      background: rgba(0,0,0,0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85em;
      word-break: break-all;
    }

    .kimi-chat__bubble pre {
      background: rgba(0,0,0,0.1);
      padding: 8px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0;
      max-width: 100%;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .kimi-chat__bubble pre code {
      background: none;
      padding: 0;
    }

    .kimi-chat__input-area {
      padding: 12px;
      border-top: 1px solid var(--color-border, #ddd);
      display: flex;
      gap: 8px;
      background: var(--color-surface, #fff);
    }

    .kimi-chat__input {
      flex: 1;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 0.9rem;
      resize: none;
      max-height: 100px;
      font-family: inherit;
    }

    .kimi-chat__input:focus {
      outline: none;
      border-color: var(--color-burgundy, #722f37);
    }

    .kimi-chat__send {
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

    .kimi-chat__send:hover {
      opacity: 0.9;
    }

    .kimi-chat__send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .kimi-chat__loading {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px;
    }

    .kimi-chat__loading-dot {
      width: 8px;
      height: 8px;
      background: var(--color-burgundy, #722f37);
      border-radius: 50%;
      animation: kimi-bounce 1.4s infinite ease-in-out both;
    }

    .kimi-chat__loading-dot:nth-child(1) { animation-delay: -0.32s; }
    .kimi-chat__loading-dot:nth-child(2) { animation-delay: -0.16s; }

    .kimi-chat__loading-text {
      margin-left: 8px;
      font-size: 0.85rem;
      color: var(--color-text-muted, #666);
      animation: kimi-fade-in 0.3s ease-in;
    }

    @keyframes kimi-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    @keyframes kimi-fade-in {
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
  const messagesEl = document.getElementById('kimi-chat-messages');
  const msgEl = document.createElement('div');
  msgEl.className = `kimi-chat__message kimi-chat__message--${role}`;
  msgEl.innerHTML = `<div class="kimi-chat__bubble">${formatMessage(content)}</div>`;
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Cold start detection
let coldStartTimer = null;

/**
 * Show loading indicator
 */
function showLoading() {
  const messagesEl = document.getElementById('kimi-chat-messages');
  const loadingEl = document.createElement('div');
  loadingEl.id = 'kimi-chat-loading';
  loadingEl.className = 'kimi-chat__message kimi-chat__message--assistant';
  loadingEl.innerHTML = `
    <div class="kimi-chat__bubble kimi-chat__loading">
      <div class="kimi-chat__loading-dot"></div>
      <div class="kimi-chat__loading-dot"></div>
      <div class="kimi-chat__loading-dot"></div>
      <span class="kimi-chat__loading-text"></span>
    </div>
  `;
  messagesEl.appendChild(loadingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Show cold start message after 3 seconds
  coldStartTimer = setTimeout(() => {
    const textEl = loadingEl.querySelector('.kimi-chat__loading-text');
    if (textEl) {
      textEl.textContent = ' Kimi er að vakna...';
    }
  }, 3000);

  // Update message after 8 seconds
  setTimeout(() => {
    const textEl = loadingEl.querySelector('.kimi-chat__loading-text');
    if (textEl && textEl.textContent) {
      textEl.textContent = ' Sæki gögn úr kerfinu...';
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
  const loadingEl = document.getElementById('kimi-chat-loading');
  if (loadingEl) loadingEl.remove();
}

/**
 * Custom error class for API errors with structured data
 */
class KimiApiError extends Error {
  constructor(message, type, retryAfter = null, status = 500) {
    super(message);
    this.name = 'KimiApiError';
    this.type = type;
    this.retryAfter = retryAfter;
    this.status = status;
  }
}

/**
 * Make API request - backend handles retries now
 */
async function fetchKimiApi(url, options) {
  try {
    const response = await fetch(url, options);

    // Parse response body
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Use error message from server if available
      const errorMsg = data.message || 'Villa kom upp';
      const errorType = data.error || 'unknown';
      const retryAfter = data.retryAfter || parseInt(response.headers.get('Retry-After')) || null;

      throw new KimiApiError(errorMsg, errorType, retryAfter, response.status);
    }

    return data;
  } catch (error) {
    // Re-throw KimiApiError as-is
    if (error instanceof KimiApiError) {
      throw error;
    }

    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new KimiApiError(
        'Náði ekki sambandi við þjón. Athugaðu nettengingu.',
        'network_error',
        null,
        0
      );
    }

    // Other errors
    throw new KimiApiError(
      error.message || 'Óvænt villa kom upp',
      'unknown',
      null,
      500
    );
  }
}

/**
 * Send message to Kimi API
 */
async function sendMessage(message) {
  if (isLoading || !message.trim()) return;

  isLoading = true;
  const sendBtn = document.getElementById('kimi-chat-send');
  const inputEl = document.getElementById('kimi-chat-input');

  sendBtn.disabled = true;
  inputEl.value = '';

  // Add user message
  addMessage('user', message);
  chatHistory.push({ role: 'user', content: message });

  // Show loading
  showLoading();

  try {
    // Get Firebase auth token
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new KimiApiError('Þú þarft að skrá þig inn aftur.', 'auth_error', null, 401);
    }

    const token = await user.getIdToken();

    const data = await fetchKimiApi(`${EVENTS_API_BASE}/api/kimi/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        history: chatHistory.slice(-10)
      })
    });

    const reply = data.reply;

    // Add assistant message
    hideLoading();
    addMessage('assistant', reply);
    chatHistory.push({ role: 'assistant', content: reply });

  } catch (error) {
    debug.error('Kimi chat error:', error);
    hideLoading();

    // Build user-friendly error message
    let errorMsg = error.message || 'Villa kom upp.';

    // Add retry info if available
    if (error.retryAfter) {
      errorMsg += ` Reyndu aftur eftir ${error.retryAfter} sekúndur.`;
    }

    // Add helpful hints based on error type
    if (error.type === 'context_exceeded') {
      errorMsg += '\n\n💡 Ábending: Smelltu á "Nýtt samtal" til að byrja upp á nýtt.';
    } else if (error.type === 'rate_limit') {
      errorMsg += '\n\n⏳ Of margar beiðnir sendar. Bíddu aðeins.';
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
  const panel = document.getElementById('kimi-chat-panel');
  const toggle = document.getElementById('kimi-chat-toggle');

  if (isOpen) {
    panel.classList.remove('kimi-chat__panel--hidden');
    toggle.style.display = 'none';
    document.getElementById('kimi-chat-input').focus();
  } else {
    panel.classList.add('kimi-chat__panel--hidden');
    toggle.style.display = 'flex';
  }
}

/**
 * Toggle expanded state
 */
function toggleExpand() {
  isExpanded = !isExpanded;
  const panel = document.getElementById('kimi-chat-panel');
  const expandBtn = document.getElementById('kimi-chat-expand');

  if (isExpanded) {
    panel.classList.add('kimi-chat__panel--expanded');
    expandBtn.textContent = '⛶';
    expandBtn.title = 'Minnka';
  } else {
    panel.classList.remove('kimi-chat__panel--expanded');
    expandBtn.textContent = '⛶';
    expandBtn.title = 'Stækka';
  }
}

/**
 * Clear chat history and reset UI
 */
function clearChat() {
  // Reset history
  chatHistory = [];

  // Reset messages UI
  const messagesEl = document.getElementById('kimi-chat-messages');
  messagesEl.innerHTML = `
    <div class="kimi-chat__message kimi-chat__message--assistant">
      <div class="kimi-chat__bubble">
        Hæ! Ég er Kimi, gervigreindaraðstoðarmaður fyrir Ekklesia kerfið. Hvernig get ég aðstoðað þig?
      </div>
    </div>
  `;

  debug.log('Kimi chat cleared');
}

/**
 * Initialize chat widget
 */
export function initKimiChat() {
  // Add styles
  addChatStyles();

  // Create widget
  createChatWidget();

  // Event listeners
  document.getElementById('kimi-chat-toggle').addEventListener('click', toggleChat);
  document.getElementById('kimi-chat-close').addEventListener('click', toggleChat);
  document.getElementById('kimi-chat-expand').addEventListener('click', toggleExpand);
  document.getElementById('kimi-chat-clear').addEventListener('click', clearChat);

  document.getElementById('kimi-chat-send').addEventListener('click', () => {
    const input = document.getElementById('kimi-chat-input');
    sendMessage(input.value);
  });

  document.getElementById('kimi-chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e.target.value);
    }
  });

  // Auto-resize textarea
  document.getElementById('kimi-chat-input').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  });

  debug.log('Kimi chat widget initialized');
}
