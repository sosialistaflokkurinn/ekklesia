/**
 * Country Mapping Utility
 *
 * Maps ISO 3166-1 alpha-2 country codes to Icelandic country names.
 * Used for displaying foreign addresses in member profiles.
 *
 * @module countries
 */

/**
 * ISO country codes to Icelandic names
 *
 * Includes most common countries for Icelandic citizens living abroad.
 * Source: Nordic countries, Europe, North America, Oceania
 */
export const COUNTRIES = {
  // Nordic Countries (Most common)
  'IS': 'Ísland',
  'DK': 'Danmörk',
  'NO': 'Noregur',
  'SE': 'Svíþjóð',
  'FI': 'Finnland',

  // Western Europe
  'GB': 'Bretland',
  'IE': 'Írland',
  'FR': 'Frakkland',
  'DE': 'Þýskaland',
  'NL': 'Holland',
  'BE': 'Belgía',
  'LU': 'Lúxemborg',
  'CH': 'Sviss',
  'AT': 'Austurríki',

  // Southern Europe
  'ES': 'Spánn',
  'PT': 'Portúgal',
  'IT': 'Ítalía',
  'GR': 'Grikkland',
  'MT': 'Malta',
  'CY': 'Kýpur',

  // Eastern Europe
  'PL': 'Pólland',
  'CZ': 'Tékkland',
  'SK': 'Slóvakía',
  'HU': 'Ungverjaland',
  'RO': 'Rúmenía',
  'BG': 'Búlgaría',
  'HR': 'Króatía',
  'SI': 'Slóvenía',
  'EE': 'Eistland',
  'LV': 'Lettland',
  'LT': 'Litháen',

  // Baltic & Eastern
  'RU': 'Rússland',
  'UA': 'Úkraína',
  'BY': 'Hvíta-Rússland',

  // North America
  'US': 'Bandaríkin',
  'CA': 'Kanada',
  'MX': 'Mexíkó',

  // Central & South America
  'BR': 'Brasilía',
  'AR': 'Argentína',
  'CL': 'Chili',
  'CO': 'Kólumbía',
  'PE': 'Perú',
  'VE': 'Venesúela',

  // Asia
  'CN': 'Kína',
  'JP': 'Japan',
  'KR': 'Suður-Kórea',
  'IN': 'Indland',
  'TH': 'Taíland',
  'VN': 'Víetnam',
  'PH': 'Filippseyjar',
  'ID': 'Indónesía',
  'MY': 'Malasía',
  'SG': 'Singapúr',
  'IL': 'Ísrael',
  'TR': 'Tyrkland',
  'AE': 'Sameinuðu arabísku furstadæmin',
  'SA': 'Sádi-Arabía',

  // Africa
  'ZA': 'Suður-Afríka',
  'EG': 'Egyptaland',
  'NG': 'Nígería',
  'KE': 'Kenýa',
  'MA': 'Marokkó',

  // Oceania
  'AU': 'Ástralía',
  'NZ': 'Nýja-Sjáland',
  'FJ': 'Fídjíeyjar'
};

/**
 * Get Icelandic name for country code
 *
 * @param {string} code - ISO 3166-1 alpha-2 country code (e.g., "DK", "US")
 * @returns {string} Icelandic country name, or code if not found
 *
 * @example
 * getCountryName('DK')  // → "Danmörk"
 * getCountryName('US')  // → "Bandaríkin"
 * getCountryName('XX')  // → "XX" (unknown code)
 */
export function getCountryName(code) {
  if (!code) return '';

  const upperCode = code.toUpperCase();
  return COUNTRIES[upperCode] || upperCode;
}

/**
 * Get list of countries sorted alphabetically by Icelandic name
 *
 * @returns {Array<{code: string, name: string}>} Array of country objects
 *
 * @example
 * getCountriesSorted()
 * // → [
 * //     { code: "AU", name: "Ástralía" },
 * //     { code: "AT", name: "Austurríki" },
 * //     { code: "US", name: "Bandaríkin" },
 * //     ...
 * //   ]
 */
export function getCountriesSorted() {
  return Object.entries(COUNTRIES)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'is'));
}

/**
 * Get list of Nordic countries (most common for Icelandic members)
 *
 * @returns {Array<{code: string, name: string}>} Nordic countries
 */
export function getNordicCountries() {
  const nordicCodes = ['IS', 'DK', 'NO', 'SE', 'FI'];
  return nordicCodes.map(code => ({
    code,
    name: COUNTRIES[code]
  }));
}

/**
 * Check if country code is valid
 *
 * @param {string} code - ISO country code
 * @returns {boolean} True if code exists in mapping
 */
export function isValidCountryCode(code) {
  if (!code) return false;
  return code.toUpperCase() in COUNTRIES;
}

/**
 * Search countries by Icelandic name
 *
 * @param {string} query - Search query
 * @returns {Array<{code: string, name: string}>} Matching countries
 *
 * @example
 * searchCountries('dan')  // → [{ code: "DK", name: "Danmörk" }]
 */
export function searchCountries(query) {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();
  return Object.entries(COUNTRIES)
    .filter(([code, name]) =>
      name.toLowerCase().includes(lowerQuery) ||
      code.toLowerCase().includes(lowerQuery)
    )
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'is'));
}
