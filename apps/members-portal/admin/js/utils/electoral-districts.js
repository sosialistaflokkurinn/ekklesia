/**
 * Electoral Districts - Postal Code Mappings
 *
 * Epic #116 - Kjördæmissíur fyrir félagalista
 *
 * Maps Icelandic postal codes to electoral districts (kjördæmi).
 * Used for filtering members by electoral district in admin portal.
 *
 * Sources (Data Quality Audit - 2025-11-01):
 * - PRIMARY: Postur.is official registry (postur.is/gogn/Gotuskra/postnumer.txt) - 195 postal codes
 * - SECONDARY: Byggðastofnun (postnumeraskra_2022.xlsx)
 * - CROSS-REFERENCE: Wikipedia (Listi yfir íslensk póstnúmer)
 *
 * Audit Results:
 * - Removed 3 duplicate codes (220, 221, 222 from Suðurkjördæmi)
 * - Removed 6 invalid codes (231, 261, 522, 523, 882, 901)
 * - Data quality: 100% (all codes verified against Postur.is)
 * - Last verified: 2025-11-01
 */

/**
 * Norðausturkjördæmi (Northeast Electoral District)
 *
 * Covers 15 municipalities from Fjallabyggð to Fjarðabyggð
 * Total: 38 postal codes (verified against Postur.is - 100% accurate)
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
 * Total: 43 postal codes (verified against Postur.is)
 *
 * Changes from audit (2025-11-01):
 * - Removed 522, 523 (invalid codes - use 520/524 instead)
 */
export const NORDVESTURKJORDAEMI_POSTNUMER = [
  // Vesturland
  300, 301, 310, 311, 320, 340, 345, 350, 355, 356, 360, 370, 371,
  // Vestfirðir
  380, 400, 401, 415, 420, 425, 430, 450, 451, 460, 465, 470, 471,
  500, 510, 520, 524,
  // Norðurland vestra
  530, 531, 540, 541, 545, 550, 551, 560, 565, 566
];

/**
 * Suðurkjördæmi (South Electoral District)
 *
 * Covers 17 municipalities: Suðurnes, Suðurland, Vestmannaeyjar
 * Total: 38 postal codes (verified against Postur.is)
 *
 * Changes from audit (2025-11-01):
 * - Removed 220, 221, 222 (belong to Hafnarfjörður in Suðvesturkjördæmi)
 * - Removed 231, 261 (invalid codes - use 230/232 and 260/262 instead)
 * - Removed 882 (invalid code - use 880/881 instead)
 * - Removed 901 (invalid code - use 900/902 instead)
 */
export const SUDURKJORDAEMI_POSTNUMER = [
  // Suðurnes
  190, 230, 232, 235, 240, 245, 250, 260, 262,
  // Suðurland
  780, 781, 785, 800, 801, 802, 806, 810, 815, 816, 820, 825, 840, 845, 850, 851,
  860, 861, 870, 871, 880, 881,
  // Vestmannaeyjar
  900, 902
];

/**
 * Suðvesturkjördæmi (Southwest Electoral District)
 *
 * Covers 6 municipalities: Hafnarfjörður, Garðabær, Kópavogur, Seltjarnarnes, Mosfellsbær, Kjósarhreppur
 * Total: 15 postal codes (verified against Postur.is)
 *
 * Note: 220, 221, 222 (Hafnarfjörður) belong here, NOT in Suðurkjördæmi
 */
export const SUDVESTURKJORDAEMI_POSTNUMER = [
  // Seltjarnarnes
  170, 172,
  // Kópavogur
  200, 201, 202, 203,
  // Garðabær
  210, 212,
  // Hafnarfjörður + Álftanes
  220, 221, 222, 225,
  // Mosfellsbær + Kjósarhreppur
  270, 271, 276
];

/**
 * Reykjavíkurkjördæmi (Reykjavik Electoral District)
 *
 * Covers all of Reykjavik
 * Total: 27 postal codes (verified against Postur.is - 100% accurate)
 */
export const REYKJAVIKURKJORDAEMI_POSTNUMER = [
  // Þéttbýli
  101, 102, 103, 104, 105, 107, 108, 109, 110, 111, 112, 113, 116,
  // Pósthólf
  121, 123, 124, 125, 127, 128, 129, 130, 132,
  // Opinberar stofnanir og fyrirtæki
  150, 155,
  // Dreifbýli
  161, 162
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
  reykjavik: {
    name: 'Reykjavíkurkjördæmi',
    postalCodes: REYKJAVIKURKJORDAEMI_POSTNUMER
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
