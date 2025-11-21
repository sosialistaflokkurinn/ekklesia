/**
 * Page Initialization Module
 *
 * Common initialization logic for all authenticated pages.
 * Handles i18n loading, navigation setup, and auth guard.
 *
 * This module provides a single `initAuthenticatedPage()` function that:
 * 1. Loads i18n strings
 * 2. Updates navigation menu strings
 * 3. Sets up logout handler
 * 4. Enforces authentication (redirects to login if not authenticated)
 * 5. Returns user object and user data for page-specific logic
 *
 * @module page-init
 */

import { R } from '../i18n/strings-loader.js';
import { requireAuth, signOut, getUserData } from '../session/auth.js';
// Note: initNavigation import removed - now handled by nav-header component

/**
 * Initialize i18n and load strings for Icelandic locale
 *
 * @returns {Promise<Object>} - R.string object with loaded strings
 */
export async function initI18n() {
  await R.load('is');
  return R;
}

/**
 * Update navigation menu strings from i18n
 *
 * Updates the navigation bar elements (brand, dashboard, profile, events, voting, logout)
 * with localized strings from R.string.
 * Also sets ARIA labels for hamburger menu and data attributes for dynamic label toggling.
 */
export function updateNavigation() {
  const navBrand = document.getElementById('nav-brand');
  const navDashboard = document.getElementById('nav-dashboard');
  const navProfile = document.getElementById('nav-profile');
  const navEvents = document.getElementById('nav-events');
  const navVoting = document.getElementById('nav-voting');
  const navLogout = document.getElementById('nav-logout');

  if (navBrand) navBrand.textContent = R.string.nav_brand;
  if (navDashboard) navDashboard.textContent = R.string.nav_dashboard;
  if (navProfile) navProfile.textContent = R.string.nav_profile;
  if (navEvents) navEvents.textContent = R.string.nav_events;
  if (navVoting) navVoting.textContent = R.string.nav_voting;
  if (navLogout) navLogout.textContent = R.string.nav_logout;

  // Set ARIA labels for hamburger menu button (FIX #5: i18n localization)
  const hamburger = document.getElementById('nav-hamburger');
  const closeBtn = document.getElementById('nav-close');

  if (hamburger) {
    // Set initial ARIA label (drawer is closed initially)
    const openLabel = R.string.nav_hamburger_open || 'Opna valmynd';
    hamburger.setAttribute('aria-label', openLabel);

    // Store labels in data attributes for dynamic toggling in nav-interactions.js
    hamburger.setAttribute('data-open-label', openLabel);

    const closeLabel = R.string.nav_hamburger_close || 'Loka valmynd';
    hamburger.setAttribute('data-close-label', closeLabel);
  }

  if (closeBtn) {
    // Close button aria-label (FIX #5: i18n localization)
    const closeLabel = R.string.nav_hamburger_close || 'Loka valmynd';
    closeBtn.setAttribute('aria-label', closeLabel);
  }
}

/**
 * Setup logout button click handler
 *
 * Attaches event listener to logout link that signs out
 * the user and redirects to home page (/).
 */
export function setupLogout() {
  document.getElementById('nav-logout').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      // Redirect to home page after logout.
      // NOTE: This is a deliberate change from the previous behavior, which redirected to '/session/login.html'.
      // Rationale: After logout, users are sent to the home page ('/') which now provides a clear login option.
      // This improves user experience and ensures users can easily log in again if desired.
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      // Still redirect even if signOut fails to avoid stuck UI
      window.location.href = '/';
    }
  });
}

/**
 * Initialize authenticated page with common setup
 *
 * This is the main entry point for authenticated pages (dashboard, profile, etc.).
 * It performs all common initialization:
 * - Loads i18n strings
 * - Updates navigation menu
 * - Sets up logout handler
 * - Enforces authentication (redirects to login if not authenticated)
 * - Fetches user data from Firebase token claims
 *
 * @returns {Promise<{user: Object, userData: Object}>} User object and user data
 * @returns {Promise<{user: Object, userData: {uid: string, displayName: string, kennitala: string, email: string, phoneNumber: string, isMember: boolean}}>}
 */
export async function initAuthenticatedPage() {
  // Load i18n strings
  await initI18n();

  // Note: Navigation text, logout handler, and hamburger menu now managed by nav-header component
  // (component loads i18n and creates nav with correct strings automatically)

  // Auth guard - redirect if not authenticated
  const user = await requireAuth();

  // Get user data
  const userData = await getUserData(user);

  return { user, userData };
}
