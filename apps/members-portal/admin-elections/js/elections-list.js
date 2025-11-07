/**
 * Admin Elections List Page
 * Displays and manages all elections with RBAC
 */

import { getFirebaseAuth } from '../../firebase/app.js';
import { getElectionRole, canPerformAction, requireAdmin, PERMISSIONS, hasPermission } from '../../js/rbac.js';
import { R } from '../../i18n/strings-loader.js';
import { initNavigation } from '../../js/nav.js';

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

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  // Load i18n strings first
  await R.load('is');
  
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
      console.log('[Elections List] Election role:', electionRole);
      
      if (!electionRole) {
        alert(R.string.error_not_authorized || 'Þú hefur ekki heimild til að skoða kosningar.');
        window.location.href = '/members-area/';
        return;
      }
      
      // Store role globally for RBAC checks in UI
      currentUserRole = electionRole;
      
      console.log('[Elections List] User authenticated with election role:', electionRole);
      
      // User is authenticated and authorized, initialize UI
      await initialize();
    } catch (error) {
      console.error('[Elections List] Authorization error:', error);
      // requireAdmin already handles redirect
    }
  });
});

async function initialize() {
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
  // Set navigation texts
  document.getElementById('nav-brand').textContent = R.string.admin_brand;
  document.getElementById('nav-overview').textContent = R.string.admin_nav_overview;
  document.getElementById('nav-elections').textContent = R.string.admin_nav_elections;
  document.getElementById('nav-members').textContent = R.string.admin_nav_members;
  document.getElementById('nav-events').textContent = R.string.admin_nav_events;
  document.getElementById('nav-back-to-member').textContent = R.string.admin_nav_back_to_member;
  document.getElementById('nav-logout').textContent = R.string.admin_nav_logout;
  
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
    
    console.log('[Elections List] Fetching elections with token...');
    
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
    
    console.log('[Elections List] Loaded elections:', elections.length);
    
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
  
  console.log('[Elections List] Filtered:', filteredElections.length, '/', elections.length);
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
  
  // Render elections
  tbody.innerHTML = filteredElections.map(election => {
    const statusBadge = getStatusBadge(election);
    const actions = getActionButtons(election);
    
    return `
      <tr data-election-id="${election.id}" class="${election.hidden ? 'election-hidden' : ''}">
        <td class="election-title">
          <a href="/admin-elections/detail.html?id=${election.id}">
            ${election.title}
          </a>
          ${election.hidden ? `<span class="hidden-indicator">${R.string.label_hidden_indicator}</span>` : ''}
        </td>
        <td>${statusBadge}</td>
        <td class="election-dates">
          <div class="date-created">${R.string.label_created} ${formatDate(election.created_at)}</div>
          ${election.opened_at ? `<div class="date-opened">${R.string.label_opened} ${formatDate(election.opened_at)}</div>` : ''}
          ${election.closed_at ? `<div class="date-closed">${R.string.label_closed} ${formatDate(election.closed_at)}</div>` : ''}
        </td>
        <td class="election-stats">
          ${election.vote_count || 0} ${R.string.label_votes}
        </td>
        <td class="election-actions">
          ${actions}
        </td>
      </tr>
    `;
  }).join('');
  
  // Attach event listeners to action buttons
  attachActionListeners();
}

/**
 * Get status badge HTML
 */
function getStatusBadge(election) {
  const statusMap = {
    'draft': { label: R.string.status_draft, class: 'status-draft' },
    'published': { label: R.string.status_open, class: 'status-active' },
    'closed': { label: R.string.status_closed, class: 'status-closed' },
    'archived': { label: R.string.status_hidden, class: 'status-archived' }
  };
  
  const status = statusMap[election.status] || { label: election.status, class: 'status-unknown' };
  
  return `<span class="status-badge ${status.class}">${status.label}</span>`;
}

/**
 * Get action buttons HTML based on election state and user role
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
  if (canPerformAction(currentUserRole, 'delete')) {
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
  
  console.log('[Elections List] Action:', action, 'Election:', electionId);
  
  switch (action) {
    case 'view':
      window.location.href = `/admin-elections/detail.html?id=${electionId}`;
      break;
      
    case 'edit':
      window.location.href = `/admin-elections/edit.html?id=${electionId}`;
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
    
    console.log('[Elections List] Election hidden:', electionId);
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
    
    console.log('[Elections List] Election unhidden:', electionId);
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
      throw new Error(errorMessage);
    }
    
    console.log('[Elections List] Election deleted:', electionId);
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
  console.log('✅', message);
}
