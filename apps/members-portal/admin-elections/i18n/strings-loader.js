/**
 * XML Strings Loader for Admin Elections
 *
 * Loads and parses strings.xml files for admin-elections area.
 * This is a separate i18n system from the general admin portal.
 *
 * Usage:
 *   import { R } from './i18n/strings-loader.js';
 *   await R.load('is');
 *   const text = R.string.admin_elections_title;
 */

import { debug } from '../../js/utils/util-debug.js';

class AdminElectionsStringsLoader {
  constructor() {
    this.strings = {};
    this.currentLocale = 'is'; // Default to Icelandic
    this.loaded = false;
  }

  /**
   * Load strings.xml for specified locale from admin-elections directory
   * @param {string} locale - Locale code (e.g., 'is', 'en')
   * @returns {Promise<Object>} - Parsed strings object
   */
  async load(locale = 'is') {
    // Check if already loaded for this locale
    if (this.loaded && this.currentLocale === locale) {
      debug.log(`[Admin Elections i18n] ✓ Using cached strings for locale: ${locale} (${Object.keys(this.strings).length} strings)`);
      return this.strings;
    }

    this.currentLocale = locale;
    const xmlPath = `/admin-elections/i18n/values-${locale}/admin-elections-strings.xml`;

    try {
      const response = await fetch(xmlPath);
      if (!response.ok) {
        throw new Error(`Failed to load admin-elections strings.xml: ${response.statusText}`);
      }

      const xmlText = await response.text();
      this.strings = this.parseXML(xmlText);
      this.loaded = true;

      debug.log(`[Admin Elections i18n] ✓ Loaded ${Object.keys(this.strings).length} strings for locale: ${locale}`);
      return this.strings;
    } catch (error) {
      console.error(`[Admin Elections i18n] Failed to load strings for locale ${locale}:`, error);

      // Fallback to default locale if not already trying default
      if (locale !== 'is') {
        debug.warn(`[Admin Elections i18n] Falling back to default locale: is`);
        return this.load('is');
      }

      throw error;
    }
  }

  /**
   * Parse XML string into JavaScript object
   * @param {string} xmlText - XML content
   * @returns {Object} - Parsed strings object
   */
  parseXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`XML parsing error: ${parserError.textContent}`);
    }

    const strings = {};
    const stringElements = xmlDoc.querySelectorAll('string');

    stringElements.forEach(element => {
      const name = element.getAttribute('name');
      const value = element.textContent;

      if (name) {
        strings[name] = value;
      }
    });

    return strings;
  }

  /**
   * Format string with placeholders (%s, %d, etc.)
   * Similar to Android String.format() and printf()
   *
   * @param {string} template - String with placeholders
   * @param {...any} args - Values to substitute
   * @returns {string} - Formatted string
   *
   * Examples:
   *   format("Hello %s", "World") → "Hello World"
   *   format("Found %d results", 5) → "Found 5 results"
   *   format("User %s has %d points", "Alice", 42) → "User Alice has 42 points"
   */
  format(template, ...args) {
    if (!template) return '';
    if (args.length === 0) return template;

    let result = template;
    let argIndex = 0;

    // Replace %s, %d, %f, etc. in order
    result = result.replace(/%[sdf]/g, () => {
      if (argIndex >= args.length) return '';
      return String(args[argIndex++]);
    });

    return result;
  }

  /**
   * Get string by key with optional formatting
   * @param {string} key - String key
   * @param {...any} args - Optional format arguments
   * @returns {string} - String value (formatted if args provided)
   */
  get(key, ...args) {
    const value = this.strings[key];
    
    if (!value) {
      console.warn(`[Admin Elections i18n] Missing string key: ${key}`);
      return key; // Return key as fallback
    }

    if (args.length > 0) {
      return this.format(value, ...args);
    }

    return value;
  }

  /**
   * Getter for strings object (for R.string.key_name syntax)
   */
  get string() {
    return this.strings;
  }

  /**
   * Translate all elements on the page that have data-i18n attributes.
   * 
   * Supported attributes:
   * - data-i18n="key" - Sets textContent
   * - data-i18n-title="key" - Sets title attribute
   * - data-i18n-placeholder="key" - Sets placeholder attribute
   * - data-i18n-aria-label="key" - Sets aria-label attribute
   * 
   * Must be called AFTER load() completes.
   */
  translatePage() {
    if (!this.loaded) {
      debug.warn('translatePage called before admin-elections strings loaded');
      return;
    }

    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const value = this.get(key);
      if (value && value !== key) {
        element.textContent = value;
      }
    });

    // Translate title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const value = this.get(key);
      if (value && value !== key) {
        element.setAttribute('title', value);
      }
    });

    // Translate placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const value = this.get(key);
      if (value && value !== key) {
        element.setAttribute('placeholder', value);
      }
    });

    // Translate aria-label attributes
    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const key = element.getAttribute('data-i18n-aria-label');
      const value = this.get(key);
      if (value && value !== key) {
        element.setAttribute('aria-label', value);
      }
    });

    debug.log(`[Admin Elections i18n] Translated page with ${Object.keys(this.strings).length} strings`);
  }
}

// Export singleton instance
export const R = new AdminElectionsStringsLoader();
