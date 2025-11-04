/**
 * Admin Utility Functions
 *
 * Shared helper functions for admin portal pages.
 */

/**
 * Check if user has admin or superuser role
 * @param {Object} userData - User data object with roles array
 * @returns {boolean} - True if user has access
 * @throws {Error} - If user doesn't have required role
 */
export function checkAdminAccess(userData) {
  const roles = userData.roles || [];
  const hasAccess = roles.includes('admin') || roles.includes('superuser');

  if (!hasAccess) {
    throw new Error('Unauthorized: Admin or superuser role required');
  }

  return true;
}

/**
 * Calculate duration between two timestamps
 * @param {Object} stats - Object with started_at and completed_at timestamps
 * @returns {string} - Formatted duration string (e.g., "2m 15s" or "45s")
 */
export function calculateDuration(stats) {
  if (!stats.started_at || !stats.completed_at) return 'N/A';

  const start = new Date(stats.started_at);
  const end = new Date(stats.completed_at);
  const durationSec = Math.floor((end - start) / 1000);

  if (durationSec < 60) return `${durationSec}s`;

  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  return `${minutes}m ${seconds}s`;
}
