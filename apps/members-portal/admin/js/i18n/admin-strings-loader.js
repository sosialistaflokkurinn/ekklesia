/**
 * Admin Strings Loader
 *
 * Singleton class for loading and accessing admin-specific i18n strings
 * from /admin/i18n/values-is/admin-portal-strings.xml
 *
 * Usage:
 *   import { adminStrings } from './i18n/admin-strings-loader.js';
 *   await adminStrings.load();
 *   const text = adminStrings.get('sync_members_title');
 */

import { debug } from '../../../js/utils/util-debug.js';

class AdminStringsLoader {
  constructor() {
    this.strings = {};
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.strings;

    try {
      const response = await fetch('/admin/i18n/values-is/admin-portal-strings.xml');
      if (!response.ok) {
        throw new Error(`Failed to load admin strings: ${response.statusText}`);
      }

      const xmlText = await response.text();
      this.strings = this.parseXML(xmlText);
      this.loaded = true;

      return this.strings;
    } catch (error) {
      debug.error('Failed to load admin strings:', error);
      throw error;
    }
  }

  parseXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

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

  get(key) {
    return this.strings[key] || key;
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
      debug.warn('translatePage called before strings loaded');
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

    debug.log(`Translated page with ${Object.keys(this.strings).length} admin strings`);
  }
}

// Export singleton instance
export const adminStrings = new AdminStringsLoader();
