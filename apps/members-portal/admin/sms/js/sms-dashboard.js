/**
 * SMS Dashboard
 *
 * Main SMS admin page with stats and quick actions.
 */

import { initSession, showAuthenticatedContent } from '../../../session/init.js';
import { AuthenticationError } from '../../../session/auth.js';
import { debug } from '../../../js/utils/util-debug.js';
import { requireAdmin } from '../../../js/rbac.js';
import { showError } from '../../../js/components/ui-toast.js';
import SmsAPI from './api/sms-api.js';

/**
 * Load and display SMS stats
 */
async function loadStats() {
  try {
    const { stats, period_days } = await SmsAPI.getStats({ days: 30 });

    document.getElementById('stat-sent-value').textContent = stats.total || 0;
    document.getElementById('stat-segments-value').textContent = stats.total_segments || 0;
    document.getElementById('stat-failed-value').textContent = stats.failed || 0;
    document.getElementById('stat-cost-value').textContent = `$${stats.estimated_cost || 0}`;

    // Period note
    document.getElementById('stats-period').textContent = `Síðustu ${period_days} dagar`;

  } catch (error) {
    debug.warn('[SmsDashboard] Could not load stats:', error);
    // Stats loading is optional - page still works
    document.getElementById('stats-period').textContent = 'Gat ekki sótt tölfræði';
  }
}

/**
 * Initialize SMS dashboard
 */
async function init() {
  try {
    // 1. Init session (loads member portal strings + authenticates)
    await initSession();

    // 2. Check admin access
    await requireAdmin();

    // Auth verified - show page content
    showAuthenticatedContent();

    // 3. Load stats (async, non-blocking)
    loadStats();

    debug.log('[SmsDashboard] Initialized');

  } catch (error) {
    debug.error('[SmsDashboard] Init failed:', error);

    // Auth error - redirect to login
    if (error instanceof AuthenticationError) {
      window.location.href = '/';
      return;
    }

    if (error.message?.includes('Unauthorized') || error.message?.includes('Admin role required')) {
      return;
    }

    showError(`Villa: ${error.message}`);
  }
}

// Run on page load
init();
