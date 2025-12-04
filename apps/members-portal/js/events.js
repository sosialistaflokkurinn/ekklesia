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
import { extractVideoLinks, formatRichText } from './utils/util-format.js';

// API Configuration
const EVENTS_API_BASE = 'https://events-service-521240388393.europe-west2.run.app';

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
  // Note: events-title removed from HTML - nav brand shows "Viðburðir"
  setTextContent('events-subtitle', R.string.events_subtitle || 'Fundir og viðburðir flokksins', 'events page');

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
      locationHtml = `
        <p class="u-text-muted" style="margin-bottom: 0.25rem;">📍 ${event.location}</p>
        <p style="margin-top: 0; margin-bottom: 0.5rem;">
          <a href="${event.mapUrls.googleMaps}" target="_blank" rel="noopener noreferrer" class="u-text-link" style="font-size: 0.875rem; margin-right: 1rem;">
            🗺️ Google Maps
          </a>
          <a href="${event.mapUrls.openStreetMap}" target="_blank" rel="noopener noreferrer" class="u-text-link" style="font-size: 0.875rem;">
            🌍 OpenStreetMap
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

    return `
      <div class="card">
        ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.title}" width="600" height="315" style="width: 100%; height: auto; display: block; border-radius: 0.5rem 0.5rem 0 0;">` : ''}
        <div class="card__content">
          <h2 class="card__title">${event.title}</h2>
          <p class="u-text-muted">${event.date}</p>
          ${locationHtml}
          ${videoLinksHtml}
          <div style="white-space: pre-line;">${formatRichText(cleanDescription)}</div>
          ${event.facebookUrl ? `<div style="margin-top: 1rem;"><a href="${event.facebookUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--small">Skoða á Facebook</a></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Load events from Facebook via Backend Proxy
 */
async function loadEvents(filter = 'upcoming') {
  try {
    showLoading();

    const response = await fetch(`${EVENTS_API_BASE}/api/external-events`);
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const rawEvents = await response.json();
    const now = new Date();

    const events = rawEvents.map(event => {
      const startDate = new Date(event.startTime);
      const endDate = event.endTime ? new Date(event.endTime) : null;
      
      // Determine status
      let status = 'upcoming';
      if (endDate) {
        if (endDate < now) status = 'past';
      } else {
        // If no end date, assume past if start date is more than 12 hours ago
        if (now - startDate > 12 * 60 * 60 * 1000) status = 'past';
      }

      // Format date
      const dateStr = startDate.toLocaleDateString('is-IS', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      const timeStr = startDate.toLocaleTimeString('is-IS', {
        hour: '2-digit', minute: '2-digit'
      });
      
      let formattedDate = `${dateStr}, kl. ${timeStr}`;
      if (endDate) {
        // Check if end date is on the same day
        const isSameDay = startDate.toDateString() === endDate.toDateString();
        if (isSameDay) {
          const endTimeStr = endDate.toLocaleTimeString('is-IS', {
            hour: '2-digit', minute: '2-digit'
          });
          formattedDate += `-${endTimeStr}`;
        } else {
           // Multi-day event
           const endDateStr = endDate.toLocaleDateString('is-IS', {
            day: 'numeric', month: 'long'
          });
           formattedDate += ` - ${endDateStr}`;
        }
      }

      // Extract location info
      const loc = event.location || {};
      const locationDisplay = loc.display || loc.name || 'Staðsetning óþekkt';
      const mapUrls = loc.mapUrls || null;

      return {
        title: event.title,
        date: formattedDate,
        description: event.description,
        location: locationDisplay,
        mapUrls: mapUrls,
        isOnline: event.isOnline,
        status: status,
        facebookUrl: event.facebookUrl,
        imageUrl: event.imageUrl,
        rawDate: startDate
      };
    });

    // Filter events by status
    const filteredEvents = filter === 'upcoming'
      ? events.filter(e => e.status === 'upcoming')
      : events.filter(e => e.status === 'past');

    // Sort: Upcoming (soonest first), Past (most recent first)
    filteredEvents.sort((a, b) => {
      if (filter === 'upcoming') {
        return a.rawDate - b.rawDate;
      } else {
        return b.rawDate - a.rawDate;
      }
    });

    if (filteredEvents.length === 0) {
      showEmpty();
    } else {
      showEvents(filteredEvents);
    }

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

    debug.log('✓ Events page initialized');

  } catch (error) {
    debug.error('Failed to initialize events page:', error);
    showError(error.message);
  }
}

// Run on page load
init();
