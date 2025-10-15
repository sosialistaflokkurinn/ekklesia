/**
 * Session Initialization Module
 *
 * Pure session setup without DOM dependencies.
 * Returns session data (user, claims, strings) that pages can use
 * to update their UI.
 *
 * Separation of concerns:
 * - This module: Authentication + data fetching
 * - UI modules: DOM manipulation
 *
 * Benefits:
 * - Testable without DOM
 * - Reusable in non-browser contexts (workers, CLI)
 * - Clear contracts between session and UI
 *
 * @module session/init
 */

import { R } from '../i18n/strings-loader.js';
import { requireAuth, getUserData, AuthenticationError } from './auth.js';

/**
 * Initialize session for authenticated page
 *
 * Pure data fetching - no DOM manipulation.
 * Returns session data that UI layer can use.
 *
 * If user not authenticated, throws AuthenticationError with redirect hint.
 * Caller (UI layer) decides whether to redirect.
 *
 * @param {string} [locale='is'] - Locale to load
 * @returns {Promise<Object>} Session data
 * @returns {Promise<{user: Object, userData: Object, strings: Object}>}
 * @throws {AuthenticationError} If user not authenticated (caller should redirect)
 *
 * @example
 * // In page module
 * import { initSession } from '/session/init.js';
 * import { AuthenticationError } from '/session/auth.js';
 * import { updateNavigationStrings } from '/ui/nav.js';
 *
 * try {
 *   const { user, userData, strings } = await initSession();
 *   updateNavigationStrings(strings);
 * } catch (error) {
 *   if (error instanceof AuthenticationError) {
 *     window.location.href = error.redirectTo;
 *   }
 * }
 */
export async function initSession(locale = 'is') {
  // Load i18n strings (cached if already loaded)
  await R.load(locale);

  // Auth guard - throws AuthenticationError if not authenticated
  const user = await requireAuth();

  // Get user data from token claims
  const userData = await getUserData(user);

  // Return session data (pure data, no side effects)
  return {
    user,
    userData,
    strings: R.string
  };
}
