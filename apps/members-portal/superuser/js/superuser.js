/**
 * Superuser Dashboard - Phase 1 Foundation
 *
 * Main superuser console page with role-based access control.
 * Only users with 'superuser' role can access this console.
 */

// Import from member portal public directory
import { initSession, showAuthenticatedContent } from '../../session/init.js';
import { AuthenticationError } from '../../session/auth.js';
import { debug } from '../../js/utils/util-debug.js';
import { getFirebaseAuth, httpsCallable } from '../../firebase/app.js';
import { superuserStrings } from './i18n/superuser-strings-loader.js';
import { requireSuperuser } from '../../js/rbac.js';
import { initKimiChat } from './kimi-chat.js';

// Initialize Firebase services
const auth = getFirebaseAuth();

/**
 * Build welcome message with proper Icelandic grammar
 */
function buildWelcomeMessage(displayName, strings) {
  const fallbackName = superuserStrings.get('superuser_fallback_name');
  const rawName = (displayName || fallbackName).trim();
  const parts = rawName.split(/\s+/);
  const lastPart = parts.length ? parts[parts.length - 1] : '';
  const normalizedLast = lastPart
    ? lastPart.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
    : '';

  let template = strings.superuser_welcome_neutral;
  if (normalizedLast.endsWith('son')) {
    template = strings.superuser_welcome_male;
  } else if (normalizedLast.endsWith('dottir')) {
    template = strings.superuser_welcome_female;
  }

  return template.replace('%s', rawName);
}

// Note: renderRoleBadges and updateRoleBadges removed - welcome card was removed

/**
 * Update system status display
 */
function updateSystemStatus(status, strings) {
  const indicator = document.querySelector('.system-status__indicator');
  const text = document.getElementById('system-status-text');

  if (!indicator || !text) return;

  // Remove all status classes
  indicator.classList.remove(
    'system-status__indicator--loading',
    'system-status__indicator--healthy',
    'system-status__indicator--degraded',
    'system-status__indicator--down'
  );

  switch (status) {
    case 'healthy':
      indicator.classList.add('system-status__indicator--healthy');
      text.textContent = strings.system_status_healthy;
      break;
    case 'degraded':
      indicator.classList.add('system-status__indicator--degraded');
      text.textContent = strings.system_status_degraded;
      break;
    case 'down':
      indicator.classList.add('system-status__indicator--down');
      text.textContent = strings.system_status_down;
      break;
    default:
      indicator.classList.add('system-status__indicator--loading');
      text.textContent = strings.system_status_loading;
  }
}

/**
 * Set page text from superuser strings
 * @param {Object} strings - Superuser i18n strings
 * @param {Object} userData - User data from session
 */
function setPageText(strings, userData) {
  // Helper to safely set text content
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // Page title
  setText('page-title', strings.superuser_dashboard_title);

  // Quick actions
  setText('superuser-actions-title', strings.superuser_actions_title);
  setText('quick-action-roles-label', strings.quick_action_roles_label);
  setText('quick-action-roles-desc', strings.quick_action_roles_desc);
  setText('quick-action-audit-logs-label', strings.quick_action_audit_logs_label);
  setText('quick-action-audit-logs-desc', strings.quick_action_audit_logs_desc);
  setText('quick-action-dangerous-ops-label', strings.quick_action_dangerous_ops_label);
  setText('quick-action-dangerous-ops-desc', strings.quick_action_dangerous_ops_desc);
  setText('quick-action-system-overview-label', strings.quick_action_system_overview_label);
  setText('quick-action-system-overview-desc', strings.quick_action_system_overview_desc);
  setText('quick-action-login-audit-label', strings.quick_action_login_audit_label);
  setText('quick-action-login-audit-desc', strings.quick_action_login_audit_desc);

  // System status
  setText('system-status-title', strings.system_status_title);

  // Set initial status to loading (will be updated by actual health check)
  updateSystemStatus('loading', strings);
}

/**
 * Check system health using Cloud Function
 */
async function checkSystemHealthQuick(strings) {
  try {
    const checkSystemHealth = httpsCallable('checkSystemHealth', 'europe-west2');

    const result = await checkSystemHealth();
    const healthData = result.data;

    debug.log('Quick health check result:', healthData);

    // Determine overall status from summary
    const summary = healthData.summary || {};
    let overallStatus = 'healthy';

    if (summary.down > 0) {
      overallStatus = 'down';
    } else if (summary.degraded > 0) {
      overallStatus = 'degraded';
    }

    updateSystemStatus(overallStatus, strings);

  } catch (error) {
    debug.error('Error checking system health:', error);
    // On error, show degraded status
    updateSystemStatus('degraded', strings);
  }
}

/**
 * Initialize superuser dashboard
 */
async function init() {
  try {
    // 1. Load superuser strings
    const strings = await superuserStrings.load();

    // 2. Init session (loads member portal strings + authenticates)
    const { user, userData } = await initSession();

    debug.log('userData from initSession:', userData);
    debug.log('userData.roles:', userData.roles);

    // 3. Check superuser access using unified RBAC (requires superuser only)
    await requireSuperuser();

    // Auth verified - show page content
    showAuthenticatedContent();

    // 4. Set page text (with personalized greeting)
    setPageText(strings, userData);

    // 5. Check system health in background (don't block page load)
    checkSystemHealthQuick(strings);

    // 6. Initialize Kimi chat widget
    initKimiChat();

    debug.log('Superuser dashboard initialized');

  } catch (error) {
    debug.error('Failed to initialize superuser dashboard:', error);

    // Auth error - redirect to login
    if (error instanceof AuthenticationError) {
      window.location.href = '/';
      return;
    }

    // Check if unauthorized (requireSuperuser already redirects, but handle edge cases)
    if (error.message?.includes('Unauthorized') || error.message?.includes('Superuser role required')) {
      return;
    }

    // Other errors
    debug.error('Error loading superuser dashboard:', error);
    alert(superuserStrings.get('error_page_load')?.replace('%s', error.message) || error.message);
  }
}

// Run on page load
init();
