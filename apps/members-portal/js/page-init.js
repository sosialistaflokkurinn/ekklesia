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
import { initNavigation } from './nav.js';

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
 */
export function updateNavigation() {
  document.getElementById('nav-brand').textContent = R.string.nav_brand;
  document.getElementById('nav-dashboard').textContent = R.string.nav_dashboard;
  document.getElementById('nav-profile').textContent = R.string.nav_profile;
  document.getElementById('nav-events').textContent = R.string.nav_events;
  document.getElementById('nav-voting').textContent = R.string.nav_voting;
  document.getElementById('nav-logout').textContent = R.string.nav_logout;
}

/**
 * Setup logout button click handler
 *
 * Attaches event listener to logout link that signs out
 * the user and redirects to login page.
 */
export function setupLogout() {
  document.getElementById('nav-logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut();
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

  // Update navigation
  updateNavigation();

  // Setup logout handler
  setupLogout();

  // Initialize mobile hamburger menu
  initNavigation();

  // Auth guard - redirect if not authenticated
  const user = await requireAuth();

  // Get user data
  const userData = await getUserData(user);

  return { user, userData };
}
