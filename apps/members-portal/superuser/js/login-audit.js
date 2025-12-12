/**
 * Login Audit Trail - Superuser Console
 *
 * Displays user login history from Firebase Auth logs.
 * Shows successful logins and failed attempts.
 *
 * Backend: Uses Firestore /users/ collection for login metadata
 */

import { initSession } from '../../session/init.js';
import { debug } from '../../js/utils/util-debug.js';
import { getFunctions, httpsCallable } from '../../firebase/app.js';
import { requireSuperuser } from '../../js/rbac.js';
import { showToast } from '../../js/components/ui-toast.js';
import { R } from '../../i18n/strings-loader.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';

/**
 * Parse user agent string to friendly browser/OS name
 */
function parseBrowserName(ua) {
  if (!ua) return '';

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Opera') || ua.includes('OPR/')) browser = 'Opera';

  // Detect OS
  let os = '';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return os ? `${browser} / ${os}` : browser;
}

// Mock data for demonstration
const MOCK_LOGINS = [
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: 'success',
    user: 'Guðrún Jónsdóttir',
    email: 'gudrun@example.com',
    method: 'kenni.is',
    ip: '85.220.xxx.xxx',
    userAgent: 'Chrome 120 / Windows'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    status: 'success',
    user: 'Jón Sigurðsson',
    email: 'jon@example.com',
    method: 'kenni.is',
    ip: '90.130.xxx.xxx',
    userAgent: 'Safari 17 / macOS'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: 'failed',
    user: null,
    email: 'unknown@example.com',
    method: 'kenni.is',
    error: 'User not found in Django',
    ip: '45.67.xxx.xxx',
    userAgent: 'Firefox 121 / Linux'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: 'success',
    user: 'Anna Ólafsdóttir',
    email: 'anna@example.com',
    method: 'kenni.is',
    ip: '95.55.xxx.xxx',
    userAgent: 'Chrome 120 / Android'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    status: 'failed',
    user: null,
    email: 'test@test.com',
    method: 'kenni.is',
    error: 'OAuth error: invalid_state',
    ip: '123.45.xxx.xxx',
    userAgent: 'Unknown'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    status: 'success',
    user: 'Pétur Pálsson',
    email: 'petur@example.com',
    method: 'kenni.is',
    ip: '78.40.xxx.xxx',
    userAgent: 'Safari 17 / iOS'
  }
];

/**
 * Format timestamp for display
 */
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('is-IS', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format relative time
 */
function formatRelativeTime(isoString) {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMinutes = Math.floor((now - then) / (1000 * 60));

  if (diffMinutes < 1) return superuserStrings.get('time_just_now');
  if (diffMinutes < 60) return superuserStrings.get('time_minutes_ago').replace('%s', diffMinutes);

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return superuserStrings.get('time_hours_ago').replace('%s', diffHours);

  const diffDays = Math.floor(diffHours / 24);
  return superuserStrings.get('time_days_ago').replace('%s', diffDays);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render login entry
 */
function renderLoginEntry(login) {
  const statusClass = login.status === 'success' ? 'login-audit-entry--success' : 'login-audit-entry--failed';
  const icon = login.status === 'success' ? '✓' : '✕';
  const userName = login.user || login.email || superuserStrings.get('login_unknown_user');

  return `
    <div class="login-audit-entry ${statusClass}">
      <span class="login-audit-entry__icon">${icon}</span>
      <div class="login-audit-entry__details">
        <div class="login-audit-entry__user">${escapeHtml(userName)}</div>
        <div class="login-audit-entry__meta">
          <span>${escapeHtml(login.email || '')}</span>
          <span>${escapeHtml(login.method || 'kenni.is')}</span>
          ${login.userAgent ? `<span class="u-text-muted">${escapeHtml(parseBrowserName(login.userAgent))}</span>` : ''}
          ${login.error ? `<span class="u-text-error">${escapeHtml(login.error)}</span>` : ''}
        </div>
      </div>
      <div class="login-audit-entry__time">
        <div>${formatRelativeTime(login.timestamp)}</div>
        <div class="u-text-muted">${formatTimestamp(login.timestamp)}</div>
      </div>
    </div>
  `;
}

/**
 * Render login results
 */
function renderResults(logins) {
  const container = document.getElementById('login-results');
  const countEl = document.getElementById('results-count');

  if (logins.length === 0) {
    container.innerHTML = `
      <div class="audit-placeholder">
        <p>${superuserStrings.get('login_no_results')}</p>
      </div>
    `;
    countEl.textContent = superuserStrings.get('audit_count_zero');
    return;
  }

  container.innerHTML = logins.map(renderLoginEntry).join('');
  countEl.textContent = superuserStrings.get('audit_count_format').replace('%s', logins.length);
}

/**
 * Update summary stats
 */
function updateStats(logins) {
  const total = logins.length;
  const success = logins.filter(l => l.status === 'success').length;
  const failed = logins.filter(l => l.status === 'failed').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-success').textContent = success;
  document.getElementById('stat-failed').textContent = failed;
}

/**
 * Filter logins based on current filters
 */
function filterLogins(logins) {
  const status = document.getElementById('filter-status').value;
  const hours = parseInt(document.getElementById('filter-hours').value);
  const userFilter = document.getElementById('filter-user').value.trim().toLowerCase();

  const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);

  return logins.filter(login => {
    // Status filter
    if (status !== 'all' && login.status !== status) return false;

    // Time filter
    if (new Date(login.timestamp).getTime() < cutoffTime) return false;

    // User filter
    if (userFilter) {
      const matchesName = login.user?.toLowerCase().includes(userFilter);
      const matchesEmail = login.email?.toLowerCase().includes(userFilter);
      if (!matchesName && !matchesEmail) return false;
    }

    return true;
  });
}

/**
 * Search logins using Cloud Function
 */
async function searchLogins() {
  const searchBtn = document.getElementById('search-btn');
  searchBtn.disabled = true;
  searchBtn.textContent = superuserStrings.get('btn_search_loading');

  try {
    // Get filter values
    const status = document.getElementById('filter-status').value;
    const hours = parseInt(document.getElementById('filter-hours').value);
    const userFilter = document.getElementById('filter-user').value.trim();

    // Call Cloud Function
    const functions = getFunctions('europe-west2');
    const getLoginAudit = httpsCallable(functions, 'getLoginAudit');

    const result = await getLoginAudit({
      status: status !== 'all' ? status : null,
      hours,
      user_filter: userFilter || null,
      limit: 100
    });

    const loginData = result.data;
    debug.log('Login audit result:', loginData);

    renderResults(loginData.logins || []);
    updateStats(loginData.logins || []);

  } catch (error) {
    debug.error('Error fetching logins:', error);

    // Fallback to mock data
    debug.log('Falling back to mock data');
    const filteredLogins = filterLogins(MOCK_LOGINS);
    renderResults(filteredLogins);
    updateStats(MOCK_LOGINS);
    showToast(superuserStrings.get('login_fetch_error'), 'warning', { duration: 3000 });
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = superuserStrings.get('btn_search');
  }
}

/**
 * Refresh data
 */
async function refresh() {
  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.disabled = true;
  refreshBtn.textContent = superuserStrings.get('login_refreshing');

  try {
    await searchLogins();
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = superuserStrings.get('login_refresh_btn');
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  document.getElementById('search-btn').addEventListener('click', searchLogins);
  document.getElementById('refresh-btn').addEventListener('click', refresh);

  // Enter key in user field triggers search
  document.getElementById('filter-user').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchLogins();
    }
  });
}

/**
 * Initialize page
 */
async function init() {
  try {
    await R.load('is');
    await superuserStrings.load();
    superuserStrings.translatePage();  // Translate data-i18n elements
    await initSession();
    await requireSuperuser();

    setupEventListeners();

    debug.log('Login audit page initialized');

  } catch (error) {
    debug.error('Failed to initialize login audit:', error);

    if (error.message.includes('Superuser role required')) {
      return;
    }

    showToast(superuserStrings.get('dangerous_op_error').replace('%s', error.message), 'error');
  }
}

init();
