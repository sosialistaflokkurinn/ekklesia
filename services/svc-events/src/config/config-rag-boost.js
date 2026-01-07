/**
 * RAG Boost Configuration
 *
 * Centralized configuration for document ranking and boosting.
 * This replaces the hardcoded boost logic in service-vector-search.js.
 *
 * @module config/config-rag-boost
 */

/**
 * Source Type Boosts
 *
 * Priority order for document sources (STEFNA ALWAYS FIRST):
 * 1. stefna - Official party policy (samþykkt á aðalfundum) - 3.5x
 * 2. curated-answer - Manually verified answers - 2.8x
 * 3. kosningaaetlun - Election manifesto (kosningastefna) - 2.2x
 * 4. alyktan - Resolutions from party congress - 2.0x
 * 5. kosningaprof - Election quizzes (supplementary) - 1.1-1.3x
 * 6. discourse - Forum discussions (lowest priority) - 0.5-1.0x
 */
const sourceTypeBoosts = {
  // Primary policy sources - ALWAYS cite first
  'stefna': 3.5,              // Party policy (samþykkt á aðalfundum) - HIGHEST PRIORITY

  // Curated answers - manually verified, but AFTER stefna
  'curated-answer': 2.8,
  'kosningaaetlun': 2.2,      // Election manifesto 2024
  'alyktan': 2.0,             // Resolutions from aðalfundur

  // Legacy source type (will be migrated to stefna/kosningaaetlun)
  'party-website': 2.0,

  // Election quizzes - supplementary sources
  'heimildin-2024': 1.3,
  'kjosturett-2024': 1.3,
  'kosningaprof-2024': 1.2,   // RÚV
  'vidskiptarad-2024': 1.1,

  // Historical/discussion sources
  'discourse-archive': 1.0,
  'discourse-person': 0.5,    // Individual profiles, lowest priority

  // Default for unknown types
  'default': 1.0,
};

/**
 * Title Keyword Boost
 * Applied when query keywords match document title
 */
const titleKeywordBoost = 1.5;

/**
 * Year Match Boost
 * Applied when year in query matches year in document title
 */
const yearMatchBoost = 2.0;

/**
 * Topic Keywords
 *
 * Maps Icelandic policy topics to their related keywords.
 * Used for intelligent topic detection and boost calculation.
 */
const topicKeywords = {
  // Housing
  husnaedismal: [
    'húsnæði', 'ibud', 'íbúð', 'leiga', 'húsaleig', 'húsnæðiskostn',
    'húsnæðisbyltingu', 'leiguíbúð', 'leiguvernd', 'félagsleg húsnæði'
  ],

  // Healthcare
  heilbrigdismal: [
    'heilbrigð', 'sjúkrahús', 'læknir', 'lyf', 'heilsufarskerfið',
    'heilsugæsl', 'læknis', 'sjúkling', 'sjúkratrygging'
  ],

  // Education
  menntamal: [
    'mennt', 'skól', 'nám', 'háskól', 'leikskól', 'grunnskól',
    'framhaldsskól', 'kennar', 'nemend'
  ],

  // Democracy
  lydraedismal: [
    'lýðræð', 'kosning', 'kjörfylg', 'þjóðaratkvæð', 'hlutfallskosnin'
  ],

  // Foreign policy
  utanrikismal: [
    'nato', 'nató', 'hernaðar', 'friðar', 'vopna', 'hern',
    'úkraín', 'gaza', 'ísrael', 'palestín', 'bandarík',
    'heimsvald', 'varnarsamning', 'herlaus'
  ],

  // Fiscal policy
  rikisfjarmmal: [
    'skatt', 'ríkisfjárm', 'auðlegðarskatt', 'fjárlög', 'fjármál',
    'tekjudreifing', 'útgjöld', 'skattkerfið'
  ],

  // Environment
  umhverfismal: [
    'loftslag', 'umhverf', 'náttúr', 'loftslagsbreyt', 'sjálfbær',
    'kolefnishlutlaus', 'orkuskipti'
  ],

  // Resources/Fisheries
  audlindamal: [
    'kvóta', 'fisk', 'sjávar', 'útvegs', 'veiði', 'auðlind'
  ],

  // Labor
  vinnumal: [
    'laun', 'verkalýð', 'vinnu', 'stéttarfélag', 'efling',
    'kjarasamning', 'lágmarkslaun'
  ],

  // Welfare
  velferdarmal: [
    'velferð', 'bætur', 'öryggi', 'trygging', 'almannatrygging',
    'barnabæt', 'örorka', 'ellilífeyri'
  ],

  // Equality
  jafnrettismal: [
    'jafnrétt', 'kynjajafnrétt', 'launamun', 'kynbundinn'
  ],

  // Party history
  saga: [
    'stofnað', 'stofnun', 'saga', 'sögul', 'fyrsti', 'upphafl',
    'tjarnarbíó', 'harmageddon'
  ],

  // Efling union
  efling: [
    'efling', 'b-listi', 'b-list', 'verkalýðsfélagi'
  ],
};

/**
 * Curated Answer Mappings
 *
 * Maps query patterns to specific curated answers for maximum relevance.
 * Each entry specifies which curated chunk_id should get a 7.0x boost.
 */
const curatedAnswerMappings = {
  // Foreign policy
  'heimsvaldastefna': {
    patterns: ['heimsvald', 'nato', 'herlaus', 'hernaðar', 'friðarbandalag', 'varnarsamning'],
    chunkId: 'stefna-heimsvaldastefna',
    boost: 7.0,
  },

  // EU
  'esb': {
    patterns: ['evrópu', 'esb', 'evrópusamband'],
    chunkId: 'stefna-esb',
    boost: 7.0,
  },

  // Capitalism
  'kapitalismi': {
    patterns: ['kapítal', 'auðvald', 'lýðræðisvæð', 'stórfyrirtæk'],
    chunkId: 'stefna-kapitalismi',
    boost: 7.0,
  },

  // Party founding
  'stofnun': {
    patterns: ['stofnaður', 'stofnað', 'stofnun', 'hvenær var', 'tjarnarbíó', 'stofnaði', 'stofnandi', 'hver stofn', 'tilkynnti', 'harmageddon'],
    chunkId: 'saga-stofnun',
    boost: 7.0,
  },

  // First elected
  'fyrsti-kjorni': {
    patterns: ['fyrsti kjörni', 'fyrsta kjörna', 'fyrsti fulltrúi'],
    chunkId: 'saga-fyrsti-kjorni',
    boost: 7.0,
  },

  // Executive chair
  'formenn': {
    patterns: ['formaður', 'framkvæmd', 'upphaflega formaður'],
    chunkId: 'saga-formenn',
    boost: 7.0,
  },

  // 2024 candidates
  'oddvitar-2024': {
    patterns: ['oddviti', '2024 oddvit'],
    chunkId: 'saga-oddvitar-2024',
    boost: 7.0,
  },

  // Efling connection
  'efling-tengsl': {
    patterns: ['efling formaður', 'efling tengist'],
    chunkId: 'saga-efling-tengsl',
    boost: 7.0,
  },

  // Constitution
  'stjornarskra': {
    patterns: ['stjórnarskr', 'ný stjórnarskrá', '2012 stjórnarskr', 'þjóðkjörnu stjórnarskr'],
    chunkId: 'stefna-stjornarskra',
    boost: 7.0,
  },

  // Drug policy
  'fikniefni': {
    patterns: ['fíkniefn', 'afglæpavæ', 'neysluskammt', 'vímuefn', 'kannabis'],
    chunkId: 'stefna-fikniefni',
    boost: 7.0,
  },

  // Immigration/refugees
  'innflytjendur': {
    patterns: ['innflytjend', 'flóttaman', 'flóttamenn', 'hælisleit', 'útlending', 'aðlögun innflytjenda'],
    chunkId: 'stefna-innflytjendur',
    boost: 7.0,
  },

  // Power plants/highland
  'virkjanir': {
    patterns: ['virkj', 'hálend', 'orkufyrirtæk', 'vatnsafl', 'einkavæð orku', 'náttúruvernd'],
    chunkId: 'stefna-virkjanir',
    boost: 7.0,
  },

  // State bank
  'rikisbanki': {
    patterns: ['ríkisbank', 'samfélagsbank', 'banka', 'ríkið eigi bank'],
    chunkId: 'stefna-rikisbanki',
    boost: 7.0,
  },

  // Road tolls
  'vegatoll': {
    patterns: ['vegatoll', 'veggjald', 'samgöngusáttmál', 'fjármagna vega'],
    chunkId: 'stefna-vegatoll',
    boost: 7.0,
  },
};

/**
 * Common Icelandic words to exclude from keyword extraction
 */
const commonWords = [
  'hvað', 'segir', 'flokkurinn', 'stefna', 'flokksins', 'afstaða',
  'er', 'um', 'til', 'að', 'og', 'eða', 'með', 'móti',
  'styður', 'vill', 'hver', 'fyrst', 'fyrsti',
];

/**
 * Source type display names (Icelandic)
 */
const sourceTypeNames = {
  'stefna': 'Stefna flokksins',
  'kosningaaetlun': 'Kosningaáætlun',
  'alyktan': 'Ályktun',
  'curated-answer': 'Staðfest svar',
  'party-website': 'Vefsíða flokksins',
  'heimildin-2024': 'Heimildin kosningapróf 2024',
  'kjosturett-2024': 'Kjóstu rétt 2024',
  'kosningaprof-2024': 'RÚV kosningapróf 2024',
  'vidskiptarad-2024': 'Viðskiptaráð kosningaáttaviti 2024',
  'discourse-archive': 'Umræður úr safni',
  'discourse-person': 'Einstaklingsupplýsingar',
};

/**
 * Get boost multiplier for a source type
 * @param {string} sourceType - The source type
 * @returns {number} - Boost multiplier
 */
function getSourceTypeBoost(sourceType) {
  // Check for wildcard matches (e.g., 'kosningaprof-*')
  for (const [pattern, boost] of Object.entries(sourceTypeBoosts)) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      if (sourceType.startsWith(prefix)) {
        return boost;
      }
    }
  }

  return sourceTypeBoosts[sourceType] || sourceTypeBoosts.default;
}

/**
 * Find matching curated answer for a query
 * @param {string} queryText - User's query
 * @returns {Object|null} - Matching curated answer config or null
 */
function findCuratedAnswer(queryText) {
  const queryLower = queryText.toLowerCase();

  for (const [key, config] of Object.entries(curatedAnswerMappings)) {
    if (config.patterns.some(pattern => queryLower.includes(pattern))) {
      return config;
    }
  }

  return null;
}

/**
 * Detect topic from query text
 * @param {string} queryText - User's query
 * @returns {string[]} - Array of detected topic keys
 */
function detectTopics(queryText) {
  const queryLower = queryText.toLowerCase();
  const detected = [];

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      detected.push(topic);
    }
  }

  return detected;
}

module.exports = {
  sourceTypeBoosts,
  titleKeywordBoost,
  yearMatchBoost,
  topicKeywords,
  curatedAnswerMappings,
  commonWords,
  sourceTypeNames,
  getSourceTypeBoost,
  findCuratedAnswer,
  detectTopics,
};
