/**
 * Admin Elections List Page
 * Displays and manages all elections with RBAC
 */

import { getFirebaseAuth } from '../../firebase/app.js';
import { getElectionRole, canPerformAction, requireAdmin, PERMISSIONS, hasPermission } from '../../js/rbac.js';
import { R } from '../i18n/strings-loader.js';
import { initElectionsListStrings } from './elections-list-i18n.js';
// Note: initNavigation import removed - now handled by nav-header component
import { formatDate, getTimeRemaining } from './date-utils.js';
import { createStatusBadge } from '../../js/components/ui-badge.js';
import { showModal, showAlert } from '../../js/components/ui-modal.js';
import { showToast } from '../../js/components/ui-toast.js';
import { formatDateIcelandic } from '../../js/utils/util-format.js';
import { debug } from '../../js/utils/util-debug.js';
import { el } from '../../js/utils/util-dom.js';
import { fetchElections, openElection, closeElection, hideElection, unhideElection, deleteElection } from './api/elections-admin-api.js';

const auth = getFirebaseAuth();

// ============================================
// STATE
// ============================================

let elections = [];
let filteredElections = [];
let currentFilter = 'all';
let searchQuery = '';
let currentUserRole = null; // Store user role for RBAC checks

// Cached permission checks (computed once, reused for all elections)
let userPermissions = {
  canDelete: false,
  canEdit: false,
  canManage: false
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load and initialize i18n strings FIRST
    await initElectionsListStrings();
    debug.log('[Elections List] i18n strings initialized');
    
    // Wait for auth to be ready
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        // Redirect to login if not authenticated
        window.location.href = '/session/login.html';
        return;
      }
      
      try {
        // Check admin access (requires admin or superuser role)
        await requireAdmin();
        
        // Get election role for API calls
        const electionRole = await getElectionRole();
        debug.log('[Elections List] Election role:', electionRole);
        
        if (!electionRole) {
          await showAlert(
            'Ekki heimild',
            R.string.error_not_authorized || 'Þú hefur ekki heimild til að skoða kosningar.'
          );
          window.location.href = '/members-area/';
          return;
        }
        
        // Store role globally for RBAC checks in UI
        currentUserRole = electionRole;
        
        // Cache permission checks ONCE (instead of checking for every election)
        userPermissions.canDelete = canPerformAction(currentUserRole, 'delete');
        userPermissions.canEdit = canPerformAction(currentUserRole, 'edit');
        userPermissions.canManage = canPerformAction(currentUserRole, 'manage');
        
        debug.log('[Elections List] User authenticated with election role:', electionRole);
        debug.log('[Elections List] Permissions cached:', userPermissions);
        
        // User is authenticated and authorized, initialize UI
        await initialize();
      } catch (error) {
        console.error('[Elections List] Authorization error:', error);
        // requireAdmin already handles redirect
      }
    });
  } catch (error) {
    console.error('[Elections List] Initialization error:', error);
  }
});

async function initialize() {
  // Static UI texts are already initialized by initElectionsListStrings()
  initializeNavigation();
  setupFilters();
  setupSearch();
  setupCreateButton();

  // Load elections
  await loadElections();
}

/**
 * Initialize navigation with hamburger menu
 */
function initializeNavigation() {
  // Navigation texts are already initialized by initElectionsListStrings()

  debug.log('[Elections List] Navigation setup');
  
  // Note: Hamburger menu now initialized by nav-header component
  // (component calls initNavigation() internally)
  
  // Logout handler
  const logoutLink = document.getElementById('nav-logout');
  logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('[Elections List] Logout error:', error);
    }
  });
}

/**
 * Fetch elections from API
 */
async function loadElections() {
  try {
    showLoading(true);
    
    debug.log('[Elections List] Fetching elections...');
    
    // Fetch all elections including hidden ones (admin view)
    elections = await fetchElections(true);
    
    debug.log('[Elections List] Loaded elections:', elections.length);
    if (elections.length > 0) {
      debug.log('[Elections List] First election data:', elections[0]);
    }
    
    // Apply current filters
    filterElections();
    renderElections();
    
  } catch (error) {
    console.error('[Elections List] Error loading elections:', error);
    showError(R.format(R.string.error_load_elections, error.message));
  } finally {
    showLoading(false);
  }
}

/**
 * Setup filter buttons
 */
function setupFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class and update aria-pressed on all buttons
      filterButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      
      // Add active class and update aria-pressed on clicked button
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      
      // Get filter value
      currentFilter = btn.dataset.filter;
      filterElections();
      renderElections();
    });
  });
}

/**
 * Setup search input
 */
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      filterElections();
      renderElections();
    });
  }
}

/**
 * Setup create election button
 */
function setupCreateButton() {
  const createBtn = document.getElementById('create-election-btn');
  
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      window.location.href = '/admin-elections/create.html';
    });
  }
}

/**
 * Filter elections based on current filter and search
 */
function filterElections() {
  filteredElections = elections.filter(election => {
    // Filter by status
    let statusMatch = true;
    if (currentFilter !== 'all') {
      if (currentFilter === 'hidden') {
        statusMatch = election.hidden === true;
      } else {
        statusMatch = election.status === currentFilter && !election.hidden;
      }
    }
    
    // Filter by search query
    let searchMatch = true;
    if (searchQuery) {
      searchMatch = election.title.toLowerCase().includes(searchQuery) ||
                   election.question.toLowerCase().includes(searchQuery);
    }
    
    return statusMatch && searchMatch;
  });
  
  debug.log('[Elections List] Filtered:', filteredElections.length, '/', elections.length);
}

/**
 * Create a mobile card for an election
 * @param {Object} election - Election object
 * @returns {HTMLElement} - Card element
 */
function createMobileCard(election) {
  const badge = createStatusBadge(election.status);
  
  // Card Header (Title + Status)
  const header = el('div', 'election-card__header', {},
    el('h3', 'election-card__title', {}, election.title),
    badge.element
  );
  
  // Card Info (Details)
  const info = el('div', 'election-card__info');
  
  // Format duration helper
  const formatDuration = (minutes) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} mín`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    if (remainingMins === 0) return `${hours} klst.`;
    return `${hours} klst. ${remainingMins} mín`;
  };
  
  // Created date
  const createdRow = el('div', 'election-card__info-row');
  createdRow.innerHTML = `
    <span class="election-card__label">${R.string.label_created || 'Created'}</span>
    <span class="election-card__value">${formatDate(election.created_at)}</span>
  `;
  info.appendChild(createdRow);
  
  // Duration
  if (election.duration_minutes) {
    const durationRow = el('div', 'election-card__info-row');
    durationRow.innerHTML = `
      <span class="election-card__label" style="font-weight: 600;">📏 ${R.string.label_duration || 'Lengd'}</span>
      <span class="election-card__value" style="font-weight: 600;">${formatDuration(election.duration_minutes)}</span>
    `;
    info.appendChild(durationRow);
  }
  
  // Voting window (for published elections)
  const votingEndsAt = election.voting_ends_at || election.scheduled_end;
  if (election.status === 'published' && votingEndsAt) {
    const closesRow = el('div', 'election-card__info-row');
    closesRow.innerHTML = `
      <span class="election-card__label" style="color: var(--color-primary); font-weight: 600;">⏰ ${R.string.label_closes_in}</span>
      <span class="election-card__value" style="color: var(--color-primary); font-weight: 600;">${getTimeRemaining(votingEndsAt)}</span>
    `;
    info.appendChild(closesRow);
  }
  
  // Opened date
  if (election.opened_at) {
    const openedRow = el('div', 'election-card__info-row');
    openedRow.innerHTML = `
      <span class="election-card__label">${R.string.label_opened || 'Opened'}</span>
      <span class="election-card__value">${formatDate(election.opened_at)}</span>
    `;
    info.appendChild(openedRow);
  }
  
  // Closed date
  if (election.closed_at) {
    const closedRow = el('div', 'election-card__info-row');
    closedRow.innerHTML = `
      <span class="election-card__label">${R.string.label_closed || 'Closed'}</span>
      <span class="election-card__value">${formatDate(election.closed_at)}</span>
    `;
    info.appendChild(closedRow);
  }
  
  // Votes count
  const votesRow = el('div', 'election-card__info-row');
  votesRow.innerHTML = `
    <span class="election-card__label">${R.string.label_votes || 'Votes'}</span>
    <span class="election-card__value">${election.vote_count || 0}</span>
  `;
  info.appendChild(votesRow);
  
  // Card Actions (Buttons)
  const actions = el('div', 'election-card__actions election-actions');
  actions.innerHTML = getActionButtons(election);
  
  return el('div', 'election-card', { 'data-id': election.id },
    header,
    info,
    actions
  );
}

/**
 * Render elections table
 */
function renderElections() {
  const tbody = document.getElementById('elections-tbody');
  const emptyState = document.getElementById('empty-state');
  const resultsCount = document.getElementById('results-count');
  
  if (!tbody) return;
  
  // Update results count
  if (resultsCount) {
    const count = filteredElections.length;
    const stringKey = count === 1 ? 'results_showing_singular' : 'results_showing';
    resultsCount.textContent = R.format(R.string[stringKey], count);
  }
  
  // Show empty state if no elections
  if (filteredElections.length === 0) {
    tbody.innerHTML = '';
    
    // Clear mobile list
    const mobileList = document.getElementById('elections-mobile-list');
    if (mobileList) mobileList.innerHTML = '';
    
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  // Clear existing rows
  tbody.innerHTML = '';
  
  // Render elections using DOM manipulation for badges
  filteredElections.forEach(election => {
    const badge = createStatusBadge(election.status);
    
    // Format duration minutes into readable text
    const formatDuration = (minutes) => {
      if (!minutes) return '';
      if (minutes < 60) return `${minutes} mín`;
      const hours = Math.floor(minutes / 60);
      const remainingMins = minutes % 60;
      if (remainingMins === 0) return `${hours} klst.`;
      return `${hours} klst. ${remainingMins} mín`;
    };

    // Title cell content
    const titleContent = [
      el('a', '', { href: `/admin-elections/election-control.html?id=${election.id}` }, election.title)
    ];
    
    if (election.hidden) {
      titleContent.push(el('span', 'hidden-indicator', {}, R.string.label_hidden_indicator));
    }

    // Dates cell content (HTML string)
    const datesHtml = `
      <div class="date-created">${R.string.label_created} ${formatDate(election.created_at)}</div>
      ${election.duration_minutes ? `<div class="date-duration" style="font-weight: 600;">📏 ${R.string.label_duration || 'Lengd'}: ${formatDuration(election.duration_minutes)}</div>` : ''}
      ${election.status === 'published' && (election.voting_ends_at || election.scheduled_end) ? `<div class="date-closes" style="color: var(--color-primary); font-weight: 600;">⏰ ${R.string.label_closes_in} ${getTimeRemaining(election.voting_ends_at || election.scheduled_end)}</div>` : ''}
      ${election.opened_at ? `<div class="date-opened">${R.string.label_opened} ${formatDate(election.opened_at)}</div>` : ''}
      ${election.closed_at ? `<div class="date-closed">${R.string.label_closed} ${formatDate(election.closed_at)}</div>` : ''}
    `;

    // Actions cell content (HTML string)
    const actionsHtml = getActionButtons(election);

    const row = el('tr', election.hidden ? 'election-hidden' : '', { 'data-election-id': election.id },
      el('td', 'election-title', {}, ...titleContent),
      el('td', '', {}, badge.element),
      el('td', 'election-dates', { innerHTML: datesHtml }),
      el('td', 'election-stats', {}, `${election.vote_count || 0} ${R.string.label_votes}`),
      el('td', 'election-actions', { innerHTML: actionsHtml })
    );
    
    tbody.appendChild(row);
  });
  
  // Render mobile cards
  const mobileList = document.getElementById('elections-mobile-list');
  if (mobileList) {
    mobileList.innerHTML = '';
    
    filteredElections.forEach(election => {
      const card = createMobileCard(election);
      mobileList.appendChild(card);
    });
  }
  
  // Attach event listeners to action buttons (both table and mobile cards)
  attachActionListeners();
}

/**
 * Get action buttons for election based on role
 */
function getActionButtons(election) {
  const buttons = [];
  
  // View button (always shown)
  buttons.push(`
    <button class="btn btn-sm btn-view" data-action="view" data-id="${election.id}">
      ${R.string.btn_view}
    </button>
  `);
  
  // Edit button (always shown, but will be limited for published/closed)
  if (!election.hidden) {
    buttons.push(`
      <button class="btn btn-sm btn-edit" data-action="edit" data-id="${election.id}">
        ${R.string.btn_edit}
      </button>
    `);
  }
  
  // Open button (for draft/upcoming elections that are not hidden)
  if ((election.status === 'draft') && !election.hidden) {
    buttons.push(`
      <button class="btn btn-sm btn-success btn-open" data-action="open" data-id="${election.id}">
        ${R.string.btn_open}
      </button>
    `);
  }
  
  // Close button (for active/published elections)
  if (election.status === 'published' && !election.hidden) {
    buttons.push(`
      <button class="btn btn-sm btn-warning btn-close" data-action="close" data-id="${election.id}">
        ${R.string.btn_close}
      </button>
    `);
  }
  
  // Hide/Unhide button (election-manager + superadmin)
  if (election.hidden) {
    buttons.push(`
      <button class="btn btn-sm btn-unhide" data-action="unhide" data-id="${election.id}">
        ${R.string.btn_unhide}
      </button>
    `);
  } else {
    buttons.push(`
      <button class="btn btn-sm btn-hide" data-action="hide" data-id="${election.id}">
        ${R.string.btn_hide}
      </button>
    `);
  }
  
  // Delete button (superadmin ONLY)
  if (userPermissions.canDelete) {
    buttons.push(`
      <button class="btn btn-sm btn-danger btn-delete-election" data-action="delete" data-id="${election.id}">
        ${R.string.btn_delete}
      </button>
    `);
  }
  
  return buttons.join('');
}

/**
 * Attach event listeners to action buttons
 */
function attachActionListeners() {
  document.querySelectorAll('.election-actions button').forEach(btn => {
    btn.addEventListener('click', handleAction);
  });
}

/**
 * Handle action button clicks
 */
async function handleAction(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const electionId = button.dataset.id;
  
  debug.log('[Elections List] Action:', action, 'Election:', electionId);
  
  switch (action) {
    case 'view':
      window.location.href = `/admin-elections/election-control.html?id=${electionId}`;
      break;
      
    case 'edit':
      window.location.href = `/admin-elections/create.html?id=${electionId}`;
      break;
      
    case 'open':
      await handleOpenElection(electionId);
      break;
      
    case 'close':
      await handleCloseElection(electionId);
      break;
      
    case 'hide':
      await handleHideElection(electionId);
      break;
      
    case 'unhide':
      await handleUnhideElection(electionId);
      break;
      
    case 'delete':
      await handleDeleteElection(electionId);
      break;
  }
}

/**
 * Open election with full schedule options modal
 * Includes: start timing, duration options, custom duration, manual end time
 */
async function handleOpenElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;

  // Get current datetime for min values
  const now = new Date();
  const nowStr = now.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm

  // Create full schedule options HTML
  const scheduleHTML = `
    <div class="open-modal-form">
      <!-- Start Timing -->
      <div class="form-group" style="margin-bottom: 1.5rem;">
        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
          ${R.string.label_start_timing || 'Hvenær á kosning að byrja?'}
        </label>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="radio" name="start_timing" value="immediate" checked>
            <span><strong>${R.string.start_immediate || 'Strax'}</strong> - ${R.string.start_immediate_desc || 'Kosningin opnast strax'}</span>
          </label>
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="radio" name="start_timing" value="scheduled">
            <span><strong>${R.string.start_scheduled || 'Tímasett'}</strong> - ${R.string.start_scheduled_desc || 'Velja upphafstíma'}</span>
          </label>
        </div>
      </div>

      <!-- Scheduled Start Time (hidden by default) -->
      <div id="scheduled-start-group" class="form-group hidden" style="margin-bottom: 1.5rem;">
        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
          ${R.string.label_scheduled_start || 'Upphafstími'}
        </label>
        <input type="datetime-local" id="modal-scheduled-start" class="form-control"
               style="width: 100%; padding: 0.5rem;" min="${nowStr}">
      </div>

      <!-- Duration Options -->
      <div class="form-group" style="margin-bottom: 1.5rem;">
        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
          ${R.string.label_duration || 'Lengd kosningar'}
        </label>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button type="button" class="duration-btn" data-minutes="1" style="padding: 0.5rem 1rem; border: 2px solid var(--color-gray-300); background: white; border-radius: 4px; cursor: pointer;">
            ${R.string.duration_1min || '1 mín'}
          </button>
          <button type="button" class="duration-btn active" data-minutes="2" style="padding: 0.5rem 1rem; border: 2px solid var(--color-primary); background: var(--color-primary); color: white; border-radius: 4px; cursor: pointer;">
            ${R.string.duration_2min || '2 mín'}
          </button>
          <button type="button" class="duration-btn" data-minutes="3" style="padding: 0.5rem 1rem; border: 2px solid var(--color-gray-300); background: white; border-radius: 4px; cursor: pointer;">
            ${R.string.duration_3min || '3 mín'}
          </button>
          <button type="button" class="duration-btn" data-minutes="custom" style="padding: 0.5rem 1rem; border: 2px solid var(--color-gray-300); background: white; border-radius: 4px; cursor: pointer;">
            ${R.string.duration_custom || 'Sérsníða'}
          </button>
        </div>
        <input type="hidden" id="modal-duration-minutes" value="2">
      </div>

      <!-- Custom Duration (hidden by default) -->
      <div id="custom-duration-group" class="form-group hidden" style="margin-bottom: 1.5rem;">
        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
          ${R.string.label_custom_duration || 'Sérsniðin lengd (mínútur)'}
        </label>
        <input type="number" id="modal-custom-duration" class="form-control"
               style="width: 100%; padding: 0.5rem;" min="1" max="10080" placeholder="${R.string.placeholder_custom_duration || 't.d. 240'}">
        <small style="color: var(--color-gray-600); font-size: 0.875rem;">
          ${R.string.help_custom_duration || '1 mínúta til 7 dagar'}
        </small>
      </div>

      <!-- Manual End Time Toggle -->
      <div class="form-group" style="margin-bottom: 1rem;">
        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" id="modal-use-manual-end">
          <span>${R.string.label_use_manual_end || 'Nota ákveðinn lokatíma frekar en tímalengd'}</span>
        </label>
      </div>

      <!-- Manual End Time (hidden by default) -->
      <div id="manual-end-group" class="form-group hidden" style="margin-bottom: 1rem;">
        <label style="font-weight: 600; display: block; margin-bottom: 0.5rem;">
          ${R.string.label_scheduled_end || 'Lokatími'}
        </label>
        <input type="datetime-local" id="modal-scheduled-end" class="form-control"
               style="width: 100%; padding: 0.5rem;" min="${nowStr}">
      </div>

      <p style="color: var(--color-gray-600); font-size: 0.875rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-gray-200);">
        ${R.string.confirm_open_note || 'Kosningin verður opin fyrir félagsmenn eftir að þú staðfestir.'}
      </p>
    </div>
  `;

  const modal = showModal({
    title: `${R.string.confirm_open_title || 'Opna kosningu:'} ${election.title}`,
    content: scheduleHTML,
    size: 'md',
    buttons: [
      {
        text: R.string.btn_cancel || 'Hætta við',
        onClick: () => modal.close()
      },
      {
        text: R.string.btn_open || '🚀 Opna',
        primary: true,
        onClick: async () => {
          // Collect schedule data from modal
          const startTiming = document.querySelector('input[name="start_timing"]:checked')?.value || 'immediate';
          const scheduledStart = document.getElementById('modal-scheduled-start')?.value;
          const useManualEnd = document.getElementById('modal-use-manual-end')?.checked;
          const scheduledEnd = document.getElementById('modal-scheduled-end')?.value;
          const durationMinutes = parseInt(document.getElementById('modal-duration-minutes')?.value || '2');

          // Validate
          if (startTiming === 'scheduled' && !scheduledStart) {
            showError(R.string.validation_scheduled_start || 'Veldu upphafstíma');
            return;
          }
          if (useManualEnd && !scheduledEnd) {
            showError(R.string.validation_scheduled_end || 'Veldu lokatíma');
            return;
          }

          modal.close();

          try {
            // Calculate start and end times
            let startTime, endTime;

            if (startTiming === 'immediate') {
              startTime = new Date();
            } else {
              startTime = new Date(scheduledStart);
            }

            if (useManualEnd) {
              endTime = new Date(scheduledEnd);
            } else {
              endTime = new Date(startTime.getTime() + durationMinutes * 60000);
            }

            await openElection(electionId, {
              voting_starts_at: startTime.toISOString(),
              voting_ends_at: endTime.toISOString()
            });

            debug.log('[Elections List] Election opened:', electionId, 'Start:', startTime, 'End:', endTime);
            showSuccess(R.string.success_opened || 'Kosning opnuð!');

            // Reload elections
            await loadElections();

          } catch (error) {
            console.error('[Elections List] Error opening election:', error);
            showError(R.format(R.string.error_open_failed, error.message));
          }
        }
      }
    ]
  });

  // Setup event listeners for the modal form
  setupOpenModalListeners();
}

/**
 * Setup event listeners for the Open modal form elements
 */
function setupOpenModalListeners() {
  // Start timing radio buttons
  document.querySelectorAll('input[name="start_timing"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const scheduledGroup = document.getElementById('scheduled-start-group');
      if (scheduledGroup) {
        scheduledGroup.classList.toggle('hidden', e.target.value !== 'scheduled');
      }
    });
  });

  // Duration buttons
  document.querySelectorAll('.open-modal-form .duration-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Remove active from all
      document.querySelectorAll('.open-modal-form .duration-btn').forEach(b => {
        b.style.border = '2px solid var(--color-gray-300)';
        b.style.background = 'white';
        b.style.color = 'inherit';
        b.classList.remove('active');
      });
      // Add active to clicked
      e.target.style.border = '2px solid var(--color-primary)';
      e.target.style.background = 'var(--color-primary)';
      e.target.style.color = 'white';
      e.target.classList.add('active');

      const minutes = e.target.dataset.minutes;
      const customGroup = document.getElementById('custom-duration-group');
      const durationInput = document.getElementById('modal-duration-minutes');
      const manualEndCheckbox = document.getElementById('modal-use-manual-end');

      if (minutes === 'custom') {
        customGroup?.classList.remove('hidden');
        durationInput.value = '';
      } else {
        customGroup?.classList.add('hidden');
        durationInput.value = minutes;
      }

      // Uncheck manual end
      if (manualEndCheckbox) {
        manualEndCheckbox.checked = false;
        document.getElementById('manual-end-group')?.classList.add('hidden');
      }
    });
  });

  // Custom duration input
  const customDurationInput = document.getElementById('modal-custom-duration');
  if (customDurationInput) {
    customDurationInput.addEventListener('input', (e) => {
      document.getElementById('modal-duration-minutes').value = e.target.value;
    });
  }

  // Manual end time toggle
  const manualEndCheckbox = document.getElementById('modal-use-manual-end');
  if (manualEndCheckbox) {
    manualEndCheckbox.addEventListener('change', (e) => {
      document.getElementById('manual-end-group')?.classList.toggle('hidden', !e.target.checked);
      if (e.target.checked) {
        // Hide custom duration and deselect duration buttons
        document.getElementById('custom-duration-group')?.classList.add('hidden');
        document.querySelectorAll('.open-modal-form .duration-btn').forEach(b => {
          b.style.border = '2px solid var(--color-gray-300)';
          b.style.background = 'white';
          b.style.color = 'inherit';
          b.classList.remove('active');
        });
      }
    });
  }
}

/**
 * Close election with confirmation
 */
async function handleCloseElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;
  
  const modal = showModal({
    title: R.string.confirm_close_title,
    content: R.format(R.string.confirm_close_message, election.title),
    size: 'md',
    buttons: [
      {
        text: R.string.btn_cancel,
        onClick: () => modal.close()
      },
      {
        text: R.string.btn_close,
        primary: true,
        onClick: async () => {
          modal.close();
          
          try {
            await closeElection(electionId, {
              voting_ends_at: new Date().toISOString()
            });
            
            debug.log('[Elections List] Election closed:', electionId);
            showSuccess(R.string.success_closed);
            
            // Reload elections
            await loadElections();
            
          } catch (error) {
            console.error('[Elections List] Error closing election:', error);
            showError(R.format(R.string.error_close_failed, error.message));
          }
        }
      }
    ]
  });
}

/**
 * Hide election (soft delete)
 */
async function handleHideElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;
  
  if (!confirm(R.format(R.string.confirm_hide_message, election.title))) {
    return;
  }
  
  try {
    await hideElection(electionId);
    
    debug.log('[Elections List] Election hidden:', electionId);
    showSuccess(R.string.success_hidden);
    
    // Reload elections
    await loadElections();
    
  } catch (error) {
    console.error('[Elections List] Error hiding election:', error);
    showError(R.format(R.string.error_hide_failed, error.message));
  }
}

/**
 * Unhide election (restore)
 */
async function handleUnhideElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;
  
  if (!confirm(R.format(R.string.confirm_unhide_message, election.title))) {
    return;
  }
  
  try {
    await unhideElection(electionId);
    
    debug.log('[Elections List] Election unhidden:', electionId);
    showSuccess(R.string.success_unhidden);
    
    // Reload elections
    await loadElections();
    
  } catch (error) {
    console.error('[Elections List] Error unhiding election:', error);
    showError(R.format(R.string.error_unhide_failed, error.message));
  }
}

/**
 * Delete election (hard delete - superadmin only)
 */
async function handleDeleteElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;
  
  // Extra confirmation for hard delete
  const confirmation = prompt(R.format(R.string.confirm_delete_message, election.title, election.title));
  
  if (confirmation !== election.title) {
    await showAlert(
      'Villa',
      R.string.confirm_delete_title_mismatch
    );
    return;
  }
  
  try {
    await deleteElection(electionId);
    
    debug.log('[Elections List] Election deleted:', electionId);
    showSuccess(R.string.success_deleted);
    
    // Refresh list
    // Refresh list
    loadElections();
  } catch (error) {
    console.error('[Elections List] Error deleting election:', error);
    showError(R.format(R.string.error_delete_failed, error.message));
  }
}

// Date formatting is now handled by date-utils.js module

/**
 * Show loading state
 */
function showLoading(isLoading) {
  const spinner = document.getElementById('loading-spinner');
  const table = document.getElementById('elections-table');
  
  if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
  if (table) table.style.opacity = isLoading ? '0.5' : '1';
}

/**
 * Show error message
 */
async function showError(message) {
  await showAlert('Villa', message);
}

/**
 * Show success message
 */
function showSuccess(message) {
  showToast(message, 'success');
  debug.log('✅', message);
}
