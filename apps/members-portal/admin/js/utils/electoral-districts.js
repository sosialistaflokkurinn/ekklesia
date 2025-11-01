/**
 * Electoral Districts - Postal Code Mappings
 *
 * Epic #116 - Kjördæmissíur fyrir félagalista
 *
 * Maps Icelandic postal codes to electoral districts (kjördæmi).
 * Used for filtering members by electoral district in admin portal.
 *
 * Sources:
 * - Wikipedia: Listi yfir íslensk póstnúmer
 * - Web search: OpenStreetMap, Google Maps, Austurland.is
 * - Date: 2025-11-01
 */

/**
 * Norðausturkjördæmi (Northeast Electoral District)
 *
 * Covers 15 municipalities from Fjallabyggð to Fjarðabyggð
 * Total: 38 unique postal codes
 */
export const NORDAUSTURKJORDAEMI_POSTNUMER = [
  // Fjallabyggð
  580, 581, 625, 626,
  // Dalvíkurbyggð
  620, 621,
  // Hörgársveit
  604,
  // Akureyrarbær + Grýtubakkahreppur
  600, 601, 603,
  // Eyjafjarðarsveit
  605,
  // Svalbarðsstrandarhreppur
  606,
  // Þingeyjarsveit
  607,
  // Norðurþing + Tjörneshreppur
  640, 641, 645,
  // Langanesbyggð
  670, 671, 675, 676, 680, 681, 685, 686,
  // Vopnafjarðarhreppur
  690, 691,
  // Múlaþing + Fljótsdalshreppur
  700, 701,
  // Fjarðabyggð
  730, 731, 735, 736, 740, 741, 750, 751, 755, 756
];

/**
 * Norðvesturkjördæmi (Northwest Electoral District)
 *
 * Covers 26 municipalities: Vesturland, Vestfirðir, Norðurland vestra
 * Total: ~45 postal codes
 */
export const NORDVESTURKJORDAEMI_POSTNUMER = [
  // Vesturland
  300, 301, 310, 311, 320, 340, 345, 350, 355, 356, 360, 370, 371,
  // Vestfirðir
  380, 400, 401, 415, 420, 425, 430, 450, 451, 460, 465, 470, 471,
  500, 510, 520, 522, 523, 524,
  // Norðurland vestra
  530, 531, 540, 541, 545, 550, 551, 560, 565, 566
];

/**
 * Suðurkjördæmi (South Electoral District)
 *
 * Covers 17 municipalities: Suðurnes, Suðurland, Vestmannaeyjar
 * Total: ~45 postal codes
 */
export const SUDURKJORDAEMI_POSTNUMER = [
  // Suðurnes
  190, 220, 221, 222, 230, 231, 232, 233, 235, 240, 241, 245, 250, 251, 260, 261, 262,
  // Suðurland
  780, 781, 785, 800, 801, 802, 806, 810, 815, 816, 820, 825, 840, 845, 850, 851,
  860, 861, 870, 871, 880, 881, 882,
  // Vestmannaeyjar
  900, 901, 902
];

/**
 * Suðvesturkjördæmi (Southwest Electoral District)
 *
 * Covers 6 municipalities: Hafnarfjörður, Garðabær, Kópavogur, Seltjarnarnes, Mosfellsbær, Kjósarhreppur
 * Total: ~15 postal codes
 */
export const SUDVESTURKJORDAEMI_POSTNUMER = [
  // Kópavogur
  200, 201, 202, 203,
  // Garðabær
  210, 211, 212,
  // Hafnarfjörður
  220, 221, 222,
  // Seltjarnarnes
  170, 171, 172,
  // Mosfellsbær
  270, 271,
  // Kjósarhreppur
  276
];

/**
 * Reykjavíkurkjördæmi suður (Reykjavik South Electoral District)
 *
 * Covers western Reykjavik
 * Total: ~10 postal codes
 */
export const REYKJAVIKURKJORDAEMI_SUDUR_POSTNUMER = [
  101, 102, 103, 104, 105, 107, 108, 109, 110, 150, 155
];

/**
 * Reykjavíkurkjördæmi norður (Reykjavik North Electoral District)
 *
 * Covers eastern Reykjavik
 * Total: ~15 postal codes
 */
export const REYKJAVIKURKJORDAEMI_NORDUR_POSTNUMER = [
  111, 112, 113, 116, 121, 123, 124, 125, 127, 128, 129, 130, 132
];

/**
 * Electoral district definitions
 */
export const ELECTORAL_DISTRICTS = {
  nordaustur: {
    name: 'Norðausturkjördæmi',
    postalCodes: NORDAUSTURKJORDAEMI_POSTNUMER
  },
  nordvestur: {
    name: 'Norðvesturkjördæmi',
    postalCodes: NORDVESTURKJORDAEMI_POSTNUMER
  },
  sudur: {
    name: 'Suðurkjördæmi',
    postalCodes: SUDURKJORDAEMI_POSTNUMER
  },
  sudvestur: {
    name: 'Suðvesturkjördæmi',
    postalCodes: SUDVESTURKJORDAEMI_POSTNUMER
  },
  reykjavik_sudur: {
    name: 'Reykjavíkurkjördæmi suður',
    postalCodes: REYKJAVIKURKJORDAEMI_SUDUR_POSTNUMER
  },
  reykjavik_nordur: {
    name: 'Reykjavíkurkjördæmi norður',
    postalCodes: REYKJAVIKURKJORDAEMI_NORDUR_POSTNUMER
  }
};

/**
 * Check if a postal code belongs to an electoral district
 *
 * @param {string|number} postalCode - Postal code to check
 * @param {string} districtKey - Electoral district key (e.g., 'nordaustur')
 * @returns {boolean} True if postal code is in the district
 */
export function isInElectoralDistrict(postalCode, districtKey) {
  if (!postalCode) return false;

  const district = ELECTORAL_DISTRICTS[districtKey];
  if (!district) return false;

  // Normalize postal code to number for comparison
  const normalizedCode = typeof postalCode === 'string'
    ? parseInt(postalCode.trim(), 10)
    : postalCode;

  if (isNaN(normalizedCode)) return false;

  return district.postalCodes.includes(normalizedCode);
}

/**
 * Get electoral district name from key
 *
 * @param {string} districtKey - Electoral district key
 * @returns {string} District name or empty string if not found
 */
export function getElectoralDistrictName(districtKey) {
  const district = ELECTORAL_DISTRICTS[districtKey];
  return district ? district.name : '';
}

/**
 * Get all electoral district options for dropdown
 *
 * @returns {Array<{value: string, label: string}>} Array of district options
 */
export function getElectoralDistrictOptions() {
  return [
    { value: 'all', label: 'Öll kjördæmi' },
    ...Object.entries(ELECTORAL_DISTRICTS).map(([key, district]) => ({
      value: key,
      label: district.name
    }))
  ];
}

/**
 * Filter members by electoral district
 *
 * @param {Array<Object>} members - Array of member objects
 * @param {string} districtKey - Electoral district key ('all' for no filtering)
 * @returns {Array<Object>} Filtered members
 */
export function filterMembersByDistrict(members, districtKey) {
  if (!members || !Array.isArray(members)) return [];
  if (districtKey === 'all') return members;

  return members.filter(member => {
    const postalCode = member?.address?.postal_code;
    return isInElectoralDistrict(postalCode, districtKey);
  });
}
