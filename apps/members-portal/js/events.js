/**
 * Events Page Logic
 *
 * Display upcoming and past events for members.
 * Placeholder implementation - to be expanded with actual events API.
 *
 * @module events
 */

import { R } from '../i18n/strings-loader.js';
import { debug } from './utils/util-debug.js';
import { initAuthenticatedPage } from './page-init.js';
import { setTextContent, setInnerHTML } from '../ui/dom.js';
import { createButton } from './components/ui-button.js';
import { extractVideoLinks, formatRichText, getNextRecurringOccurrence } from './utils/util-format.js';
import { SERVICES } from './config/config.js';

// API Configuration - from js/config/config.js
const EVENTS_API_BASE = SERVICES.EVENTS;

// ============================================================================
// LOCAL STORAGE CACHE - Persistent (no PII - public Facebook events)
// ============================================================================
const CACHE_KEY = 'events_cache';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data from localStorage
 * Safe to use localStorage here - events are public Facebook data, no PII.
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
 * Save data to localStorage cache
 * @param {Array} data - Events array to cache
 */
function setCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    debug.log('[Cache] Events cached:', data.length);
  } catch (e) {
    debug.warn('[Cache] Failed to write cache:', e);
  }
}

// Icelandic month names (fallback for browsers without is-IS locale)
const ICELANDIC_MONTHS = [
  'janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní',
  'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'
];

const ICELANDIC_DAYS = [
  'sunnudaginn', 'mánudaginn', 'þriðjudaginn', 'miðvikudaginn',
  'fimmtudaginn', 'föstudaginn', 'laugardaginn'
];

/**
 * Format date in Icelandic (manually to ensure consistency)
 * @param {Date} date - Date to format
 * @param {Object} options - Format options
 * @returns {string} Formatted date string
 */
function formatIcelandicDate(date, options = {}) {
  const day = date.getDate();
  const month = ICELANDIC_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  if (options.dayName) {
    const dayName = ICELANDIC_DAYS[date.getDay()];
    return `${dayName} ${day}. ${month}, kl. ${hours}:${minutes}`;
  }

  if (options.dateOnly) {
    return `${day}. ${month}`;
  }

  if (options.timeOnly) {
    return `${hours}:${minutes}`;
  }

  if (options.noYear) {
    return `${day}. ${month}, kl. ${hours}:${minutes}`;
  }

  return `${day}. ${month} ${year}, kl. ${hours}:${minutes}`;
}

// NOTE: Backend uses test Facebook page (Guðröður) until BP access is granted
// When Sósíalistaflokkurinn page access is available, update GCP secrets:
// - fb-page-access-token: New System User token
// - fb-page-id: Real page ID
// See: tmp/FACEBOOK_INTEGRATION_STATUS.md

// Button instances
let tabUpcomingButton = null;
let tabPastButton = null;

/**
 * Set page title and header text
 */
function updateEventsStrings() {
  document.title = R.string.page_title_events || 'Viðburðir';
  // Note: events-title and events-subtitle removed from HTML - nav brand shows "Viðburðir" and buttons communicate the rest

  // Loading message
  setTextContent('loading-message', R.string.events_loading || 'Sæki viðburði...', 'events page');

  // Empty message
  setTextContent('empty-message', R.string.events_empty || 'Engir viðburðir fundust', 'events page');

  // Note: Tab labels are now set during button creation in setupFilters()
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

  return events.map(event => {
    // Extract video conference links from description
    const { links: videoLinks, cleanedText: cleanDescription } = extractVideoLinks(event.description);

    // Build location section with map links
    let locationHtml = '';
    if (event.isOnline) {
      locationHtml = '<p class="u-text-muted">💻 Netviðburður</p>';
    } else if (event.mapUrls) {
      // Official Google Maps icon (simplified pin)
      const googleMapsIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 92.3 132.3" style="vertical-align: middle; margin-right: 4px;"><path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z"/><path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z"/><path fill="#4285f4" d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"/><path fill="#fbbc04" d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3"/><path fill="#34a853" d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.4 14.5 6.8 23.1 12.8 23.1s3.4-8.7 12.8-23.2"/></svg>`;

      // Official OpenStreetMap icon (simplified)
      const osmIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 180 180" style="vertical-align: middle; margin-right: 4px;"><path fill="#7ebc6f" d="M180 90c0 49.7-40.3 90-90 90S0 139.7 0 90 40.3 0 90 0s90 40.3 90 90"/><path fill="#fff" d="M89.6 17.1c-4.3 0-8.3 3.3-9.3 7.4l-9.9 42.6c-.4 1.8-2 3.1-3.9 3.1H27.2c-4.5 0-8.2 3.7-8.2 8.2v4c0 1.8 1.2 3.4 2.9 4l69.4 22.6c1.8.6 3.1 2.2 3.1 4.1v49.7c0 4.5 3.7 8.2 8.2 8.2h4c4.5 0 8.2-3.7 8.2-8.2V113c0-1.8 1.2-3.5 3-4l68.8-22.4c1.8-.6 3-2.2 3-4v-4.1c0-4.5-3.7-8.2-8.2-8.2h-38.8c-1.9 0-3.5-1.3-3.9-3.1L129 24.5c-1-4.1-5-7.4-9.3-7.4h-30.1z"/></svg>`;

      locationHtml = `
        <p class="u-text-muted" style="margin-bottom: 0.25rem;">📍 ${event.location}</p>
        <p style="margin-top: 0; margin-bottom: 0.5rem;">
          <a href="${event.mapUrls.googleMaps}" target="_blank" rel="noopener noreferrer" class="u-text-link" style="font-size: 0.875rem; margin-right: 1rem;">
            ${googleMapsIcon} Google Maps
          </a>
          <a href="${event.mapUrls.openStreetMap}" target="_blank" rel="noopener noreferrer" class="u-text-link" style="font-size: 0.875rem;">
            ${osmIcon} OpenStreetMap
          </a>
        </p>
      `;
    } else {
      locationHtml = `<p class="u-text-muted">📍 ${event.location}</p>`;
    }

    // Build video conference links section
    let videoLinksHtml = '';
    if (videoLinks.length > 0) {
      videoLinksHtml = `
        <p style="margin-top: 0; margin-bottom: 0.5rem;">
          ${videoLinks.map(url => `
            <a href="${url}" target="_blank" rel="noopener noreferrer" class="u-text-link" style="font-size: 0.875rem; margin-right: 1rem;">
              📹 Fjarfundarhlekk
            </a>
          `).join('')}
        </p>
      `;
    }

    // Badge for ongoing events (started but not ended)
    const ongoingBadge = event.isOngoing
      ? '<span style="display: inline-block; background: var(--color-success-green, #2e7d32); color: white; padding: 0.125rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; margin-left: 0.5rem; vertical-align: middle;">Í gangi</span>'
      : '';

    // Event anchor ID for direct linking
    const eventId = `event-${event.id}`;

    // Format date - all dates get burgundy badge styling
    let dateHtml;
    if (event.date.startsWith('__NEXT__')) {
      const nextDate = event.date.replace('__NEXT__', '');
      dateHtml = `
        <p style="margin-bottom: 0.5rem;">
          <span style="display: inline-block; background: var(--color-burgundy, #722f37); color: var(--color-cream, #fce9d8); padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-weight: 600;">
            📅 Næst: ${nextDate}
          </span>
        </p>
      `;
    } else {
      dateHtml = `
        <p style="margin-bottom: 0.5rem;">
          <span style="display: inline-block; background: var(--color-burgundy, #722f37); color: var(--color-cream, #fce9d8); padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-weight: 600;">
            📅 ${event.date}
          </span>
        </p>
      `;
    }

    return `
      <div class="card" id="${eventId}">
        ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.title}" width="600" height="315" style="width: 100%; height: auto; display: block; border-radius: 0.5rem 0.5rem 0 0;">` : ''}
        <div class="card__content">
          <h2 class="card__title">${event.title}${ongoingBadge}</h2>
          ${dateHtml}
          ${locationHtml}
          ${videoLinksHtml}
          <div style="white-space: pre-line;">${formatRichText(cleanDescription)}</div>
          <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${event.facebookUrl ? `<a href="${event.facebookUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--small">Skoða á Facebook</a>` : ''}
            <button class="btn btn--secondary btn--small" onclick="copyEventLink('${eventId}')" title="Afrita hlekk">🔗 Deila</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Process raw events from API into display format
 * Extracted to allow reuse for both cached and fresh data
 *
 * @param {Array} rawEvents - Raw events from API
 * @returns {Array} Processed events ready for display
 */
function processEvents(rawEvents) {
  const now = new Date();

  return rawEvents.map(event => {
    const startDate = new Date(event.startTime);
    const endDate = event.endTime ? new Date(event.endTime) : null;

    // Use backend status flags (isUpcoming, isOngoing)
    // - upcoming: hasn't started yet
    // - ongoing: started but not ended (e.g., recurring events)
    // - past: already ended
    let status = 'past';
    if (event.isUpcoming) {
      status = 'upcoming';
    } else if (event.isOngoing) {
      status = 'ongoing';
    }

    // Format date - handle recurring events specially
    let formattedDate;

    // Check if this is a recurring weekly event using shared utility
    const nextOccurrence = getNextRecurringOccurrence(event);

    if (nextOccurrence) {
      // Use special marker for prominent styling
      formattedDate = `__NEXT__${formatIcelandicDate(nextOccurrence, { dayName: true })}`;
    } else if (event.isOngoing && endDate && (endDate - startDate) > 7 * 24 * 60 * 60 * 1000) {
      // Recurring event that has passed its end date
      formattedDate = `Lokið ${formatIcelandicDate(endDate, { dateOnly: true })}`;
    } else {
      // Regular event formatting
      formattedDate = formatIcelandicDate(startDate);
      if (endDate) {
        const isSameDay = startDate.toDateString() === endDate.toDateString();
        if (isSameDay) {
          formattedDate += `-${formatIcelandicDate(endDate, { timeOnly: true })}`;
        } else {
          formattedDate += ` - ${formatIcelandicDate(endDate, { dateOnly: true })}`;
        }
      }
    }

    // Extract location info
    const loc = event.location || {};
    const locationDisplay = loc.display || loc.name || 'Staðsetning óþekkt';
    const mapUrls = loc.mapUrls || null;

    return {
      id: event.facebookId || event.id,
      title: event.title,
      date: formattedDate,
      description: event.description,
      location: locationDisplay,
      mapUrls: mapUrls,
      isOnline: event.isOnline,
      status: status,
      isOngoing: event.isOngoing,
      facebookUrl: event.facebookUrl,
      imageUrl: event.imageUrl,
      rawDate: startDate
    };
  });
}

/**
 * Filter and sort events by status
 * @param {Array} events - Processed events
 * @param {string} filter - 'upcoming' or 'past'
 * @returns {Array} Filtered and sorted events
 */
function filterAndSortEvents(events, filter) {
  // Filter events by status
  // "Framundan" tab shows upcoming + ongoing events
  // "Liðnir" tab shows only past events
  const filteredEvents = filter === 'upcoming'
    ? events.filter(e => e.status === 'upcoming' || e.status === 'ongoing')
    : events.filter(e => e.status === 'past');

  // Sort: Upcoming (soonest first), Past (most recent first)
  filteredEvents.sort((a, b) => {
    if (filter === 'upcoming') {
      return a.rawDate - b.rawDate;
    } else {
      return b.rawDate - a.rawDate;
    }
  });

  return filteredEvents;
}

/**
 * Display events from data (used for both cached and fresh data)
 * @param {Array} rawEvents - Raw events from API or cache
 * @param {string} filter - 'upcoming' or 'past'
 */
function displayEventsFromData(rawEvents, filter) {
  const events = processEvents(rawEvents);
  const filteredEvents = filterAndSortEvents(events, filter);

  if (filteredEvents.length === 0) {
    showEmpty();
  } else {
    showEvents(filteredEvents);
  }
}

/**
 * Load events from Facebook via Backend Proxy
 * Uses localStorage cache for instant display on repeat visits
 *
 * @param {string} filter - 'upcoming' or 'past'
 * @param {boolean} backgroundRefresh - If true, don't show loading spinner
 */
async function loadEvents(filter = 'upcoming', backgroundRefresh = false) {
  try {
    if (!backgroundRefresh) {
      showLoading();
    }

    const response = await fetch(`${EVENTS_API_BASE}/api/external-events`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const rawEvents = await response.json();

    // Cache the raw events for future visits
    setCache(rawEvents);

    // Display the events
    displayEventsFromData(rawEvents, filter);

  } catch (error) {
    debug.error('Failed to load events:', error);
    showError(R.string.events_error || 'Villa kom upp við að sækja viðburði');
  }
}

/**
 * Current active filter
 */
let currentFilter = 'upcoming';

/**
 * Setup tab filter event listeners
 */
function setupFilters() {
  // Helper function to toggle tab states
  // Active tab = .btn (primary by default)
  // Inactive tab = .btn .btn--secondary
  const setActiveTab = (filter) => {
    currentFilter = filter;
    
    if (filter === 'upcoming') {
      tabUpcomingButton.element.classList.remove('btn--secondary');
      tabPastButton.element.classList.add('btn--secondary');
    } else {
      tabUpcomingButton.element.classList.add('btn--secondary');
      tabPastButton.element.classList.remove('btn--secondary');
    }
  };

  // Create "Upcoming" tab button (default active - no secondary class)
  tabUpcomingButton = createButton({
    text: R.string.events_tab_upcoming || 'Framundan',
    variant: 'primary',
    size: 'small',
    onClick: () => {
      if (currentFilter !== 'upcoming') {
        setActiveTab('upcoming');
        loadEvents('upcoming');
      }
    }
  });

  // Create "Past" tab button (inactive - secondary class)
  tabPastButton = createButton({
    text: R.string.events_tab_past || 'Liðnir viðburðir',
    variant: 'secondary',
    size: 'small',
    onClick: () => {
      if (currentFilter !== 'past') {
        setActiveTab('past');
        loadEvents('past');
      }
    }
  });

  // Add data-filter attributes for potential future use
  tabUpcomingButton.element.setAttribute('data-filter', 'upcoming');
  tabPastButton.element.setAttribute('data-filter', 'past');

  // Find button group container and replace hardcoded buttons
  const buttonGroup = document.querySelector('.button-group');
  if (buttonGroup) {
    // Clear existing buttons
    buttonGroup.innerHTML = '';

    // Append new button instances
    buttonGroup.appendChild(tabUpcomingButton.element);
    buttonGroup.appendChild(tabPastButton.element);
  }
}

/**
 * Copy event link to clipboard
 * @param {string} eventId - The event anchor ID
 */
window.copyEventLink = function(eventId) {
  const url = `${window.location.origin}${window.location.pathname}#${eventId}`;
  navigator.clipboard.writeText(url).then(() => {
    // Show brief feedback
    const btn = document.querySelector(`#${eventId} button[onclick*="copyEventLink"]`);
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = `✓ ${R.string.events_link_copied}`;
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);
    }
  }).catch(err => {
    debug.error('Failed to copy link:', err);
  });
};

/**
 * Scroll to event if URL has hash
 */
function scrollToEventFromHash() {
  const hash = window.location.hash;
  if (hash && hash.startsWith('#event-')) {
    const element = document.querySelector(hash);
    if (element) {
      // Delay slightly to ensure page is rendered
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Add highlight effect
        element.style.boxShadow = '0 0 0 3px var(--color-primary, #d32f2f)';
        setTimeout(() => {
          element.style.boxShadow = '';
        }, 2000);
      }, 100);
    }
  }
}

/**
 * Initialize events page
 * Uses localStorage cache for instant display on repeat visits
 */
async function init() {
  try {
    // Check for cached data first - show immediately while auth loads
    const cached = getCache();
    const hash = window.location.hash;
    const hasEventHash = hash && hash.startsWith('#event-');

    if (cached?.data) {
      debug.log('[Cache] Showing cached events immediately');
      displayEventsFromData(cached.data, hasEventHash ? 'upcoming' : 'upcoming');

      // If event hash present and not found in upcoming, try past
      if (hasEventHash && !document.querySelector(hash)) {
        displayEventsFromData(cached.data, 'past');
        // Will update tab state after setupFilters
      }
    }

    // Initialize authenticated page (handles auth, nav, i18n)
    await initAuthenticatedPage();

    // Set page-specific strings
    updateEventsStrings();

    // Setup filter tabs
    setupFilters();

    // If we have cached data, decide whether to refresh in background
    if (cached?.data) {
      // Handle event hash navigation
      if (hasEventHash && !document.querySelector(hash)) {
        // Event not in upcoming, switch to past tab
        tabUpcomingButton.element.classList.add('btn--secondary');
        tabPastButton.element.classList.remove('btn--secondary');
        currentFilter = 'past';
      }

      // Refresh in background if cache is stale
      if (cached.isStale) {
        debug.log('[Cache] Cache is stale, refreshing in background');
        loadEvents(currentFilter, true).catch(err => {
          debug.warn('[Cache] Background refresh failed:', err);
        });
      }
    } else {
      // No cache - load normally with loading spinner
      if (hasEventHash) {
        // Load all events first (try upcoming, then past if not found)
        await loadEvents('upcoming');
        if (!document.querySelector(hash)) {
          // Event not in upcoming, try past
          await loadEvents('past');
          // Update tab state
          tabUpcomingButton.element.classList.add('btn--secondary');
          tabPastButton.element.classList.remove('btn--secondary');
          currentFilter = 'past';
        }
      } else {
        // Normal load - upcoming events
        await loadEvents('upcoming');
      }
    }

    // Scroll to event if hash present
    scrollToEventFromHash();

    debug.log('✓ Events page initialized');

  } catch (error) {
    // Handle auth redirect
    if (error.name === 'AuthenticationError') {
      window.location.href = error.redirectTo || '/';
      return;
    }

    debug.error('Failed to initialize events page:', error);
    showError(error.message);
  }
}

// Run on page load
init();
