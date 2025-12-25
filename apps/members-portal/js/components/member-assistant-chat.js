/**
 * Member Assistant Chat Widget
 *
 * RAG-powered floating chat widget for party members.
 * Uses semantic search and Kimi AI for context-aware responses.
 *
 * @module components/member-assistant-chat
 */

import { debug } from '../utils/util-debug.js';
import { getFirebaseAuth } from '../../firebase/app.js';

const EVENTS_API_BASE = 'https://events-service-521240388393.europe-west1.run.app';

// Chat state
let isOpen = false;
let isLoading = false;
let isExpanded = false;
let chatHistory = [];
let selectedModel = 'kimi-k2-0711-preview';

/**
 * Create the chat widget HTML
 */
function createChatWidget() {
  const widget = document.createElement('div');
  widget.id = 'member-assistant-widget';
  widget.innerHTML = `
    <button id="member-assistant-toggle" class="member-assistant__toggle" title="Spyrja um flokkinn">
      <span class="member-assistant__toggle-icon">?</span>
    </button>
    <div id="member-assistant-panel" class="member-assistant__panel member-assistant__panel--hidden">
      <div class="member-assistant__header">
        <div class="member-assistant__title-area">
          <span class="member-assistant__title">Spyrja um flokkinn</span>
          <button class="member-assistant__info-btn" id="member-assistant-info" title="Um þennan aðstoðarmann">
            <span class="member-assistant__info-icon">ⓘ</span>
          </button>
          <div class="member-assistant__info-tooltip" id="member-assistant-tooltip">
            <div class="member-assistant__info-tooltip-title">Um gervigreindaraðstoðarmanninn</div>
            <p>Þessi aðstoðarmaður notar <a href="https://moonshotai.github.io/Kimi-K2/" target="_blank" rel="noopener">Kimi K2</a> tungumálalíkan frá Moonshot AI.</p>
            <p>Líkanið var sérsniðið fyrir flokkinn með RAG (Retrieval Augmented Generation) tækni sem tryggir að svör byggi á raunverulegum heimildum úr stefnu og sögu flokksins.</p>
            <p class="member-assistant__info-tooltip-note">Gögnin eru geymd á Íslandi/Evrópu (Google Cloud) og eru ekki send til Kína - aðeins spurningin fer til Kimi API.</p>
          </div>
        </div>
        <div class="member-assistant__header-actions">
          <button id="member-assistant-clear" class="member-assistant__clear" title="Nýtt samtal">🗑</button>
          <button id="member-assistant-expand" class="member-assistant__expand" title="Stækka">⛶</button>
          <button id="member-assistant-close" class="member-assistant__close" title="Loka">×</button>
        </div>
      </div>
      <div id="member-assistant-messages" class="member-assistant__messages">
        <div class="member-assistant__message member-assistant__message--assistant">
          <div class="member-assistant__bubble">
            Sæl! Ég get svarað spurningum um stefnu flokksins, sögu hans og fleira. Hvaða upplýsingar ertu að leita að?
          </div>
        </div>
        <div class="member-assistant__suggestions">
          <button class="member-assistant__suggestion" data-query="Hver er stefna flokksins í húsnæðismálum?">Húsnæðismál</button>
          <button class="member-assistant__suggestion" data-query="Hvað segir flokkurinn um heilbrigðismál?">Heilbrigðismál</button>
          <button class="member-assistant__suggestion" data-query="Hver er afstaða flokksins til skatta?">Skattar</button>
        </div>
      </div>
      <div class="member-assistant__input-area">
        <select id="member-assistant-model" class="member-assistant__model-select" title="Velja módel">
          <option value="kimi-k2-0711-preview">⚡ Hraður</option>
          <option value="kimi-k2-thinking">🧠 Nákvæmur (hægur)</option>
        </select>
        <textarea
          id="member-assistant-input"
          class="member-assistant__input"
          placeholder="Spurðu um flokkinn..."
          rows="1"
        ></textarea>
        <button id="member-assistant-send" class="member-assistant__send" title="Senda">
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
    #member-assistant-widget {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: inherit;
    }

    .member-assistant__toggle {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--color-burgundy, #722f37);
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-cream, #fce9d8);
    }

    .member-assistant__toggle:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(0,0,0,0.4);
    }

    .member-assistant__toggle-icon {
      font-size: 24px;
      font-weight: bold;
    }

    .member-assistant__panel {
      position: absolute;
      bottom: 66px;
      right: 0;
      width: 360px;
      max-width: calc(100vw - 40px);
      height: 480px;
      max-height: calc(100vh - 100px);
      background: var(--color-surface, #fff);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: opacity 0.2s, transform 0.2s;
    }

    .member-assistant__panel--hidden {
      opacity: 0;
      transform: translateY(20px) scale(0.95);
      pointer-events: none;
    }

    .member-assistant__panel--expanded {
      width: 600px;
      max-width: calc(100vw - 40px);
      height: 70vh;
      max-height: calc(100vh - 100px);
    }

    @media (min-width: 1200px) {
      .member-assistant__panel--expanded {
        width: 700px;
        height: 75vh;
      }
    }

    .member-assistant__header {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .member-assistant__title-area {
      display: flex;
      align-items: center;
      gap: 8px;
      position: relative;
    }

    .member-assistant__title {
      font-weight: 600;
      font-size: 1rem;
    }

    .member-assistant__info-btn {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      padding: 2px;
      opacity: 0.7;
      font-size: 14px;
      line-height: 1;
      border-radius: 50%;
      transition: opacity 0.2s;
    }

    .member-assistant__info-btn:hover {
      opacity: 1;
    }

    .member-assistant__info-icon {
      font-size: 14px;
    }

    .member-assistant__info-tooltip {
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 8px;
      width: 280px;
      background: var(--color-surface, #fff);
      color: var(--color-text, #333);
      padding: 14px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      font-size: 0.8rem;
      line-height: 1.5;
      z-index: 10;
    }

    .member-assistant__info-tooltip--visible {
      display: block;
    }

    .member-assistant__info-tooltip-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--color-burgundy, #722f37);
    }

    .member-assistant__info-tooltip p {
      margin: 0 0 8px 0;
    }

    .member-assistant__info-tooltip p:last-child {
      margin-bottom: 0;
    }

    .member-assistant__info-tooltip a {
      color: var(--color-red, #d32f2f);
      text-decoration: none;
    }

    .member-assistant__info-tooltip a:hover {
      text-decoration: underline;
    }

    .member-assistant__info-tooltip-note {
      font-size: 0.75rem;
      color: var(--color-text-muted, #666);
      padding-top: 8px;
      border-top: 1px solid var(--color-cream-dark, #f5e6d3);
    }

    .member-assistant__header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .member-assistant__model-select {
      background: var(--color-cream-dark, #f5e6d3);
      border: 1px solid var(--color-cream-dark, #f5e6d3);
      color: var(--color-text, #333);
      font-size: 12px;
      padding: 8px 10px;
      border-radius: 20px;
      cursor: pointer;
      outline: none;
      min-width: 100px;
    }

    .member-assistant__model-select:hover {
      border-color: var(--color-burgundy, #722f37);
    }

    .member-assistant__model-select:focus {
      border-color: var(--color-burgundy, #722f37);
    }

    .member-assistant__model-select option {
      background: var(--color-surface, #fff);
      color: var(--color-text, #333);
    }

    .member-assistant__clear,
    .member-assistant__expand,
    .member-assistant__close {
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

    .member-assistant__expand,
    .member-assistant__close {
      font-size: 20px;
    }

    .member-assistant__clear:hover,
    .member-assistant__expand:hover,
    .member-assistant__close:hover {
      opacity: 1;
      background: rgba(255,255,255,0.1);
    }

    .member-assistant__messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .member-assistant__message {
      display: flex;
      max-width: 90%;
    }

    .member-assistant__message--user {
      align-self: flex-end;
    }

    .member-assistant__message--assistant {
      align-self: flex-start;
    }

    .member-assistant__bubble {
      padding: 10px 14px;
      border-radius: 16px;
      line-height: 1.5;
      font-size: 0.9rem;
    }

    .member-assistant__message--user .member-assistant__bubble {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
      border-bottom-right-radius: 4px;
    }

    .member-assistant__message--assistant .member-assistant__bubble {
      background: var(--color-cream-dark, #f5e6d3);
      color: var(--color-text, #333);
      border-bottom-left-radius: 4px;
    }

    .member-assistant__suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .member-assistant__suggestion {
      background: var(--color-cream-dark, #f5e6d3);
      border: 1px solid var(--color-burgundy, #722f37);
      color: var(--color-burgundy, #722f37);
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .member-assistant__suggestion:hover {
      background: var(--color-burgundy, #722f37);
      color: var(--color-cream, #fce9d8);
    }

    .member-assistant__citations {
      margin-top: 12px;
      padding: 10px;
      background: rgba(114, 47, 55, 0.05);
      border-radius: 8px;
      font-size: 0.75rem;
      color: var(--color-text-muted, #666);
    }

    .member-assistant__citations-title {
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--color-burgundy, #722f37);
    }

    .member-assistant__citation {
      display: block;
      padding: 4px 0;
      border-bottom: 1px solid rgba(0,0,0,0.05);
    }

    .member-assistant__citation:last-child {
      border-bottom: none;
    }

    .member-assistant__input-area {
      padding: 12px;
      border-top: 1px solid var(--color-cream-dark, #f5e6d3);
      display: flex;
      gap: 8px;
    }

    .member-assistant__input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid var(--color-cream-dark, #f5e6d3);
      border-radius: 20px;
      resize: none;
      font-family: inherit;
      font-size: 0.9rem;
      line-height: 1.4;
      max-height: 100px;
      outline: none;
    }

    .member-assistant__input:focus {
      border-color: var(--color-burgundy, #722f37);
    }

    .member-assistant__send {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--color-burgundy, #722f37);
      border: none;
      color: var(--color-cream, #fce9d8);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.2s;
    }

    .member-assistant__send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .member-assistant__send:not(:disabled):hover {
      opacity: 0.9;
    }

    .member-assistant__loading {
      display: flex;
      gap: 4px;
      padding: 8px 0;
    }

    .member-assistant__loading-dot {
      width: 8px;
      height: 8px;
      background: var(--color-burgundy, #722f37);
      border-radius: 50%;
      animation: member-assistant-bounce 1.4s ease-in-out infinite both;
    }

    .member-assistant__loading-dot:nth-child(1) { animation-delay: -0.32s; }
    .member-assistant__loading-dot:nth-child(2) { animation-delay: -0.16s; }

    .member-assistant__countdown {
      font-size: 13px;
      font-weight: 700;
      color: #ffffff;
      margin-top: 8px;
      padding: 5px 14px;
      background: var(--color-burgundy, #722f37);
      border-radius: 12px;
      display: inline-block;
    }

    @keyframes member-assistant-bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

/**
 * Format citations - disabled, citations are handled in the AI response itself
 */
function formatCitations(citations) {
  // Citations removed from UI - the AI includes source references in its response text
  return '';
}

/**
 * Add a message to the chat
 */
function addMessage(role, content, citations = null) {
  const messagesEl = document.getElementById('member-assistant-messages');
  if (!messagesEl) return;

  // Remove suggestions after first message
  const suggestions = messagesEl.querySelector('.member-assistant__suggestions');
  if (suggestions) {
    suggestions.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `member-assistant__message member-assistant__message--${role}`;

  let bubbleContent = content;
  if (role === 'assistant' && citations) {
    bubbleContent += formatCitations(citations);
  }

  messageDiv.innerHTML = `<div class="member-assistant__bubble">${bubbleContent}</div>`;
  messagesEl.appendChild(messageDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Countdown timer state
let countdownInterval = null;

/**
 * Show loading indicator with countdown
 */
function showLoading(expectedSeconds = 30) {
  const messagesEl = document.getElementById('member-assistant-messages');
  if (!messagesEl) return;

  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'member-assistant-loading';
  loadingDiv.className = 'member-assistant__message member-assistant__message--assistant';
  loadingDiv.innerHTML = `
    <div class="member-assistant__bubble">
      <div class="member-assistant__loading">
        <div class="member-assistant__loading-dot"></div>
        <div class="member-assistant__loading-dot"></div>
        <div class="member-assistant__loading-dot"></div>
      </div>
      <div class="member-assistant__countdown" id="member-assistant-countdown">
        ~${expectedSeconds} sek
      </div>
    </div>
  `;
  messagesEl.appendChild(loadingDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // Start countdown
  let remaining = expectedSeconds;
  countdownInterval = setInterval(() => {
    remaining--;
    const countdownEl = document.getElementById('member-assistant-countdown');
    if (countdownEl && remaining > 0) {
      countdownEl.textContent = `~${remaining} sek`;
    } else if (countdownEl) {
      countdownEl.textContent = 'næstum tilbúið...';
    }
  }, 1000);
}

/**
 * Hide loading indicator
 */
function hideLoading() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  const loadingEl = document.getElementById('member-assistant-loading');
  if (loadingEl) {
    loadingEl.remove();
  }
}

/**
 * Send message to API
 */
async function sendMessage(message) {
  if (isLoading || !message.trim()) return;

  isLoading = true;
  addMessage('user', message);
  chatHistory.push({ role: 'user', content: message });

  const inputEl = document.getElementById('member-assistant-input');
  const sendBtn = document.getElementById('member-assistant-send');
  if (inputEl) inputEl.value = '';
  if (sendBtn) sendBtn.disabled = true;

  // Get model for timeout and countdown
  const modelSelect = document.getElementById('member-assistant-model');
  const model = modelSelect ? modelSelect.value : selectedModel;
  const isThinking = model === 'kimi-k2-thinking';

  // Expected response time: thinking ~60-120s, preview ~15-30s
  const expectedSeconds = isThinking ? 90 : 20;
  showLoading(expectedSeconds);

  try {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Notandi er ekki skráður inn');
    }

    const token = await user.getIdToken();

    // Set timeout based on model (backend + buffer)
    const timeoutMs = isThinking ? 210000 : 120000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${EVENTS_API_BASE}/api/member-assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message,
        history: chatHistory.slice(-6),
        model
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Villa kom upp');
    }

    const data = await response.json();
    hideLoading();

    // Format markdown in reply
    const formattedReply = formatMarkdown(data.reply);
    addMessage('assistant', formattedReply, data.citations);
    chatHistory.push({ role: 'assistant', content: data.reply });

  } catch (error) {
    hideLoading();
    debug.error('member-assistant', 'Error:', error);
    // User-friendly error messages
    let errorMsg = error.message;
    if (error.name === 'AbortError') {
      errorMsg = 'Beiðnin tók of langan tíma. Prófaðu aftur eða notaðu hraðari módel.';
    }
    addMessage('assistant', `Villa: ${errorMsg}`);
  } finally {
    isLoading = false;
    if (sendBtn) sendBtn.disabled = false;
  }
}

/**
 * Basic markdown formatting
 */
function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

/**
 * Toggle chat panel visibility
 */
function togglePanel() {
  const panel = document.getElementById('member-assistant-panel');
  const toggle = document.getElementById('member-assistant-toggle');
  if (!panel || !toggle) return;

  isOpen = !isOpen;
  panel.classList.toggle('member-assistant__panel--hidden', !isOpen);
  toggle.style.display = isOpen ? 'none' : 'flex';

  if (isOpen) {
    const input = document.getElementById('member-assistant-input');
    if (input) input.focus();
  }
}

/**
 * Toggle expanded mode
 */
function toggleExpanded() {
  const panel = document.getElementById('member-assistant-panel');
  if (!panel) return;

  isExpanded = !isExpanded;
  panel.classList.toggle('member-assistant__panel--expanded', isExpanded);
}

/**
 * Clear chat history
 */
function clearChat() {
  chatHistory = [];
  const messagesEl = document.getElementById('member-assistant-messages');
  if (!messagesEl) return;

  messagesEl.innerHTML = `
    <div class="member-assistant__message member-assistant__message--assistant">
      <div class="member-assistant__bubble">
        Sæl! Ég get svarað spurningum um stefnu flokksins, sögu hans og fleira. Hvaða upplýsingar ertu að leita að?
      </div>
    </div>
    <div class="member-assistant__suggestions">
      <button class="member-assistant__suggestion" data-query="Hver er stefna flokksins í húsnæðismálum?">Húsnæðismál</button>
      <button class="member-assistant__suggestion" data-query="Hvað segir flokkurinn um heilbrigðismál?">Heilbrigðismál</button>
      <button class="member-assistant__suggestion" data-query="Hver er afstaða flokksins til skatta?">Skattar</button>
    </div>
  `;
}

/**
 * Initialize the chat widget
 */
export function initMemberAssistantChat() {
  // Only init if user is authenticated
  const auth = getFirebaseAuth();
  if (!auth.currentUser) {
    debug.log('member-assistant', 'waiting for auth');
    auth.onAuthStateChanged((user) => {
      if (user) {
        debug.log('member-assistant', 'user authenticated, initializing');
        setupWidget();
      }
    });
    return;
  }

  setupWidget();
}

/**
 * Set up the widget DOM and event listeners
 */
function setupWidget() {
  // Don't init twice
  if (document.getElementById('member-assistant-widget')) {
    return;
  }

  addChatStyles();
  createChatWidget();

  // Event listeners
  document.getElementById('member-assistant-toggle')?.addEventListener('click', togglePanel);
  document.getElementById('member-assistant-close')?.addEventListener('click', togglePanel);
  document.getElementById('member-assistant-expand')?.addEventListener('click', toggleExpanded);
  document.getElementById('member-assistant-clear')?.addEventListener('click', clearChat);

  // Info tooltip toggle
  document.getElementById('member-assistant-info')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const tooltip = document.getElementById('member-assistant-tooltip');
    if (tooltip) {
      tooltip.classList.toggle('member-assistant__info-tooltip--visible');
    }
  });

  // Close tooltip when clicking outside
  document.addEventListener('click', (e) => {
    const tooltip = document.getElementById('member-assistant-tooltip');
    const infoBtn = document.getElementById('member-assistant-info');
    if (tooltip && !tooltip.contains(e.target) && e.target !== infoBtn) {
      tooltip.classList.remove('member-assistant__info-tooltip--visible');
    }
  });

  document.getElementById('member-assistant-send')?.addEventListener('click', () => {
    const input = document.getElementById('member-assistant-input');
    if (input) sendMessage(input.value);
  });

  document.getElementById('member-assistant-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e.target.value);
    }
  });

  // Auto-resize textarea
  document.getElementById('member-assistant-input')?.addEventListener('input', (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
  });

  // Suggestion buttons
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('member-assistant__suggestion')) {
      const query = e.target.dataset.query;
      if (query) sendMessage(query);
    }
  });

  debug.log('member-assistant', 'chat initialized');
}

export default { initMemberAssistantChat };
