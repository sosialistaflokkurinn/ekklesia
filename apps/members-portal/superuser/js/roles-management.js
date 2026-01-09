/**
 * Role Management - Superuser Console
 *
 * Frontend for managing user roles. Superusers can search for members
 * and change their roles (member, admin, superuser).
 *
 * Module cleanup not needed - page reloads on navigation.
 *
 * Backend Status:
 * ✅ setUserRole - IMPLEMENTED (superuser_functions.py)
 * ✅ getUserRole - IMPLEMENTED (superuser_functions.py)
 * ✅ loadElevatedUsers - Uses Firestore /users/ collection query
 */

import { initSession, showAuthenticatedContent } from '../../session/init.js';
import { AuthenticationError } from '../../session/auth.js';
import { debug } from '../../js/utils/util-debug.js';
import {
  getFirebaseFirestore,
  httpsCallable,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc
} from '../../firebase/app.js';
import { requireSuperuser, ROLES } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { showModal } from '../../js/components/ui-modal.js';
import { R } from '../../i18n/strings-loader.js';
import { superuserStrings } from '../../i18n/superuser-strings.js';
import { escapeHTML, formatKennitala as formatKennitalaUtil } from '../../js/utils/util-format.js';

// Use centralized functions from util-format.js
const escapeHtml = escapeHTML;
const formatKennitala = (kt) => formatKennitalaUtil(kt) || '-';

const db = getFirebaseFirestore();

// ============================================================================
// SESSION STORAGE CACHE - Cleared on browser close for security
// ============================================================================
const CACHE_KEY = 'superuser_elevated_users_cache';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get cached elevated users from sessionStorage
 * Uses sessionStorage for security - PII data cleared when browser closes.
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
 * Save elevated users to sessionStorage cache
 * @param {Object} data - Elevated users data to cache
 */
function setCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
    debug.log('[Cache] Elevated users cached');
  } catch (e) {
    debug.warn('[Cache] Failed to write cache:', e);
  }
}

// State
let selectedMember = null;
let selectedRole = null;
let searchTimeout = null;

/**
 * Search members in Firestore
 * @param {string} searchTerm - Search term (name, email, or kennitala)
 * @returns {Promise<Array>} Array of matching members
 */
async function searchMembers(searchTerm) {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }

  try {
    const membersCol = collection(db, 'members');
    const members = [];

    // If search term looks like a kennitala (10 digits), search directly by document ID
    const cleanTerm = searchTerm.replace(/-/g, '');
    if (/^\d{10}$/.test(cleanTerm)) {
      // Direct lookup by kennitala (document ID)
      const memberDoc = await getDoc(doc(db, 'members', cleanTerm));
      if (memberDoc.exists()) {
        const data = memberDoc.data();
        members.push({
          id: memberDoc.id,
          kennitala: data.profile?.kennitala || memberDoc.id,
          name: data.profile?.name || '',
          email: data.profile?.email || '',
          firebaseUid: data.metadata?.firebase_uid || null
        });
      }
      return members;
    }

    // Load all active members for client-side search (same approach as admin/members.html)
    // For ~2,100 members this is acceptable (~500KB)
    // Include both 'active' (fees paid) and 'unpaid' (fees not paid) - both are valid members
    const constraints = [
      where('membership.status', 'in', ['active', 'unpaid']),
      orderBy('metadata.django_id', 'desc'),
      limit(5000)  // Load all for client-side filtering
    ];

    const q = query(membersCol, ...constraints);
    const snapshot = await getDocs(q);

    const searchLower = searchTerm.toLowerCase();

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const kennitala = data.profile?.kennitala || docSnap.id;

      // Skip test accounts
      if (kennitala.startsWith('9999')) return;

      const name = data.profile?.name || '';
      const email = data.profile?.email || '';

      // Client-side filter - match name, email, or kennitala
      if (
        name.toLowerCase().includes(searchLower) ||
        email.toLowerCase().includes(searchLower) ||
        kennitala.includes(searchTerm)
      ) {
        members.push({
          id: docSnap.id,
          kennitala,
          name,
          email,
          firebaseUid: data.metadata?.firebase_uid || null
        });
      }
    });

    return members.slice(0, 20); // Show up to 20 matching results
  } catch (error) {
    debug.error('Error searching members:', error);
    return [];
  }
}

/**
 * Get Firebase user info via getUserRole Cloud Function
 * @param {string} firebaseUid - User's Firebase UID (from members.metadata.firebase_uid)
 * @returns {Promise<Object|null>} User info with roles or null
 */
async function getFirebaseUserInfo(firebaseUid) {
  if (!firebaseUid) {
    debug.log('No Firebase UID provided');
    return null;
  }

  try {
    // Use Cloud Function to get user role (avoids Firestore permission issues)
    const getUserRole = httpsCallable('getUserRole', 'europe-west2');

    const result = await getUserRole({ target_uid: firebaseUid });
    const userData = result.data;

    debug.log('getUserRole result:', userData);

    return {
      uid: userData.uid,
      email: userData.email || '',
      roles: userData.roles || (userData.role ? [userData.role] : ['member']),  // Prefer roles array
      role: userData.role || 'member',  // Legacy fallback
      lastLogin: userData.lastSignIn || null
    };
  } catch (error) {
    debug.error('Error getting Firebase user info:', error);
    return null;
  }
}

/**
 * Render search results dropdown
 */
function renderSearchResults(members) {
  const resultsEl = document.getElementById('user-search-results');

  if (members.length === 0) {
    resultsEl.classList.add('u-hidden');
    return;
  }

  resultsEl.innerHTML = members.map(m => `
    <div class="user-search__result" data-kennitala="${m.kennitala}">
      <div class="user-search__name">${m.name}</div>
      <div class="user-search__email">${m.email || m.kennitala}</div>
    </div>
  `).join('');

  resultsEl.classList.remove('u-hidden');

  // Add click handlers
  resultsEl.querySelectorAll('.user-search__result').forEach(el => {
    el.addEventListener('click', () => {
      const kennitala = el.dataset.kennitala;
      const member = members.find(m => m.kennitala === kennitala);
      if (member) {
        selectMember(member);
      }
    });
  });
}

/**
 * Select a member and show their details
 */
async function selectMember(member) {
  selectedMember = member;
  selectedRole = null;

  // Hide search results
  document.getElementById('user-search-results').classList.add('u-hidden');
  document.getElementById('user-search-input').value = member.name;

  // Show selected user card
  const card = document.getElementById('selected-user-card');
  card.classList.remove('u-hidden');

  // Populate basic info
  document.getElementById('selected-user-name').textContent = member.name;
  document.getElementById('selected-user-email').textContent = member.email || '-';
  document.getElementById('selected-user-kennitala').textContent = formatKennitala(member.kennitala);

  // Get Firebase user info using the firebaseUid from member document
  const userInfo = await getFirebaseUserInfo(member.firebaseUid);

  if (userInfo) {
    document.getElementById('selected-user-uid').textContent = userInfo.uid;
    selectedMember.firebaseUid = userInfo.uid;
    // Use the full roles array and determine highest role
    const roles = userInfo.roles || ['member'];
    const highestRole = getHighestRole(roles);
    selectedMember.currentRoles = [highestRole];

    // Render current role (show highest)
    renderCurrentRoles([highestRole]);
  } else if (member.firebaseUid) {
    // Has UID but no user doc - show the UID anyway
    document.getElementById('selected-user-uid').textContent = member.firebaseUid;
    selectedMember.currentRoles = ['member'];
    renderCurrentRoles(['member']);
  } else {
    document.getElementById('selected-user-uid').textContent = superuserStrings.get('not_found');
    document.getElementById('current-roles').innerHTML = `
      <span class="role-badge role-badge--warning">${superuserStrings.get('not_registered_firebase')}</span>
    `;
  }

  // Reset role selector
  resetRoleSelector();
}

/**
 * Render current roles badges
 */
function renderCurrentRoles(roles) {
  const container = document.getElementById('current-roles');
  const normalizedRoles = Array.isArray(roles) ? roles : ['member'];

  container.innerHTML = normalizedRoles.map(role => {
    const label = R.string[`role_badge_${role}`] || role;
    let className = 'role-badge';

    if (role === 'superuser') className += ' role-badge--superuser';
    else if (role === 'admin') className += ' role-badge--admin';

    return `<span class="${className}">${label}</span>`;
  }).join(' ');
}

/**
 * Reset role selector to neutral state
 */
function resetRoleSelector() {
  document.querySelectorAll('.role-option').forEach(el => {
    el.classList.remove('role-option--selected');
  });
  document.getElementById('save-role-btn').disabled = true;
  selectedRole = null;
}

/**
 * Handle role option click
 */
function handleRoleSelect(role) {
  debug.log('handleRoleSelect called with role:', role, 'type:', typeof role);
  selectedRole = role;

  // Update UI
  document.querySelectorAll('.role-option').forEach(el => {
    el.classList.remove('role-option--selected');
    if (el.dataset.role === role) {
      el.classList.add('role-option--selected');
    }
  });

  // Enable save button if role is different from current
  const currentHighestRole = getHighestRole(selectedMember?.currentRoles || []);
  document.getElementById('save-role-btn').disabled = (role === currentHighestRole);
}

/**
 * Get highest role from roles array
 */
function getHighestRole(roles) {
  if (roles.includes('superuser')) return 'superuser';
  if (roles.includes('admin')) return 'admin';
  return 'member';
}

/**
 * Save role change
 */
async function saveRoleChange() {
  debug.log('saveRoleChange called, selectedRole:', selectedRole, 'selectedMember:', selectedMember?.firebaseUid);

  if (!selectedMember || !selectedRole) {
    debug.warn('saveRoleChange: Missing member or role', { selectedMember: !!selectedMember, selectedRole });
    return;
  }

  // Validate role before sending (match backend validation)
  const VALID_ROLES = ['member', 'admin', 'superuser'];
  if (typeof selectedRole !== 'string' || !VALID_ROLES.includes(selectedRole)) {
    debug.error('Invalid role selected:', selectedRole, 'type:', typeof selectedRole);
    showToast(`Villa: Ógilt hlutverk "${selectedRole}"`, 'error');
    return;
  }

  const currentHighest = getHighestRole(selectedMember.currentRoles || []);

  // Show confirmation modal
  const confirmed = await showConfirmationModal(
    selectedMember.name,
    currentHighest,
    selectedRole
  );

  if (!confirmed) return;

  // Check if user has Firebase UID
  if (!selectedMember.firebaseUid) {
    showToast(superuserStrings.get('user_not_registered_warning'), 'warning', { duration: 5000 });
    return;
  }

  const saveBtn = document.getElementById('save-role-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = superuserStrings.get('saving');

  try {
    // Call Cloud Function to change role
    const setUserRole = httpsCallable('setUserRole', 'europe-west2');

    const payload = {
      target_uid: selectedMember.firebaseUid,
      role: selectedRole
    };
    debug.log('Calling setUserRole with payload:', payload);

    const result = await setUserRole(payload);

    debug.log('Role change result:', result.data);

    showToast(superuserStrings.get('role_changed_success', { role: selectedRole }), 'success');

    // Invalidate cache since roles changed
    sessionStorage.removeItem(CACHE_KEY);

    // Update local state
    selectedMember.currentRoles = [selectedRole];
    renderCurrentRoles([selectedRole]);
    resetRoleSelector();

    // Refresh elevated users list
    loadElevatedUsers(true);

  } catch (error) {
    debug.error('Error changing role:', error);
    showToast(`Villa: ${error.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = superuserStrings.get('save');
  }
}

/**
 * Show confirmation modal for role change
 */
function showConfirmationModal(name, fromRole, toRole) {
  return new Promise(resolve => {
    const fromLabel = R.string[`role_badge_${fromRole}`] || fromRole;
    const toLabel = R.string[`role_badge_${toRole}`] || toRole;

    const modal = showModal({
      title: superuserStrings.get('confirm_role_change_title'),
      content: `
        <p>${superuserStrings.get('confirm_role_change_message', { name })}</p>
        <div style="margin: 1rem 0; padding: 1rem; background: var(--color-surface); border-radius: 8px;">
          <div><strong>${superuserStrings.get('from')}:</strong> ${fromLabel}</div>
          <div><strong>${superuserStrings.get('to')}:</strong> ${toLabel}</div>
        </div>
        <p class="u-text-muted" style="font-size: 0.875rem;">
          ${superuserStrings.get('logout_required_note')}
        </p>
      `,
      size: 'sm',
      buttons: [
        {
          text: superuserStrings.get('cancel'),
          onClick: () => {
            modal.close();
            resolve(false);
          }
        },
        {
          text: superuserStrings.get('confirm'),
          primary: true,
          onClick: () => {
            modal.close();
            resolve(true);
          }
        }
      ]
    });
  });
}

/**
 * Cancel selection
 */
function cancelSelection() {
  selectedMember = null;
  selectedRole = null;

  document.getElementById('selected-user-card').classList.add('u-hidden');
  document.getElementById('user-search-input').value = '';
  resetRoleSelector();
}

/**
 * Initialize search input
 */
function initSearch() {
  const input = document.getElementById('user-search-input');
  const results = document.getElementById('user-search-results');

  input.addEventListener('input', async (e) => {
    const term = e.target.value.trim();

    // Debounce
    if (searchTimeout) clearTimeout(searchTimeout);

    if (term.length < 2) {
      results.classList.add('u-hidden');
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const members = await searchMembers(term);
        renderSearchResults(members);
      } catch (error) {
        console.error('Error in search timeout:', error);
      }
    }, 300);
  });

  // Hide results on blur (with delay for click)
  input.addEventListener('blur', () => {
    setTimeout(() => {
      results.classList.add('u-hidden');
    }, 200);
  });

  // Show results on focus if input has value
  input.addEventListener('focus', async () => {
    try {
      const term = input.value.trim();
      if (term.length >= 2) {
        const members = await searchMembers(term);
        renderSearchResults(members);
      }
    } catch (error) {
      console.error('Error in search focus:', error);
    }
  });
}

/**
 * Initialize role selector
 */
function initRoleSelector() {
  document.querySelectorAll('.role-option').forEach(el => {
    el.addEventListener('click', () => {
      handleRoleSelect(el.dataset.role);
    });
  });

  document.getElementById('save-role-btn').addEventListener('click', saveRoleChange);
  document.getElementById('cancel-btn').addEventListener('click', cancelSelection);
}

/**
 * Render elevated users data to the page
 * @param {Object} data - { superusers, admins, counts }
 */
function renderElevatedUsersData(data) {
  const loadingEl = document.getElementById('elevated-users-loading');
  const listEl = document.getElementById('elevated-users-list');

  const { superusers, admins, counts } = data;

  // Update counts
  document.getElementById('superuser-count').textContent = counts.superusers;
  document.getElementById('admin-count').textContent = counts.admins;

  // Render superusers
  const superuserList = document.getElementById('superuser-list');
  if (superusers.length > 0) {
    superuserList.innerHTML = superusers.map(u => renderElevatedUser(u)).join('');
  } else {
    superuserList.innerHTML = `<div class="elevated-group--empty">${superuserStrings.get('no_superusers')}</div>`;
  }

  // Render admins
  const adminList = document.getElementById('admin-list');
  if (admins.length > 0) {
    adminList.innerHTML = admins.map(u => renderElevatedUser(u)).join('');
  } else {
    adminList.innerHTML = `<div class="elevated-group--empty">${superuserStrings.get('no_admins')}</div>`;
  }

  // Add click handlers for elevated users
  setupElevatedUserClickHandlers();

  // Show list, hide loading
  loadingEl.classList.add('u-hidden');
  listEl.classList.remove('u-hidden');
}

/**
 * Load and display users with elevated privileges (admin, superuser)
 * Uses Cloud Function to bypass Firestore permission restrictions
 * @param {boolean} backgroundRefresh - If true, don't show loading spinner
 */
async function loadElevatedUsers(backgroundRefresh = false) {
  const loadingEl = document.getElementById('elevated-users-loading');
  const listEl = document.getElementById('elevated-users-list');
  const errorEl = document.getElementById('elevated-users-error');

  try {
    if (!backgroundRefresh) {
      // Show loading state only on initial load
      loadingEl.classList.remove('u-hidden');
      listEl.classList.add('u-hidden');
    }

    // Call Cloud Function to get elevated users
    const listElevatedUsers = httpsCallable('listElevatedUsers', 'europe-west2');
    const startTime = performance.now();
    const result = await listElevatedUsers();
    const elapsed = Math.round(performance.now() - startTime);
    debug.log(`listElevatedUsers API call took ${elapsed}ms`);

    // Cache the result
    setCache(result.data);

    // Render the data
    renderElevatedUsersData(result.data);

    debug.log(`Loaded elevated users: ${result.data.counts.superusers} superusers, ${result.data.counts.admins} admins`);

  } catch (error) {
    debug.error('Failed to load elevated users:', error);
    if (!backgroundRefresh) {
      loadingEl.classList.add('u-hidden');
      errorEl.classList.remove('u-hidden');
    }
  }
}

/**
 * Setup click handlers for elevated user rows
 */
function setupElevatedUserClickHandlers() {
  document.querySelectorAll('.elevated-user--clickable').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.dataset.uid;
      const name = el.dataset.name;
      const email = el.dataset.email;
      const kennitala = el.dataset.kennitala;

      // Create a member object and select it
      const member = {
        id: kennitala || uid,
        kennitala: kennitala || null,
        name: name,
        email: email,
        firebaseUid: uid
      };

      // Update search input
      document.getElementById('user-search-input').value = name;

      // Select the member to show their details
      selectMember(member);

      // Scroll to the selected user card
      document.getElementById('selected-user-card').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    });
  });
}

/**
 * Render a single elevated user row (clickable to edit role)
 */
function renderElevatedUser(user) {
  const sourceLabels = {
    'users': superuserStrings.get('source_system_admin'),
    'firebase_claims': superuserStrings.get('source_firebase'),
    'django': superuserStrings.get('source_django'),
    'django_members': superuserStrings.get('source_django_members')
  };
  const sourceLabel = sourceLabels[user.source] || user.source;
  const loginStatus = user.hasLoggedIn
    ? `<span class="badge badge--success">${superuserStrings.get('logged_in')}</span>`
    : `<span class="badge badge--warning">${superuserStrings.get('not_logged_in')}</span>`;

  // Make clickable if user has logged in (has UID)
  const isClickable = user.hasLoggedIn && user.uid;
  const clickableClass = isClickable ? 'elevated-user--clickable' : '';
  const dataAttrs = isClickable 
    ? `data-uid="${escapeHtml(user.uid)}" data-name="${escapeHtml(user.displayName)}" data-email="${escapeHtml(user.email)}" data-kennitala="${escapeHtml(user.kennitala || '')}"`
    : '';

  // Show Django flags if present
  const djangoFlagsHtml = user.djangoFlags 
    ? `<span class="elevated-user__flags">${formatDjangoFlags(user.djangoFlags)}</span>` 
    : '';

  return `
    <div class="elevated-user ${!user.hasLoggedIn ? 'elevated-user--not-logged-in' : ''} ${clickableClass}" ${dataAttrs}>
      <div class="elevated-user__info">
        <div class="elevated-user__name">${escapeHtml(user.displayName)}</div>
        <div class="elevated-user__email">${escapeHtml(user.email)}</div>
      </div>
      <div class="elevated-user__meta">
        ${loginStatus}
        <span class="elevated-user__source">${sourceLabel}</span>
        ${djangoFlagsHtml}
        ${user.roleUpdatedAt ? `<span class="elevated-user__updated">${superuserStrings.get('updated')}: ${formatDateString(user.roleUpdatedAt)}</span>` : ''}
      </div>
    </div>
  `;
}

/**
 * Format Django role flags for display
 */
function formatDjangoFlags(flags) {
  const parts = [];
  if (flags.is_superuser) parts.push('superuser');
  if (flags.is_staff) parts.push('staff');
  if (flags.is_admin) parts.push('admin');
  return parts.length > 0 ? `(${parts.join(', ')})` : '';
}

/**
 * Format date for display (accepts Date object)
 */
function formatDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('is-IS', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
}

/**
 * Format ISO date string for display
 */
function formatDateString(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('is-IS', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * Initialize page
 */
async function init() {
  try {
    // Check for cached data first - show immediately for instant load
    const cached = getCache();
    if (cached?.data) {
      debug.log('[Cache] Showing cached elevated users immediately');
      renderElevatedUsersData(cached.data);
    }

    // Load i18n
    await R.load('is');
    await superuserStrings.load();
    superuserStrings.translatePage();  // Translate data-i18n elements

    // Init session
    await initSession();

    // Check superuser access
    await requireSuperuser();

    // Auth verified - show page content
    showAuthenticatedContent();

    // Initialize components
    initSearch();
    initRoleSelector();

    // Load elevated users list (background refresh if we have cached data)
    if (cached?.data) {
      if (cached.isStale) {
        debug.log('[Cache] Cache is stale, refreshing in background');
        loadElevatedUsers(true).catch(err => {
          debug.warn('[Cache] Background refresh failed:', err);
        });
      }
    } else {
      // No cache - load normally with loading spinner
      loadElevatedUsers();
    }

    debug.log('Role management page initialized');

  } catch (error) {
    debug.error('Failed to initialize role management:', error);

    // Auth error - redirect to login
    if (error instanceof AuthenticationError) {
      window.location.href = '/';
      return;
    }

    if (error.message?.includes('Superuser role required')) {
      return; // requireSuperuser already redirects
    }

    showToast(`Villa: ${error.message}`, 'error');
  }
}

init();
