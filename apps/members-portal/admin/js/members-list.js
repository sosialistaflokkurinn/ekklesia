/**
 * Members List Page - Epic #116, Issue #120
 *
 * Handles UI interactions for the members list page:
 * - Loading and displaying members from Firestore
 * - Search functionality (debounced)
 * - Status filtering
 * - Pagination
 * - Loading/error/empty states
 *
 * Module cleanup not needed - page reloads on navigation.
 */

// Import from member portal public directory
import { initSession } from '../../session/init.js';
import { initNavigation } from '../../js/nav-interactions.js';
import { debug } from '../../js/utils/util-debug.js';
import { getFirebaseAuth, getFirebaseFirestore, httpsCallable } from '../../firebase/app.js';
import MembersAPI from './api/members-api.js?v=20260122a';
import { formatPhone, maskKennitala, formatDateOnlyIcelandic } from '../../js/utils/util-format.js';
import { filterMembersByDistrict, getElectoralDistrictName } from './utils/electoral-districts.js';
import { filterMembersByMunicipality, getMunicipalityName, getMunicipalityOptions, FILTER_MISSING_ADDRESS } from './utils/municipalities.js';
import { el } from '../../js/utils/util-dom.js';
import { createListPageStates } from './utils/ui-states.js';
import { initSearchableSelects } from '../../js/components/ui-searchable-select.js';
import { showModal } from '../../js/components/ui-modal.js';
import { showToast } from '../../js/components/ui-toast.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

// Cloud Functions
const REGION = 'europe-west2';
const softDeleteAdminFunction = httpsCallable('softDeleteAdmin', REGION);

// Global i18n storage
const adminStrings = new Map();

// ============================================================================
// SESSION STORAGE CACHE - Cleared on browser close for security
// ============================================================================
const CACHE_KEY = 'admin_members_list_cache';
const CACHE_MAX_AGE_MS = 3 * 60 * 1000; // 3 minutes (shorter for admin data)

/**
 * Get cached members from sessionStorage
 * Uses sessionStorage instead of localStorage for security - PII data is
 * cleared when browser closes and not persisted across sessions.
 * @returns {Object|null} { data, isStale } or null if no cache
 */
function getCache() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
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
 * Save members to sessionStorage cache
 * @param {Array} data - Members array to cache
 */
function setCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    debug.log('[Cache] Members cached:', data.length);
  } catch (e) {
    debug.warn('[Cache] Failed to write cache:', e);
  }
}

(function() {
  'use strict';

  // State
  let currentPage = 1;
  let lastDoc = null;
  let pageHistory = []; // Stack of lastDoc for previous pages
  let currentSearch = '';
  let currentDistrict = 'all';
  let currentMunicipality = 'all';
  let isLoading = false;

  // DOM Elements
  const elements = {
    searchInput: null,
    filterDistrict: null,
    filterMunicipality: null,
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
    btnRetry: null,
    btnPrintList: null
  };

  // Filtered members for printing
  let filteredMembersForPrint = [];

  // UI State Manager
  let uiStates = null;

  // Initialize page
  async function init() {
    // Initialize DOM elements first (before auth check)
    initElements();

    // Initialize UI state manager
    uiStates = createListPageStates({
      ...elements,
      loadingMessage: document.getElementById('members-loading-text'),
      errorMessage: document.getElementById('members-error-message')
    });

    // Load i18n strings FIRST - required for renderMembers() data-label attributes
    await loadStrings();

    // Check for cached data - show immediately for instant load (AFTER strings loaded)
    const cached = getCache();
    if (cached?.data && cached.data.length > 0) {
      debug.log('[Cache] Showing cached members immediately:', cached.data.length);
      renderMembers(cached.data);
      uiStates.showContent();
      elements.paginationContainer.style.display = 'flex';
    }

    // Read URL parameters for initial filter state
    const urlParams = new URLSearchParams(window.location.search);
    const urlMunicipality = urlParams.get('municipality');
    if (urlMunicipality) {
      currentMunicipality = urlMunicipality;
    }

    // Populate municipality dropdown
    populateMunicipalityDropdown();

    // Set dropdown value from URL parameter
    if (urlMunicipality && elements.filterMunicipality) {
      elements.filterMunicipality.value = urlMunicipality;
    }

    // Initialize searchable selects after strings are loaded
    initSearchableSelects({
      searchPlaceholder: adminStrings.get('search_placeholder') || 'Leita...',
      noResultsText: adminStrings.get('no_results') || 'Engar niðurstöður'
    });

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
        uiStates.showError(adminStrings.get('error_permission_denied'));
        return;
      }

      // Note: Navigation now initialized by nav-header component

      // Set up event listeners
      setupEventListeners();

      // If we have cached data, decide whether to refresh
      if (cached?.data) {
        if (cached.isStale) {
          debug.log('[Cache] Cache is stale, refreshing in background');
          loadMembers(true).catch(err => {
            debug.warn('[Cache] Background refresh failed:', err);
          });
        }
        // Update member count (non-blocking)
        updateMemberCount();
      } else {
        // No cache - load normally with loading spinner
        await loadMembers();
      }
    });
  }

  // Initialize DOM element references
  function initElements() {
    elements.searchInput = document.getElementById('members-search-input');
    elements.filterDistrict = document.getElementById('members-filter-district');
    elements.filterMunicipality = document.getElementById('members-filter-municipality');
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
    elements.btnPrintList = document.getElementById('btn-print-list');
  }

  // Populate municipality dropdown with options
  function populateMunicipalityDropdown() {
    if (!elements.filterMunicipality) return;

    const options = getMunicipalityOptions();

    // Clear existing options except the first one
    elements.filterMunicipality.innerHTML = '';

    // Add options
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      elements.filterMunicipality.appendChild(option);
    });
  }

  // Load i18n strings from admin portal
  async function loadStrings() {
    try {
      const response = await fetch('/admin/i18n/values-is/admin-portal-strings.xml');
      if (!response.ok) {
        debug.warn('Could not load admin i18n strings');
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
      debug.warn('Error loading i18n strings:', error);
      return;
    }
  }

  // Apply i18n strings to DOM elements
  function applyStrings(R) {
    if (!R || !R.string) {
      debug.warn('i18n strings not loaded');
      return;
    }

    // Page title
    document.title = R.string.members_list_title || 'Félagar';

    // Navigation - Handled by nav-header.js component
    // const navBrand = document.getElementById('nav-brand');
    // if (navBrand) navBrand.textContent = R.string.app_name || 'Ekklesia';

    // const navAdminDashboard = document.getElementById('nav-admin-dashboard');
    // if (navAdminDashboard) navAdminDashboard.textContent = R.string.nav_admin_dashboard || 'Stjórnborð';

    // const navAdminMembers = document.getElementById('nav-admin-members');
    // if (navAdminMembers) navAdminMembers.textContent = R.string.nav_admin_members || 'Félagar';

    // const navAdminSync = document.getElementById('nav-admin-sync');
    // if (navAdminSync) navAdminSync.textContent = R.string.nav_admin_sync || 'Samstilling';

    // const navAdminQueue = document.getElementById('nav-admin-queue');
    // if (navAdminQueue) navAdminQueue.textContent = R.string.nav_admin_queue || 'Biðröð';

    // const navAdminHistory = document.getElementById('nav-admin-history');
    // if (navAdminHistory) navAdminHistory.textContent = R.string.nav_admin_history || 'Saga';

    // const navBackToMember = document.getElementById('nav-back-to-member');
    // if (navBackToMember) navBackToMember.textContent = R.string.nav_back_to_member || 'Til baka';

    // const navLogout = document.getElementById('nav-logout');
    // if (navLogout) navLogout.textContent = R.string.nav_logout || 'Útskrá';

    // Note: Page header removed - nav brand shows "Félagaskrá"

    // Table headers
    const headerName = document.getElementById('header-name');
    if (headerName) headerName.textContent = R.string.members_table_header_name || R.string.member_name || 'Nafn';

    const headerId = document.getElementById('header-id');
    if (headerId) headerId.textContent = R.string.members_table_header_id || 'Django ID';

    const headerKennitala = document.getElementById('header-kennitala');
    if (headerKennitala) headerKennitala.textContent = R.string.members_table_header_kennitala || R.string.member_kennitala || 'Kennitala';

    const headerEmail = document.getElementById('header-email');
    if (headerEmail) headerEmail.textContent = R.string.members_table_header_email || R.string.member_email || 'Netfang';

    const headerPhone = document.getElementById('header-phone');
    if (headerPhone) headerPhone.textContent = R.string.member_phone || 'Sími';

    const headerStatus = document.getElementById('header-status');
    if (headerStatus) headerStatus.textContent = R.string.members_table_header_status || R.string.member_status || 'Staða';

    const headerActions = document.getElementById('header-actions');
    if (headerActions) headerActions.textContent = R.string.members_table_header_actions || R.string.member_actions || 'Aðgerðir';

    // Electoral district dropdown options
    const filterDistrictAll = document.getElementById('filter-district-all');
    if (filterDistrictAll) filterDistrictAll.textContent = R.string.district_all || 'Öll kjördæmi';

    const filterDistrictReykjavik = document.getElementById('filter-district-reykjavik');
    if (filterDistrictReykjavik) filterDistrictReykjavik.textContent = R.string.district_reykjavik || 'Reykjavíkurkjördæmi';

    const filterDistrictSudvestur = document.getElementById('filter-district-sudvestur');
    if (filterDistrictSudvestur) filterDistrictSudvestur.textContent = R.string.district_sudvestur || 'Suðvesturkjördæmi';

    const filterDistrictSudur = document.getElementById('filter-district-sudur');
    if (filterDistrictSudur) filterDistrictSudur.textContent = R.string.district_sudur || 'Suðurkjördæmi';

    const filterDistrictNordvestur = document.getElementById('filter-district-nordvestur');
    if (filterDistrictNordvestur) filterDistrictNordvestur.textContent = R.string.district_nordvestur || 'Norðvesturkjördæmi';

    const filterDistrictNordaustur = document.getElementById('filter-district-nordaustur');
    if (filterDistrictNordaustur) filterDistrictNordaustur.textContent = R.string.district_nordaustur || 'Norðausturkjördæmi';

    // UI text
    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) btnRetry.textContent = R.string.members_retry_button || R.string.btn_retry || 'Reyna aftur';

    const emptyMessage = document.getElementById('members-empty-message');
    if (emptyMessage) emptyMessage.textContent = R.string.members_empty_message || 'Engir félagar fundust';

    // Create button
    const btnCreateText = document.getElementById('btn-create-member-text');
    if (btnCreateText) btnCreateText.textContent = R.string.member_create_button || '+ Nýr félagi';

    // Pagination
    const btnPagePrevText = document.getElementById('btn-page-prev-text');
    if (btnPagePrevText) btnPagePrevText.textContent = R.string.pagination_previous || '‹ Fyrri';

    const btnPageNextText = document.getElementById('btn-page-next-text');
    if (btnPageNextText) btnPageNextText.textContent = R.string.pagination_next || 'Næsta ›';

    // Search input placeholder
    const searchInput = document.getElementById('members-search-input');
    if (searchInput) searchInput.placeholder = R.string.members_search_placeholder || 'Leita að nafni eða kennitölu...';
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

    // Electoral district filter
    elements.filterDistrict?.addEventListener('change', (e) => {
      currentDistrict = e.target.value;
      resetPagination();
      loadMembers();
    });

    // Municipality filter
    elements.filterMunicipality?.addEventListener('change', (e) => {
      currentMunicipality = e.target.value;
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

    // Print list button
    elements.btnPrintList?.addEventListener('click', printCallList);

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
  // @param {boolean} backgroundRefresh - If true, don't show loading spinner
  async function loadMembers(backgroundRefresh = false) {
    if (isLoading) return;
    isLoading = true;

    if (!backgroundRefresh) {
      uiStates.showLoading(currentSearch ? adminStrings.get('members_searching') : adminStrings.get('members_loading'));
    }

    try {
      // If searching OR filtering by district/municipality, load ALL documents for client-side filtering
      // For 2,118 members, this is acceptable (~500KB)
      const needsClientSideFiltering = currentSearch || currentDistrict !== 'all' || currentMunicipality !== 'all';
      const limitCount = needsClientSideFiltering ? 5000 : 50;

      const result = await MembersAPI.fetchMembers({
        limit: limitCount,
        status: 'active',  // Only fetch active members (exclude soft-deleted)
        search: currentSearch,
        municipality: currentMunicipality !== 'all' ? currentMunicipality : '',
        startAfter: needsClientSideFiltering ? null : lastDoc  // No pagination when filtering
      });

      // Apply electoral district filter client-side
      let filteredMembers = result.members;
      if (currentDistrict !== 'all') {
        filteredMembers = filterMembersByDistrict(filteredMembers, currentDistrict);
      }

      // Apply municipality filter client-side
      if (currentMunicipality !== 'all') {
        filteredMembers = filterMembersByMunicipality(filteredMembers, currentMunicipality);
      }

      // Store filtered members for printing and show/hide print button
      // (Don't show print button for "missing address" filter - not useful for call lists)
      filteredMembersForPrint = filteredMembers;
      if (elements.btnPrintList) {
        const showPrint = currentMunicipality !== 'all' && currentMunicipality !== FILTER_MISSING_ADDRESS;
        elements.btnPrintList.style.display = showPrint ? 'inline-block' : 'none';
      }

      // Cache the results (only for initial page load without search/district filter)
      if (!needsClientSideFiltering && currentPage === 1) {
        setCache(filteredMembers);
      }

      if (filteredMembers.length === 0) {
        uiStates.showEmpty();
      } else {
        renderMembers(filteredMembers);

        // Hide pagination when searching or filtering by district (showing all results)
        if (needsClientSideFiltering) {
          elements.paginationContainer.style.display = 'none';
          const template = adminStrings.get('pagination_showing_results') || 'Sýni %d niðurstöður';
          elements.paginationInfo.textContent = template.replace('%d', filteredMembers.length);
        } else {
          updatePagination(result.hasMore, filteredMembers.length);
          elements.paginationContainer.style.display = 'flex';
        }

        lastDoc = result.lastDoc;

        // Update count
        updateMemberCount();

        uiStates.showContent();
        elements.paginationContainer.style.display = 'flex';
      }

    } catch (error) {
      debug.error('Error loading members:', error);
      if (!backgroundRefresh) {
        uiStates.showError(error.message || adminStrings.get('members_error_loading'));
      }
    } finally {
      isLoading = false;
    }
  }

  // Update member count display
  async function updateMemberCount() {
    try {
      // If any filter is active, count filtered members
      if (currentDistrict !== 'all' || currentMunicipality !== 'all') {
        // Load all members for client-side counting (with server-side filter if applicable)
        const result = await MembersAPI.fetchMembers({
          limit: 5000,
          status: 'active',  // Only count active members
          search: '',
          municipality: currentMunicipality !== 'all' ? currentMunicipality : '',
          startAfter: null
        });

        // Apply filters
        let filteredMembers = result.members;
        if (currentDistrict !== 'all') {
          filteredMembers = filterMembersByDistrict(filteredMembers, currentDistrict);
        }
        if (currentMunicipality !== 'all') {
          filteredMembers = filterMembersByMunicipality(filteredMembers, currentMunicipality);
        }

        const count = filteredMembers.length;

        // Build filter description
        let filterName = '';
        if (currentDistrict !== 'all' && currentMunicipality !== 'all') {
          filterName = `${getMunicipalityName(currentMunicipality)} (${getElectoralDistrictName(currentDistrict)})`;
        } else if (currentMunicipality !== 'all') {
          filterName = getMunicipalityName(currentMunicipality);
        } else {
          filterName = getElectoralDistrictName(currentDistrict);
        }

        // Show count with filter name
        const filterTemplate = adminStrings.get('members_count_in_district') || '%d félagar í %s';
        elements.countText.textContent = filterTemplate.replace('%d', count).replace('%s', filterName);
      } else {
        // Normal count (active members only)
        const count = await MembersAPI.getMembersCount('active');
        const countTemplate = adminStrings.get('members_count_total') || '%d félagar';
        elements.countText.textContent = countTemplate.replace('%d', count);
      }
    } catch (error) {
      debug.error('Error getting member count:', error);
      elements.countText.textContent = adminStrings.get('members_list_title') || 'Félagar';
    }
  }

  // Render members in table
  function renderMembers(members) {
    elements.tableBody.innerHTML = '';

    members.forEach(member => {
      const row = el('tr', 'members-table__row', {},
        // Django ID
        el('td', 'members-table__cell', {
          dataset: { label: adminStrings.get('members_table_header_id') }
        }, member.metadata?.django_id || '-'),
        // Name
        el('td', 'members-table__cell', {
          dataset: { label: adminStrings.get('members_table_header_name') }
        }, member.name || '-'),
        // Phone (formatted as XXX-XXXX)
        el('td', 'members-table__cell', {
          dataset: { label: adminStrings.get('member_phone') }
        }, formatPhone(member.phone) || '-'),
        // Email
        el('td', 'members-table__cell', {
          dataset: { label: adminStrings.get('members_table_header_email') }
        }, member.email || '-'),
        // Kennitala (masked)
        el('td', 'members-table__cell', {
          dataset: { label: adminStrings.get('members_table_header_kennitala') }
        }, maskKennitala(member.kennitala)),
        // Actions - Use django_id in URL for security (kennitala is sensitive)
        el('td', 'members-table__cell members-table__cell--actions', {},
          el('a', 'members-table__action', {
            href: `/admin/member-profile.html?id=${member.metadata?.django_id || member.kennitala}`
          }, adminStrings.get('members_btn_view')),
          el('button', 'members-table__action members-table__action--danger', {
            type: 'button',
            onclick: () => showDeleteConfirmModal(member)
          }, 'Eyða')
        )
      );

      elements.tableBody.appendChild(row);
    });
  }

  /**
   * Show delete confirmation modal for a member
   */
  function showDeleteConfirmModal(member) {
    const memberName = member.name || 'Óþekktur';
    const djangoId = member.metadata?.django_id || member.django_id;
    let modal = null;

    if (!djangoId) {
      showToast('Django ID vantar - ekki hægt að eyða', 'error');
      return;
    }

    const content = document.createElement('div');
    content.innerHTML = `
      <div class="modal__message">
        <p><strong>Ertu viss um að þú viljir eyða ${memberName}?</strong></p>
        <ul style="margin: 1rem 0; padding-left: 1.5rem; color: var(--color-text-muted);">
          <li>Félaginn verður ekki lengur sýnilegur í félagaskrá</li>
          <li>Félaginn getur ekki tekið þátt í kosningum</li>
          <li>Hægt er að endurvirkja félagann seinna</li>
        </ul>
        <p style="margin-top: 1rem;"><strong>Skrifaðu "EYÐA" til að staðfesta:</strong></p>
        <input type="text" id="confirm-delete-input" class="profile-field__input" placeholder="EYÐA" style="margin-top: 0.5rem; width: 100%;">
      </div>
    `;

    modal = showModal({
      title: '🗑️ Eyða félaga',
      content,
      size: 'md',
      buttons: [
        {
          text: 'Hætta við',
          onClick: () => modal.close()
        },
        {
          text: 'Eyða félaga',
          primary: false,
          onClick: async () => {
            await handleDeleteMember(modal, djangoId, memberName);
          }
        }
      ]
    });

    // Setup confirmation input validation
    setTimeout(() => {
      const confirmInput = document.getElementById('confirm-delete-input');
      const buttons = modal.element.querySelectorAll('.modal__footer .btn');
      const confirmBtn = buttons[buttons.length - 1];

      if (confirmBtn) {
        confirmBtn.classList.remove('btn--secondary');
        confirmBtn.classList.add('btn--danger');
        confirmBtn.disabled = true;
      }

      if (confirmInput) {
        confirmInput.addEventListener('input', () => {
          const isValid = confirmInput.value.toUpperCase() === 'EYÐA';
          if (confirmBtn) confirmBtn.disabled = !isValid;
        });
        confirmInput.focus();
      }
    }, 100);
  }

  /**
   * Handle member deletion from list
   */
  async function handleDeleteMember(modal, djangoId, memberName) {
    const confirmInput = document.getElementById('confirm-delete-input');
    if (!confirmInput || confirmInput.value.toUpperCase() !== 'EYÐA') {
      showToast('Vinsamlegast sláðu inn "EYÐA" til að staðfesta', 'error');
      return;
    }

    const buttons = modal.element.querySelectorAll('.modal__footer .btn');
    const cancelBtn = buttons[0];
    const confirmBtn = buttons[1];
    const originalText = confirmBtn?.textContent;

    try {
      debug.log('🗑️ Initiating admin soft delete from list...', { djangoId });

      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `<span class="spinner spinner--small"></span> Eyði...`;
      }
      if (cancelBtn) cancelBtn.disabled = true;
      if (confirmInput) confirmInput.disabled = true;

      const result = await softDeleteAdminFunction({
        django_id: djangoId,
        confirmation: 'EYÐA'
      });

      debug.log('✅ Soft delete successful:', result);

      if (confirmBtn) {
        confirmBtn.innerHTML = `✅ Eytt`;
        confirmBtn.classList.remove('btn--danger');
        confirmBtn.classList.add('btn--success');
      }

      showToast(result.data.message || `${memberName} hefur verið eytt`, 'success');

      // Close modal and reload list
      setTimeout(() => {
        modal.close();
        // Reload the members list
        loadMembers();
      }, 1000);

    } catch (error) {
      debug.error('❌ Soft delete failed:', error);

      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = originalText;
      }
      if (cancelBtn) cancelBtn.disabled = false;
      if (confirmInput) confirmInput.disabled = false;

      showToast(error.message || 'Villa við eyðingu', 'error');
    }
  }

  // Update pagination controls
  function updatePagination(hasMore, currentCount) {
    // Update pagination info
    const start = (currentPage - 1) * 50 + 1;
    const end = (currentPage - 1) * 50 + currentCount;
    const showingTemplate = adminStrings.get('pagination_showing') || 'Sýni %d-%d';
    elements.paginationInfo.textContent = showingTemplate.replace('%d', start).replace('%d', end);

    // Update current page
    const pageTemplate = adminStrings.get('pagination_page') || 'Síða %d';
    elements.paginationCurrent.textContent = pageTemplate.replace('%d', currentPage);

    // Enable/disable previous button
    elements.btnPagePrev.disabled = currentPage === 1;

    // Enable/disable next button
    elements.btnPageNext.disabled = !hasMore;
  }

  // Get status text in Icelandic
  function getStatusText(status) {
    switch (status) {
      case 'active': return adminStrings.get('members_status_active') || 'Virkur';
      case 'unpaid': return adminStrings.get('members_status_unpaid') || 'Ógreitt';
      case 'inactive': return adminStrings.get('members_status_inactive') || 'Óvirkur';
      default: return adminStrings.get('members_status_unknown') || 'Óþekkt';
    }
  }

  // Print call list for selected municipality
  function printCallList() {
    const municipalityName = getMunicipalityName(currentMunicipality);
    const today = formatDateOnlyIcelandic(new Date());

    // Build address string from member data
    const getAddress = (member) => {
      // Try direct address object first (from listMembers API)
      const addr = member?.address || {};
      if (addr.street) {
        const parts = [addr.street];
        if (addr.number) parts[0] += ' ' + addr.number;
        if (addr.letter) parts[0] += addr.letter;
        if (addr.postal_code || addr.city) {
          parts.push([addr.postal_code, addr.city].filter(Boolean).join(' '));
        }
        return parts.join(', ');
      }
      // Fallback to addresses array (from getMember API)
      const addresses = member?.profile?.addresses || member?.addresses || [];
      const fallbackAddr = addresses.find(a => a.is_default || a.is_primary) || addresses[0];
      if (!fallbackAddr) return '-';
      const parts = [fallbackAddr.street || ''];
      if (fallbackAddr.number) parts[0] += ' ' + fallbackAddr.number;
      if (fallbackAddr.letter) parts[0] += fallbackAddr.letter;
      if (fallbackAddr.postal_code || fallbackAddr.city) {
        parts.push([fallbackAddr.postal_code, fallbackAddr.city].filter(Boolean).join(' '));
      }
      return parts.join(', ') || '-';
    };

    // Build table rows
    const rows = filteredMembersForPrint.map(m => `
      <tr>
        <td>${m.name || '-'}</td>
        <td>${formatPhone(m.phone) || '-'}</td>
        <td>${getAddress(m)}</td>
      </tr>
    `).join('');

    // Create print window
    // Note: document.write() is acceptable here - writing to a NEW blank window for printing,
    // not the main document. This is the standard pattern for print preview windows.
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="is">
      <head>
        <meta charset="UTF-8">
        <title>Úthringilisti - ${municipalityName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 5px; }
          .date { color: #666; font-size: 12px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background: #fafafa; }
          @media print {
            body { padding: 0; }
            h1 { font-size: 14pt; }
            table { font-size: 9pt; }
          }
        </style>
      </head>
      <body>
        <h1>Úthringilisti - ${municipalityName}</h1>
        <div class="date">Prentað: ${today} | Fjöldi: ${filteredMembersForPrint.length}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 30%">Nafn</th>
              <th style="width: 15%">Sími</th>
              <th style="width: 55%">Heimilisfang</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <script>window.onload = () => window.print();<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
