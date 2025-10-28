/**
 * Member Detail Page - Epic #116, Issue #136
 *
 * Displays read-only view of member information from Firestore.
 */

// Import from member portal public directory
import { getFirebaseAuth, getFirebaseFirestore } from '../../firebase/app.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize Firebase services
const auth = getFirebaseAuth();
const db = getFirebaseFirestore();

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

  // Initialize page
  async function init() {
    // Initialize DOM elements
    initElements();

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
      const hasAdminAccess = roles.includes('admin') || roles.includes('developer');

      if (!hasAdminAccess) {
        showError('Þú hefur ekki réttindi til að skoða þessa síðu');
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
        if (name) R.string[name] = value;
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
    showLoading();

    try {
      const docRef = doc(db, 'members', currentKennitala);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        showNotFound();
        return;
      }

      memberData = docSnap.data();
      renderMemberDetail(memberData);
      showDetails();

    } catch (error) {
      console.error('Error loading member:', error);
      showError('Villa kom upp við að hlaða félaga. Vinsamlegast reyndu aftur.');
    }
  }

  // Render member detail
  function renderMemberDetail(data) {
    // Basic Info
    setText('value-name', data.profile?.name || '-');
    setText('value-kennitala', maskKennitala(data.profile?.kennitala || currentKennitala));
    setText('value-email', data.profile?.email || '-');
    setText('value-phone', data.profile?.phone || '-');
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
      statusBadge.className = `member-detail__status-badge member-detail__status-badge--${status}`;
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

  // Mask kennitala (show birthdate, mask personal identifier)
  function maskKennitala(kennitala) {
    if (!kennitala) return '-';
    if (kennitala.length < 11) return kennitala;
    return kennitala.slice(0, 7) + '****';
  }

  // Format date (YYYY-MM-DD → DD. Month YYYY)
  function formatDate(dateString) {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      const months = [
        'janúar', 'febrúar', 'mars', 'apríl', 'maí', 'júní',
        'júlí', 'ágúst', 'september', 'október', 'nóvember', 'desember'
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
      case 'active': return 'Virkur';
      case 'inactive': return 'Óvirkur';
      default: return 'Óþekkt';
    }
  }

  // Show loading state
  function showLoading() {
    elements.loading.style.display = 'block';
    elements.error.style.display = 'none';
    elements.notFound.style.display = 'none';
    elements.details.style.display = 'none';
  }

  // Show error state
  function showError(message) {
    elements.loading.style.display = 'none';
    elements.error.style.display = 'block';
    elements.notFound.style.display = 'none';
    elements.details.style.display = 'none';
    elements.errorMessage.textContent = message;
  }

  // Show not found state
  function showNotFound() {
    elements.loading.style.display = 'none';
    elements.error.style.display = 'none';
    elements.notFound.style.display = 'block';
    elements.details.style.display = 'none';
  }

  // Show details
  function showDetails() {
    elements.loading.style.display = 'none';
    elements.error.style.display = 'none';
    elements.notFound.style.display = 'none';
    elements.details.style.display = 'block';
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
