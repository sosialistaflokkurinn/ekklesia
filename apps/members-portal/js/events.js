/**
 * Events Page Module
 *
 * Displays list of upcoming and past events for members.
 * Events are fetched from the Events API.
 *
 * @module pages/events
 */

import { R } from '../i18n/strings-loader.js';
import { initAuthenticatedPage } from './page-init.js';
import { setTextContent, show, hide, addEventListener } from '../ui/dom.js';
import { getEvents } from './api/events-api.js';

/**
 * Event filter states
 */
const FILTERS = {
  UPCOMING: 'upcoming',
  PAST: 'past'
};

/**
 * Current filter state
 */
let currentFilter = FILTERS.UPCOMING;

/**
 * Initialize the events page
 */
async function init() {
  try {
    // Load i18n strings (note: initAuthenticatedPage also calls R.load, but explicit here)
    await R.load('is');

    // Initialize page: auth check, nav setup, logout handler
    await initAuthenticatedPage();

    // Update page-specific strings
    updatePageStrings();

    // Setup handlers
    setupFilterHandlers();

    // Load events
    await loadEvents(currentFilter);

  } catch (error) {
    console.error('[Events] Initialization error:', error);
    showError(error.message || R.string.events_init_error);
  }
}

/**
 * Update page UI strings
 */
function updatePageStrings() {
  // Set page title in browser tab
  document.title = R.string.page_title_events;

  // Set page heading
  setTextContent('events-title', R.string.events_title, 'events title');
  setTextContent('events-subtitle', R.string.events_subtitle, 'events subtitle');

  setTextContent('tab-upcoming-label', R.string.events_tab_upcoming, 'upcoming tab');
  setTextContent('tab-past-label', R.string.events_tab_past, 'past tab');

  setTextContent('loading-message', R.string.events_loading, 'loading message');
  setTextContent('empty-message', R.string.events_empty, 'empty message');
  setTextContent('error-message', R.string.events_error, 'error message');
}

/**
 * Setup filter tab handlers
 */
function setupFilterHandlers() {
  addEventListener('tab-upcoming', 'click', () => {
    switchFilter(FILTERS.UPCOMING);
  }, 'upcoming filter');

  addEventListener('tab-past', 'click', () => {
    switchFilter(FILTERS.PAST);
  }, 'past filter');
}

/**
 * Switch between event filters
 */
async function switchFilter(filter) {
  if (filter === currentFilter) return;

  currentFilter = filter;

  // Update active tab UI
  const upcomingTab = document.getElementById('tab-upcoming');
  const pastTab = document.getElementById('tab-past');

  if (filter === FILTERS.UPCOMING) {
    upcomingTab?.classList.add('tabs__item--active');
    pastTab?.classList.remove('tabs__item--active');
  } else {
    upcomingTab?.classList.remove('tabs__item--active');
    pastTab?.classList.add('tabs__item--active');
  }

  // Load events for new filter
  await loadEvents(filter);
}

/**
 * Load events using API abstraction
 *
 * @param {string} filter - Filter type (upcoming or past)
 */
async function loadEvents(filter) {
  showLoading();
  hideError();
  hideEmpty();
  hideEventsList();

  try {
    // Fetch events using API abstraction
    const filteredEvents = await getEvents({ status: filter });

    if (filteredEvents.length === 0) {
      showEmpty();
    } else {
      renderEvents(filteredEvents);
      showEventsList();
    }

  } catch (error) {
    console.error('[Events] Load error:', error);
    showError(error.message || R.string.events_error);
  } finally {
    hideLoading();
  }
}

/**
 * Render events list
 *
 * @param {Array} events - Array of event objects
 */
function renderEvents(events) {
  const container = document.getElementById('events-list');
  if (!container) return;

  // Clear existing content
  container.innerHTML = '';

  // Render each event
  events.forEach(event => {
    const eventCard = createEventCard(event);
    container.appendChild(eventCard);
  });
}

/**
 * Create event card element
 *
 * @param {Object} event - Event object
 * @returns {HTMLElement} Event card element
 */
function createEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event';

  // Format date and time
  const eventDate = new Date(event.date);
  const dateStr = eventDate.toLocaleDateString('is-IS', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Build format badge
  let formatBadge = '';
  if (event.format === 'hybrid') {
    formatBadge = '<span class="event__badge event__badge--info">Staðar og á Zoom</span>';
  } else if (event.format === 'remote') {
    formatBadge = '<span class="event__badge event__badge--info">Aðeins á Zoom</span>';
  } else if (event.format === 'in-person') {
    formatBadge = '<span class="event__badge event__badge--info">Staðar</span>';
  }

  // Build agenda section
  let agendaHtml = '';
  if (event.agenda && event.agenda.length > 0) {
    agendaHtml = `
      <div class="event__section">
        <h4 class="event__section-title">Dagskrá:</h4>
        <ul class="event__agenda">
          ${event.agenda.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  // Build speakers/moderators section
  let speakersHtml = '';
  if (event.speaker || event.moderator || event.organizers) {
    speakersHtml = '<div class="event__section">';
    if (event.speaker) {
      const speakerText = event.speakerTitle
        ? `${escapeHTML(event.speaker)}, ${escapeHTML(event.speakerTitle)}`
        : escapeHTML(event.speaker);
      speakersHtml += `<div class="event__meta-item">🎤 Fyrirlesari: ${speakerText}</div>`;
    }
    if (event.moderator) {
      speakersHtml += `<div class="event__meta-item">👤 Fundarstjóri: ${escapeHTML(event.moderator)}</div>`;
    }
    if (event.organizers && event.organizers.length > 0) {
      const escapedOrganizers = event.organizers.map(o => escapeHTML(o));
      speakersHtml += `<div class="event__meta-item">👥 Skipuleggjendur: ${escapedOrganizers.join(', ')}</div>`;
    }
    speakersHtml += '</div>';
  }

  // Build metadata section
  let metadataHtml = '<div class="event__metadata">';
  if (event.duration) {
    metadataHtml += `<div class="event__meta-item">⏱️ ${event.duration}</div>`;
  }
  if (event.refreshments) {
    metadataHtml += `<div class="event__meta-item">☕ Léttar veitingar</div>`;
  }
  if (event.attendance) {
    metadataHtml += `<div class="event__meta-item">👥 ${event.attendance.going} mæta, ${event.attendance.interested} hafa áhuga</div>`;
  }
  metadataHtml += '</div>';

  // Build elections section
  let electionsHtml = '';
  if (event.elections && event.elections.length > 0) {
    electionsHtml = '<div class="event__elections">';
    electionsHtml += '<h4 class="event__section-title">🗳️ Kjörseðlar í boði:</h4>';
    electionsHtml += '<div class="event__elections-list">';
    event.elections.forEach(election => {
      electionsHtml += `
        <div class="event__election-item">
          <a href="/election-detail.html?id=${escapeHTML(election.id)}" class="event__election-link">
            <strong>${escapeHTML(election.title)}</strong>
            ${election.description ? `<p>${escapeHTML(election.description)}</p>` : ''}
          </a>
        </div>
      `;
    });
    electionsHtml += '</div></div>';
  }

  // Build materials section
  let materialsHtml = '';
  if (event.materials && Object.keys(event.materials).length > 0) {
    materialsHtml = '<div class="event__materials">';
    materialsHtml += '<h4 class="event__section-title">📄 Gögn:</h4>';
    materialsHtml += '<div class="event__materials-list">';

    if (event.materials.agenda) {
      materialsHtml += `<a href="${event.materials.agenda}" class="event__material-link" target="_blank">📋 Dagskrá</a>`;
    }
    if (event.materials.slides) {
      materialsHtml += `<a href="${event.materials.slides}" class="event__material-link" target="_blank">📊 Glærur</a>`;
    }
    if (event.materials.minutes) {
      materialsHtml += `<a href="${event.materials.minutes}" class="event__material-link" target="_blank">📝 Fundargerð</a>`;
    }
    if (event.materials.other) {
      event.materials.other.forEach(doc => {
        materialsHtml += `<a href="${doc.url}" class="event__material-link" target="_blank">📎 ${doc.title}</a>`;
      });
    }

    materialsHtml += '</div></div>';
  }

  // Build links section
  let linksHtml = '<div class="event__links">';
  if (event.zoomLink) {
    linksHtml += `<a href="${event.zoomLink}" class="btn" target="_blank" rel="noopener noreferrer">Tengja við Zoom</a>`;
  }
  if (event.facebookEvent) {
    linksHtml += `<a href="${event.facebookEvent}" class="btn" target="_blank" rel="noopener noreferrer">Skoða á Facebook</a>`;
  }
  linksHtml += '</div>';

  // Build complete card HTML
  card.innerHTML = `
    <div class="event__header">
      <div>
        <h3 class="event__title">${escapeHTML(event.title || 'Viðburður')}</h3>
        ${event.subtitle ? `<p class="event__subtitle">${escapeHTML(event.subtitle)}</p>` : ''}
      </div>
      ${formatBadge}
    </div>
    <div class="event__content">
      <div class="event__datetime">
        <div class="event__date">📅 ${dateStr}</div>
        <div class="event__time">🕐 ${escapeHTML(event.time)}${event.endTime ? ` - ${escapeHTML(event.endTime)}` : ''}${event.doorOpen && event.doorOpen !== event.time ? ` (Húsið opnar ${escapeHTML(event.doorOpen)})` : ''}</div>
      </div>

      ${event.location ? `<div class="event__location">📍 ${escapeHTML(event.location)}</div>` : ''}

      ${event.description ? `<div class="event__description">${escapeHTML(event.description)}</div>` : ''}

      ${speakersHtml}

      ${agendaHtml}

      ${event.notes ? `<div class="event__notes"><strong>Athugið:</strong> ${escapeHTML(event.notes)}</div>` : ''}

      ${electionsHtml}

      ${materialsHtml}

      ${metadataHtml}

      ${linksHtml}
    </div>
  `;

  return card;
}

/**
 * Show loading state
 */
function showLoading() {
  show('events-loading');
}

/**
 * Hide loading state
 */
function hideLoading() {
  hide('events-loading');
}

/**
 * Show error state
 */
function showError(message) {
  const errorElement = document.getElementById('error-message');
  if (errorElement && message) {
    errorElement.textContent = message;
  }
  show('events-error');
}

/**
 * Hide error state
 */
function hideError() {
  hide('events-error');
}

/**
 * Show empty state
 */
function showEmpty() {
  show('events-empty');
}

/**
 * Hide empty state
 */
function hideEmpty() {
  hide('events-empty');
}

/**
 * Show events list
 */
function showEventsList() {
  show('events-list');
}

/**
 * Hide events list
 */
function hideEventsList() {
  hide('events-list');
}

/**
 * Utility: Escape HTML to prevent XSS
 *
 * @param {string} text - Text to escape
 * @returns {string} HTML-safe text
 */
function escapeHTML(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize on page load
init();
