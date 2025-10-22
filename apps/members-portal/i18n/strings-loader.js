/**
 * XML Strings Loader (Android strings.xml style)
 *
 * Loads and parses strings.xml files for i18n, similar to Android's R.string pattern.
 * Supports:
 * - Multiple locales (values-is/, values-en/, etc.)
 * - String formatting with %s placeholders
 * - Fallback to default locale
 *
 * Usage:
 *   import { R } from '/i18n/strings-loader.js';
 *   const text = R.string.login_title;
 *   const formatted = R.format(R.string.error_authentication, errorMsg);
 */

class StringsLoader {
  constructor() {
    this.strings = {};
    this.currentLocale = 'is'; // Default to Icelandic
    this.loaded = false;
  }

  /**
   * Load strings.xml for specified locale
   * @param {string} locale - Locale code (e.g., 'is', 'en')
   * @returns {Promise<Object>} - Parsed strings object
   */
  async load(locale = 'is') {
    // Check if already loaded for this locale
    if (this.loaded && this.currentLocale === locale) {
      console.log(`✓ Using cached strings for locale: ${locale} (${Object.keys(this.strings).length} strings)`);
      return this.strings;
    }

    this.currentLocale = locale;
    const xmlPath = `/i18n/values-${locale}/strings.xml`;

    try {
      const response = await fetch(xmlPath);
      if (!response.ok) {
        throw new Error(`Failed to load strings.xml: ${response.statusText}`);
      }

      const xmlText = await response.text();
      this.strings = this.parseXML(xmlText);
      this.loaded = true;

      console.log(`✓ Loaded ${Object.keys(this.strings).length} strings for locale: ${locale}`);
      return this.strings;
    } catch (error) {
      console.error(`Failed to load strings for locale ${locale}:`, error);

      // Fallback to default locale if not already trying default
      if (locale !== 'is') {
        console.warn(`Falling back to default locale: is`);
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
   * @example
   * R.format(R.string.error_authentication, "Invalid token")
   * // => "Villa við auðkenningu: Invalid token"
   */
  format(template, ...args) {
    if (!template) return '';

    let result = template;
    args.forEach(arg => {
      // Replace %s (string), %d (decimal), or %% (literal %)
      result = result.replace(/%s|%d/, String(arg));
    });

    return result;
  }

  /**
   * Get string by key with optional formatting
   * @param {string} key - String key
   * @param {...any} args - Format arguments
   * @returns {string} - String value (formatted if args provided)
   */
  get(key, ...args) {
    const value = this.strings[key];

    if (!value) {
      console.warn(`Missing string key: ${key}`);
      return key; // Return key as fallback
    }

    if (args.length > 0) {
      return this.format(value, ...args);
    }

    return value;
  }

  /**
   * Check if a string key exists
   * @param {string} key - String key
   * @returns {boolean}
   */
  has(key) {
    return key in this.strings;
  }

  /**
   * Get all strings (useful for debugging)
   * @returns {Object} - All loaded strings
   */
  getAll() {
    return { ...this.strings };
  }
}

// Singleton instance
const stringsLoader = new StringsLoader();

/**
 * R.string - Android-style string resource accessor
 *
 * Usage:
 *   R.string.login_title
 *   R.format(R.string.error_authentication, errorMsg)
 *   R.string.app_name
 */
export const R = {
  /**
   * Proxy to access strings via dot notation
   * Returns empty string for missing keys (safe default)
   */
  string: new Proxy({}, {
    get(target, prop) {
      return stringsLoader.get(prop) || '';
    }
  }),

  /**
   * Format string with arguments
   * @param {string} template - String template
   * @param {...any} args - Format arguments
   * @returns {string}
   */
  format: (template, ...args) => stringsLoader.format(template, ...args),

  /**
   * Load strings for specified locale
   * Must be called before accessing R.string
   * @param {string} locale - Locale code (default: 'is')
   * @returns {Promise<void>}
   */
  load: (locale) => stringsLoader.load(locale),

  /**
   * Check if string key exists
   * @param {string} key - String key
   * @returns {boolean}
   */
  has: (key) => stringsLoader.has(key),

  /**
   * Get all strings (for debugging)
   * @returns {Object}
   */
  getAll: () => stringsLoader.getAll(),

  /**
   * Get current locale
   * @returns {string}
   */
  getLocale: () => stringsLoader.currentLocale,

  /**
   * Check if strings are loaded
   * @returns {boolean}
   */
  isLoaded: () => stringsLoader.loaded
};

// Lazy loading only - no auto-load
// Pages call R.load() via initSession(), which caches the result
// This avoids double-fetch on first page load
export default R;
