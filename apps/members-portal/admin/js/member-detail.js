/**
 * Member Detail Page - Epic #116, Issue #136
 *
 * Displays read-only view of member information from Firestore.
 */

// Import from member portal public directory
import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { formatPhone, maskKennitala } from '../../js/utils/format.js';
import { createMemberPageStates } from './utils/ui-states.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

// Global i18n storage
const adminStrings = new Map();

(function() {
  'use strict';

  // State
  let currentKennitala = null;
  let memberData = null;

  // DOM Elements
  const elements = {
    loading: null,
    error: null,
    notFound: null,
    details: null,
    errorMessage: null,
    btnRetry: null,
    btnEdit: null
  };

  // UI State Manager
  let uiStates = null;

  // Initialize page
  async function init() {
    // Initialize DOM elements
    initElements();

    // Initialize UI state manager
    uiStates = createMemberPageStates(elements);

    // Load i18n strings early
    await loadStrings();

    // Get kennitala from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentKennitala = urlParams.get('id');

    if (!currentKennitala) {
      // No kennitala in URL - redirect to members list
      window.location.href = '/admin/members.html';
      return;
    }

    // Check authentication
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = '/login.html';
        return;
      }

      // Check admin or developer role
      const token = await user.getIdTokenResult();
      const roles = token.claims.roles || [];
      const hasAdminAccess = roles.includes('admin') || roles.includes('superuser');

      if (!hasAdminAccess) {
        uiStates.showError(adminStrings.get('error_permission_denied'));
        return;
      }

      // Set up event listeners
      setupEventListeners();

      // Load member data
      await loadMemberDetail();
    });
  }

  // Initialize DOM element references
  function initElements() {
    elements.loading = document.getElementById('member-loading');
    elements.error = document.getElementById('member-error');
    elements.notFound = document.getElementById('member-not-found');
    elements.details = document.getElementById('member-details');
    elements.errorMessage = document.getElementById('member-error-message');
    elements.btnRetry = document.getElementById('btn-retry');
    elements.btnEdit = document.getElementById('btn-edit-member');
  }

  // Load i18n strings
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
    }
  }

  // Apply i18n strings to DOM elements
  function applyStrings(R) {
    if (!R || !R.string) return;

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

    // Page strings
    const pageTitle = document.getElementById('page-header-title');
    if (pageTitle) pageTitle.textContent = R.string.member_detail_title || 'Félagsupplýsingar';

    const pageSubtitle = document.getElementById('page-header-subtitle');
    if (pageSubtitle) pageSubtitle.textContent = R.string.member_detail_subtitle || 'Skoða upplýsingar um félaga';

    // Section titles
    const sectionBasic = document.getElementById('section-basic-info');
    if (sectionBasic) sectionBasic.textContent = R.string.member_detail_basic_info || 'Grunnupplýsingar';

    const sectionAddress = document.getElementById('section-address');
    if (sectionAddress) sectionAddress.textContent = R.string.member_detail_address || 'Heimilisfang';

    const sectionMembership = document.getElementById('section-membership');
    if (sectionMembership) sectionMembership.textContent = R.string.member_detail_membership || 'Félagsaðild';

    const sectionMetadata = document.getElementById('section-metadata');
    if (sectionMetadata) sectionMetadata.textContent = R.string.member_detail_metadata || 'Kerfisgögn';
  }

  // Set up event listeners
  function setupEventListeners() {
    // Retry button
    elements.btnRetry?.addEventListener('click', () => {
      loadMemberDetail();
    });

    // Edit button
    elements.btnEdit?.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentKennitala) {
        window.location.href = `/admin/member-edit.html?id=${currentKennitala}`;
      }
    });

    // Logout
    const navLogout = document.getElementById('nav-logout');
    navLogout?.addEventListener('click', async (e) => {
      e.preventDefault();
      await auth.signOut();
      window.location.href = '/login.html';
    });
  }

  // Load member detail from Firestore
  async function loadMemberDetail() {
    uiStates.showLoading();

    try {
      const docRef = doc(db, 'members', currentKennitala);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        uiStates.show('notFound');
        return;
      }

      memberData = docSnap.data();
      renderMemberDetail(memberData);
      uiStates.showContent();

    } catch (error) {
      console.error('Error loading member:', error);
      uiStates.showError(adminStrings.get('member_detail_error'));
    }
  }

  // Render member detail
  function renderMemberDetail(data) {
    // Basic Info
    setText('value-name', data.profile?.name || '-');
    setText('value-kennitala', maskKennitala(data.profile?.kennitala || currentKennitala));
    setText('value-email', data.profile?.email || '-');
    // Format phone for display (XXX-XXXX)
    setText('value-phone', formatPhone(data.profile?.phone) || '-');
    setText('value-birthday', formatDate(data.profile?.birthday) || '-');

    // Address
    const address = data.address || {};
    const street = address.street || '-';
    const number = address.number || '';
    const streetFull = number ? `${street} ${number}` : street;
    setText('value-street', streetFull);
    setText('value-postal-code', address.postal_code || '-');
    setText('value-city', address.city || '-');

    // Membership
    const status = data.membership?.status || 'unknown';
    const statusBadge = document.getElementById('status-badge');
    if (statusBadge) {
      statusBadge.textContent = getStatusText(status);
      // Map status to admin badge modifiers
      const badgeModifier = status === 'active' ? 'success' : status === 'inactive' ? 'error' : 'neutral';
      statusBadge.className = `admin-badge admin-badge--${badgeModifier}`;
    }
    setText('value-joined', formatDate(data.membership?.joined) || '-');

    // Metadata
    setText('value-django-id', data.metadata?.django_id || '-');
    setText('value-synced-at', formatDateTime(data.metadata?.synced_at) || '-');
  }

  // Helper: Set text content
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // Format date (YYYY-MM-DD → DD. Month YYYY)
  function formatDate(dateString) {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const months = [
        adminStrings.get('month_january'),
        adminStrings.get('month_february'),
        adminStrings.get('month_march'),
        adminStrings.get('month_april'),
        adminStrings.get('month_may'),
        adminStrings.get('month_june'),
        adminStrings.get('month_july'),
        adminStrings.get('month_august'),
        adminStrings.get('month_september'),
        adminStrings.get('month_october'),
        adminStrings.get('month_november'),
        adminStrings.get('month_december')
      ];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}. ${month} ${year}`;
    } catch (e) {
      return dateString;
    }
  }

  // Format datetime (ISO string → DD. Month YYYY, HH:MM)
  function formatDateTime(dateString) {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const dateFormatted = formatDate(dateString);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${dateFormatted}, ${hours}:${minutes}`;
    } catch (e) {
      return dateString;
    }
  }

  // Get status text in Icelandic
  function getStatusText(status) {
    switch (status) {
      case 'active': return adminStrings.get('members_status_active') || 'Virkur';
      case 'inactive': return adminStrings.get('members_status_inactive') || 'Óvirkur';
      default: return adminStrings.get('members_status_unknown') || 'Óþekkt';
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
