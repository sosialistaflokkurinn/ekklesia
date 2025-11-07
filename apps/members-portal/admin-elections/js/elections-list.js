/**
 * Admin Elections List Page
 * Displays and manages all elections with RBAC
 */

import { getFirebaseAuth } from '../../firebase/app.js';
import { getElectionRole, canPerformAction, requireAdmin, PERMISSIONS, hasPermission } from '../../js/rbac.js';
import { R } from '../i18n/strings-loader.js';
import { initNavigation } from '../../js/nav.js';
import { createStatusBadge } from '../../js/components/badge.js';
import { showModal } from '../../js/components/modal.js';
import { formatDateIcelandic } from '../../js/utils/format.js';
import { debug } from '../../js/utils/debug.js';

const auth = getFirebaseAuth();

// API Configuration
const ADMIN_API_URL = 'https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections';

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
    // Load i18n strings FIRST and wait for it to complete
    await R.load('is');
    debug.log('[Elections List] i18n strings loaded');
    
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
          alert(R.string.error_not_authorized || 'Þú hefur ekki heimild til að skoða kosningar.');
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
  initializeUITexts();
  initializeNavigation();
  setupFilters();
  setupSearch();
  setupCreateButton();
  
  // Load elections
  await loadElections();
}

/**
 * Initialize all UI texts with i18n strings
 */
function initializeUITexts() {
  // Page title and heading
  document.getElementById('page-title').textContent = R.string.admin_elections_title || 'Kosningar - Admin';
  document.getElementById('page-heading').textContent = R.string.admin_elections_heading || 'Kosningar';
  
  // Filter buttons
  document.getElementById('filter-all').textContent = R.string.filter_all || 'Allar';
  document.getElementById('filter-draft').textContent = R.string.filter_draft || 'Drög';
  document.getElementById('filter-published').textContent = R.string.filter_published || 'Opnar';
  document.getElementById('filter-closed').textContent = R.string.filter_closed || 'Lokaðar';
  document.getElementById('filter-hidden').textContent = R.string.filter_hidden || 'Faldar';
  
  // Search
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.placeholder = R.string.search_placeholder || 'Leita...';
  }
  
  // Create button
  const createBtn = document.getElementById('create-election-btn');
  if (createBtn) {
    createBtn.textContent = R.string.btn_create_election || '+ Búa til kosningu';
  }
  
  // Table headers
  document.getElementById('table-header-title').textContent = R.string.table_header_title || 'Heiti';
  document.getElementById('table-header-status').textContent = R.string.table_header_status || 'Staða';
  document.getElementById('table-header-dates').textContent = R.string.table_header_dates || 'Dagsetningar';
  document.getElementById('table-header-votes').textContent = R.string.table_header_votes || 'Atkvæði';
  document.getElementById('table-header-actions').textContent = R.string.table_header_actions || 'Aðgerðir';
  
  // Loading text
  document.getElementById('loading-text').textContent = R.string.loading_elections || 'Hleð kosningum...';
  
  debug.log('[Elections List] UI texts initialized');
}

/**
 * Initialize navigation with hamburger menu
 */
function initializeNavigation() {
  // Defensive check: Ensure strings are loaded
  if (!R.string || !R.string.admin_brand) {
    console.error('[Elections List] i18n strings not loaded yet!');
    return;
  }
  
  // Set navigation texts (Elections-specific nav)
  document.getElementById('nav-brand').textContent = R.string.admin_elections_brand || 'Kosningastjórnun';
  document.getElementById('nav-elections-list').textContent = R.string.nav_elections_list || 'Kosningar';
  document.getElementById('nav-back-to-member').textContent = R.string.admin_nav_back_to_member;
  document.getElementById('nav-logout').textContent = R.string.admin_nav_logout;
  
  debug.log('[Elections List] Navigation initialized');
  
  // Initialize hamburger menu behavior
  initNavigation();
  
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
    
    const user = auth.currentUser;
    if (!user) {
      throw new Error(R.string.error_not_authenticated);
    }
    
    const token = await user.getIdToken();
    
    debug.log('[Elections List] Fetching elections with token...');
    
    // Fetch all elections including hidden ones (admin view)
    const response = await fetch(`${ADMIN_API_URL}?includeHidden=true`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Elections List] API Error:', response.status, errorData);
      throw new Error(`API ${R.string.error_message}: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }
    
    const data = await response.json();
    elections = data.elections || [];
    
    debug.log('[Elections List] Loaded elections:', elections.length);
    
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
      // Update active state
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update filter
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
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  // Clear existing rows
  tbody.innerHTML = '';
  
  // Render elections using DOM manipulation for badges
  filteredElections.forEach(election => {
    const row = document.createElement('tr');
    row.dataset.electionId = election.id;
    if (election.hidden) row.classList.add('election-hidden');
    
    // Title cell
    const titleCell = document.createElement('td');
    titleCell.className = 'election-title';
    const titleLink = document.createElement('a');
    titleLink.href = `/admin-elections/detail.html?id=${election.id}`;
    titleLink.textContent = election.title;
    titleCell.appendChild(titleLink);
    if (election.hidden) {
      const hiddenIndicator = document.createElement('span');
      hiddenIndicator.className = 'hidden-indicator';
      hiddenIndicator.textContent = R.string.label_hidden_indicator;
      titleCell.appendChild(hiddenIndicator);
    }
    row.appendChild(titleCell);
    
    // Status cell with badge component
    const statusCell = document.createElement('td');
    const badge = createStatusBadge(election.status);
    statusCell.appendChild(badge);
    row.appendChild(statusCell);
    
    // Dates cell
    const datesCell = document.createElement('td');
    datesCell.className = 'election-dates';
    datesCell.innerHTML = `
      <div class="date-created">${R.string.label_created} ${formatDate(election.created_at)}</div>
      ${election.opened_at ? `<div class="date-opened">${R.string.label_opened} ${formatDate(election.opened_at)}</div>` : ''}
      ${election.closed_at ? `<div class="date-closed">${R.string.label_closed} ${formatDate(election.closed_at)}</div>` : ''}
    `;
    row.appendChild(datesCell);
    
    // Stats cell
    const statsCell = document.createElement('td');
    statsCell.className = 'election-stats';
    statsCell.textContent = `${election.vote_count || 0} ${R.string.label_votes}`;
    row.appendChild(statsCell);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    actionsCell.className = 'election-actions';
    actionsCell.innerHTML = getActionButtons(election);
    row.appendChild(actionsCell);
    
    tbody.appendChild(row);
  });
  
  // Attach event listeners to action buttons
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
  
  // Edit button (only for drafts)
  if (election.status === 'draft' && !election.hidden) {
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
      window.location.href = `/admin-elections/detail.html?id=${electionId}`;
      break;
      
    case 'edit':
      window.location.href = `/admin-elections/edit.html?id=${electionId}`;
      break;
      
    case 'open':
      await openElection(electionId);
      break;
      
    case 'close':
      await closeElection(electionId);
      break;
      
    case 'hide':
      await hideElection(electionId);
      break;
      
    case 'unhide':
      await unhideElection(electionId);
      break;
      
    case 'delete':
      await deleteElection(electionId);
      break;
  }
}

/**
 * Open election with duration selector modal
 */
async function openElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;
  
  // Create duration selector HTML
  const durationHTML = `
    <div style="margin-bottom: 1rem;">
      <p style="margin-bottom: 0.5rem; font-weight: 600;">${R.string.confirm_open_duration}</p>
      <select id="duration-select" class="form-control" style="width: 100%; padding: 0.5rem; font-size: 1rem; border: 1px solid var(--color-gray-300); border-radius: 4px;">
        <option value="15">${R.string.duration_15min}</option>
        <option value="30" selected>${R.string.duration_30min}</option>
        <option value="60">${R.string.duration_1hour}</option>
        <option value="90">${R.string.duration_90min}</option>
        <option value="120">${R.string.duration_2hours}</option>
      </select>
    </div>
    <p style="color: var(--color-gray-600); font-size: 0.875rem; margin-top: 1rem;">${R.string.confirm_open_note}</p>
  `;
  
  const modal = showModal({
    title: `${R.string.confirm_open_title} ${election.title}`,
    content: durationHTML,
    size: 'md',
    buttons: [
      {
        text: R.string.btn_cancel,
        onClick: () => modal.close()
      },
      {
        text: R.string.btn_open,
        primary: true,
        onClick: async () => {
          const durationMinutes = parseInt(document.getElementById('duration-select').value);
          modal.close();
          
          try {
            const user = auth.currentUser;
            const token = await user.getIdToken();
            
            // Calculate end time
            const now = new Date();
            const endTime = new Date(now.getTime() + durationMinutes * 60000);
            
            const response = await fetch(`${ADMIN_API_URL}/${electionId}/open`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                voting_starts_at: now.toISOString(),
                voting_ends_at: endTime.toISOString()
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
              throw new Error(errorMessage);
            }
            
            debug.log('[Elections List] Election opened:', electionId, 'Duration:', durationMinutes, 'min');
            showSuccess(R.string.success_opened);
            
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
}

/**
 * Close election with confirmation
 */
async function closeElection(electionId) {
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
            const user = auth.currentUser;
            const token = await user.getIdToken();
            
            const response = await fetch(`${ADMIN_API_URL}/${electionId}/close`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                voting_ends_at: new Date().toISOString()
              })
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
              throw new Error(errorMessage);
            }
            
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
async function hideElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;
  
  if (!confirm(R.format(R.string.confirm_hide_message, election.title))) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    const token = await user.getIdToken();
    
    const response = await fetch(`${ADMIN_API_URL}/${electionId}/hide`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
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
async function unhideElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;
  
  if (!confirm(R.format(R.string.confirm_unhide_message, election.title))) {
    return;
  }
  
  try {
    const user = auth.currentUser;
    const token = await user.getIdToken();
    
    const response = await fetch(`${ADMIN_API_URL}/${electionId}/unhide`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
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
async function deleteElection(electionId) {
  const election = elections.find(e => e.id === electionId);
  if (!election) return;
  
  // Extra confirmation for hard delete
  const confirmation = prompt(R.format(R.string.confirm_delete_message, election.title, election.title));
  
  if (confirmation !== election.title) {
    alert(R.string.confirm_delete_title_mismatch);
    return;
  }
  
  try {
    const user = auth.currentUser;
    const token = await user.getIdToken();
    
    const response = await fetch(`${ADMIN_API_URL}/${electionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      console.error('[Elections List] Delete failed:', response.status, errorData);
      
      // Provide more helpful error message for common cases
      if (errorMessage.includes('active election')) {
        throw new Error('Ekki hægt að eyða virkri kosningu. Lokaðu kosningunni fyrst.');
      }
      
      throw new Error(errorMessage);
    }
    
    debug.log('[Elections List] Election deleted:', electionId);
    showSuccess(R.string.success_deleted);
    
    // Reload elections
    await loadElections();
    
  } catch (error) {
    console.error('[Elections List] Error deleting election:', error);
    showError(R.format(R.string.error_delete_failed, error.message));
  }
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  return date.toLocaleDateString('is-IS', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

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
function showError(message) {
  // TODO: Use toast notification instead of alert
  alert('Villa: ' + message);
}

/**
 * Show success message
 */
function showSuccess(message) {
  // TODO: Use toast notification instead of alert
  debug.log('✅', message);
}
