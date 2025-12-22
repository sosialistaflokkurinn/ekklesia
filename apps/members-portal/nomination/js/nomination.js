/**
 * Uppstillingarnefnd Main Page Logic
 * Lists nomination committee elections and provides navigation to vote/results.
 * Also displays candidate metadata with edit functionality.
 */

import { getFirebaseAuth } from '../../../firebase/app.js';
import { requireAuth } from '../../../js/auth.js';
import { getNominationElections, checkNominationAccess } from '../../../js/api/api-nomination.js';
import { getAllCandidates, updateCandidate } from '../../../js/api/api-candidates.js';
import { debug } from '../../../js/utils/util-debug.js';
import { escapeHTML, formatDateShortIcelandic } from '../../../js/utils/util-format.js';
import { el } from '../../../js/utils/util-dom.js';
import { showModal } from '../../../js/components/ui-modal.js';
import { showToast } from '../../../js/components/ui-toast.js';
import { R } from '../../../i18n/strings-loader.js';

// =============================================================================
// LOCAL STORAGE CACHE - Instant load on repeat visits
// =============================================================================
const CACHE_KEYS = {
  ELECTIONS: 'nomination_elections_cache',
  CANDIDATES: 'nomination_candidates_cache'
};
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached data from localStorage
 * @param {string} key - Cache key
 * @returns {Object|null} Cached data or null if expired/missing
 */
function getCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    // Return cached data even if stale (will be refreshed in background)
    return { data, isStale: age > CACHE_MAX_AGE_MS };
  } catch (e) {
    debug.warn('[Cache] Failed to read cache:', e);
    return null;
  }
}

/**
 * Save data to localStorage cache
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 */
function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    debug.warn('[Cache] Failed to write cache:', e);
  }
}

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

// Candidates DOM Elements
const candidatesList = document.getElementById('candidates-list');
const candidatesLoading = document.getElementById('candidates-loading');
const candidatesError = document.getElementById('candidates-error');

/**
 * Initialize page
 */
async function init() {
  try {
    // Load i18n strings first
    await R.load('is');

    // Show cached data immediately (before auth completes)
    const cachedElections = getCache(CACHE_KEYS.ELECTIONS);
    const cachedCandidates = getCache(CACHE_KEYS.CANDIDATES);

    if (cachedElections?.data) {
      debug.log('[Cache] Showing cached elections');
      displayElections(cachedElections.data);
    }
    if (cachedCandidates?.data) {
      debug.log('[Cache] Showing cached candidates');
      displayCandidates(cachedCandidates.data);
    }

    // Wait for auth - redirects to login if not authenticated
    await requireAuth();

    // Fetch fresh data (in background if cache was shown)
    const hasCachedData = cachedElections?.data || cachedCandidates?.data;
    if (hasCachedData) {
      // Background refresh - don't await
      Promise.all([
        loadElections(true),
        loadCandidates(true)
      ]).catch(err => debug.warn('[Cache] Background refresh failed:', err));
    } else {
      // No cache - wait for data
      await Promise.all([
        loadElections(false),
        loadCandidates(false)
      ]);
    }
  } catch (error) {
    debug.error('[Uppstilling] Init error:', error);
    showError(error.message || R.string.uppstilling_error_generic);
  }
}

/**
 * Display elections from data (no fetch)
 * @param {Array} elections - Elections data
 */
function displayElections(elections) {
  hideLoading();

  if (!elections || elections.length === 0) {
    showNoAccess();
    return;
  }

  // Split into active and closed
  const activeElections = elections.filter(e => e.status === 'published');
  const closedElections = elections.filter(e => e.status === 'closed' || e.status === 'archived');

  // Render active elections
  if (activeElections.length > 0) {
    renderElections(activeElections, activeElectionsList);
    noActiveElections.style.display = 'none';
  } else {
    noActiveElections.style.display = 'block';
  }

  // Render closed elections
  if (closedElections.length > 0) {
    renderElections(closedElections, closedElectionsList);
    noClosedElections.style.display = 'none';
  } else {
    noClosedElections.style.display = 'block';
  }

  electionsContainer.style.display = 'block';
}

/**
 * Load and display elections
 * @param {boolean} isBackground - If true, don't show loading states
 */
async function loadElections(isBackground = false) {
  try {
    const result = await getNominationElections();

    // Cache the fresh data
    if (result.elections) {
      setCache(CACHE_KEYS.ELECTIONS, result.elections);
    }

    // Display the data
    displayElections(result.elections);

  } catch (error) {
    debug.error('[Uppstilling] Load elections error:', error);

    // Only show error UI if not a background refresh
    if (!isBackground) {
      if (error.status === 403) {
        hideLoading();
        showNoAccess();
      } else {
        showError(error.message || R.string.uppstilling_error_load_elections);
      }
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
    'draft': R.string.uppstilling_status_draft,
    'published': R.string.uppstilling_status_published,
    'paused': R.string.uppstilling_status_paused,
    'closed': R.string.uppstilling_status_closed,
    'archived': R.string.uppstilling_status_archived,
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

// =============================================================================
// CANDIDATES SECTION
// =============================================================================

/**
 * Display candidates from data (no fetch)
 * @param {Array} candidates - Candidates data
 */
function displayCandidates(candidates) {
  candidatesLoading.style.display = 'none';

  if (!candidates || candidates.length === 0) {
    candidatesError.textContent = R.string.uppstilling_no_candidates;
    candidatesError.style.display = 'block';
    return;
  }

  candidatesError.style.display = 'none';
  renderCandidates(candidates);
}

/**
 * Load and display candidates
 * @param {boolean} isBackground - If true, don't show loading states
 */
async function loadCandidates(isBackground = false) {
  try {
    const candidates = await getAllCandidates();

    // Cache the fresh data
    setCache(CACHE_KEYS.CANDIDATES, candidates);

    // Display the data
    displayCandidates(candidates);

  } catch (error) {
    debug.error('[Uppstilling] Load candidates error:', error);

    // Only show error UI if not a background refresh
    if (!isBackground) {
      candidatesLoading.style.display = 'none';
      candidatesError.style.display = 'block';
    }
  }
}

/**
 * Render candidates grid
 * @param {Array} candidates - Candidate objects
 */
function renderCandidates(candidates) {
  candidatesList.innerHTML = '';

  candidates.forEach(candidate => {
    const card = createCandidateCard(candidate);
    candidatesList.appendChild(card);
  });
}

/**
 * Create a candidate card element
 * @param {Object} candidate - Candidate data
 * @returns {HTMLElement} Card element
 */
function createCandidateCard(candidate) {
  const bioPreview = candidate.bio
    ? candidate.bio.substring(0, 100) + (candidate.bio.length > 100 ? '...' : '')
    : R.string.uppstilling_no_info;

  const lastEdited = candidate.last_edited_by
    ? `Síðast breytt af ${escapeHTML(candidate.last_edited_by.user_name)}`
    : '';

  const card = el('div', 'candidate-card', {
    onclick: () => openCandidateModal(candidate)
  },
    el('div', 'candidate-card__name', {}, escapeHTML(candidate.name)),
    el('div', 'candidate-card__bio', {}, escapeHTML(bioPreview)),
    lastEdited ? el('div', 'candidate-card__meta', {}, lastEdited) : null
  );

  return card;
}

/**
 * Open candidate detail/edit modal
 * @param {Object} candidate - Candidate data
 */
function openCandidateModal(candidate) {
  const content = createCandidateModalContent(candidate);

  showModal({
    title: candidate.name,
    content,
    size: 'lg',
    buttons: [
      {
        text: R.string.uppstilling_btn_close,
        onClick: () => {}
      }
    ]
  });
}

/**
 * Create contact info section with clickable links
 * @param {Object} memberInfo - Member info object
 * @returns {HTMLElement} Contact section element
 */
function createContactInfoSection(memberInfo) {
  const items = [];

  // Email (clickable)
  if (memberInfo.email) {
    items.push(
      el('a', 'contact-item contact-item--email', {
        href: `mailto:${memberInfo.email}`,
        title: R.string.uppstilling_title_email
      },
        el('span', 'contact-item__icon', {}, '✉️'),
        el('span', 'contact-item__value', {}, memberInfo.email)
      )
    );
  }

  // Phone (clickable)
  if (memberInfo.phone) {
    items.push(
      el('a', 'contact-item contact-item--phone', {
        href: `tel:+354${memberInfo.phone}`,
        title: R.string.uppstilling_title_phone
      },
        el('span', 'contact-item__icon', {}, '📞'),
        el('span', 'contact-item__value', {}, memberInfo.phone)
      )
    );
  }

  // Django ID
  if (memberInfo.django_id) {
    items.push(
      el('span', 'contact-item contact-item--id', {
        title: R.string.uppstilling_title_django_id
      },
        el('span', 'contact-item__label', {}, R.string.uppstilling_label_member_id),
        el('span', 'contact-item__value', {}, String(memberInfo.django_id))
      )
    );
  }

  // Kennitala (partially hidden)
  if (memberInfo.kennitala) {
    const kt = memberInfo.kennitala;
    const maskedKt = kt.substring(0, 6) + '-****';
    items.push(
      el('span', 'contact-item contact-item--kt', {
        title: R.string.uppstilling_title_kennitala
      },
        el('span', 'contact-item__label', {}, R.string.uppstilling_label_kt),
        el('span', 'contact-item__value', {}, maskedKt)
      )
    );
  }

  return el('div', 'candidate-contact-section', {}, ...items);
}

/**
 * Create modal content for candidate view/edit
 * @param {Object} candidate - Candidate data
 * @returns {HTMLElement} Modal content element
 */
function createCandidateModalContent(candidate) {
  const container = el('div', 'candidate-modal');

  // Contact info section (if member_info exists)
  if (candidate.member_info) {
    const contactSection = createContactInfoSection(candidate.member_info);
    container.appendChild(contactSection);
  }

  const fields = [
    { key: 'bio', label: R.string.uppstilling_field_bio, type: 'textarea' },
    { key: 'education', label: R.string.uppstilling_field_education, type: 'textarea' },
    { key: 'experience', label: R.string.uppstilling_field_experience, type: 'textarea' },
    { key: 'party_roles', label: R.string.uppstilling_field_party_roles, type: 'textarea' },
    { key: 'focus_areas', label: R.string.uppstilling_field_focus_areas, type: 'textarea', isArray: true },
    { key: 'personal', label: R.string.uppstilling_field_personal, type: 'textarea' },
    { key: 'requested_seat', label: R.string.uppstilling_field_requested_seat, type: 'text' },
    { key: 'notes', label: R.string.uppstilling_field_notes, type: 'textarea' }
  ];

  fields.forEach(field => {
    let value = candidate[field.key] || '';
    // Handle array fields (join with comma + space for display)
    if (field.isArray && Array.isArray(value)) {
      value = value.join(', ');
    }
    const fieldContainer = createEditableField(candidate, field, value);
    container.appendChild(fieldContainer);
  });

  // Links section
  if (candidate.links && candidate.links.length > 0) {
    const linksSection = el('div', 'candidate-modal__section',
      {},
      el('h4', 'candidate-modal__section-title', {}, R.string.uppstilling_section_links),
      el('ul', 'candidate-modal__links',
        {},
        ...candidate.links.map(link =>
          el('li', '',
            {},
            el('a', '', { href: link.url, target: '_blank', rel: 'noopener' }, escapeHTML(link.title || link.url))
          )
        )
      )
    );
    container.appendChild(linksSection);
  }

  // Edit history section
  if (candidate.edit_history && candidate.edit_history.length > 0) {
    const historySection = createEditHistorySection(candidate.edit_history);
    container.appendChild(historySection);
  }

  return container;
}

/**
 * Create an editable field with inline editing
 * @param {Object} candidate - Candidate data
 * @param {Object} field - Field configuration
 * @param {string} value - Current value
 * @returns {HTMLElement} Field container
 */
function createEditableField(candidate, field, value) {
  const container = el('div', 'candidate-field');

  const header = el('div', 'candidate-field__header',
    {},
    el('label', 'candidate-field__label', {}, field.label),
    el('button', 'candidate-field__edit-btn', {
      type: 'button',
      onclick: (e) => {
        e.stopPropagation();
        enableFieldEdit(container, candidate, field, value);
      }
    }, R.string.uppstilling_btn_edit)
  );

  const display = el('div', 'candidate-field__value', {}, value || R.string.uppstilling_no_info_short);

  container.appendChild(header);
  container.appendChild(display);

  return container;
}

/**
 * Enable inline editing for a field
 * @param {HTMLElement} container - Field container
 * @param {Object} candidate - Candidate data
 * @param {Object} field - Field configuration
 * @param {string} currentValue - Current value
 */
function enableFieldEdit(container, candidate, field, currentValue) {
  const display = container.querySelector('.candidate-field__value');
  const editBtn = container.querySelector('.candidate-field__edit-btn');

  // Create input/textarea
  const input = field.type === 'textarea'
    ? el('textarea', 'candidate-field__input', {
        value: currentValue,
        rows: 4
      }, currentValue)
    : el('input', 'candidate-field__input', {
        type: 'text',
        value: currentValue
      });

  // Create action buttons
  const actions = el('div', 'candidate-field__actions',
    {},
    el('button', 'btn btn--primary btn--sm', {
      type: 'button',
      onclick: async () => {
        const newValue = input.value.trim();
        await saveFieldEdit(container, candidate, field, newValue, display, editBtn, actions, input);
      }
    }, R.string.uppstilling_btn_save),
    el('button', 'btn btn--secondary btn--sm', {
      type: 'button',
      onclick: () => {
        cancelFieldEdit(container, display, editBtn, actions, input);
      }
    }, R.string.uppstilling_btn_cancel)
  );

  // Hide display and edit button, show input and actions
  display.style.display = 'none';
  editBtn.style.display = 'none';
  container.appendChild(input);
  container.appendChild(actions);
  input.focus();
}

/**
 * Save field edit
 */
async function saveFieldEdit(container, candidate, field, newValue, display, editBtn, actions, input) {
  try {
    // Disable buttons during save
    const buttons = actions.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);

    // Handle array fields (split by comma)
    let valueToSave = newValue;
    if (field.isArray) {
      valueToSave = newValue.split(',').map(s => s.trim()).filter(s => s);
    }

    await updateCandidate(candidate.id, { [field.key]: valueToSave });

    // Update display
    display.textContent = newValue || R.string.uppstilling_no_info_short;
    display.style.display = 'block';
    editBtn.style.display = 'inline-block';
    input.remove();
    actions.remove();

    showToast(R.string.uppstilling_saved, 'success');

    // Refresh candidates list to show updated data
    loadCandidates();
  } catch (error) {
    debug.error('[Uppstilling] Save field error:', error);
    showToast(R.string.uppstilling_error_save, 'error');

    // Re-enable buttons
    const buttons = actions.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = false);
  }
}

/**
 * Cancel field edit
 */
function cancelFieldEdit(container, display, editBtn, actions, input) {
  display.style.display = 'block';
  editBtn.style.display = 'inline-block';
  input.remove();
  actions.remove();
}

/**
 * Create edit history section
 * @param {Array} history - Edit history array
 * @returns {HTMLElement} History section element
 */
function createEditHistorySection(history) {
  // Show only last 5 edits, newest first
  const recentHistory = [...history].reverse().slice(0, 5);

  const fieldLabels = {
    'bio': R.string.uppstilling_field_bio,
    'education': R.string.uppstilling_field_education,
    'experience': R.string.uppstilling_field_experience,
    'party_roles': R.string.uppstilling_field_party_roles_short,
    'focus_areas': R.string.uppstilling_field_focus_areas,
    'personal': R.string.uppstilling_field_personal,
    'requested_seat': R.string.uppstilling_field_requested_seat,
    'notes': R.string.uppstilling_field_notes
  };

  const historyItems = recentHistory.map(entry => {
    const dateStr = formatDateShortIcelandic(entry.timestamp);
    const fieldLabel = fieldLabels[entry.field] || entry.field;

    return el('li', 'candidate-history__item',
      {},
      el('span', 'candidate-history__user', {}, escapeHTML(entry.user_name)),
      ' breytti ',
      el('span', 'candidate-history__field', {}, fieldLabel),
      el('span', 'candidate-history__date', {}, ` (${dateStr})`)
    );
  });

  return el('div', 'candidate-modal__section candidate-history',
    {},
    el('h4', 'candidate-modal__section-title', {}, R.string.uppstilling_section_history),
    el('ul', 'candidate-history__list', {}, ...historyItems)
  );
}

// Initialize on load
init();
