/**
 * Icelandic Declension Service
 *
 * Uses the BÍN (Beygingarlýsing íslensks nútímamáls) API from Árnastofnun
 * to get all inflected forms of Icelandic words.
 *
 * API Documentation: https://bin.arnastofnun.is/DMII/dmii-core/api/
 *
 * @module service-icelandic-declension
 */

const axios = require('axios');

const BIN_API_BASE = 'https://bin.arnastofnun.is/api';

// In-memory cache to avoid repeated API calls
// Key: lowercase word, Value: array of all forms
const formsCache = new Map();

// Common Icelandic personal names with their declensions
// These are pre-cached because BÍN doesn't always have personal names
const PERSONAL_NAMES = {
  // Karlmannsnöfn (nf, þf, þgf, ef)
  'kári': ['kári', 'kára', 'kára', 'kára'],
  'gunnar': ['gunnar', 'gunnar', 'gunnari', 'gunnars'],
  'trausti': ['trausti', 'trausta', 'trausta', 'trausta'],
  'sæþór': ['sæþór', 'sæþór', 'sæþóri', 'sæþórs'],
  'smári': ['smári', 'smára', 'smára', 'smára'],
  'jón': ['jón', 'jón', 'jóni', 'jóns'],
  'baldur': ['baldur', 'baldur', 'baldri', 'baldurs'],

  // Kvenmannsnöfn
  'sanna': ['sanna', 'sönnu', 'sönnu', 'sönnu'],
  'sólveig': ['sólveig', 'sólveigu', 'sólveigu', 'sólveigar'],
  'anna': ['anna', 'önnu', 'önnu', 'önnu'],
  'magdalena': ['magdalena', 'magdalenu', 'magdalenu', 'magdalenu'],
};

/**
 * Get all inflected forms of a word from BÍN API
 *
 * @param {string} word - The word to look up (any form)
 * @returns {Promise<string[]>} Array of all forms (lowercase)
 */
async function getAllForms(word) {
  const key = word.toLowerCase();

  // Check cache first
  if (formsCache.has(key)) {
    return formsCache.get(key);
  }

  // Check personal names
  if (PERSONAL_NAMES[key]) {
    const forms = [...new Set(PERSONAL_NAMES[key])];
    formsCache.set(key, forms);
    return forms;
  }

  try {
    // Try looking up by lemma first
    const response = await axios.get(`${BIN_API_BASE}/ord/${encodeURIComponent(word)}`, {
      timeout: 5000,
    });

    if (response.data && response.data.length > 0 && response.data[0].bmyndir) {
      const forms = [...new Set(response.data[0].bmyndir.map(m => m.b.toLowerCase()))];
      formsCache.set(key, forms);
      return forms;
    }

    // If not found by lemma, try by inflected form
    const inflectedResponse = await axios.get(`${BIN_API_BASE}/beygingarmynd/${encodeURIComponent(word)}`, {
      timeout: 5000,
    });

    if (inflectedResponse.data && inflectedResponse.data.length > 0) {
      // Get the lemma and then get all its forms
      const lemma = inflectedResponse.data[0].ord;
      const lemmaResponse = await axios.get(`${BIN_API_BASE}/ord/${encodeURIComponent(lemma)}`, {
        timeout: 5000,
      });

      if (lemmaResponse.data && lemmaResponse.data.length > 0 && lemmaResponse.data[0].bmyndir) {
        const forms = [...new Set(lemmaResponse.data[0].bmyndir.map(m => m.b.toLowerCase()))];
        formsCache.set(key, forms);
        return forms;
      }
    }
  } catch (error) {
    // API error - log but don't fail
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`BÍN API error for "${word}":`, error.message);
    }
  }

  // Fallback: return just the word itself
  const fallback = [key];
  formsCache.set(key, fallback);
  return fallback;
}

/**
 * Check if text contains any form of the given word
 *
 * @param {string} text - Text to search in
 * @param {string} word - Word to look for (any form)
 * @returns {Promise<boolean>} True if any form is found
 */
async function textContainsWord(text, word) {
  const textLower = text.toLowerCase();
  const wordLower = word.toLowerCase();

  // Quick direct check first
  if (textLower.includes(wordLower)) {
    return true;
  }

  // Check personal names directly (faster than API)
  if (PERSONAL_NAMES[wordLower]) {
    return PERSONAL_NAMES[wordLower].some(form => textLower.includes(form));
  }

  // Get all forms and check
  const forms = await getAllForms(word);
  return forms.some(form => textLower.includes(form));
}

/**
 * Check if text contains all expected terms (with declension support)
 *
 * @param {string} text - Text to search in
 * @param {string[]} expectedTerms - Terms to look for (supports | for OR)
 * @returns {Promise<boolean>} True if all terms are found
 */
async function textContainsAllTerms(text, expectedTerms) {
  for (const term of expectedTerms) {
    const alternatives = term.split('|');
    let found = false;

    for (const alt of alternatives) {
      if (await textContainsWord(text, alt.trim())) {
        found = true;
        break;
      }
    }

    if (!found) {
      return false;
    }
  }

  return true;
}

/**
 * Get lemma (base form) from any inflected form
 *
 * @param {string} word - Any inflected form
 * @returns {Promise<string|null>} Lemma or null if not found
 */
async function getLemma(word) {
  try {
    const response = await axios.get(`${BIN_API_BASE}/beygingarmynd/${encodeURIComponent(word)}`, {
      timeout: 5000,
    });

    if (response.data && response.data.length > 0) {
      return response.data[0].ord;
    }
  } catch (error) {
    // API error
  }

  return null;
}

/**
 * Clear the forms cache (useful for testing)
 */
function clearCache() {
  formsCache.clear();
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
function getCacheStats() {
  return {
    size: formsCache.size,
    personalNamesCount: Object.keys(PERSONAL_NAMES).length,
  };
}

module.exports = {
  getAllForms,
  textContainsWord,
  textContainsAllTerms,
  getLemma,
  clearCache,
  getCacheStats,
  PERSONAL_NAMES,
};
