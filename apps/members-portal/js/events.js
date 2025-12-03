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
  setTextContent('events-title', R.string.events_title || 'Viðburðir', 'events page');
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

  return events.map(event => `
    <div class="card">
      ${event.imageUrl ? `<div class="card__image" style="background-image: url('${event.imageUrl}'); height: 200px; background-size: cover; background-position: center;"></div>` : ''}
      <div class="card__content">
        <h3 class="card__title">${event.title}</h3>
        <p class="u-text-muted">${event.date}</p>
        <p class="u-text-muted">📍 ${event.location}</p>
        <p style="white-space: pre-line;">${event.description}</p>
        ${event.facebookUrl ? `<div style="margin-top: 1rem;"><a href="${event.facebookUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--small">Skoða á Facebook</a></div>` : ''}
      </div>
    </div>
  `).join('');
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

      return {
        title: event.title,
        date: formattedDate,
        description: event.description,
        location: event.location,
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
    variant: 'primary', // This gives us .btn (no extra class needed)
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
    variant: 'secondary', // This gives us .btn .btn--secondary
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
