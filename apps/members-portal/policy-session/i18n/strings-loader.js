/**
 * Policy Session i18n Strings Loader
 * 
 * Loads localized strings from policy-session/i18n directory
 */

import { debug } from '../../js/utils/util-debug.js';

class StringsResource {
  constructor() {
    this.string = {};
    this.locale = null;
  }

  /**
   * Load strings for specified locale
   * @param {string} locale - Locale code (e.g., 'is', 'en')
   * @returns {Promise<void>}
   */
  async load(locale) {
    try {
      const response = await fetch(`./i18n/values-${locale}/policy-session-strings.xml`);
      
      if (!response.ok) {
        throw new Error(`Failed to load strings: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Check for parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('XML parsing error: ' + parserError.textContent);
      }

      // Parse strings
      const stringElements = xmlDoc.querySelectorAll('string');
      this.string = {};

      stringElements.forEach(element => {
        const name = element.getAttribute('name');
        const value = element.textContent;
        if (name) {
          this.string[name] = value;
        }
      });

      this.locale = locale;
      debug.log(`✓ Loaded ${Object.keys(this.string).length} strings for locale: ${locale}`);

    } catch (error) {
      console.error('Error loading strings:', error);
      throw error;
    }
  }

  /**
   * Translate all elements on the page that have data-i18n attributes.
   * 
   * Supported attributes:
   * - data-i18n="key" - Sets textContent
   * - data-i18n-title="key" - Sets title attribute
   * - data-i18n-placeholder="key" - Sets placeholder attribute
   * - data-i18n-aria-label="key" - Sets aria-label attribute
   */
  translatePage() {
    if (!this.locale) {
      debug.warn('translatePage called before strings loaded');
      return;
    }

    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const value = this.string[key];
      if (value) {
        element.textContent = value;
      }
    });

    // Translate title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const value = this.string[key];
      if (value) {
        element.setAttribute('title', value);
      }
    });

    // Translate placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const value = this.string[key];
      if (value) {
        element.setAttribute('placeholder', value);
      }
    });

    // Translate aria-label attributes
    document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
      const key = element.getAttribute('data-i18n-aria-label');
      const value = this.string[key];
      if (value) {
        element.setAttribute('aria-label', value);
      }
    });

    debug.log(`Translated page with ${Object.keys(this.string).length} policy-session strings`);
  }
}

// Export singleton instance
export const R = new StringsResource();
