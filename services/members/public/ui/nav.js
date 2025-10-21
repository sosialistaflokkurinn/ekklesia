/**
 * Navigation UI Module
 *
 * Pure DOM manipulation for navigation menu.
 * Separated from session/auth logic for better testability.
 *
 * @module ui/nav
 */

import { setTextContent, addEventListener, validateElements } from './dom.js';

/**
 * Required navigation element IDs
 */
const NAV_ELEMENTS = [
  'nav-brand',
  'nav-dashboard',
  'nav-profile',
  'nav-logout'
];

/**
 * Validate navigation DOM structure
 *
 * @throws {Error} If required elements are missing
 */
export function validateNavigation() {
  validateElements(NAV_ELEMENTS, 'navigation menu');
}

/**
 * Update navigation menu strings
 *
 * @param {Object} strings - i18n strings object
 * @param {string} strings.nav_brand - Brand text
 * @param {string} strings.nav_dashboard - Dashboard link text
 * @param {string} strings.nav_profile - Profile link text
 * @param {string} strings.nav_logout - Logout link text
 */
export function updateNavigationStrings(strings) {
  setTextContent('nav-brand', strings.nav_brand, 'navigation menu');
  setTextContent('nav-dashboard', strings.nav_dashboard, 'navigation menu');
  setTextContent('nav-profile', strings.nav_profile, 'navigation menu');
  setTextContent('nav-logout', strings.nav_logout, 'navigation menu');
}

/**
 * Setup logout button handler
 *
 * @param {Function} onLogout - Logout handler function (should be session/auth.signOut)
 * @param {string} [redirectTo='/'] - Where to redirect after logout
 */
export function setupLogoutHandler(onLogout, redirectTo = '/') {
  addEventListener('nav-logout', 'click', async (e) => {
    e.preventDefault();
    await onLogout();
    // UI layer handles redirect (session layer stays pure)
    window.location.href = redirectTo;
  }, 'navigation menu');
}
