/**
 * Country Mapping Utility (Enhanced)
 *
 * Maps ISO 3166-1 alpha-2 country codes to both Icelandic and English names.
 * Supports flexible search by Icelandic name, English name, OR country code.
 *
 * Used for foreign address selection in member profiles.
 * Enhanced for UX: users can search any way they think (Icelandic, English, code)
 *
 * @module countries
 */

/**
 * ISO country codes to Icelandic and English names
 *
 * Structure: { code: { is: "Icelandic name", en: "English name" } }
 *
 * Includes most common countries for Icelandic citizens living abroad.
 * Source: Nordic countries, Europe, North America, Asia, Oceania
 */
export const COUNTRIES = {
  // Nordic Countries (Most common)
  'IS': { is: 'Ísland', en: 'Iceland' },
  'DK': { is: 'Danmörk', en: 'Denmark' },
  'NO': { is: 'Noregur', en: 'Norway' },
  'SE': { is: 'Svíþjóð', en: 'Sweden' },
  'FI': { is: 'Finnland', en: 'Finland' },

  // Western Europe
  'GB': { is: 'Bretland', en: 'United Kingdom' },
  'IE': { is: 'Írland', en: 'Ireland' },
  'FR': { is: 'Frakkland', en: 'France' },
  'DE': { is: 'Þýskaland', en: 'Germany' },
  'NL': { is: 'Holland', en: 'Netherlands' },
  'BE': { is: 'Belgía', en: 'Belgium' },
  'LU': { is: 'Lúxemborg', en: 'Luxembourg' },
  'CH': { is: 'Sviss', en: 'Switzerland' },
  'AT': { is: 'Austurríki', en: 'Austria' },

  // Southern Europe
  'ES': { is: 'Spánn', en: 'Spain' },
  'PT': { is: 'Portúgal', en: 'Portugal' },
  'IT': { is: 'Ítalía', en: 'Italy' },
  'GR': { is: 'Grikkland', en: 'Greece' },
  'MT': { is: 'Malta', en: 'Malta' },
  'CY': { is: 'Kýpur', en: 'Cyprus' },

  // Eastern Europe
  'PL': { is: 'Pólland', en: 'Poland' },
  'CZ': { is: 'Tékkland', en: 'Czech Republic' },
  'SK': { is: 'Slóvakía', en: 'Slovakia' },
  'HU': { is: 'Ungverjaland', en: 'Hungary' },
  'RO': { is: 'Rúmenía', en: 'Romania' },
  'BG': { is: 'Búlgaría', en: 'Bulgaria' },
  'HR': { is: 'Króatía', en: 'Croatia' },
  'SI': { is: 'Slóvenía', en: 'Slovenia' },
  'EE': { is: 'Eistland', en: 'Estonia' },
  'LV': { is: 'Lettland', en: 'Latvia' },
  'LT': { is: 'Litháen', en: 'Lithuania' },

  // Baltic & Eastern
  'RU': { is: 'Rússland', en: 'Russia' },
  'UA': { is: 'Úkraína', en: 'Ukraine' },
  'BY': { is: 'Hvíta-Rússland', en: 'Belarus' },

  // North America
  'US': { is: 'Bandaríkin', en: 'United States' },
  'CA': { is: 'Kanada', en: 'Canada' },
  'MX': { is: 'Mexíkó', en: 'Mexico' },

  // Central & South America
  'BR': { is: 'Brasilía', en: 'Brazil' },
  'AR': { is: 'Argentína', en: 'Argentina' },
  'CL': { is: 'Chili', en: 'Chile' },
  'CO': { is: 'Kólumbía', en: 'Colombia' },
  'PE': { is: 'Perú', en: 'Peru' },
  'VE': { is: 'Venesúela', en: 'Venezuela' },

  // Asia
  'CN': { is: 'Kína', en: 'China' },
  'JP': { is: 'Japan', en: 'Japan' },
  'KR': { is: 'Suður-Kórea', en: 'South Korea' },
  'IN': { is: 'Indland', en: 'India' },
  'TH': { is: 'Taíland', en: 'Thailand' },
  'VN': { is: 'Víetnam', en: 'Vietnam' },
  'PH': { is: 'Filippseyjar', en: 'Philippines' },
  'ID': { is: 'Indónesía', en: 'Indonesia' },
  'MY': { is: 'Malasía', en: 'Malaysia' },
  'SG': { is: 'Singapúr', en: 'Singapore' },
  'IL': { is: 'Ísrael', en: 'Israel' },
  'TR': { is: 'Tyrkland', en: 'Turkey' },
  'AE': { is: 'Sameinuðu arabísku furstadæmin', en: 'United Arab Emirates' },
  'SA': { is: 'Sádi-Arabía', en: 'Saudi Arabia' },

  // Africa
  'ZA': { is: 'Suður-Afríka', en: 'South Africa' },
  'EG': { is: 'Egyptaland', en: 'Egypt' },
  'NG': { is: 'Nígería', en: 'Nigeria' },
  'KE': { is: 'Kenýa', en: 'Kenya' },
  'MA': { is: 'Marokkó', en: 'Morocco' },

  // Oceania
  'AU': { is: 'Ástralía', en: 'Australia' },
  'NZ': { is: 'Nýja-Sjáland', en: 'New Zealand' },
  'FJ': { is: 'Fídjíeyjar', en: 'Fiji' }
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
  const country = COUNTRIES[upperCode];
  return country ? country.is : upperCode;
}

/**
 * Get English name for country code
 *
 * @param {string} code - ISO 3166-1 alpha-2 country code
 * @returns {string} English country name, or code if not found
 *
 * @example
 * getCountryNameEnglish('DK')  // → "Denmark"
 * getCountryNameEnglish('US')  // → "United States"
 */
export function getCountryNameEnglish(code) {
  if (!code) return '';

  const upperCode = code.toUpperCase();
  const country = COUNTRIES[upperCode];
  return country ? country.en : upperCode;
}

/**
 * Get country by code (returns both Icelandic and English names)
 *
 * @param {string} code - ISO country code
 * @returns {{code: string, nameIs: string, nameEn: string}|null} Country object or null
 *
 * @example
 * getCountryByCode('DK')
 * // → { code: "DK", nameIs: "Danmörk", nameEn: "Denmark" }
 */
export function getCountryByCode(code) {
  if (!code) return null;

  const upperCode = code.toUpperCase();
  const country = COUNTRIES[upperCode];

  if (!country) return null;

  return {
    code: upperCode,
    nameIs: country.is,
    nameEn: country.en
  };
}

/**
 * Get list of countries sorted alphabetically by Icelandic name
 *
 * @returns {Array<{code: string, nameIs: string, nameEn: string}>} Array of country objects
 *
 * @example
 * getCountriesSorted()
 * // → [
 * //     { code: "AU", nameIs: "Ástralía", nameEn: "Australia" },
 * //     { code: "AT", nameIs: "Austurríki", nameEn: "Austria" },
 * //     { code: "US", nameIs: "Bandaríkin", nameEn: "United States" },
 * //     ...
 * //   ]
 */
export function getCountriesSorted() {
  return Object.entries(COUNTRIES)
    .map(([code, names]) => ({
      code,
      nameIs: names.is,
      nameEn: names.en
    }))
    .sort((a, b) => a.nameIs.localeCompare(b.nameIs, 'is'));
}

/**
 * Get list of Nordic countries (most common for Icelandic members)
 *
 * @returns {Array<{code: string, nameIs: string, nameEn: string}>} Nordic countries
 */
export function getNordicCountries() {
  const nordicCodes = ['IS', 'DK', 'NO', 'SE', 'FI'];
  return nordicCodes.map(code => ({
    code,
    nameIs: COUNTRIES[code].is,
    nameEn: COUNTRIES[code].en
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
 * Search countries by Icelandic name, English name, OR country code
 *
 * Enhanced UX: Supports flexible search patterns
 * - "Banda" → Bandaríkin (Icelandic)
 * - "United" → Bandaríkin (English)
 * - "US" → Bandaríkin (code)
 *
 * See: docs/development/DATA_QUALITY_POLICY.md (Pattern 2: Flexible Search with Autocomplete)
 *
 * @param {string} query - Search query
 * @returns {Array<{code: string, nameIs: string, nameEn: string}>} Matching countries
 *
 * @example
 * searchCountries('dan')
 * // → [{ code: "DK", nameIs: "Danmörk", nameEn: "Denmark" }]
 *
 * searchCountries('United')
 * // → [{ code: "US", nameIs: "Bandaríkin", nameEn: "United States" }, ...]
 *
 * searchCountries('US')
 * // → [{ code: "US", nameIs: "Bandaríkin", nameEn: "United States" }]
 */
export function searchCountries(query) {
  if (!query || query.trim().length === 0) return [];

  const lowerQuery = query.toLowerCase().trim();

  return Object.entries(COUNTRIES)
    .filter(([code, names]) => {
      const matchesCode = code.toLowerCase().includes(lowerQuery);
      const matchesIcelandic = names.is.toLowerCase().includes(lowerQuery);
      const matchesEnglish = names.en.toLowerCase().includes(lowerQuery);

      return matchesCode || matchesIcelandic || matchesEnglish;
    })
    .map(([code, names]) => ({
      code,
      nameIs: names.is,
      nameEn: names.en
    }))
    .sort((a, b) => {
      // Prioritize exact code matches first (e.g., "US" search → US comes first)
      const aCodeMatch = a.code.toLowerCase() === lowerQuery;
      const bCodeMatch = b.code.toLowerCase() === lowerQuery;

      if (aCodeMatch && !bCodeMatch) return -1;
      if (!aCodeMatch && bCodeMatch) return 1;

      // Otherwise sort alphabetically by Icelandic name
      return a.nameIs.localeCompare(b.nameIs, 'is');
    });
}
