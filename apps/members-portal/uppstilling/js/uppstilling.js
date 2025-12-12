/**
 * Uppstillingarnefnd Main Page Logic
 * Lists nomination committee elections and provides navigation to vote/results.
 */

import { getFirebaseAuth } from '../../../firebase/app.js';
import { requireAuth } from '../../../js/auth.js';
import { getNominationElections, checkNominationAccess } from '../../../js/api/api-nomination.js';
import { debug } from '../../../js/utils/util-debug.js';
import { escapeHTML } from '../../../js/utils/util-format.js';

// DOM Elements
const loadingCard = document.getElementById('loading-card');
const errorCard = document.getElementById('error-card');
const noAccessCard = document.getElementById('no-access-card');
const electionsContainer = document.getElementById('elections-container');
const activeElectionsList = document.getElementById('active-elections-list');
const closedElectionsList = document.getElementById('closed-elections-list');
const noActiveElections = document.getElementById('no-active-elections');
const noClosedElections = document.getElementById('no-closed-elections');
const errorMessage = document.getElementById('error-message');

/**
 * Initialize page
 */
async function init() {
  try {
    // Wait for auth - redirects to login if not authenticated
    await requireAuth();

    // Load elections
    await loadElections();
  } catch (error) {
    debug.error('[Uppstilling] Init error:', error);
    showError(error.message || 'Villa kom upp');
  }
}

/**
 * Load and display elections
 */
async function loadElections() {
  try {
    const result = await getNominationElections();

    hideLoading();

    if (!result.elections || result.elections.length === 0) {
      // Check if user has no access vs no elections
      showNoAccess();
      return;
    }

    // Split into active and closed
    const activeElections = result.elections.filter(e =>
      e.status === 'published' || e.status === 'draft'
    );
    const closedElections = result.elections.filter(e =>
      e.status === 'closed' || e.status === 'archived'
    );

    // Render active elections
    if (activeElections.length > 0) {
      renderElections(activeElections, activeElectionsList);
    } else {
      noActiveElections.style.display = 'block';
    }

    // Render closed elections
    if (closedElections.length > 0) {
      renderElections(closedElections, closedElectionsList);
    } else {
      noClosedElections.style.display = 'block';
    }

    electionsContainer.style.display = 'block';
  } catch (error) {
    debug.error('[Uppstilling] Load elections error:', error);

    if (error.status === 403) {
      hideLoading();
      showNoAccess();
    } else {
      showError(error.message || 'Villa við að sækja kosningar');
    }
  }
}

/**
 * Render elections list
 * @param {Array} elections - Elections to render
 * @param {HTMLElement} container - Container element
 */
function renderElections(elections, container) {
  container.innerHTML = '';

  elections.forEach(election => {
    const item = document.createElement('a');
    item.className = 'election-item';

    // Link to vote if open, results if closed
    if (election.status === 'published') {
      item.href = `vote.html?id=${election.id}`;
    } else {
      item.href = `results.html?id=${election.id}`;
    }

    const statusClass = `election-item__status--${election.status}`;
    const statusText = getStatusText(election.status);

    item.innerHTML = `
      <div class="election-item__title">${escapeHTML(election.title)}</div>
      <div class="election-item__meta">
        <span class="election-item__status ${statusClass}">${statusText}</span>
        <span>Umferð ${election.round_number || 1}</span>
        <span>${election.votes_cast || 0} atkvæði</span>
        ${election.has_voted ? '<span style="color: var(--color-success);">✓ Þú hefur kosið</span>' : ''}
      </div>
    `;

    container.appendChild(item);
  });
}

/**
 * Get human-readable status text
 * @param {string} status - Election status
 * @returns {string} Status text in Icelandic
 */
function getStatusText(status) {
  const statusMap = {
    'draft': 'Drög',
    'published': 'Opin',
    'paused': 'Í bið',
    'closed': 'Lokað',
    'archived': 'Geymd',
  };
  return statusMap[status] || status;
}

/**
 * Hide loading state
 */
function hideLoading() {
  loadingCard.style.display = 'none';
}

/**
 * Show error state
 * @param {string} message - Error message
 */
function showError(message) {
  hideLoading();
  errorMessage.textContent = message;
  errorCard.style.display = 'block';
}

/**
 * Show no access state
 */
function showNoAccess() {
  hideLoading();
  noAccessCard.style.display = 'block';
}

// Initialize on load
init();
