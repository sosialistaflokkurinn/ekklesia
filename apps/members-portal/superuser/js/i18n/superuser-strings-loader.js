/**
 * Superuser Strings Loader
 *
 * Singleton class for loading and accessing superuser-specific i18n strings
 * from /superuser/i18n/values-is/superuser-portal-strings.xml
 *
 * Usage:
 *   import { superuserStrings } from './i18n/superuser-strings-loader.js';
 *   await superuserStrings.load();
 *   const text = superuserStrings.get('superuser_dashboard_title');
 */

import { debug } from '../../../js/utils/util-debug.js';

class SuperuserStringsLoader {
  constructor() {
    this.strings = {};
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.strings;

    try {
      const response = await fetch('/superuser/i18n/values-is/superuser-portal-strings.xml');
      if (!response.ok) {
        throw new Error(`Failed to load superuser strings: ${response.statusText}`);
      }

      const xmlText = await response.text();
      this.strings = this.parseXML(xmlText);
      this.loaded = true;

      return this.strings;
    } catch (error) {
      debug.error('Failed to load superuser strings:', error);
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
   * Translate all elements with data-i18n attributes
   * Supports:
   *   data-i18n="key"           - Sets textContent
   *   data-i18n-title="key"     - Sets title attribute
   *   data-i18n-placeholder="key" - Sets placeholder attribute
   *   data-i18n-aria-label="key"  - Sets aria-label attribute
   */
  translatePage() {
    if (!this.loaded) {
      debug.warn('superuserStrings.translatePage() called before load()');
      return;
    }

    // Translate textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const translation = this.get(key);
      if (translation !== key) {
        el.textContent = translation;
      }
    });

    // Translate title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const translation = this.get(key);
      if (translation !== key) {
        el.setAttribute('title', translation);
      }
    });

    // Translate placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const translation = this.get(key);
      if (translation !== key) {
        el.setAttribute('placeholder', translation);
      }
    });

    // Translate aria-label attributes
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      const translation = this.get(key);
      if (translation !== key) {
        el.setAttribute('aria-label', translation);
      }
    });
  }
}

// Export singleton instance
export const superuserStrings = new SuperuserStringsLoader();
