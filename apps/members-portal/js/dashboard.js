/**
 * Dashboard Page Logic
 *
 * Main dashboard for authenticated members. Displays welcome message,
 * quick links to other pages, and membership verification status.
 *
 * New architecture:
 * - Uses firebase/app.js for Firebase services (single import point)
 * - Uses session/init.js for authentication (pure data)
 * - Uses ui/nav.js + ui/dom.js for DOM manipulation (validated)
 * - Testable pure functions separated from side effects
 *
 * @module dashboard
 */

import { R } from '../i18n/strings-loader.js';
import { debug } from './utils/util-debug.js';
import { initAuthenticatedPage } from './page-init.js';
import { requireAuth, getUserData, signOut, AuthenticationError } from '../session/auth.js';
import { requireMember } from './rbac.js';
import { httpsCallable, getFirebaseAuth, getFirebaseFirestore } from '../firebase/app.js';
import { setTextContent, setInnerHTML, addEventListener, setDisabled, validateElements } from '../ui/dom.js';
import { formatPhone, normalizePhoneForComparison, formatDateWithDayIcelandic, getNextRecurringOccurrence } from './utils/util-format.js';
import { updateMemberProfile } from './api/api-members.js';
import { createButton } from './components/ui-button.js';
import { showModal } from './components/ui-modal.js';
import { showToast } from './components/ui-toast.js';
import { SERVICES } from './config/config.js';
import { initMemberAssistantChat } from './components/member-assistant-chat.js';
import { initAutoTracking, trackAction } from './utils/util-analytics.js';

/**
 * Nomination committee member UIDs
 * These users can see the nomination/uppstilling link on the dashboard
 */
const NOMINATION_COMMITTEE_UIDS = [
  'NE5e8GpzzBcjxuTHWGuJtTfevPD2',
  'VNu6MunXCCV9USkDmWBAAQreaIs1',
  'YYcjrF7HZ4VoFkwLdnrlWdlVWq23',
  'ZTUkKGZxneXY7TLRLwHhe74cvGb2',
  'mxK7v6CefxMB0NBTxPdiMO7Nh6C3',
  'KIe8gk1B4NRTQFzSbwTgMVipXGq1'
];

/**
 * Required DOM elements for dashboard page
 */
const DASHBOARD_ELEMENTS = [
  'welcome-title',
  'quick-link-profile-label',
  'quick-link-profile-desc',
  'quick-link-events-label',
  'quick-link-events-desc',
  'quick-link-voting-label',
  'quick-link-voting-desc',
  'quick-link-policy-label',
  'quick-link-policy-desc'
];

/**
 * Validate dashboard DOM structure
 *
 * @throws {Error} If required elements are missing
 */
function validateDashboard() {
  validateElements(DASHBOARD_ELEMENTS, 'dashboard page');
}

/**
 * Update all dashboard-specific UI strings
 *
 * Uses R.string for i18n localization.
 */
function updateDashboardStrings() {
  // Set page title
  document.title = R.string.page_title_dashboard;

  // Update quick links
  setTextContent('quick-link-profile-label', R.string.quick_links_profile_label, 'dashboard');
  setTextContent('quick-link-profile-desc', R.string.quick_links_profile_desc, 'dashboard');
  setTextContent('quick-link-events-label', R.string.quick_links_events_label, 'dashboard');
  setTextContent('quick-link-events-desc', R.string.quick_links_events_desc, 'dashboard');
  setTextContent('quick-link-voting-label', R.string.quick_links_voting_label, 'dashboard');
  setTextContent('quick-link-voting-desc', R.string.quick_links_voting_desc, 'dashboard');
  setTextContent('quick-link-policy-label', R.string.quick_links_policy_label, 'dashboard');
  setTextContent('quick-link-policy-desc', R.string.quick_links_policy_desc, 'dashboard');
}

function buildWelcomeMessage(displayName) {
  const fallbackName = R.string.dashboard_default_name;
  const rawName = (displayName || fallbackName).trim();
  const parts = rawName.split(/\s+/);
  const lastPart = parts.length ? parts[parts.length - 1] : '';
  const normalizedLast = lastPart
    ? lastPart.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    : '';

  let template = R.string.dashboard_welcome_neutral;
  if (normalizedLast.endsWith('son')) {
    template = R.string.dashboard_welcome_male;
  } else if (normalizedLast.endsWith('dottir')) {
    template = R.string.dashboard_welcome_female;
  }

  return R.format(template, rawName);
}

function renderRoleBadges(roles) {
  const normalizedRoles = Array.isArray(roles) ? roles.filter(Boolean) : [];
  if (normalizedRoles.length === 0) {
    return '';
  }

  const badges = normalizedRoles.map((role) => {
    const key = `role_badge_${role}`;
    const label = R.string[key] || role;

    // Admin → Member management dashboard (red)
    if (role === 'admin') {
      return `<a href="/admin/" class="role-badge role-badge--admin role-badge--button" title="${R.string.role_badge_title_open_member_admin}">${label}</a>`;
    }

    // Superuser → Superuser console (blue)
    if (role === 'superuser') {
      return `<a href="/superuser/" class="role-badge role-badge--superuser role-badge--button" title="${R.string.role_badge_title_open_superuser_console || 'Opna kerfisstjórn'}">${label}</a>`;
    }

    return `<span class="role-badge role-badge--button">${label}</span>`;
  }).join('');

  return `
    <span class="role-badges__label">${R.string.dashboard_roles_label}</span>
    <div class="role-badges__list">${badges}</div>
  `;
}

/**
 * Render role-based quick links for admin/superuser
 * Shows as prominent cards above the Quick Links section
 */
function renderRoleQuickLinks(roles) {
  const normalizedRoles = Array.isArray(roles) ? roles.filter(Boolean) : [];
  const links = [];

  // Superuser gets first position (blue)
  if (normalizedRoles.includes('superuser')) {
    links.push(`
      <a href="/superuser/" class="admin-link admin-link--superuser">
        <span class="admin-link__icon">🔧</span>
        <div class="admin-link__content">
          <div class="admin-link__title">Kerfisstjórn</div>
          <div class="admin-link__desc">Kerfisstillingar og yfirlit</div>
        </div>
      </a>
    `);
  }

  // Admin gets second position (red)
  if (normalizedRoles.includes('admin')) {
    links.push(`
      <a href="/admin/" class="admin-link admin-link--admin">
        <span class="admin-link__icon">👥</span>
        <div class="admin-link__content">
          <div class="admin-link__title">Stjórnandi</div>
          <div class="admin-link__desc">Umsjá félagaskrár</div>
        </div>
      </a>
    `);
  }

  return links.join('');
}

function updateRoleBadges(roles) {
  const container = document.getElementById('role-badges');
  if (!container) {
    return;
  }

  const html = renderRoleBadges(roles);
  if (!html) {
    container.innerHTML = '';
    container.classList.add('u-hidden');
    return;
  }

  container.innerHTML = html;
  container.classList.remove('u-hidden');
}

/**
 * Update role-based quick links in the Quick Links section
 */
function updateRoleQuickLinks(roles) {
  const container = document.getElementById('quick-links-roles');
  if (!container) {
    return;
  }

  const html = renderRoleQuickLinks(roles);
  container.innerHTML = html;
}

/**
 * Show nomination link for committee members only
 * @param {string} uid - Current user's Firebase UID
 */
function updateNominationLink(uid) {
  const nominationLink = document.getElementById('quick-link-nomination');
  if (!nominationLink) {
    return;
  }

  if (NOMINATION_COMMITTEE_UIDS.includes(uid)) {
    nominationLink.style.display = '';
    debug.log('Nomination link shown for committee member:', uid);
  }
}

/**
 * localStorage key for suppressing profile discrepancy check
 */
const PROFILE_CHECK_SUPPRESSED_KEY = 'profile_discrepancy_suppressed_until';
const SUPPRESS_DURATION_DAYS = 90;

/**
 * Check if profile discrepancy check is suppressed
 * @returns {boolean} True if check should be skipped
 */
function isProfileCheckSuppressed() {
  const suppressedUntil = localStorage.getItem(PROFILE_CHECK_SUPPRESSED_KEY);
  if (!suppressedUntil) return false;

  const suppressedDate = new Date(suppressedUntil);
  if (isNaN(suppressedDate.getTime())) return false;

  return new Date() < suppressedDate;
}

/**
 * Suppress profile discrepancy check for N days
 */
function suppressProfileCheck() {
  const suppressUntil = new Date();
  suppressUntil.setDate(suppressUntil.getDate() + SUPPRESS_DURATION_DAYS);
  localStorage.setItem(PROFILE_CHECK_SUPPRESSED_KEY, suppressUntil.toISOString());
  debug.log(`Profile check suppressed until ${suppressUntil.toISOString()}`);
}

/**
 * Check for discrepancies between Kenni.is data (userData) and Cloud SQL member data
 *
 * Compares:
 * - Full name
 * - Email
 * - Phone number
 *
 * If differences found, prompts user to update Cloud SQL (source of truth).
 *
 * @param {Object} userData - User data from Firebase Auth token (Kenni.is claims)
 * @returns {Promise<void>}
 */
async function checkProfileDiscrepancies(userData) {
  try {
    // Check if user has suppressed this check
    if (isProfileCheckSuppressed()) {
      debug.log('Profile discrepancy check suppressed by user');
      return;
    }

    // Get member data from Cloud SQL via getMemberSelf Cloud Function
    const getMemberSelfFn = httpsCallable('getMemberSelf', 'europe-west2');
    const result = await getMemberSelfFn();

    if (!result.data?.member) {
      debug.log('No member data returned from SQL - skipping profile check');
      return;
    }

    const memberData = result.data.member;
    const memberProfile = memberData.profile || {};

    // Compare fields
    const discrepancies = [];

    // Name comparison
    if (userData.displayName && memberProfile.name !== userData.displayName) {
      discrepancies.push({
        field: 'name',
        label: R.string.nav_profile, // "Prófíll" - we reuse this for "Nafn"
        kenni: userData.displayName,
        members: memberProfile.name || R.string.profile_empty_value
      });
    }

    // Email comparison
    if (userData.email && memberProfile.email !== userData.email) {
      discrepancies.push({
        field: 'email',
        label: R.string.profile_email_label, // From existing strings
        kenni: userData.email,
        members: memberProfile.email || R.string.profile_empty_value
      });
    }

    // Phone comparison (normalize format - remove spaces/dashes/country code)
    // Use shared utility to handle +354 prefix from Kenni.is
    const kenniPhone = normalizePhoneForComparison(userData.phoneNumber);
    const membersPhone = normalizePhoneForComparison(memberProfile.phone);

    if (kenniPhone && kenniPhone !== membersPhone) {
      discrepancies.push({
        field: 'phone',
        label: R.string.profile_phone_label,
        // Format both for display (XXX-XXXX)
        kenni: formatPhone(userData.phoneNumber),
        members: formatPhone(memberProfile.phone) || R.string.profile_empty_value
      });
    }

    // If discrepancies found, show modal
    if (discrepancies.length > 0) {
      debug.log('Profile discrepancies found:', discrepancies);
      await showProfileUpdateModal(discrepancies, userData, memberData);
    }

  } catch (error) {
    debug.error('Error checking profile discrepancies:', error);
    // Don't block dashboard load on error
  }
}

/**
 * Show modal dialog for profile update confirmation
 *
 * @param {Array} discrepancies - Array of field discrepancies
 * @param {Object} userData - Current user data from Kenni.is
 * @param {Object} memberData - Current member data from Firestore
 * @returns {Promise<boolean>} Whether user confirmed update
 */
async function showProfileUpdateModal(discrepancies, userData, memberData) {
  // Build discrepancies list HTML with suppress checkbox
  const suppressLabel = R.string.profile_update_suppress;
  const discrepanciesHtml = `
    <p>${R.string.profile_update_description}</p>
    <div class="profile-discrepancies">
      ${discrepancies.map(d => `
        <div class="profile-discrepancy">
          <div class="profile-discrepancy__label">${d.label}:</div>
          <div class="profile-discrepancy__values">
            <div class="profile-discrepancy__old">
              <strong>${R.string.profile_discrepancy_old_label}</strong> ${d.members}
            </div>
            <div class="profile-discrepancy__new">
              <strong>${R.string.profile_discrepancy_new_label}</strong> ${d.kenni}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <label class="profile-suppress-checkbox">
      <input type="checkbox" id="suppress-profile-check" />
      <span>${suppressLabel}</span>
    </label>
  `;

  // Return promise that resolves when user makes choice
  return new Promise((resolve) => {
    let isUpdating = false;

    // Show modal with buttons
    const modal = showModal({
      title: R.string.profile_update_title,
      content: discrepanciesHtml,
      size: 'md',
      closeOnOverlay: false, // Don't close on overlay click during update
      buttons: [
        {
          text: R.string.profile_update_cancel,
          onClick: () => {
            if (!isUpdating) {
              // Check if user wants to suppress future checks
              const suppressCheckbox = document.getElementById('suppress-profile-check');
              if (suppressCheckbox?.checked) {
                suppressProfileCheck();
              }
              modal.close();
              resolve(false);
            }
          }
        },
        {
          text: R.string.profile_update_confirm,
          primary: true,
          onClick: async (event) => {
            const button = event.target;

            // Prevent double-click
            if (isUpdating) return;

            isUpdating = true;
            button.disabled = true;
            button.textContent = R.string.profile_updating;

            try {
              // Update both Firestore and Django
              await updateProfileData(userData, discrepancies, memberData);

              // Close modal
              modal.close();

              // Show success toast
              showToast(R.string.profile_updated_success, 'success');

              resolve(true);
            } catch (error) {
              debug.error('Failed to update profile:', error);

              // Show error toast
              const errorMessage = R.string.profile_update_error.replace('%s', error.message || error);
              showToast(errorMessage, 'error', { duration: 5000 });

              // Re-enable button
              button.disabled = false;
              button.textContent = R.string.profile_update_confirm;
              isUpdating = false;

              resolve(false);
            }
          }
        }
      ]
    });
  });
}

/**
 * Update profile data in both Firestore and Django backend
 *
 * @param {Object} userData - User data from Kenni.is (source of truth)
 * @param {Array} discrepancies - List of fields that need updating
 * @param {Object} memberData - Current member data from Firestore (for rollback)
 * @returns {Promise<void>}
 */
async function updateProfileData(userData, discrepancies, memberData = {}) {
  const kennitala = userData.kennitala.replace(/-/g, '');

  // Build update data from discrepancies
  const updates = {};
  discrepancies.forEach(d => {
    if (d.field === 'name') updates.name = userData.displayName;
    if (d.field === 'email') updates.email = userData.email;
    if (d.field === 'phone') updates.phone = userData.phoneNumber;
  });

  // Update both Firestore and Django using shared client
  // (includes automatic rollback if Django fails)
  await updateMemberProfile(kennitala, updates, memberData);
}

// Events API configuration - from js/config/config.js
const EVENTS_API_BASE = SERVICES.EVENTS;

// ============================================================================
// LOCAL STORAGE CACHE - Persistent (no PII - public event data)
// ============================================================================
const CACHE_KEY = 'dashboard_featured_event_cache';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached featured event from localStorage
 * Safe to use localStorage - public Facebook event data, no PII.
 * @returns {Object|null} { data, isStale } or null if no cache
 */
function getFeaturedEventCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    return {
      data,
      isStale: age > CACHE_MAX_AGE_MS
    };
  } catch (e) {
    debug.warn('[Cache] Failed to read featured event cache:', e);
    return null;
  }
}

/**
 * Save featured event to localStorage cache
 * @param {Object} event - Event to cache (or null if no event)
 */
function setFeaturedEventCache(event) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: event,
      timestamp: Date.now()
    }));
    debug.log('[Cache] Featured event cached:', event?.title || 'null');
  } catch (e) {
    debug.warn('[Cache] Failed to write featured event cache:', e);
  }
}

/**
 * Display featured event in the card
 * @param {Object} event - Event to display
 */
function displayFeaturedEvent(event) {
  if (!event) return;

  // Check for recurring events and use next occurrence date
  const nextOccurrence = getNextRecurringOccurrence(event);
  const dateToShow = nextOccurrence || new Date(event.startTime);

  // Format date in Icelandic using central formatter
  const formattedDate = formatDateWithDayIcelandic(dateToShow);

  // Get location
  const location = event.location?.display || event.location?.name || '';

  // Build content
  const card = document.getElementById('featured-event-card');
  const content = document.getElementById('featured-event-content');

  if (!card || !content) return;

  content.innerHTML = `
    <a href="/events/" style="text-decoration: none; color: inherit;">
      <div style="font-weight: 600; font-size: 1rem; margin-bottom: 0.25rem;">${event.title}</div>
      <div style="color: var(--color-text-secondary); font-size: 0.875rem;">
        ${formattedDate}
      </div>
      ${location ? `<div style="color: var(--color-text-secondary); font-size: 0.875rem;">📍 ${location}</div>` : ''}
    </a>
  `;

  card.style.display = 'block';
  debug.log('Featured event displayed:', event.title);
}

/**
 * Fetch featured event from API
 * @returns {Promise<Object|null>} Event or null
 */
async function fetchFeaturedEvent() {
  let event = null;

  // Try to get admin-selected featured event first
  const featuredResponse = await fetch(`${EVENTS_API_BASE}/api/external-events/featured`);
  if (featuredResponse.ok) {
    const data = await featuredResponse.json();
    if (data.featured) {
      event = data.featured;
      debug.log('Using admin-selected featured event:', event.title);
    }
  }

  // Fallback to next upcoming OR ongoing event if no featured event
  if (!event) {
    const allEventsResponse = await fetch(`${EVENTS_API_BASE}/api/external-events`);
    if (allEventsResponse.ok) {
      const events = await allEventsResponse.json();
      // Filter for upcoming or ongoing events, sort by next relevant date
      // For ongoing recurring events, use next occurrence; for upcoming, use startTime
      const getRelevantDate = (e) => {
        if (e.isOngoing) {
          const nextOccurrence = getNextRecurringOccurrence(e);
          if (nextOccurrence) return nextOccurrence;
        }
        return new Date(e.startTime);
      };
      const upcomingOrOngoing = events
        .filter(e => e.isUpcoming || e.isOngoing)
        .sort((a, b) => getRelevantDate(a) - getRelevantDate(b));

      if (upcomingOrOngoing.length > 0) {
        event = upcomingOrOngoing[0];
        debug.log('Using next upcoming/ongoing event:', event.title);
      }
    }
  }

  return event;
}

/**
 * Load and display featured event on dashboard
 * Uses localStorage cache for instant display on repeat visits
 *
 * Priority:
 * 1. Admin-selected featured event (from /api/external-events/featured)
 * 2. Next upcoming event (fallback)
 *
 * Non-blocking - if it fails, dashboard still works
 *
 * @param {boolean} backgroundRefresh - If true, don't show if no cache
 */
async function loadFeaturedEvent(backgroundRefresh = false) {
  try {
    // Check cache first
    const cached = getFeaturedEventCache();

    if (cached?.data && !backgroundRefresh) {
      debug.log('[Cache] Showing cached featured event');
      displayFeaturedEvent(cached.data);

      // If cache is stale, refresh in background
      if (cached.isStale) {
        debug.log('[Cache] Cache stale, refreshing in background');
        loadFeaturedEvent(true).catch(err => {
          debug.warn('[Cache] Background refresh failed:', err);
        });
      }
      return;
    }

    // Fetch from API
    const event = await fetchFeaturedEvent();

    // Cache the result (even if null)
    setFeaturedEventCache(event);

    // Display if we have an event
    if (event) {
      displayFeaturedEvent(event);
    }
  } catch (error) {
    debug.warn('Failed to load featured event:', error.message);
    // Non-blocking - dashboard still works without featured event
  }
}

/**
 * Initialize dashboard page
 *
 * New architecture - clear separation:
 * 1. Validate DOM structure (fail fast with helpful errors)
 * 2. Load i18n and initialize page
 * 3. Fetch user data
 * 4. Update UI (explicit DOM manipulation)
 * 5. Setup event handlers
 *
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Validate DOM structure before doing anything
    validateDashboard();

    // Load i18n strings (note: initAuthenticatedPage also calls R.load, but explicit here)
    await R.load('is');
    
    // Translate elements with data-i18n attributes
    R.translatePage();

    // Initialize page: auth check, nav setup, logout handler
    await initAuthenticatedPage();

    // Get authenticated user
    const currentUser = await requireAuth();

    // Check member role (required for member area access)
    try {
      await requireMember();
    } catch (error) {
      debug.error('Member role required:', error);
      alert(R.string.error_must_be_member);
      window.location.href = '/';
      return;
    }

    // Get user data from custom claims
    const userData = await getUserData(currentUser);

    // Update dashboard-specific UI
    updateDashboardStrings();

    // Update welcome message with user's name
    const welcomeText = buildWelcomeMessage(userData.displayName);
    setTextContent('welcome-title', welcomeText, 'dashboard');

    // Show role-based quick links (admin/superuser)
    updateRoleQuickLinks(userData.roles);

    // Show nomination link for committee members
    updateNominationLink(currentUser.uid);

    // Load featured event (non-blocking)
    loadFeaturedEvent();

    // Initialize member assistant chat widget
    initMemberAssistantChat();

    // Initialize analytics tracking (excludes admins on backend)
    initAutoTracking();

    // Check for profile data discrepancies between Kenni.is and Firestore
    await checkProfileDiscrepancies(userData);

  } catch (error) {
    // Handle authentication error (redirect to login)
    if (error instanceof AuthenticationError) {
      window.location.href = error.redirectTo;
      return;
    }

    // Other errors
    debug.error('Dashboard initialization failed:', error);
  }
}

// Run initialization
init();
