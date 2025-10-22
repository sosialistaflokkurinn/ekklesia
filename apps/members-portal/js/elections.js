/**
 * Elections List Page
 *
 * Displays all elections a member can vote in.
 * - Active elections: Can vote now
 * - Upcoming elections: Will open for voting soon
 * - Closed elections: Results available
 *
 * Filter by status using tabs.
 */

import { initAuthenticatedPage } from './page-init.js';
import { R } from '../i18n/strings-loader.js';
import { getElections } from './api/elections-api.js';

// State
let currentFilter = 'all';
let allElections = [];
let electionCounts = {
  all: 0,
  active: 0,
  upcoming: 0,
  closed: 0
};

/**
 * Initialize elections list page
 */
async function init() {
  try {
    // Load i18n strings
    await R.load('is');

    // Initialize authenticated page (header, navigation, auth check)
    await initAuthenticatedPage();

    // Update page titles
    document.title = R.string.page_title_elections;
    document.getElementById('elections-title').textContent = R.string.elections_title;
    document.getElementById('elections-subtitle').textContent = R.string.elections_subtitle;
    document.getElementById('loading-message').textContent = R.string.loading_elections;
    document.getElementById('empty-message').textContent = R.string.empty_no_elections;
    document.getElementById('error-message').textContent = R.string.error_load_elections;

    // Update filter button labels
    document.getElementById('filter-all-text').textContent = R.string.filter_all;
    document.getElementById('filter-active-text').textContent = R.string.filter_active;
    document.getElementById('filter-upcoming-text').textContent = R.string.filter_upcoming;
    document.getElementById('filter-closed-text').textContent = R.string.filter_closed;

    // Update retry button
    document.getElementById('retry-button').textContent = R.string.btn_retry;

    // Setup filter buttons
    setupFilters();

    // Load elections
    await loadElections();

  } catch (error) {
    console.error('Error initializing elections page:', error);
    showError(R.string.error_load_elections);
  }
}

/**
 * Setup filter button event listeners
 */
function setupFilters() {
  const filterButtons = document.querySelectorAll('.elections__filter-btn');

  filterButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      // Update active state
      document.querySelectorAll('.elections__filter-btn').forEach(btn => btn.classList.remove('elections__filter-btn--active'));
      e.target.closest('.elections__filter-btn').classList.add('elections__filter-btn--active');

      // Update current filter and reload display
      currentFilter = e.target.closest('.elections__filter-btn').dataset.filter;
      displayElections(allElections);
    });
  });

  // Retry button
  const retryButton = document.getElementById('retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', loadElections);
  }
}

/**
 * Load elections from API (or mock)
 */
async function loadElections() {
  try {
    showLoading();

    // Fetch elections
    allElections = await getElections();

    // Calculate counts by status
    electionCounts = {
      all: allElections.length,
      active: allElections.filter(e => e.status === 'active').length,
      upcoming: allElections.filter(e => e.status === 'upcoming').length,
      closed: allElections.filter(e => e.status === 'closed').length
    };

    // Update filter count badges
    document.getElementById('count-all').textContent = electionCounts.all;
    document.getElementById('count-active').textContent = electionCounts.active;
    document.getElementById('count-upcoming').textContent = electionCounts.upcoming;
    document.getElementById('count-closed').textContent = electionCounts.closed;

    // Display elections
    displayElections(allElections);

    hideLoading();

  } catch (error) {
    console.error('Error loading elections:', error);
    showError(R.string.error_load_elections);
  }
}

/**
 * Display elections (filtered by current filter)
 */
function displayElections(elections) {
  const container = document.querySelector('.elections__list');
  container.innerHTML = '';

  // Filter elections
  let filtered = elections;
  if (currentFilter !== 'all') {
    filtered = elections.filter(e => e.status === currentFilter);
  }

  // Show empty state if no elections
  if (filtered.length === 0) {
    showEmpty();
    hideLoading();
    return;
  }

  hideEmpty();

  // Create election cards
  filtered.forEach(election => {
    const card = createElectionCard(election);
    container.appendChild(card);
  });
}

/**
 * Create election card element
 */
function createElectionCard(election) {
  const card = document.createElement('div');
  card.className = 'elections__card';
  card.style.cursor = 'pointer';

  // Status badge
  const statusClass = `elections__status-badge--${election.status}`;
  let statusText = '';
  if (election.status === 'active') {
    statusText = R.string.status_active;
  } else if (election.status === 'upcoming') {
    statusText = R.string.status_upcoming;
  } else if (election.status === 'closed') {
    statusText = R.string.status_closed;
  }

  // Already voted indicator
  let votedHTML = '';
  if (election.has_voted) {
    votedHTML = `<div class="elections__card-voted">${R.string.election_card_voted}</div>`;
  }

  card.innerHTML = `
    <div class="elections__card-header">
      <h3 class="elections__card-title">${escapeHTML(election.title)}</h3>
      <span class="elections__status-badge ${statusClass}">${statusText}</span>
    </div>
    <p class="elections__card-question">${escapeHTML(election.question)}</p>
    ${votedHTML}
    <div class="elections__card-footer">
      <span class="elections__card-date">${formatDate(election.voting_starts_at)}</span>
      <span class="elections__card-cta">${R.string.election_card_cta}</span>
    </div>
  `;

  // Click to navigate to election detail
  card.addEventListener('click', () => {
    window.location.href = `/election-detail.html?id=${election.id}`;
  });

  return card;
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('elections-loading').classList.remove('u-hidden');
  document.getElementById('elections-error').classList.add('u-hidden');
  document.getElementById('elections-empty').classList.add('u-hidden');
  document.querySelector('.elections__list').innerHTML = '';
}

/**
 * Hide loading state
 */
function hideLoading() {
  document.getElementById('elections-loading').classList.add('u-hidden');
}

/**
 * Show error state
 */
function showError(message) {
  document.getElementById('elections-error').classList.remove('u-hidden');
  document.getElementById('error-message').textContent = message;
  document.getElementById('elections-loading').classList.add('u-hidden');
  document.getElementById('elections-empty').classList.add('u-hidden');
  document.querySelector('.elections__list').innerHTML = '';
}

/**
 * Show empty state
 */
function showEmpty() {
  document.getElementById('elections-empty').classList.remove('u-hidden');
  document.getElementById('elections-error').classList.add('u-hidden');
  document.getElementById('elections-loading').classList.add('u-hidden');
}

/**
 * Utility: Escape HTML to prevent XSS
 */
function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Utility: Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('is-IS', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
