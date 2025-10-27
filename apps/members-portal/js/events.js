/**
 * Events Page Logic
 *
 * Display upcoming and past events for members.
 * Placeholder implementation - to be expanded with actual events API.
 *
 * @module events
 */

import { R } from '../i18n/strings-loader.js';
import { initAuthenticatedPage } from './page-init.js';
import { setTextContent, setInnerHTML } from '../ui/dom.js';

/**
 * Set page title and header text
 */
function updateEventsStrings() {
  document.title = R.string.page_title_events || 'Viðburðir';
  setTextContent('events-title', R.string.events_title || 'Viðburðir', 'events page');
  setTextContent('events-subtitle', R.string.events_subtitle || 'Komandi og liðnir viðburðir flokksins', 'events page');

  // Tab labels
  setTextContent('tab-upcoming-label', R.string.events_tab_upcoming || 'Komandi', 'events page');
  setTextContent('tab-past-label', R.string.events_tab_past || 'Liðnir', 'events page');

  // Loading message
  setTextContent('loading-message', R.string.events_loading || 'Hleð inn viðburðum...', 'events page');

  // Empty message
  setTextContent('empty-message', R.string.events_empty || 'Engir viðburðir fundust', 'events page');
}

/**
 * Show loading state
 */
function showLoading() {
  document.getElementById('loading-state').classList.remove('u-hidden');
  document.getElementById('error-state').classList.add('u-hidden');
  document.getElementById('empty-state').classList.add('u-hidden');
  document.getElementById('events-list').classList.add('u-hidden');
}

/**
 * Show error state
 */
function showError(message) {
  document.getElementById('loading-state').classList.add('u-hidden');
  document.getElementById('error-state').classList.remove('u-hidden');
  document.getElementById('empty-state').classList.add('u-hidden');
  document.getElementById('events-list').classList.add('u-hidden');

  setTextContent('error-message', message, 'events page');
}

/**
 * Show empty state
 */
function showEmpty() {
  document.getElementById('loading-state').classList.add('u-hidden');
  document.getElementById('error-state').classList.add('u-hidden');
  document.getElementById('empty-state').classList.remove('u-hidden');
  document.getElementById('events-list').classList.add('u-hidden');
}

/**
 * Show events list
 */
function showEvents(events) {
  document.getElementById('loading-state').classList.add('u-hidden');
  document.getElementById('error-state').classList.add('u-hidden');
  document.getElementById('empty-state').classList.add('u-hidden');
  document.getElementById('events-list').classList.remove('u-hidden');

  const eventsList = document.getElementById('events-list');
  eventsList.innerHTML = renderEventsList(events);
}

/**
 * Render events list HTML
 */
function renderEventsList(events) {
  if (!events || events.length === 0) {
    return '';
  }

  return events.map(event => `
    <div class="card">
      <div class="card__content">
        <h3 class="card__title">${event.title}</h3>
        <p class="u-text-muted">${event.date}</p>
        <p>${event.description}</p>
      </div>
    </div>
  `).join('');
}

/**
 * Load events (placeholder - will be replaced with actual API call)
 */
async function loadEvents(filter = 'upcoming') {
  try {
    showLoading();

    // TODO: Replace with actual Events API call
    // For now, show empty state
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading

    const events = []; // Placeholder - no events yet

    if (events.length === 0) {
      showEmpty();
    } else {
      showEvents(events);
    }

  } catch (error) {
    console.error('Failed to load events:', error);
    showError(R.string.events_error || 'Villa kom upp við að sækja viðburði');
  }
}

/**
 * Setup tab filter event listeners
 */
function setupFilters() {
  const tabs = document.querySelectorAll('.button-group .btn');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab (toggle between primary and secondary)
      tabs.forEach(t => {
        t.classList.remove('btn--primary');
        t.classList.add('btn--secondary');
      });
      tab.classList.remove('btn--secondary');
      tab.classList.add('btn--primary');

      // Load events for selected filter
      const filter = tab.getAttribute('data-filter');
      loadEvents(filter);
    });
  });
}

/**
 * Initialize events page
 */
async function init() {
  try {
    // Initialize authenticated page (handles auth, nav, i18n)
    await initAuthenticatedPage();

    // Set page-specific strings
    updateEventsStrings();

    // Setup filter tabs
    setupFilters();

    // Load initial events (upcoming)
    await loadEvents('upcoming');

    console.log('✓ Events page initialized');

  } catch (error) {
    console.error('Failed to initialize events page:', error);
    showError(error.message);
  }
}

// Run on page load
init();
