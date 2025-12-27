/**
 * Elections List Page
 *
 * Displays all elections a member can vote in.
 * - Active elections: Can vote now
 * - Upcoming elections: Will open for voting soon
 * - Closed elections: Results available
 *
 * Filter by status using tabs.
 *
 * Module cleanup not needed - page reloads on navigation.
 */

import { initAuthenticatedPage } from '../../js/page-init.js';
import { debug } from '../../js/utils/util-debug.js';
import { R } from '../i18n/strings-loader.js';
import { getElections } from '../../js/api/api-elections.js';
import { escapeHTML, formatDateIcelandic } from '../../js/utils/util-format.js';
import { createButton } from '../../js/components/ui-button.js';
import { setTextContentOptional, showElement, hideElement } from '../../ui/dom.js';

// ============================================================================
// LOCAL STORAGE CACHE - Persistent (no PII - election metadata only)
// ============================================================================
const CACHE_KEY = 'elections_list_cache';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached elections from localStorage
 * Safe to use localStorage - only election names/dates, no voter PII.
 * @returns {Object|null} { data, isStale } or null if no cache
 */
function getCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    return {
      data,
      isStale: age > CACHE_MAX_AGE_MS
    };
  } catch (e) {
    debug.warn('[Cache] Failed to read cache:', e);
    return null;
  }
}

/**
 * Save elections to localStorage cache
 * @param {Array} data - Elections array to cache
 */
function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    debug.log('[Cache] Elections cached:', data.length);
  } catch (e) {
    debug.warn('[Cache] Failed to write cache:', e);
  }
}

// State
let currentFilter = 'active';
let allElections = [];
let electionCounts = {
  active: 0,
  upcoming: 0,
  closed: 0
};

// Button instances
let retryButton = null;

/**
 * Initialize elections list page
 * Uses localStorage cache for instant display on repeat visits
 */
async function init() {
  try {
    // Check for cached data first - show immediately
    const cached = getCache();

    if (cached?.data) {
      debug.log('[Cache] Showing cached elections immediately');
      allElections = cached.data;
      updateElectionCounts(allElections);
      displayElections(allElections);
    }

    // Load i18n strings
    await R.load('is');

    // Translate elements with data-i18n attributes
    R.translatePage();

    // Initialize authenticated page (header, navigation, auth check)
    // Note: This updates nav-brand, nav-dashboard, nav-profile, and nav-logout
    await initAuthenticatedPage();

    // Update elections navigation link (page-specific) if it exists
    setTextContentOptional('nav-voting', R.string.nav_voting);

    // Update page titles (using safe helpers)
    document.title = R.string.page_title_elections;
    // Note: elections-title and elections-subtitle removed from HTML - nav brand shows "Kosningar" and buttons communicate context
    setTextContentOptional('loading-message', R.string.loading_elections);
    setTextContentOptional('empty-message', R.string.empty_no_elections);
    setTextContentOptional('error-message', R.string.error_load_elections);

    // Update filter button labels
    setTextContentOptional('filter-active-text', R.string.filter_active);
    setTextContentOptional('filter-upcoming-text', R.string.filter_upcoming);
    setTextContentOptional('filter-closed-text', R.string.filter_closed);

    // Setup filter buttons and retry button
    setupFilters();

    // If we have cached data, decide whether to refresh
    if (cached?.data) {
      if (cached.isStale) {
        debug.log('[Cache] Cache is stale, refreshing in background');
        loadElections(true).catch(err => {
          debug.warn('[Cache] Background refresh failed:', err);
        });
      }
    } else {
      // No cache - load normally with loading spinner
      await loadElections();
    }

  } catch (error) {
    // Handle auth redirect
    if (error.name === 'AuthenticationError') {
      window.location.href = error.redirectTo || '/';
      return;
    }

    debug.error('Error initializing elections page:', error);
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

  // Create retry button
  retryButton = createButton({
    text: R.string.btn_retry,
    variant: 'primary',
    onClick: loadElections
  });

  // Append to error state container
  const errorContainer = document.getElementById('elections-error');
  if (errorContainer) {
    // Find existing button placeholder or append
    const existingButton = document.getElementById('retry-button');
    if (existingButton) {
      existingButton.replaceWith(retryButton.element);
    } else {
      errorContainer.appendChild(retryButton.element);
    }
  }
}

/**
 * Update election counts in filter badges
 * @param {Array} elections - Elections array
 */
function updateElectionCounts(elections) {
  electionCounts = {
    active: elections.filter(e => e.status === 'active').length,
    upcoming: elections.filter(e => e.status === 'upcoming').length,
    closed: elections.filter(e => e.status === 'closed').length
  };

  // Update filter count badges
  document.getElementById('count-active').textContent = electionCounts.active;
  document.getElementById('count-upcoming').textContent = electionCounts.upcoming;
  document.getElementById('count-closed').textContent = electionCounts.closed;
}

/**
 * Load elections from API (or mock)
 * @param {boolean} backgroundRefresh - If true, don't show loading spinner
 */
async function loadElections(backgroundRefresh = false) {
  try {
    if (!backgroundRefresh) {
      showLoading();
    }

    // Fetch elections (API layer normalizes status: published → active)
    allElections = await getElections();

    // Cache the elections for future visits
    setCache(allElections);

    // Update counts and display
    updateElectionCounts(allElections);
    displayElections(allElections);

    hideLoading();

  } catch (error) {
    debug.error('Error loading elections:', error);
    if (!backgroundRefresh) {
      showError(R.string.error_load_elections);
    }
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
      <span class="elections__card-date">${formatDateIcelandic(election.voting_starts_at || election.scheduled_start)}</span>
      <span class="elections__card-cta">${R.string.election_card_cta}</span>
    </div>
  `;

  // Click to navigate to election detail
  card.addEventListener('click', () => {
    window.location.href = `/elections/detail.html?id=${election.id}`;
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
 * Hide empty state
 */
function hideEmpty() {
  document.getElementById('elections-empty').classList.add('u-hidden');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
