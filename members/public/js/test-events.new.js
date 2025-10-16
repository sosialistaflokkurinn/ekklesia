/**
 * Test Events Page Logic
 *
 * Testing interface for Events and Elections service APIs.
 *
 * New architecture:
 * - Reuses initSession() (no code duplication)
 * - Uses ui/nav.js for navigation (shared)
 * - Uses session/auth.js for authenticated fetch
 * - Pure functions for formatting
 *
 * @module test-events
 */

import { R } from '/i18n/strings-loader.js';
import { initSession } from '/session/init.js';
import { signOut, authenticatedFetch, AuthenticationError } from '/session/auth.js';
import { updateNavigationStrings, setupLogoutHandler, validateNavigation } from '/ui/nav.js';
import { setTextContent, setDisabled, setInnerHTML, validateElements, getElementByIdSafe } from '/ui/dom.js';

/**
 * Required DOM elements for test events page
 */
const TEST_EVENTS_ELEMENTS = [
  'event-title',
  'auth-title',
  'auth-badge',
  'user-info',
  'api-title',
  'api-env-label',
  'api-env-url',
  'test-1-title',
  'btn-health',
  'test-2-title',
  'btn-election',
  'test-3-title',
  'btn-request-token',
  'test-4-title',
  'btn-my-status',
  'test-5-title',
  'test-5-token-label',
  'test-5-answer-label',
  'btn-vote',
  'answer-yes',
  'answer-no',
  'answer-abstain',
  'test-6-title',
  'btn-results',
  'result-health',
  'result-election',
  'result-request-token',
  'result-my-status',
  'result-vote',
  'result-results',
  'voting-token',
  'vote-answer',
  // Reset section
  'test-7-title',
  'test-7-warning',
  'test-7-scope-label',
  'test-7-scope-mine',
  'test-7-scope-all',
  'test-7-confirm-label',
  'btn-reset-election',
  'result-reset',
  'reset-scope',
  'reset-confirm'
];

/**
 * Validate test events page DOM structure
 *
 * @throws {Error} If required elements are missing
 */
function validateTestEventsPage() {
  validateNavigation();
  validateElements(TEST_EVENTS_ELEMENTS, 'test events page');
}

/**
 * Update test events page strings
 *
 * @param {Object} strings - i18n strings object
 */
function updateTestEventsStrings(strings) {
  document.title = strings.page_title_test_events;
  setTextContent('event-title', strings.test_events_title, 'test events page');
  setTextContent('auth-title', strings.test_auth_title, 'test events page');
  setTextContent('api-title', strings.test_api_title, 'test events page');
  setTextContent('api-env-label', strings.test_api_production_env, 'test events page');
  setTextContent('api-env-url', strings.config_api_events, 'test events page');

  // Test section titles
  setTextContent('test-1-title', strings.test_1_title, 'test events page');
  setTextContent('btn-health', strings.test_1_button, 'test events page');

  setTextContent('test-2-title', strings.test_2_title, 'test events page');
  setTextContent('btn-election', strings.test_2_button, 'test events page');

  setTextContent('test-3-title', strings.test_3_title, 'test events page');
  setTextContent('btn-request-token', strings.test_3_button, 'test events page');

  setTextContent('test-4-title', strings.test_4_title, 'test events page');
  setTextContent('btn-my-status', strings.test_4_button, 'test events page');

  setTextContent('test-5-title', strings.test_5_title, 'test events page');
  setTextContent('test-5-token-label', strings.test_5_token_label, 'test events page');
  setTextContent('test-5-answer-label', strings.test_5_answer_label, 'test events page');
  setTextContent('btn-vote', strings.test_5_button, 'test events page');
  setTextContent('answer-yes', strings.test_5_answer_yes, 'test events page');
  setTextContent('answer-no', strings.test_5_answer_no, 'test events page');
  setTextContent('answer-abstain', strings.test_5_answer_abstain, 'test events page');

  setTextContent('test-6-title', strings.test_6_title, 'test events page');
  setTextContent('btn-results', strings.test_6_button, 'test events page');

  // Reset section
  setTextContent('test-7-title', strings.test_7_title, 'test events page');
  setTextContent('test-7-warning', strings.test_7_warning, 'test events page');
  setTextContent('test-7-scope-label', strings.test_7_scope_label, 'test events page');
  setTextContent('test-7-scope-mine', strings.test_7_scope_mine, 'test events page');
  setTextContent('test-7-scope-all', strings.test_7_scope_all, 'test events page');
  setTextContent('test-7-confirm-label', strings.test_7_confirm_label, 'test events page');
  setTextContent('btn-reset-election', strings.test_7_button, 'test events page');

  const resetConfirm = document.getElementById('reset-confirm');
  if (resetConfirm) {
    resetConfirm.placeholder = strings.test_7_confirm_placeholder;
  }

  // Set placeholder for voting token input
  const votingTokenInput = document.getElementById('voting-token');
  if (votingTokenInput) {
    votingTokenInput.placeholder = strings.test_5_token_placeholder;
  }
}

/**
 * Format user details HTML
 *
 * Pure function - returns HTML for user info card.
 *
 * @param {Object} userData - User data
 * @param {Object} strings - i18n strings
 * @returns {string} HTML string
 */
export function formatUserDetails(userData, strings) {
  const kennitala = userData.kennitala || strings.test_auth_not_available;
  const isMember = userData.isMember ? strings.test_auth_yes : strings.test_auth_no;

  return `
    <div class="user-details">
      <div><strong>${strings.test_auth_uid}</strong> ${userData.uid}</div>
      <div><strong>${strings.test_auth_kennitala}</strong> ${kennitala}</div>
      <div><strong>${strings.test_auth_membership}</strong> ${isMember}</div>
    </div>
  `;
}

/**
 * Update authentication UI
 *
 * @param {Object} userData - User data
 * @param {Object} strings - i18n strings
 */
function updateAuthUI(userData, strings) {
  const authBadge = getElementByIdSafe('auth-badge', 'test events');
  authBadge.textContent = strings.test_auth_authenticated;
  authBadge.className = 'status-badge status-authenticated';

  setInnerHTML('user-info', formatUserDetails(userData, strings), 'test events');
}

/**
 * Enable API test buttons
 *
 * @param {boolean} enabled - Whether buttons should be enabled
 */
function enableButtons(enabled) {
  setDisabled('btn-election', !enabled, 'test events');
  setDisabled('btn-request-token', !enabled, 'test events');
  setDisabled('btn-my-status', !enabled, 'test events');
  setDisabled('btn-results', !enabled, 'test events');
  setDisabled('btn-reset-election', !enabled, 'test events');
}

/**
 * Show API test result
 *
 * @param {string} elementId - Result element ID
 * @param {Object|string} data - Result data
 * @param {boolean} isError - Whether this is an error
 */
function showResult(elementId, data, isError = false) {
  const element = getElementByIdSafe(elementId, 'test events');
  element.className = isError ? 'test-result test-error' : 'test-result test-success';
  element.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  element.style.display = 'block';
}

/**
 * Setup API test handlers
 *
 * @param {string} productionApi - Events API URL
 * @param {string} electionsApi - Elections API URL
 * @param {Object} strings - i18n strings
 */
function setupAPITestHandlers(productionApi, electionsApi, strings) {
  // Health Check (no auth)
  document.getElementById('btn-health').addEventListener('click', async () => {
    try {
      const response = await fetch(`${productionApi}/health`);
      const data = await response.json();
      showResult('result-health', data);
    } catch (error) {
      showResult('result-health', { error: error.message }, true);
    }
  });

  // Get Election
  document.getElementById('btn-election').addEventListener('click', async () => {
    try {
      const response = await authenticatedFetch(`${productionApi}/api/election`);
      const data = await response.json();
      showResult('result-election', data, !response.ok);
    } catch (error) {
      showResult('result-election', { error: error.message }, true);
    }
  });

  // Request Token
  document.getElementById('btn-request-token').addEventListener('click', async () => {
    try {
      const response = await authenticatedFetch(`${productionApi}/api/request-token`, {
        method: 'POST'
      });
      const data = await response.json();
      showResult('result-request-token', data, !response.ok);
    } catch (error) {
      showResult('result-request-token', { error: error.message }, true);
    }
  });

  // Check Status
  document.getElementById('btn-my-status').addEventListener('click', async () => {
    try {
      const response = await authenticatedFetch(`${productionApi}/api/my-status`);
      const data = await response.json();
      showResult('result-my-status', data, !response.ok);
    } catch (error) {
      showResult('result-my-status', { error: error.message }, true);
    }
  });

  // Submit Vote
  document.getElementById('btn-vote').addEventListener('click', async () => {
    try {
      const votingTokenEl = getElementByIdSafe('voting-token', 'test events');
      const voteAnswerEl = getElementByIdSafe('vote-answer', 'test events');

      const votingToken = votingTokenEl.value.trim();
      const answer = voteAnswerEl.value;

      if (!votingToken) {
        showResult('result-vote', { error: strings.test_5_error_no_token }, true);
        return;
      }

      const response = await fetch(`${electionsApi}/api/vote`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${votingToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answer })
      });
      const data = await response.json();
      showResult('result-vote', data, !response.ok);

      if (response.ok) {
        votingTokenEl.value = '';
      }
    } catch (error) {
      showResult('result-vote', { error: error.message }, true);
    }
  });

  // Get Results
  document.getElementById('btn-results').addEventListener('click', async () => {
    try {
      const response = await authenticatedFetch(`${productionApi}/api/results`);
      const data = await response.json();
      showResult('result-results', data, !response.ok);
    } catch (error) {
      showResult('result-results', { error: error.message }, true);
    }
  });

  // Admin Reset
  document.getElementById('btn-reset-election').addEventListener('click', async () => {
    try {
      const scopeEl = getElementByIdSafe('reset-scope', 'test events');
      const confirmEl = getElementByIdSafe('reset-confirm', 'test events');
      const scope = scopeEl.value;
      const confirmText = confirmEl.value.trim();

      // For full reset, require exact phrase
      if (scope === 'all' && confirmText !== 'RESET ALL') {
        showResult('result-reset', { error: strings.test_7_error_confirm }, true);
        return;
      }

      const response = await authenticatedFetch(`${productionApi}/api/admin/reset-election`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, confirm: confirmText })
      });
      const data = await response.json();
      showResult('result-reset', data, !response.ok);
    } catch (error) {
      showResult('result-reset', { error: error.message }, true);
    }
  });
}

/**
 * Initialize test events page
 *
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Validate DOM structure
    validateTestEventsPage();

    // Initialize session (reuse shared init - no code duplication!)
    const { userData, strings } = await initSession();

    // Update navigation (shared UI)
    updateNavigationStrings(strings);
    setupLogoutHandler(signOut);

    // Update page-specific UI
    updateTestEventsStrings(strings);
    updateAuthUI(userData, strings);

    // Enable common buttons always after auth
    enableButtons(true);

    // Gate admin reset section by role (developer only)
    try {
      const resetSectionTitle = document.getElementById('test-7-title');
      const resetButton = document.getElementById('btn-reset-election');
      const hasDeveloperRole = Array.isArray(userData.roles) && userData.roles.includes('developer');
      if (!hasDeveloperRole) {
        // Hide the entire section by collapsing elements
        if (resetSectionTitle) {
          const section = resetSectionTitle.closest('.test-section');
          if (section) section.style.display = 'none';
        }
      } else {
        // Ensure reset button is enabled for devs
        if (resetButton) resetButton.disabled = false;
      }
    } catch (e) {
      // Non-fatal UI gating error; continue without exposing controls
      console.warn('Role-gating error:', e);
    }

    // Get API URLs from config
    const productionApi = strings.config_api_events;
    const electionsApi = strings.config_api_elections;

    // Setup API test handlers
    setupAPITestHandlers(productionApi, electionsApi, strings);
  } catch (error) {
    // Handle authentication error (redirect to login)
    if (error instanceof AuthenticationError) {
      window.location.href = error.redirectTo;
      return;
    }

    // Other errors
    console.error('Test events page initialization failed:', error);
  }
}

// Run initialization
init();
