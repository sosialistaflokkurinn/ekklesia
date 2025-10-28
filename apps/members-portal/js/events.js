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
  setTextContent('events-subtitle', R.string.events_subtitle || 'Fundir og viðburðir flokksins', 'events page');

  // Tab labels
  setTextContent('tab-upcoming-label', R.string.events_tab_upcoming || 'Framundan', 'events page');
  setTextContent('tab-past-label', R.string.events_tab_past || 'Liðnir viðburðir', 'events page');

  // Loading message
  setTextContent('loading-message', R.string.events_loading || 'Sæki viðburði...', 'events page');

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
    // For now, show hardcoded events
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate loading

    // Hardcoded event data - Facebook events
    const allEvents = [
      // Upcoming events
      {
        title: 'Málþing um sveitarstjórnarmál',
        date: '1. nóvember 2025, kl. 10:00-14:30',
        description: 'Opinn fundur um sveitastjórnarmál þar sem allir fá tækifæri til að segja sína skoðun og heyra skoðun annara.\n\nDagskrá:\n• Fullrúar frá svæðisfélögum sósíalista segir frá sinni sýn á sveitastjórnarmálum\n• Hlé\n• Almennar umræður um sveitastjórnarmál þar sem félagsmenn fá að segja sína skoðun\n• Kaffi og léttar veitingar í boði',
        location: 'Hverfisgata 105, 101 Reykjavík',
        status: 'upcoming'
      },
      {
        title: 'Tölum um húsnæðismál',
        date: '25. september 2025, kl. 20:00',
        description: 'Jón Ferdinand Estherarson fjallar um húsnæðismálin. Húsnæðismál eru í dag eitt stærsta verkefnið sem unga fólkið, láglaunafólk og efnaminni eru að takast á við. Verkefnið er alþjóðlegt, en hér á Íslandi er það engu að síður einstakt. Hvað er til ráða? Og hvað getur róttækur stjórnmálaflókkur gert til að bjarga þeim sem í vandræðum eru?\n\nKomdu og tökum þetta saman! Í húsakynnum Sósíalistaflokks Íslands, Hverfisgötu 105, Rvk. og á zoom.',
        location: 'Sósíalistaflokkur Íslands, Hverfisgötu 105',
        status: 'upcoming'
      },
      // Past events
      {
        title: 'Félagsfundur Október 2025',
        date: '25. október 2025, kl. 10:30',
        description: 'Félagsfundur Sósíalistaflokks Íslands.\n\nHúsið opnar klukkan 10:30 og fundurinn hefst stundvíslega klukkan 11:00. Boðið var upp á að taka þátt í gegnum Zoom.\n\nDagskrá:\n1. Framkvæmdastjórn segir frá starfinu\n2. Málefnastjórn segir frá starfinu\n3. Kosningastjórn segir frá starfinu\n4. Sagt frá starfi svæðisfélaga\n5. Önnur mál\n\nLéttar veitingar voru í boði.',
        location: 'Hverfisgata 105, 101 Reykjavík',
        status: 'past'
      }
    ];

    // Filter events by status
    const events = filter === 'upcoming'
      ? allEvents.filter(e => e.status === 'upcoming')
      : allEvents.filter(e => e.status === 'past');

    if (events.length === 0) {
      showEmpty();
    } else {
      showEvents(events);
    }

  } catch (error) {
    console.error('Failed to load events:', error);
    showError(R.string.events_error || 'Villa kom upp');
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
