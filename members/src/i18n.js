import i18next from 'i18next';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize i18next with Icelandic translations
 */
export async function initI18n() {
  // Load Icelandic translations
  const isTranslations = JSON.parse(
    await fs.readFile(path.join(__dirname, 'locales', 'is.json'), 'utf-8')
  );

  await i18next.init({
    lng: 'is', // Default language: Icelandic
    fallbackLng: 'is',
    debug: false,
    resources: {
      is: {
        translation: isTranslations
      }
    },
    interpolation: {
      escapeValue: false // Not needed for server-side
    }
  });

  return i18next;
}

/**
 * Get translation function
 */
export function getT() {
  return i18next.t.bind(i18next);
}

/**
 * Translation helper for templates
 * Returns a function that can be used in template rendering
 */
export function createTranslator(language = 'is') {
  return (key, options = {}) => {
    return i18next.t(key, { lng: language, ...options });
  };
}
