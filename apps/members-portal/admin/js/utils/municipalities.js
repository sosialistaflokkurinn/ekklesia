/**
 * Icelandic Municipalities (Sveitarfélög)
 *
 * Issue #330 - Sveitarfélagasía fyrir félagalista
 *
 * List of all Icelandic municipalities for filtering members.
 * Data from iceaddr library's svfheiti field.
 *
 * Last updated: 2025-12-16
 * Total: 64 municipalities (after 2024 mergers)
 */

/**
 * All Icelandic municipalities grouped by region
 *
 * Names match the svfheiti field from iceaddr exactly
 */
export const MUNICIPALITIES = [
  // Höfuðborgarsvæðið (Capital Region)
  'Reykjavíkurborg',
  'Kópavogsbær',
  'Seltjarnarnesbær',
  'Garðabær',
  'Hafnarfjarðarkaupstaður',
  'Mosfellsbær',
  'Kjósarhreppur',

  // Suðurnes
  'Reykjanesbær',
  'Grindavíkurbær',
  'Sandgerðisbær',
  'Sveitarfélagið Garður',
  'Sveitarfélagið Vogar',

  // Vesturland
  'Akraneskaupstaður',
  'Hvalfjarðarsveit',
  'Skorradalshreppur',
  'Borgarbyggð',
  'Grundarfjarðarbær',
  'Helgafellssveit',
  'Stykkishólmsbær',
  'Eyja- og Miklaholtshreppur',
  'Snæfellsbær',
  'Dalabyggð',

  // Vestfirðir
  'Bolungarvíkurkaupstaður',
  'Ísafjarðarbær',
  'Reykhólahreppur',
  'Tálknafjarðarhreppur',
  'Vesturbyggð',
  'Súðavíkurhreppur',
  'Árneshreppur',
  'Kaldrananeshreppur',
  'Strandabyggð',

  // Norðurland vestra
  'Húnaþing vestra',
  'Blönduósbær',
  'Sveitarfélagið Skagafjörður',
  'Akrahreppur',

  // Norðurland eystra
  'Akureyrarkaupstaður',
  'Norðurþing',
  'Fjallabyggð',
  'Dalvíkurbyggð',
  'Eyjafjarðarsveit',
  'Hörgársveit',
  'Svalbarðsstrandarhreppur',
  'Grýtubakkahreppur',
  'Þingeyjarsveit',
  'Skútustaðahreppur',
  'Tjörneshreppur',
  'Langanesbyggð',

  // Austurland
  'Vopnafjarðarhreppur',
  'Múlaþing',
  'Fljótsdalshreppur',
  'Fjarðabyggð',
  'Breiðdalshreppur',
  'Djúpavogshreppur',

  // Suðurland
  'Sveitarfélagið Hornafjörður',
  'Skaftárhreppur',
  'Mýrdalshreppur',
  'Rangárþing eystra',
  'Rangárþing ytra',
  'Ásahreppur',
  'Flóahreppur',
  'Sveitarfélagið Árborg',
  'Skeiða- og Gnúpverjahreppur',
  'Bláskógabyggð',
  'Grímsnes- og Grafningshreppur',
  'Hrunamannahreppur',

  // Vestmannaeyjar
  'Vestmannaeyjabær'
];

/**
 * Sort municipalities alphabetically (Icelandic sort order)
 */
export const MUNICIPALITIES_SORTED = [...MUNICIPALITIES].sort((a, b) =>
  a.localeCompare(b, 'is')
);

/**
 * Get municipality options for dropdown
 *
 * @returns {Array<{value: string, label: string}>} Array of municipality options
 */
export function getMunicipalityOptions() {
  return [
    { value: 'all', label: 'Öll sveitarfélög' },
    ...MUNICIPALITIES_SORTED.map(name => ({
      value: name,
      label: name
    }))
  ];
}

/**
 * Get municipality name (for display)
 *
 * @param {string} municipalityKey - Municipality name/key
 * @returns {string} Municipality name or empty string if 'all'
 */
export function getMunicipalityName(municipalityKey) {
  if (municipalityKey === 'all') return '';
  return municipalityKey;
}

/**
 * Filter members by municipality
 *
 * @param {Array<Object>} members - Array of member objects
 * @param {string} municipalityKey - Municipality name ('all' for no filtering)
 * @returns {Array<Object>} Filtered members
 */
export function filterMembersByMunicipality(members, municipalityKey) {
  if (!members || !Array.isArray(members)) return [];
  if (municipalityKey === 'all') return members;

  return members.filter(member => {
    // Check default address municipality (is_default in synced data, is_primary in user-edited data)
    const addresses = member?.profile?.addresses || member?.addresses || [];
    const primaryAddress = addresses.find(a => a.is_default || a.is_primary) || addresses[0];
    const municipality = primaryAddress?.municipality || member?.address?.municipality;
    return municipality === municipalityKey;
  });
}
