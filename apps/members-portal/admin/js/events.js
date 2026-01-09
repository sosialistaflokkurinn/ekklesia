/**
 * Admin Events Page
 *
 * Events management page (placeholder for future development).
 * Only users with 'admin' or 'superuser' role can access.
 */

import { initSession, showAuthenticatedContent } from '../../session/init.js';
import { debug } from '../../js/utils/util-debug.js';
import { requireAdmin } from '../../js/rbac.js';

/**
 * Initialize events page
 */
async function init() {
  try {
    // 1. Init session (authenticates user)
    await initSession();

    // 2. Check admin access
    await requireAdmin();

    // Auth verified - show page content
    showAuthenticatedContent();

    debug.log('✓ Events page initialized');

  } catch (error) {
    debug.error('Failed to initialize events page:', error);

    // Check if unauthorized
    if (error.message.includes('Unauthorized') || error.message.includes('Admin role required')) {
      alert('Þú hefur ekki aðgang.');
      window.location.href = '/members-area/';
      return;
    }

    // Check if not authenticated
    if (error.message.includes('Not authenticated')) {
      window.location.href = '/';
      return;
    }

    // Other errors
    debug.error('Error loading events page:', error);
    alert(`Villa: ${error.message}`);
  }
}

// Run on page load
init();
