/**
 * R.string - Resource String Utility (Android-style)
 *
 * Provides centralized access to localized strings.
 * Currently supports Icelandic only, but designed for future expansion.
 *
 * Usage:
 *   import { R } from './i18n/R.js';
 *   const text = R.string.login_title; // "Innskráning"
 */

import { strings } from './is.js';

/**
 * R.string - Access localized strings via property access
 *
 * Uses Proxy to provide:
 * - Dot notation access: R.string.key
 * - Fallback for missing keys: [Missing: key]
 * - Easy to extend with multiple languages later
 */
export const R = {
  string: new Proxy(strings, {
    get(target, key) {
      if (key in target) {
        return target[key];
      }
      // Fallback for missing keys (helps with debugging)
      console.warn(`Missing translation key: ${key}`);
      return `[Missing: ${key}]`;
    }
  })
};

// Future expansion: Language switching
// Uncomment when adding multiple languages:
//
// let currentLanguage = 'is';
// const languages = { is };
//
// export const R = {
//   string: new Proxy({}, {
//     get(target, key) {
//       const strings = languages[currentLanguage];
//       return strings[key] || `[Missing: ${key}]`;
//     }
//   }),
//
//   setLanguage(lang) {
//     if (languages[lang]) {
//       currentLanguage = lang;
//       localStorage.setItem('language', lang);
//       document.documentElement.lang = lang;
//     }
//   }
// };
