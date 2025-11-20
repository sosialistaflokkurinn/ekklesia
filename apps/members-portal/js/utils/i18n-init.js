/**
 * i18n Initialization Utility
 *
 * Provides standardized functions for initializing internationalization strings
 * across all pages in the Ekklesia application. Replaces inline i18n code with
 * a consistent, maintainable pattern.
 *
 * @module js/utils/i18n-init
 */

import { R } from '../../i18n/strings-loader.js';
import { showToast } from '../components/toast.js';

/**
 * Initialize i18n strings for a page using element-to-string mappings
 *
 * This function loads the specified locale and sets textContent/placeholder
 * for all mapped elements. It provides consistent error handling and logging.
 *
 * @param {string} locale - The locale code to load (e.g., 'is', 'en')
 * @param {Object} mappings - Element ID to string key mappings
 * @param {Object.<string, string>} mappings.textContent - Map of element IDs to string keys for textContent
 * @param {Object.<string, string>} [mappings.placeholder] - Map of element IDs to string keys for placeholder
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.logErrors=true] - Whether to log errors for missing elements
 * @param {boolean} [options.throwOnMissing=false] - Whether to throw errors for missing elements
 * @returns {Promise<void>} Resolves when all strings are initialized
 * @throws {Error} If locale fails to load or elements are missing (when throwOnMissing=true)
 *
 * @example
 * // Basic usage
 * await initPageStrings('is', {
 *   textContent: {
 *     'page-title': 'page_title',
 *     'nav-brand': 'nav_brand',
 *     'submit-btn': 'btn_submit'
 *   },
 *   placeholder: {
 *     'search-input': 'placeholder_search'
 *   }
 * });
 *
 * @example
 * // With custom options
 * await initPageStrings('is', mappings, {
 *   logErrors: false,
 *   throwOnMissing: true
 * });
 */
export async function initPageStrings(locale, mappings, options = {}) {
  const { logErrors = true, throwOnMissing = false } = options;

  // Load i18n strings
  try {
    await R.load(locale);
  } catch (error) {
    console.error(`[i18n-init] Failed to load locale '${locale}':`, error);
    throw error;
  }

  const errors = [];

  // Set textContent for all mapped elements
  if (mappings.textContent) {
    for (const [elementId, stringKey] of Object.entries(mappings.textContent)) {
      const element = document.getElementById(elementId);

      if (!element) {
        const error = `Element not found: #${elementId}`;
        errors.push(error);
        if (logErrors) console.warn(`[i18n-init] ${error}`);
        continue;
      }

      const stringValue = R.string[stringKey];
      if (stringValue === undefined) {
        const error = `String key not found: ${stringKey}`;
        errors.push(error);
        if (logErrors) console.warn(`[i18n-init] ${error}`);
        continue;
      }

      element.textContent = stringValue;
    }
  }

  // Set placeholder for all mapped elements
  if (mappings.placeholder) {
    for (const [elementId, stringKey] of Object.entries(mappings.placeholder)) {
      const element = document.getElementById(elementId);

      if (!element) {
        const error = `Element not found: #${elementId}`;
        errors.push(error);
        if (logErrors) console.warn(`[i18n-init] ${error}`);
        continue;
      }

      const stringValue = R.string[stringKey];
      if (stringValue === undefined) {
        const error = `String key not found: ${stringKey}`;
        errors.push(error);
        if (logErrors) console.warn(`[i18n-init] ${error}`);
        continue;
      }

      element.placeholder = stringValue;
    }
  }

  // Throw if configured and errors occurred
  if (throwOnMissing && errors.length > 0) {
    throw new Error(`i18n initialization failed: ${errors.join(', ')}`);
  }
}

/**
 * Batch initialize multiple element types with same string key pattern
 *
 * Useful when element IDs follow a naming convention that matches string keys.
 * For example, if element ID 'btn-save' maps to string key 'btn_save'.
 *
 * @param {string} locale - The locale code to load
 * @param {string[]} elementIds - Array of element IDs to initialize
 * @param {Object} [options] - Options for initialization
 * @param {Function} [options.transform] - Transform element ID to string key (default: replace '-' with '_')
 * @param {string} [options.property='textContent'] - Property to set ('textContent' or 'placeholder')
 * @returns {Promise<void>} Resolves when all strings are initialized
 *
 * @example
 * // Initialize buttons where ID pattern matches string key pattern
 * await batchInitStrings('is', [
 *   'btn-save',    // maps to R.string.btn_save
 *   'btn-cancel',  // maps to R.string.btn_cancel
 *   'btn-delete'   // maps to R.string.btn_delete
 * ]);
 *
 * @example
 * // With custom transform
 * await batchInitStrings('is', ['pageTitle', 'navBrand'], {
 *   transform: (id) => id.toLowerCase() // pageTitle → pagetitle
 * });
 */
export async function batchInitStrings(locale, elementIds, options = {}) {
  const {
    transform = (id) => id.replace(/-/g, '_'),
    property = 'textContent'
  } = options;

  await R.load(locale);

  for (const elementId of elementIds) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`[i18n-init] Element not found: #${elementId}`);
      continue;
    }

    const stringKey = transform(elementId);
    const stringValue = R.string[stringKey];

    if (stringValue === undefined) {
      console.warn(`[i18n-init] String key not found: ${stringKey} (from element ID: ${elementId})`);
      continue;
    }

    element[property] = stringValue;
  }
}

/**
 * Initialize strings and return R object for further use
 *
 * Convenience function for pages that need to access R.string after initialization.
 * Loads locale and returns the R object so page scripts can access strings.
 *
 * @param {string} locale - The locale code to load
 * @returns {Promise<Object>} The R object with loaded strings
 *
 * @example
 * // Load strings and use R in script
 * const R = await loadStrings('is');
 * console.log(R.string.page_title);
 * showToast(R.string.success_message);
 */
export async function loadStrings(locale) {
  await R.load(locale);
  return R;
}

/**
 * Initialize common navigation strings
 *
 * Helper function for standard navigation elements that appear on most pages.
 * Reduces boilerplate by providing defaults for common nav elements.
 *
 * @param {string} locale - The locale code to load
 * @param {Object} [customMappings] - Additional custom mappings to merge with defaults
 * @returns {Promise<void>} Resolves when navigation strings are initialized
 *
 * @example
 * // Initialize standard nav elements
 * await initNavStrings('is');
 *
 * @example
 * // Initialize standard nav + custom elements
 * await initNavStrings('is', {
 *   textContent: {
 *     'custom-nav-item': 'custom_nav_string'
 *   }
 * });
 */
export async function initNavStrings(locale, customMappings = {}) {
  const defaultMappings = {
    textContent: {
      'nav-brand': 'nav_brand',
      'nav-dashboard': 'nav_dashboard',
      'nav-profile': 'nav_profile',
      'nav-elections': 'nav_elections',
      'nav-events': 'nav_events',
      'nav-logout': 'nav_logout',
      'nav-back-to-member': 'admin_nav_back_to_member',
      'admin-brand': 'admin_brand',
      ...customMappings.textContent
    }
  };

  await initPageStrings(locale, defaultMappings, { logErrors: false });
}
