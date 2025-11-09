/**
 * Policy Session i18n Strings Loader
 * 
 * Loads localized strings from policy-session/i18n directory
 */

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
      const response = await fetch(`./i18n/values-${locale}/strings.xml`);
      
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
      console.log(`✓ Loaded ${Object.keys(this.string).length} strings for locale: ${locale}`);

    } catch (error) {
      console.error('Error loading strings:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const R = new StringsResource();
