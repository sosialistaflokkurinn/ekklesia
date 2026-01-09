/**
 * Email Dashboard - Issue #323
 *
 * Main email admin page with stats and quick actions.
 */

import { initSession, showAuthenticatedContent } from '../../../session/init.js';
import { debug } from '../../../js/utils/util-debug.js';
import { adminStrings } from '../../js/i18n/admin-strings-loader.js';
import { requireAdmin } from '../../../js/rbac.js';
import { showError } from '../../../js/components/ui-toast.js';
import EmailAPI from './api/email-api.js';

/**
 * Set page text from admin strings
 */
function setPageText(strings) {
  // Page title
  document.getElementById('page-title').textContent = strings.email_dashboard_title + ' - Ekklesia';

  // Stats labels
  document.getElementById('stats-title').textContent = strings.email_stats_title;
  document.getElementById('stat-sent-label').textContent = strings.email_stats_sent;
  document.getElementById('stat-delivered-label').textContent = strings.email_stats_delivered;
  document.getElementById('stat-opened-label').textContent = strings.email_stats_opened;
  document.getElementById('stat-bounced-label').textContent = strings.email_stats_bounced;

  // Actions
  document.getElementById('actions-title').textContent = strings.admin_actions_title;
  document.getElementById('action-send-label').textContent = strings.email_send_title;
  document.getElementById('action-send-desc').textContent = strings.email_send_subtitle;
  document.getElementById('action-templates-label').textContent = strings.email_templates_title;
  document.getElementById('action-templates-desc').textContent = strings.email_templates_subtitle;
  document.getElementById('action-campaigns-label').textContent = strings.email_campaigns_title;
  document.getElementById('action-campaigns-desc').textContent = strings.email_campaigns_subtitle;
  document.getElementById('action-logs-label').textContent = strings.email_logs_title;
  document.getElementById('action-logs-desc').textContent = strings.email_logs_subtitle;
}

/**
 * Load and display email stats
 */
async function loadStats(strings) {
  try {
    const { stats, period_days } = await EmailAPI.getStats({ days: 30 });

    document.getElementById('stat-sent-value').textContent = stats.total || 0;
    document.getElementById('stat-delivered-value').textContent = stats.delivered || 0;
    document.getElementById('stat-opened-value').textContent = stats.opened || 0;
    document.getElementById('stat-bounced-value').textContent = stats.bounced || 0;

    // Period note
    const periodText = strings.email_stats_period.replace('%d', period_days);
    document.getElementById('stats-period').textContent = periodText;

  } catch (error) {
    debug.warn('[EmailDashboard] Could not load stats:', error);
    // Stats loading is optional - page still works
    document.getElementById('stats-period').textContent = strings.email_stats_error;
  }
}

/**
 * Initialize email dashboard
 */
async function init() {
  try {
    // 1. Load admin strings
    const strings = await adminStrings.load();

    // 2. Init session (loads member portal strings + authenticates)
    await initSession();

    // 3. Check admin access
    await requireAdmin();

    // Auth verified - show page content
    showAuthenticatedContent();

    // 4. Set page text
    setPageText(strings);

    // 5. Load stats (async, non-blocking)
    loadStats(strings);

    debug.log('[EmailDashboard] Initialized');

  } catch (error) {
    debug.error('[EmailDashboard] Init failed:', error);

    if (error.message.includes('Unauthorized') || error.message.includes('Admin role required')) {
      window.location.href = '/members-area/';
      return;
    }

    if (error.message.includes('Not authenticated')) {
      window.location.href = '/';
      return;
    }

    showError(`Villa: ${error.message}`);
  }
}

// Run on page load
init();
