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
 * Covers 15 municipalities:
 * - Fjallabyggð, Dalvíkurbyggð, Hörgársveit
 * - Akureyrarbær, Grýtubakkahreppur
 * - Eyjafjarðarsveit, Svalbarðsstrandarhreppur
 * - Þingeyjarsveit, Norðurþing, Tjörneshreppur
 * - Langanesbyggð, Vopnafjarðarhreppur
 * - Múlaþing, Fljótsdalshreppur, Fjarðabyggð
 *
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
 * Electoral district definitions
 */
export const ELECTORAL_DISTRICTS = {
  nordaustur: {
    name: 'Norðausturkjördæmi',
    postalCodes: NORDAUSTURKJORDAEMI_POSTNUMER
  }
  // Additional electoral districts can be added here:
  // nordvestur: { ... },
  // sudur: { ... },
  // etc.
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
