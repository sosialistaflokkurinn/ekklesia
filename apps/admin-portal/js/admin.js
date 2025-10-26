/**
 * Admin Dashboard - Epic #43 Phase 2
 *
 * Main admin page with role-based access control.
 * Only users with 'developer' role can access admin portal.
 */

// Import from parent member portal directory (up one level from /admin/)
import { initSession } from '../js/session.js';
import { auth, db } from '../js/firebase-init.js';
import { initNav } from '../js/ui/nav.js';
import { showError } from '../js/ui/dom.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Load admin-specific strings from admin portal i18n
 */
class AdminStringsLoader {
  constructor() {
    this.strings = {};
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.strings;

    try {
      const response = await fetch('/admin/i18n/values-is/strings.xml');
      if (!response.ok) {
        throw new Error(`Failed to load admin strings: ${response.statusText}`);
      }

      const xmlText = await response.text();
      this.strings = this.parseXML(xmlText);
      this.loaded = true;

      console.log(`✓ Loaded ${Object.keys(this.strings).length} admin strings`);
      return this.strings;
    } catch (error) {
      console.error('Failed to load admin strings:', error);
      throw error;
    }
  }

  parseXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`XML parsing error: ${parserError.textContent}`);
    }

    const strings = {};
    const stringElements = xmlDoc.querySelectorAll('string');

    stringElements.forEach(element => {
      const name = element.getAttribute('name');
      const value = element.textContent;
      if (name) {
        strings[name] = value;
      }
    });

    return strings;
  }

  get(key) {
    return this.strings[key] || key;
  }
}

const adminStrings = new AdminStringsLoader();

/**
 * Check if user has developer role
 */
function checkAdminAccess(user) {
  return user.getIdTokenResult().then(idTokenResult => {
    const roles = idTokenResult.claims.roles || [];
    const isAdmin = roles.includes('developer');

    if (!isAdmin) {
      throw new Error('Unauthorized: Developer role required');
    }

    return idTokenResult;
  });
}

/**
 * Load recent sync status from Firestore
 */
async function loadRecentSync() {
  try {
    const syncLogsRef = collection(db, 'sync_logs');
    const q = query(syncLogsRef, orderBy('timestamp', 'desc'), limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      // No recent sync, hide the card
      document.getElementById('recent-sync-card').classList.add('u-hidden');
      return;
    }

    const recentLog = querySnapshot.docs[0].data();
    displayRecentSync(recentLog);
  } catch (error) {
    console.error('Failed to load recent sync:', error);
    // Don't show error, just hide the card
    document.getElementById('recent-sync-card').classList.add('u-hidden');
  }
}

/**
 * Display recent sync summary
 */
function displayRecentSync(log) {
  const card = document.getElementById('recent-sync-card');
  const summary = document.getElementById('recent-sync-summary');

  // Format timestamp
  const timestamp = log.timestamp?.toDate?.() || new Date();
  const formattedDate = timestamp.toLocaleString('is-IS', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Build summary HTML
  const stats = log.stats || {};
  const status = stats.failed > 0 ? '⚠️ Með villum' : '✅ Tókst';

  summary.innerHTML = `
    <div class="info-grid">
      <div class="info-grid__item">
        <div class="info-grid__label">Dagsetning</div>
        <div class="info-grid__value">${formattedDate}</div>
      </div>
      <div class="info-grid__item">
        <div class="info-grid__label">Staða</div>
        <div class="info-grid__value">${status}</div>
      </div>
      <div class="info-grid__item">
        <div class="info-grid__label">Samstillt</div>
        <div class="info-grid__value">${stats.synced || 0} / ${stats.total_members || 0}</div>
      </div>
      <div class="info-grid__item">
        <div class="info-grid__label">Tími</div>
        <div class="info-grid__value">${calculateDuration(stats)}</div>
      </div>
    </div>
  `;

  card.classList.remove('u-hidden');
}

/**
 * Calculate duration from stats
 */
function calculateDuration(stats) {
  if (!stats.started_at || !stats.completed_at) return 'N/A';

  const start = new Date(stats.started_at);
  const end = new Date(stats.completed_at);
  const durationSec = Math.floor((end - start) / 1000);

  if (durationSec < 60) return `${durationSec}s`;

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Set page text from admin strings
 */
function setPageText(strings) {
  // Page title
  document.getElementById('page-title').textContent = strings.admin_dashboard_title;

  // Navigation
  document.getElementById('nav-brand').textContent = strings.admin_brand;
  document.getElementById('nav-admin-dashboard').textContent = strings.nav_admin_dashboard;
  document.getElementById('nav-admin-sync').textContent = strings.nav_admin_sync;
  document.getElementById('nav-admin-history').textContent = strings.nav_admin_history;
  document.getElementById('nav-back-to-member').textContent = strings.nav_back_to_member;

  // Welcome card
  document.getElementById('admin-welcome-title').textContent = strings.admin_welcome_title;
  document.getElementById('admin-welcome-subtitle').textContent = strings.admin_welcome_subtitle;

  // Quick actions
  document.getElementById('admin-actions-title').textContent = strings.admin_actions_title;
  document.getElementById('quick-action-sync-label').textContent = strings.quick_action_sync_label;
  document.getElementById('quick-action-sync-desc').textContent = strings.quick_action_sync_desc;
  document.getElementById('quick-action-history-label').textContent = strings.quick_action_history_label;
  document.getElementById('quick-action-history-desc').textContent = strings.quick_action_history_desc;
}

/**
 * Initialize admin dashboard
 */
async function init() {
  try {
    // 1. Load admin strings
    const strings = await adminStrings.load();

    // 2. Init session (loads member portal strings + authenticates)
    const user = await initSession();

    // 3. Check admin access (developer role required)
    await checkAdminAccess(user);

    // 4. Set page text
    setPageText(strings);

    // 5. Initialize navigation
    initNav();

    // 6. Load recent sync status
    await loadRecentSync();

    console.log('✓ Admin dashboard initialized');

  } catch (error) {
    console.error('Failed to initialize admin dashboard:', error);

    // Check if unauthorized
    if (error.message.includes('Unauthorized')) {
      alert('Þú hefur ekki aðgang að stjórnkerfi. Aðeins notendur með developer role hafa aðgang.');
      window.location.href = '/dashboard.html';
      return;
    }

    // Check if not authenticated
    if (error.message.includes('Not authenticated')) {
      window.location.href = '/';
      return;
    }

    // Other errors
    showError(`Villa við að hlaða stjórnborði: ${error.message}`);
  }
}

// Run on page load
init();
