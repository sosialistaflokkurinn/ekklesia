/**
 * Elections List Page - i18n Initialization
 *
 * Handles static internationalization string initialization for the elections list page.
 * Dynamic i18n strings (used in runtime logic) remain in elections-list.js.
 *
 * @module admin-elections/js/elections-list-i18n
 */

import { R } from '../i18n/strings-loader.js';

/**
 * Initialize all static i18n strings for the elections list page
 *
 * Sets up textContent and placeholders for navigation, filters, table headers,
 * and other static UI elements. Runtime strings (used in error messages, dynamic
 * content generation, etc.) are handled directly in elections-list.js.
 *
 * @returns {Promise<void>} Resolves when all static strings are initialized
 */
export async function initElectionsListStrings() {
  // Load admin-elections specific strings
  await R.load('is');

  // Mapping of element IDs to string keys
  const mappings = {
    textContent: {
      // Page title
      'page-title': 'admin_elections_title',

      // Navigation - Handled by navigation-bar.js
      // 'nav-brand': 'admin_elections_brand',
      // 'nav-elections-list': 'nav_elections_list',
      // 'nav-back-to-member': 'admin_nav_back_to_member',
      // 'nav-logout': 'admin_nav_logout',

      // Filter buttons
      'filter-all': 'filter_all',
      'filter-draft': 'filter_draft',
      'filter-published': 'filter_published',
      'filter-closed': 'filter_closed',
      'filter-hidden': 'filter_hidden',

      // Create button
      'create-election-btn': 'btn_create_election',

      // Table headers
      'table-header-title': 'table_header_title',
      'table-header-status': 'table_header_status',
      'table-header-dates': 'table_header_dates',
      'table-header-votes': 'table_header_votes',
      'table-header-actions': 'table_header_actions',

      // Loading text
      'loading-text': 'loading_elections'
    },
    placeholder: {
      // Search input
      'search-input': 'search_placeholder'
    }
  };

  // Set textContent for all mapped elements
  for (const [elementId, stringKey] of Object.entries(mappings.textContent)) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`[Elections List i18n] Element not found: #${elementId}`);
      continue;
    }

    const stringValue = R.string[stringKey];
    if (!stringValue) {
      console.warn(`[Elections List i18n] String key not found: ${stringKey}`);
      continue;
    }

    element.textContent = stringValue;
  }

  // Set placeholder for all mapped elements
  for (const [elementId, stringKey] of Object.entries(mappings.placeholder)) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`[Elections List i18n] Element not found: #${elementId}`);
      continue;
    }

    const stringValue = R.string[stringKey];
    if (!stringValue) {
      console.warn(`[Elections List i18n] String key not found: ${stringKey}`);
      continue;
    }

    element.placeholder = stringValue;
  }
}
