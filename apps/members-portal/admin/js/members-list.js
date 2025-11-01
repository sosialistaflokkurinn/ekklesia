/**
 * Members List Page - Epic #116, Issue #120
 *
 * Handles UI interactions for the members list page:
 * - Loading and displaying members from Firestore
 * - Search functionality (debounced)
 * - Status filtering
 * - Pagination
 * - Loading/error/empty states
 */

// Import from member portal public directory
import { initSession } from '../../session/init.js';
import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app.js';
import MembersAPI from './api/members-api.js';
import { formatPhone, maskKennitala } from './utils/format.js';
import { filterMembersByDistrict } from './utils/electoral-districts.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

// Global i18n storage
const adminStrings = new Map();

(function() {
  'use strict';

  // State
  let currentPage = 1;
  let lastDoc = null;
  let pageHistory = []; // Stack of lastDoc for previous pages
  let currentStatus = 'active';
  let currentSearch = '';
  let currentDistrict = 'all';
  let isLoading = false;

  // DOM Elements
  const elements = {
    searchInput: null,
    filterStatus: null,
    filterDistrict: null,
    tableBody: null,
    loadingState: null,
    errorState: null,
    emptyState: null,
    tableContainer: null,
    paginationContainer: null,
    countText: null,
    paginationInfo: null,
    paginationCurrent: null,
    btnPagePrev: null,
    btnPageNext: null,
    btnRetry: null
  };

  // Initialize page
  async function init() {
    // Initialize DOM elements first (before auth check)
    initElements();

    // Load i18n strings early (before auth check so UI shows proper text)
    await loadStrings();

    // Check authentication
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = '/login.html';
        return;
      }

      // Check admin or developer role (developers have admin access)
      const token = await user.getIdTokenResult();
      const roles = token.claims.roles || [];
      const hasAdminAccess = roles.includes('admin') || roles.includes('superuser');

      if (!hasAdminAccess) {
        showError(adminStrings.get('error_permission_denied'));
        return;
      }

      // Set up event listeners
      setupEventListeners();

      // Load initial data
      await loadMembers();
    });
  }

  // Initialize DOM element references
  function initElements() {
    elements.searchInput = document.getElementById('members-search-input');
    elements.filterStatus = document.getElementById('members-filter-status');
    elements.filterDistrict = document.getElementById('members-filter-district');
    elements.tableBody = document.getElementById('members-table-body');
    elements.loadingState = document.getElementById('members-loading');
    elements.errorState = document.getElementById('members-error');
    elements.emptyState = document.getElementById('members-empty');
    elements.tableContainer = document.getElementById('members-table-container');
    elements.paginationContainer = document.getElementById('members-pagination');
    elements.countText = document.getElementById('members-count-text');
    elements.paginationInfo = document.getElementById('pagination-info');
    elements.paginationCurrent = document.getElementById('pagination-current');
    elements.btnPagePrev = document.getElementById('btn-page-prev');
    elements.btnPageNext = document.getElementById('btn-page-next');
    elements.btnRetry = document.getElementById('btn-retry');
  }

  // Load i18n strings from admin portal
  async function loadStrings() {
    try {
      const response = await fetch('/admin/i18n/values-is/strings.xml');
      if (!response.ok) {
        console.warn('Could not load admin i18n strings');
        return;
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const stringElements = xmlDoc.getElementsByTagName('string');

      const R = { string: {} };
      for (const el of stringElements) {
        const name = el.getAttribute('name');
        const value = el.textContent;
        if (name) {
          R.string[name] = value;
          adminStrings.set(name, value);
        }
      }

      // Apply strings to DOM
      applyStrings(R);
    } catch (error) {
      console.warn('Error loading i18n strings:', error);
      return;
    }
  }

  // Apply i18n strings to DOM elements
  function applyStrings(R) {
    if (!R || !R.string) {
      console.warn('i18n strings not loaded');
      return;
    }

    // Page title
    document.title = R.string.members_list_title || 'Félagar';

    // Navigation
    const navBrand = document.getElementById('nav-brand');
    if (navBrand) navBrand.textContent = R.string.app_name || 'Ekklesia';

    const navAdminDashboard = document.getElementById('nav-admin-dashboard');
    if (navAdminDashboard) navAdminDashboard.textContent = R.string.nav_admin_dashboard || 'Stjórnborð';

    const navAdminMembers = document.getElementById('nav-admin-members');
    if (navAdminMembers) navAdminMembers.textContent = R.string.nav_admin_members || 'Félagar';

    const navAdminSync = document.getElementById('nav-admin-sync');
    if (navAdminSync) navAdminSync.textContent = R.string.nav_admin_sync || 'Samstilling';

    const navAdminHistory = document.getElementById('nav-admin-history');
    if (navAdminHistory) navAdminHistory.textContent = R.string.nav_admin_history || 'Saga';

    const navBackToMember = document.getElementById('nav-back-to-member');
    if (navBackToMember) navBackToMember.textContent = R.string.nav_back_to_member || 'Til baka';

    const navLogout = document.getElementById('nav-logout');
    if (navLogout) navLogout.textContent = R.string.nav_logout || 'Útskrá';

    // Page header
    const pageTitle = document.getElementById('page-header-title');
    if (pageTitle) pageTitle.textContent = R.string.members_list_title || 'Félagar';

    const pageSubtitle = document.getElementById('page-header-subtitle');
    if (pageSubtitle) pageSubtitle.textContent = R.string.members_list_subtitle || 'Skoða og breyta félagaskrá';

    // Table headers
    const headerName = document.getElementById('header-name');
    if (headerName) headerName.textContent = R.string.member_name || 'Nafn';

    const headerKennitala = document.getElementById('header-kennitala');
    if (headerKennitala) headerKennitala.textContent = R.string.member_kennitala || 'Kennitala';

    const headerEmail = document.getElementById('header-email');
    if (headerEmail) headerEmail.textContent = R.string.member_email || 'Netfang';

    const headerPhone = document.getElementById('header-phone');
    if (headerPhone) headerPhone.textContent = R.string.member_phone || 'Sími';

    const headerStatus = document.getElementById('header-status');
    if (headerStatus) headerStatus.textContent = R.string.member_status || 'Staða';

    const headerActions = document.getElementById('header-actions');
    if (headerActions) headerActions.textContent = R.string.member_actions || 'Aðgerðir';

    // Create button
    const btnCreateText = document.getElementById('btn-create-member-text');
    if (btnCreateText) btnCreateText.textContent = R.string.member_create_button || '+ Nýr félagi';

    // Pagination
    const btnPagePrevText = document.getElementById('btn-page-prev-text');
    if (btnPagePrevText) btnPagePrevText.textContent = R.string.pagination_previous || '‹ Fyrri';

    const btnPageNextText = document.getElementById('btn-page-next-text');
    if (btnPageNextText) btnPageNextText.textContent = R.string.pagination_next || 'Næsta ›';
  }

  // Set up event listeners
  function setupEventListeners() {
    // Search input (debounced)
    let searchTimeout;
    elements.searchInput?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearch = e.target.value.trim();
        resetPagination();
        loadMembers();
      }, 300); // 300ms debounce
    });

    // Status filter
    elements.filterStatus?.addEventListener('change', (e) => {
      currentStatus = e.target.value;
      resetPagination();
      loadMembers();
    });

    // Electoral district filter
    elements.filterDistrict?.addEventListener('change', (e) => {
      currentDistrict = e.target.value;
      resetPagination();
      loadMembers();
    });

    // Pagination buttons
    elements.btnPagePrev?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        lastDoc = pageHistory.pop();
        loadMembers();
      }
    });

    elements.btnPageNext?.addEventListener('click', () => {
      if (lastDoc) {
        pageHistory.push(lastDoc);
        currentPage++;
        loadMembers();
      }
    });

    // Retry button
    elements.btnRetry?.addEventListener('click', () => {
      loadMembers();
    });

    // Logout
    const navLogout = document.getElementById('nav-logout');
    navLogout?.addEventListener('click', async (e) => {
      e.preventDefault();
      await auth.signOut();
      window.location.href = '/login.html';
    });
  }

  // Reset pagination state
  function resetPagination() {
    currentPage = 1;
    lastDoc = null;
    pageHistory = [];
  }

  // Load members from Firestore
  async function loadMembers() {
    if (isLoading) return;
    isLoading = true;

    showLoading(currentSearch ? adminStrings.get('members_searching') : adminStrings.get('members_loading'));

    try {
      // If searching OR filtering by district, load ALL documents for client-side filtering
      // For 2,118 members, this is acceptable (~500KB)
      const needsClientSideFiltering = currentSearch || currentDistrict !== 'all';
      const limitCount = needsClientSideFiltering ? 5000 : 50;

      const result = await MembersAPI.fetchMembers({
        limit: limitCount,
        status: currentStatus,
        search: currentSearch,
        startAfter: needsClientSideFiltering ? null : lastDoc  // No pagination when filtering
      });

      // Apply electoral district filter client-side
      let filteredMembers = result.members;
      if (currentDistrict !== 'all') {
        filteredMembers = filterMembersByDistrict(result.members, currentDistrict);
      }

      if (filteredMembers.length === 0) {
        showEmpty();
      } else {
        renderMembers(filteredMembers);

        // Hide pagination when searching or filtering by district (showing all results)
        if (needsClientSideFiltering) {
          elements.paginationContainer.style.display = 'none';
          elements.paginationInfo.textContent = `Sýni ${filteredMembers.length} niðurstöður`;
        } else {
          updatePagination(result.hasMore, filteredMembers.length);
          elements.paginationContainer.style.display = 'flex';
        }

        lastDoc = result.lastDoc;

        // Update count
        updateMemberCount();

        showTable();
      }

    } catch (error) {
      console.error('Error loading members:', error);
      showError(error.message || adminStrings.get('members_error_loading'));
    } finally {
      isLoading = false;
    }
  }

  // Update member count display
  async function updateMemberCount() {
    try {
      const count = await MembersAPI.getMembersCount(currentStatus);
      const statusText = currentStatus === 'all' ? adminStrings.get('members_status_all_plural') :
                        currentStatus === 'active' ? adminStrings.get('members_status_active_plural') :
                        adminStrings.get('members_status_inactive_plural');
      elements.countText.textContent = `${count} ${statusText} félagar`;
    } catch (error) {
      console.error('Error getting member count:', error);
      elements.countText.textContent = adminStrings.get('members_list_title') || 'Félagar';
    }
  }

  // Render members in table
  function renderMembers(members) {
    elements.tableBody.innerHTML = '';

    members.forEach(member => {
      const row = document.createElement('tr');
      row.className = 'members-table__row';

      // Django ID
      const idCell = document.createElement('td');
      idCell.className = 'members-table__cell';
      idCell.textContent = member.metadata?.django_id || '-';
      row.appendChild(idCell);

      // Name
      const nameCell = document.createElement('td');
      nameCell.className = 'members-table__cell';
      nameCell.textContent = member.name || '-';
      row.appendChild(nameCell);

      // Phone (formatted as XXX-XXXX)
      const phoneCell = document.createElement('td');
      phoneCell.className = 'members-table__cell';
      phoneCell.textContent = formatPhone(member.phone) || '-';
      row.appendChild(phoneCell);

      // Email
      const emailCell = document.createElement('td');
      emailCell.className = 'members-table__cell';
      emailCell.textContent = member.email || '-';
      row.appendChild(emailCell);

      // Kennitala (masked)
      const kennitalaCell = document.createElement('td');
      kennitalaCell.className = 'members-table__cell';
      kennitalaCell.textContent = maskKennitala(member.kennitala);
      row.appendChild(kennitalaCell);

      // Actions
      const actionsCell = document.createElement('td');
      actionsCell.className = 'members-table__cell members-table__cell--actions';

      const viewBtn = document.createElement('a');
      viewBtn.href = `/admin/member-detail.html?id=${member.kennitala}`;
      viewBtn.className = 'members-table__action';
      viewBtn.textContent = adminStrings.get('members_btn_view');
      actionsCell.appendChild(viewBtn);

      const editBtn = document.createElement('a');
      editBtn.href = `/admin/member-edit.html?id=${member.kennitala}`;
      editBtn.className = 'members-table__action';
      editBtn.textContent = 'Breyta';
      actionsCell.appendChild(editBtn);

      row.appendChild(actionsCell);

      elements.tableBody.appendChild(row);
    });
  }

  // Update pagination controls
  function updatePagination(hasMore, currentCount) {
    // Update pagination info
    const start = (currentPage - 1) * 50 + 1;
    const end = (currentPage - 1) * 50 + currentCount;
    elements.paginationInfo.textContent = `Sýni ${start}-${end}`;

    // Update current page
    elements.paginationCurrent.textContent = `Síða ${currentPage}`;

    // Enable/disable previous button
    elements.btnPagePrev.disabled = currentPage === 1;

    // Enable/disable next button
    elements.btnPageNext.disabled = !hasMore;
  }

  // Get status text in Icelandic
  function getStatusText(status) {
    switch (status) {
      case 'active': return adminStrings.get('members_status_active') || 'Virkur';
      case 'inactive': return adminStrings.get('members_status_inactive') || 'Óvirkur';
      default: return adminStrings.get('members_status_unknown') || 'Óþekkt';
    }
  }

  // Show loading state
  function showLoading(message = adminStrings.get('members_loading') || 'Hleð félagaskrá...') {
    elements.loadingState.style.display = 'block';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.tableContainer.style.display = 'none';
    elements.paginationContainer.style.display = 'none';

    const loadingText = document.getElementById('members-loading-text');
    if (loadingText) {
      loadingText.textContent = message;
    }
  }

  // Show error state
  function showError(message) {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'block';
    elements.emptyState.style.display = 'none';
    elements.tableContainer.style.display = 'none';
    elements.paginationContainer.style.display = 'none';

    const errorMessage = document.getElementById('members-error-message');
    if (errorMessage) {
      errorMessage.textContent = message;
    }
  }

  // Show empty state
  function showEmpty() {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'block';
    elements.tableContainer.style.display = 'none';
    elements.paginationContainer.style.display = 'none';
  }

  // Show table with data
  function showTable() {
    elements.loadingState.style.display = 'none';
    elements.errorState.style.display = 'none';
    elements.emptyState.style.display = 'none';
    elements.tableContainer.style.display = 'block';
    elements.paginationContainer.style.display = 'flex';
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
