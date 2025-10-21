/**
 * Test Events Page Logic
 *
 * Testing interface for Events and Elections service APIs.
 * Allows authenticated members to test the full voting flow.
 *
 * @module test-events
 */

import { R } from '/i18n/strings-loader.js';
import { requireAuth, signOut, authenticatedFetch } from '/js/auth.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

/**
 * Update page title and navigation strings
 */
function updatePageStrings() {
  document.title = R.string.page_title_test_events;
  document.getElementById('nav-brand').textContent = R.string.nav_brand;
  document.getElementById('nav-dashboard').textContent = R.string.nav_dashboard;
  document.getElementById('nav-profile').textContent = R.string.nav_profile;
  document.getElementById('nav-logout').textContent = R.string.nav_logout;
}

/**
 * Update authentication UI with user information
 *
 * @param {Object} user - Firebase user object
 */
async function updateAuthUI(user) {
  const authBadge = document.getElementById('auth-badge');
  const userInfo = document.getElementById('user-info');

  if (user) {
    authBadge.textContent = R.string.test_auth_authenticated;
    authBadge.className = 'status-badge status-authenticated';

    const idTokenResult = await user.getIdTokenResult();
    const kennitala = idTokenResult.claims.kennitala || R.string.test_auth_not_available;
    const isMember = idTokenResult.claims.isMember ? R.string.test_auth_yes : R.string.test_auth_no;

    userInfo.innerHTML = `
      <div class="user-details">
        <div><strong>${R.string.test_auth_uid}</strong> ${user.uid}</div>
        <div><strong>${R.string.test_auth_kennitala}</strong> ${kennitala}</div>
        <div><strong>${R.string.test_auth_membership}</strong> ${isMember}</div>
      </div>
    `;

    enableButtons(true);
  }
}

/**
 * Enable or disable API test buttons
 *
 * @param {boolean} enabled - Whether buttons should be enabled
 */
function enableButtons(enabled) {
  document.getElementById('btn-election').disabled = !enabled;
  document.getElementById('btn-request-token').disabled = !enabled;
  document.getElementById('btn-my-status').disabled = !enabled;
  document.getElementById('btn-results').disabled = !enabled;
}

/**
 * Display API test result in the UI
 *
 * @param {string} elementId - ID of result element
 * @param {Object} data - Result data to display
 * @param {boolean} isError - Whether this is an error result
 */
function showResult(elementId, data, isError = false) {
  const element = document.getElementById(elementId);
  element.className = isError ? 'test-result test-error' : 'test-result test-success';
  element.textContent = JSON.stringify(data, null, 2);
  element.style.display = 'block';
}

/**
 * Setup logout button handler
 */
function setupLogout() {
  document.getElementById('nav-logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut();
  });
}

/**
 * Setup API test button handlers
 *
 * @param {Object} currentUser - Firebase user object
 * @param {string} productionApi - Events service API URL
 * @param {string} electionsApi - Elections service API URL
 */
function setupAPITestHandlers(currentUser, productionApi, electionsApi) {
  // Health Check (no auth required)
  document.getElementById('btn-health').addEventListener('click', async () => {
    try {
      const response = await fetch(`${productionApi}/health`);
      const data = await response.json();
      showResult('result-health', data);
    } catch (error) {
      showResult('result-health', { error: error.message }, true);
    }
  });

  // Get Election Details
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

  // Check Participation Status
  document.getElementById('btn-my-status').addEventListener('click', async () => {
    try {
      const response = await authenticatedFetch(`${productionApi}/api/my-status`);
      const data = await response.json();
      showResult('result-my-status', data, !response.ok);
    } catch (error) {
      showResult('result-my-status', { error: error.message }, true);
    }
  });

  // Submit Vote (Elections Service)
  document.getElementById('btn-vote').addEventListener('click', async () => {
    try {
      const votingToken = document.getElementById('voting-token').value.trim();
      const answer = document.getElementById('vote-answer').value;

      if (!votingToken) {
        showResult('result-vote', { error: R.string.test_5_error_no_token }, true);
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

      // If vote succeeded, clear the token field
      if (response.ok) {
        document.getElementById('voting-token').value = '';
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
}

/**
 * Initialize test events page
 */
async function init() {
  // Load i18n strings
  await R.load('is');

  // Update page strings
  updatePageStrings();

  // Get API URLs from i18n config
  const PRODUCTION_API = R.string.config_api_events;
  const ELECTIONS_API = R.string.config_api_elections;

  // Auth guard - redirect if not authenticated
  const currentUser = await requireAuth();

  // Update auth UI
  await updateAuthUI(currentUser);

  // Setup logout handler
  setupLogout();

  // Setup API test handlers
  setupAPITestHandlers(currentUser, PRODUCTION_API, ELECTIONS_API);
}

// Run initialization
init().catch(error => {
  console.error('Test events page initialization failed:', error);
});
