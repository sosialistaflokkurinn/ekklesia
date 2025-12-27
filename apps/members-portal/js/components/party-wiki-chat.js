/**
 * Party Wiki Chat Widget for Members Area
 *
 * Floating chat widget that provides AI-powered information about the Socialist Party.
 * Uses Kimi API with party knowledge base (xj.is + discourse-archive data).
 *
 * Module cleanup not needed - widget persists for page lifetime.
 */

import { debug } from '../utils/util-debug.js';
import { getFirebaseAuth } from '../../firebase/app.js';
import { R } from '../../i18n/strings-loader.js';

const EVENTS_API_BASE = 'https://events-service-521240388393.europe-west1.run.app';

// Chat state
let isOpen = false;
let isLoading = false;
let chatHistory = [];

/**
 * Create the chat widget HTML
 */
function createChatWidget() {
  const widget = document.createElement('div');
  widget.id = 'party-wiki-widget';
  // SECURITY: Template uses only i18n strings (R.string.*) - all developer-controlled
  widget.innerHTML = `
    <button id="party-wiki-toggle" class="party-wiki__toggle" title="${R.string.party_wiki_toggle_title}">
      <span class="party-wiki__toggle-icon">📚</span>
    </button>
    <div id="party-wiki-panel" class="party-wiki__panel party-wiki__panel--hidden">
      <div class="party-wiki__header">
        <span class="party-wiki__title">${R.string.party_wiki_title}</span>
        <button id="party-wiki-close" class="party-wiki__close" title="${R.string.nav_close}">&times;</button>
      </div>
      <div id="party-wiki-messages" class="party-wiki__messages">
        <div class="party-wiki__message party-wiki__message--assistant">
          <div class="party-wiki__bubble">
            ${R.string.party_wiki_welcome}
          </div>
        </div>
      </div>
      <div class="party-wiki__input-area">
        <textarea
          id="party-wiki-input"
          class="party-wiki__input"
          placeholder="${R.string.party_wiki_placeholder}"
          rows="1"
        ></textarea>
        <button id="party-wiki-send" class="party-wiki__send" title="${R.string.party_wiki_send}">
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
    #party-wiki-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: inherit;
    }

    .party-wiki__toggle {
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

    .party-wiki__toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0,0,0,0.4);
    }

    .party-wiki__toggle-icon {
      font-size: 28px;
    }

    .party-wiki__panel {
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

    .party-wiki__panel--hidden {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
    }

    .party-wiki__header {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .party-wiki__title {
      font-weight: 600;
      font-size: 1rem;
    }

    .party-wiki__close {
      background: none;
      border: none;
      color: inherit;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      opacity: 0.8;
    }

    .party-wiki__close:hover {
      opacity: 1;
    }

    .party-wiki__messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .party-wiki__message {
      display: flex;
      max-width: 85%;
    }

    .party-wiki__message--user {
      align-self: flex-end;
    }

    .party-wiki__message--assistant {
      align-self: flex-start;
    }

    .party-wiki__bubble {
      padding: 10px 14px;
      border-radius: 16px;
      line-height: 1.4;
      font-size: 0.9rem;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .party-wiki__message--user .party-wiki__bubble {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      border-bottom-right-radius: 4px;
    }

    .party-wiki__message--assistant .party-wiki__bubble {
      background: var(--color-surface-secondary, #f5f5f5);
      color: var(--color-text, #333);
      border-bottom-left-radius: 4px;
    }

    .party-wiki__bubble code {
      background: rgba(0,0,0,0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85em;
    }

    .party-wiki__bubble pre {
      background: rgba(0,0,0,0.1);
      padding: 8px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0;
    }

    .party-wiki__bubble pre code {
      background: none;
      padding: 0;
    }

    .party-wiki__bubble h2, .party-wiki__bubble h3 {
      font-size: 1em;
      font-weight: 600;
      margin: 0.5em 0 0.25em 0;
    }

    .party-wiki__bubble ul, .party-wiki__bubble ol {
      margin: 0.5em 0;
      padding-left: 1.5em;
    }

    .party-wiki__bubble li {
      margin: 0.25em 0;
    }

    .party-wiki__input-area {
      padding: 12px;
      border-top: 1px solid var(--color-border, #ddd);
      display: flex;
      gap: 8px;
      background: var(--color-surface, #fff);
    }

    .party-wiki__input {
      flex: 1;
      border: 1px solid var(--color-border, #ddd);
      border-radius: 20px;
      padding: 10px 16px;
      font-size: 0.9rem;
      resize: none;
      max-height: 100px;
      font-family: inherit;
    }

    .party-wiki__input:focus {
      outline: none;
      border-color: var(--color-burgundy, #722f37);
    }

    .party-wiki__send {
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

    .party-wiki__send:hover {
      opacity: 0.9;
    }

    .party-wiki__send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .party-wiki__loading {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px;
    }

    .party-wiki__loading-dot {
      width: 8px;
      height: 8px;
      background: var(--color-burgundy, #722f37);
      border-radius: 50%;
      animation: party-wiki-bounce 1.4s infinite ease-in-out both;
    }

    .party-wiki__loading-dot:nth-child(1) { animation-delay: -0.32s; }
    .party-wiki__loading-dot:nth-child(2) { animation-delay: -0.16s; }

    .party-wiki__loading-text {
      margin-left: 8px;
      font-size: 0.85rem;
      color: var(--color-text-muted, #666);
      animation: party-wiki-fade-in 0.3s ease-in;
    }

    @keyframes party-wiki-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    @keyframes party-wiki-fade-in {
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

  // Headers (## and ###)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Bullet lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  return html;
}

/**
 * Add a message to the chat
 */
function addMessage(role, content) {
  const messagesEl = document.getElementById('party-wiki-messages');
  const msgEl = document.createElement('div');
  msgEl.className = `party-wiki__message party-wiki__message--${role}`;
  // SECURITY: formatMessage() escapes HTML before markdown processing (see line 317-321)
  msgEl.innerHTML = `<div class="party-wiki__bubble">${formatMessage(content)}</div>`;
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Cold start detection
let coldStartTimer = null;

/**
 * Show loading indicator
 */
function showLoading() {
  const messagesEl = document.getElementById('party-wiki-messages');
  const loadingEl = document.createElement('div');
  loadingEl.id = 'party-wiki-loading';
  loadingEl.className = 'party-wiki__message party-wiki__message--assistant';
  // SECURITY: Static HTML only - no user input
  loadingEl.innerHTML = `
    <div class="party-wiki__bubble party-wiki__loading">
      <div class="party-wiki__loading-dot"></div>
      <div class="party-wiki__loading-dot"></div>
      <div class="party-wiki__loading-dot"></div>
      <span class="party-wiki__loading-text"></span>
    </div>
  `;
  messagesEl.appendChild(loadingEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Show cold start message after 3 seconds
  coldStartTimer = setTimeout(() => {
    const textEl = loadingEl.querySelector('.party-wiki__loading-text');
    if (textEl) {
      textEl.textContent = ` ${R.string.party_wiki_searching}`;
    }
  }, 3000);

  // Update message after 8 seconds
  setTimeout(() => {
    const textEl = loadingEl.querySelector('.party-wiki__loading-text');
    if (textEl && textEl.textContent) {
      textEl.textContent = ` ${R.string.party_wiki_fetching}`;
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
  const loadingEl = document.getElementById('party-wiki-loading');
  if (loadingEl) loadingEl.remove();
}

/**
 * Send message to Party Wiki API
 */
async function sendMessage(message) {
  if (isLoading || !message.trim()) return;

  isLoading = true;
  const sendBtn = document.getElementById('party-wiki-send');
  const inputEl = document.getElementById('party-wiki-input');

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
    if (!user) throw new Error('Not authenticated');

    const token = await user.getIdToken();

    const response = await fetch(`${EVENTS_API_BASE}/api/party-wiki/chat`, {
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

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.reply;

    // Add assistant message
    hideLoading();
    addMessage('assistant', reply);
    chatHistory.push({ role: 'assistant', content: reply });

  } catch (error) {
    debug.error('Party wiki chat error:', error);
    hideLoading();
    addMessage('assistant', R.string.party_wiki_error);
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
  const panel = document.getElementById('party-wiki-panel');
  const toggle = document.getElementById('party-wiki-toggle');

  if (isOpen) {
    panel.classList.remove('party-wiki__panel--hidden');
    toggle.style.display = 'none';
    document.getElementById('party-wiki-input').focus();
  } else {
    panel.classList.add('party-wiki__panel--hidden');
    toggle.style.display = 'flex';
  }
}

/**
 * Initialize chat widget
 */
export function initPartyWikiChat() {
  // Add styles
  addChatStyles();

  // Create widget
  createChatWidget();

  // Event listeners
  document.getElementById('party-wiki-toggle').addEventListener('click', toggleChat);
  document.getElementById('party-wiki-close').addEventListener('click', toggleChat);

  document.getElementById('party-wiki-send').addEventListener('click', () => {
    const input = document.getElementById('party-wiki-input');
    sendMessage(input.value);
  });

  document.getElementById('party-wiki-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e.target.value);
    }
  });

  // Auto-resize textarea
  document.getElementById('party-wiki-input').addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  });

  debug.log('Party wiki chat widget initialized');
}
