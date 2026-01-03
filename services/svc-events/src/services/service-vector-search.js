/**
 * Vector Search Service
 *
 * Performs semantic search using pgvector on Cloud SQL PostgreSQL.
 * Used for RAG (Retrieval Augmented Generation) document retrieval.
 *
 * @module services/service-vector-search
 */

const { query } = require('../config/config-database');
const logger = require('../utils/util-logger');
const boostConfig = require('../config/config-rag-boost');

/**
 * Search for similar documents using cosine similarity
 *
 * @param {number[]} embedding - Query embedding vector (768 dimensions)
 * @param {Object} options - Search options
 * @param {number} options.limit - Maximum results (default: 5)
 * @param {number} options.threshold - Minimum similarity score 0-1 (default: 0.5)
 * @param {string[]} options.sourceTypes - Filter by source types (optional)
 * @param {boolean} options.boostPolicySources - Boost party-website and kosningaprof (default: false)
 * @param {string} options.queryText - Original query text for title matching boost (optional)
 * @returns {Promise<Array>} - Matching documents with similarity scores
 */
async function searchSimilar(embedding, options = {}) {
  const {
    limit = 5,
    threshold = 0.5,
    sourceTypes = null,
    boostPolicySources = false,
    queryText = null,
  } = options;

  try {
    // Convert embedding array to pgvector format
    const vectorStr = `[${embedding.join(',')}]`;

    let sql;
    const params = [vectorStr, threshold];

    // Extract keywords from query for title matching (if provided)
    // Look for Icelandic policy topic words (remove common words)
    let titleBoostClause = '1.0';
    if (queryText) {
      // Extract significant words (>4 chars, lowercase, remove common Icelandic words)
      // Exclude short question words that appear inside other words (e.g., 'hver' inside 'Umhverfis')
      const commonWords = boostConfig.commonWords;

      // Normalize Icelandic accents for matching (á→a, é→e, etc.)
      const normalizeAccents = (w) => w
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ý/g, 'y')
        .replace(/ð/g, 'd').replace(/þ/g, 'th').replace(/æ/g, 'ae')
        .replace(/ö/g, 'o');

      // Simple Icelandic stemming: remove common suffixes
      const stemWord = (w) => {
        // Remove common Icelandic noun/adjective suffixes
        return w
          .replace(/mála$/, 'mál')        // samgöngumála -> samgöngumál
          .replace(/málum$/, 'mál')       // húsnæðismálum -> húsnæðismál
          .replace(/málin$/, 'mál')       // húsnæðismálin -> húsnæðismál
          .replace(/göngur$/, 'göngumál') // almenningssamgöngur -> almenningssamgöngumál
          .replace(/göngu$/, 'göngumál')  // samgöngu -> samgöngumál
          .replace(/inu$/, '')            // kerfinu -> kerf (not perfect)
          .replace(/inn$/, '')            // flokkinn -> flokk
          .replace(/num$/, '')            // flokknum -> flokk
          .replace(/ana$/, '')            // flokkana -> flokk
          .replace(/unum$/, '')           // flokkunum -> flokk
          .replace(/ið$/, '');            // félagsgjaldið -> félagsgjald
      };

      let words = queryText.toLowerCase()
        .replace(/[?!.,]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !commonWords.includes(w))
        .map(stemWord);

      // For compound words containing policy topics, also extract the base topic
      // e.g., "almenningssamgöngumál" -> also match "samgöngumál"
      const policyTopics = ['samgöngumál', 'húsnæðismál', 'velferðarmál', 'heilbrigðismál',
        'menntamál', 'jafnréttismál', 'loftslagsmál', 'utanríkismál', 'atvinnumál',
        'ríkisfjármál', 'byggðamál', 'landbúnaðar', 'umhverfis',
        // Saga og skipulag
        'skipulag', 'saga', 'stofnun', 'kosningasaga', 'sósíalistaflokkinn', 'frambjóðendur',
        // Efling og verkalýðsmál
        'efling', 'verkalýðsmál'];

      // Map common keywords to their policy topic (for content-to-title matching)
      const keywordToTopic = {
        // Utanríkismál
        'nato': 'utanríkismál', 'nató': 'utanríkismál', 'hernaðar': 'utanríkismál',
        'friðar': 'utanríkismál', 'vopna': 'utanríkismál', 'hern': 'utanríkismál',
        'úkraín': 'utanríkismál', 'gaza': 'utanríkismál', 'ísrael': 'utanríkismál',
        'palestín': 'utanríkismál', 'bandarík': 'utanríkismál',

        // Sjávarútvegur (ekki stefnuskjal, en kosningapróf)
        'kvóta': 'auðlindamál', 'fisk': 'auðlindamál', 'sjávar': 'auðlindamál',
        'útvegs': 'auðlindamál', 'veiði': 'auðlindamál',

        // Menntamál
        'skóla': 'menntamál', 'háskóla': 'menntamál', 'kennar': 'menntamál',
        'nemand': 'menntamál', 'nám': 'menntamál', 'grunn': 'menntamál',
        'leikskól': 'menntamál', 'framhalds': 'menntamál',

        // Heilbrigðismál
        'lækn': 'heilbrigðismál', 'sjúkra': 'heilbrigðismál', 'spítal': 'heilbrigðismál',
        'heilsu': 'heilbrigðismál', 'lyf': 'heilbrigðismál', 'geðheil': 'heilbrigðismál',
        'hjúkr': 'heilbrigðismál', 'tanna': 'heilbrigðismál',

        // Húsnæðismál
        'íbúð': 'húsnæðismál', 'leig': 'húsnæðismál', 'húsa': 'húsnæðismál',
        'húsnæð': 'húsnæðismál', 'bygg': 'húsnæðismál', 'fasteigna': 'húsnæðismál',

        // Loftslagsmál / Umhverfismál
        'loftsla': 'loftslagsmál', 'umhverf': 'umhverfis', 'náttúr': 'umhverfis',
        'kolefn': 'loftslagsmál', 'orku': 'umhverfis', 'virkj': 'umhverfis',
        'hálend': 'umhverfis', 'miðhálen': 'umhverfis',

        // Vinnumarkaðsmál / Atvinnumál
        'laun': 'vinnumarkaðsmál', 'vinnu': 'vinnumarkaðsmál', 'stéttarféla': 'vinnumarkaðsmál',
        'starfs': 'vinnumarkaðsmál', 'atvinnu': 'vinnumarkaðsmál', 'verkfall': 'vinnumarkaðsmál',
        'styttingu': 'vinnumarkaðsmál', 'vinnuviku': 'vinnumarkaðsmál',

        // Skattar / Ríkisfjármál
        'skatt': 'ríkisfjármál', 'auðlegð': 'ríkisfjármál', 'tekjur': 'ríkisfjármál',
        'auðmenn': 'ríkisfjármál', 'ójöfnuð': 'ríkisfjármál',

        // Velferðarmál
        'velferð': 'velferðarmál', 'lífeyri': 'velferðarmál', 'ellilíf': 'velferðarmál',
        'öryrkj': 'velferðarmál', 'bætur': 'velferðarmál', 'atvinnuleysi': 'velferðarmál',

        // Jafnréttismál
        'jafnrétt': 'jafnréttismál', 'hinsegin': 'jafnréttismál', 'kynja': 'jafnréttismál',
        'trans': 'jafnréttismál', 'femín': 'jafnréttismál', 'kven': 'jafnréttismál',

        // Samgöngumál
        'strætó': 'samgöngumál', 'rútu': 'samgöngumál', 'veg': 'samgöngumál',
        'göng': 'samgöngumál', 'flug': 'samgöngumál', 'borgarlín': 'samgöngumál',

        // Landbúnaður
        'bænda': 'landbúnaðar', 'búvör': 'landbúnaðar', 'matvæl': 'landbúnaðar',
        'lífræn': 'landbúnaðar', 'dýravelferð': 'landbúnaðar',

        // Lýðræðismál
        'lýðræð': 'lýðræðismál', 'kosning': 'lýðræðismál', 'þjóðaratkvæða': 'lýðræðismál',
        'alþing': 'lýðræðismál', 'stjórnarskr': 'lýðræðismál',

        // Um flokkinn / Saga
        'saga': 'saga', 'sögu': 'saga', 'sögul': 'saga',
        'stofn': 'stofnun', 'stofnaður': 'stofnun', 'stofnaði': 'stofnun', 'stofnandi': 'stofnun',
        'uppruna': 'stofnun',
        'flokkinn': 'sósíalistaflokkinn', 'hverjir': 'sósíalistaflokkinn',
        'hvað er': 'sósíalistaflokkinn', 'sósíal': 'sósíalistaflokkinn',
        // Fyrsti/fyrsta - historical firsts
        'fyrsti': 'saga', 'fyrsta': 'saga', 'fyrst': 'saga',
        // Skipulag flokksins
        'skipulag': 'skipulag', 'framkvæmdastjórn': 'skipulag', 'valdamest': 'skipulag',
        'formaður': 'skipulag', 'formann': 'skipulag', 'kosningastjórn': 'skipulag',
        'stjórn': 'skipulag', 'valdakerfi': 'skipulag', 'völd': 'skipulag',
        // Kosningasaga
        'stofnfund': 'stofnun', 'tjarnarbíó': 'stofnun', 'bauð': 'saga', 'fylgi': 'saga',
        'kjörni': 'saga', 'fulltrú': 'saga', 'þingsæt': 'saga',
        '2017': 'saga', '2021': 'saga', '2022': 'saga', '2024': 'saga',
        'borgarfulltrú': 'saga', 'þröskuld': 'saga', 'atkvæð': 'saga',
        // Frambjóðendur
        'frambjóðend': 'frambjóðendur', 'framboð': 'frambjóðendur', 'listi': 'frambjóðendur',
        '2018': 'frambjóðendur', 'kópavog': 'frambjóðendur', 'reykjavík': 'frambjóðendur',
        'oddvit': 'frambjóðendur', 'oddvitar': 'frambjóðendur', '2024': 'frambjóðendur',
        'daníel': 'frambjóðendur', 'sanna': 'frambjóðendur', 'gunnar smári': 'frambjóðendur',
        // Efling og B-listi
        'efling': 'efling', 'eflingar': 'efling', 'b-list': 'efling', 'baráttulist': 'efling',
        'sólveig anna': 'efling', 'stéttarfélag': 'efling', 'verkalýð': 'efling',
        'afsögn': 'efling', 'sagði af': 'efling', 'hætt': 'efling',
        'lista eflingar': 'efling',
      };

      const additionalPatterns = [];
      const queryLower = queryText.toLowerCase();
      const queryNormalized = normalizeAccents(queryLower);

      for (const word of words) {
        // Check compound words
        for (const topic of policyTopics) {
          if (word.includes(topic) && word !== topic) {
            additionalPatterns.push(topic);
          }
        }
        // Check single-word keyword mappings
        for (const [keyword, topic] of Object.entries(keywordToTopic)) {
          if (!keyword.includes(' ')) {  // Single-word keywords
            if (word.includes(keyword) || normalizeAccents(word).includes(keyword)) {
              additionalPatterns.push(topic);
            }
          }
        }
      }

      // Check multi-word keyword mappings against full query
      for (const [keyword, topic] of Object.entries(keywordToTopic)) {
        if (keyword.includes(' ')) {  // Multi-word keywords
          if (queryLower.includes(keyword) || queryNormalized.includes(keyword)) {
            additionalPatterns.push(topic);
          }
        }
      }

      words = [...words, ...additionalPatterns];

      // Check if query is about Efling/B-listi
      const isEflingQuery = additionalPatterns.includes('efling');

      // Extract years from query for direct matching (2017-2030)
      const yearMatch = queryLower.match(/\b(20[12][0-9])\b/g);
      const queryYears = yearMatch ? [...new Set(yearMatch)] : [];

      if (words.length > 0 || queryYears.length > 0) {
        // Add title boost: 1.5x if any keyword matches title
        // Use both original and accent-normalized versions for matching
        const allPatterns = [];
        for (const w of words) {
          allPatterns.push(`LOWER(title) LIKE '%${w}%'`);
          const normalized = normalizeAccents(w);
          if (normalized !== w) {
            // Also match normalized version against normalized title
            allPatterns.push(`LOWER(TRANSLATE(title, 'áéíóúýðþæö', 'aeiouydthaeo')) LIKE '%${normalized}%'`);
          }
        }

        // Add direct year matching with strong boost (2.0x)
        // This ensures "2018" in query matches documents with "2018" in title
        let yearBoostClause = '1.0';
        if (queryYears.length > 0) {
          // SQL SAFETY: queryYears comes from regex /\b(20[1-3]\d)\b/ which only captures
          // 4-digit years (2010-2039). These are validated digits, safe for SQL interpolation.
          const yearPatterns = queryYears.map(y => `title LIKE '%${y}%'`);
          yearBoostClause = `CASE WHEN ${yearPatterns.join(' OR ')} THEN 2.0 ELSE 1.0 END`;
        }

        const patterns = allPatterns.length > 0 ? allPatterns.join(' OR ') : 'FALSE';
        titleBoostClause = `CASE WHEN ${patterns} THEN 1.5 ELSE 1.0 END * ${yearBoostClause}`;

        // Extra boost for Efling queries matching Efling documents
        if (isEflingQuery) {
          titleBoostClause = `CASE WHEN ${patterns} THEN 1.5 ELSE 1.0 END * ${yearBoostClause} * CASE WHEN LOWER(title) LIKE '%efling%' OR LOWER(title) LIKE '%b-list%' THEN 1.5 ELSE 1.0 END`;
        }
      }
    }

    // Content-based boost for specific historical fact queries
    // This boosts documents that contain the actual factual answer in their content
    let contentBoostClause = '1.0';
    if (queryText) {
      const queryLower = queryText.toLowerCase();

      // CURATED ANSWERS - These are manually verified high-quality Q&A pairs
      // They should get the HIGHEST boost (7.0) when matching relevant queries
      const heimsvaldastefnaTerms = ['heimsvald', 'nato', 'herlaus', 'hernaðar', 'friðarbandalag', 'varnarsamning'];
      const esbTerms = ['evrópu', 'esb', 'evrópusamband'];
      const kapitalismiTerms = ['kapítal', 'auðvald', 'lýðræðisvæð', 'stórfyrirtæk'];

      if (heimsvaldastefnaTerms.some(term => queryLower.includes(term))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'stefna-heimsvaldastefna' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }
      if (esbTerms.some(term => queryLower.includes(term))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'stefna-esb' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }
      if (kapitalismiTerms.some(term => queryLower.includes(term))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'stefna-kapitalismi' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Stofnun flokksins (hvenær stofnaður, hvar)
      const stofnunTerms = ['stofnaður', 'stofnað', 'stofnun', 'hvenær var', 'tjarnarbíó'];
      if (stofnunTerms.some(term => queryLower.includes(term))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-stofnun' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Fyrsti kjörni fulltrúi
      if (queryLower.includes('fyrsti kjörni') || queryLower.includes('fyrsta kjörna') ||
          queryLower.includes('fyrsti fulltrúi') || (queryLower.includes('fyrst') && queryLower.includes('kjör'))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-fyrsti-kjorni' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Borgarfulltrúar 2022 - boost saga-fyrsti-kjorni which has both Sanna and Trausti
      if ((queryLower.includes('borgarfulltrú') && queryLower.includes('2022')) ||
          (queryLower.includes('fulltrú') && queryLower.includes('sveitarstjórn') && queryLower.includes('2022'))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-fyrsti-kjorni' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Stofnandi flokksins
      const stofnandiTerms = ['stofnaði', 'stofnandi', 'hver stofn'];
      if (stofnandiTerms.some(term => queryLower.includes(term))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-stofnun' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Formaður framkvæmdastjórnar
      if (queryLower.includes('formaður') && (queryLower.includes('framkvæmd') || queryLower.includes('upphaflega'))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-formenn' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Oddvitar 2024
      if (queryLower.includes('oddviti') && queryLower.includes('2024')) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-oddvitar-2024' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Efling formaður
      if (queryLower.includes('efling') && (queryLower.includes('formaður') || queryLower.includes('tengist'))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-efling-tengsl' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Tilkynning stofnunar / Harmageddon
      if (queryLower.includes('tilkynnti') || queryLower.includes('harmageddon')) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-stofnun' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // RÚV kosningapróf heilbrigðismál
      if (queryLower.includes('rúv') && (queryLower.includes('heilbrigð') || queryLower.includes('kosningapróf'))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'ruv-heilbrigdismal-2024' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // RÚV kosningapróf byggingariðnaður/regluverk
      if (queryLower.includes('rúv') && (queryLower.includes('byggin') || queryLower.includes('regluverk'))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'ruv-byggingaridn-2024' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Vor til vinstri
      if (queryLower.includes('vor til vinstri')) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'vor-til-vinstri' THEN 7.0
          ELSE ${contentBoostClause} END`;
      }

      // Historical firsts (fyrsti kjörni fulltrúi)
      if (queryLower.includes('fyrsti kjörni') || queryLower.includes('fyrsta kjörna') ||
          queryLower.includes('fyrsti fulltrúi') || queryLower.includes('fyrsta fulltrúa') ||
          (queryLower.includes('fyrst') && queryLower.includes('kjör'))) {
        contentBoostClause = `CASE WHEN LOWER(content) LIKE '%fyrsti kjörni%' OR LOWER(content) LIKE '%fyrsta kjörna%' THEN 2.5 ELSE 1.0 END`;
      }

      // Founder queries - REMOVED: Already handled by stofnandiTerms boost at lines 293-298
      // which gives saga-stofnun a 7.0 boost (higher than the 2.0-3.0 boosts here)

      // Vor til vinstri queries
      if (queryLower.includes('vor til vinstri')) {
        contentBoostClause = `CASE WHEN LOWER(content) LIKE '%vor til vinstri%' THEN 2.5 ELSE ${contentBoostClause} END`;
      }

      // Aðalfundur 2025 / hallarbylting queries - boost saga-formenn which has Sæþór info
      if ((queryLower.includes('aðalfund') && queryLower.includes('2025')) ||
          queryLower.includes('hallarbylting') ||
          (queryLower.includes('maí 2025') && queryLower.includes('fundur'))) {
        contentBoostClause = `CASE
          WHEN source_type = 'curated-answer' AND chunk_id = 'saga-formenn' THEN 7.0
          WHEN LOWER(title) LIKE '%aðalfund%hallarbylting%' THEN 3.0
          WHEN LOWER(title) LIKE '%aðalfund%' THEN 2.5
          WHEN LOWER(content) LIKE '%sæþór%' THEN 2.5
          WHEN LOWER(content) LIKE '%hallarbylting%' THEN 2.0
          ELSE ${contentBoostClause} END`;
      }

      // Formaður framkvæmdastjórnar queries (especially "upphaflega")
      if (queryLower.includes('formaður') && queryLower.includes('framkvæmdastjórn')) {
        contentBoostClause = `CASE
          WHEN LOWER(title) LIKE '%gunnar smári%' AND LOWER(content) LIKE '%formaður%' THEN 3.0
          WHEN LOWER(content) LIKE '%formaður framkvæmdastjórnar%' THEN 2.5
          WHEN LOWER(title) = 'saga sósíalistaflokksins' THEN 2.0
          ELSE ${contentBoostClause} END`;
      }

      // Fjármál flokksins, Vorstjarnan, Alþýðufélagið queries
      if (queryLower.includes('vorstjörn') || queryLower.includes('alþýðufélag') ||
          queryLower.includes('ríkisstyrkur') || queryLower.includes('félagsgjöld') ||
          (queryLower.includes('peningar') && queryLower.includes('flokk')) ||
          (queryLower.includes('fjármál') && queryLower.includes('flokk'))) {
        contentBoostClause = `CASE
          WHEN LOWER(title) LIKE '%fjármál%klofn%' THEN 4.0
          WHEN LOWER(content) LIKE '%vorstjörn%' AND LOWER(content) LIKE '%alþýðufélag%' THEN 3.5
          WHEN LOWER(content) LIKE '%ríkisstyrkur%' OR LOWER(content) LIKE '%félagsgjöld%' THEN 2.5
          ELSE ${contentBoostClause} END`;
      }

      // Kosningasjóður 2024 / núll króna queries
      if ((queryLower.includes('kosningasjóð') && queryLower.includes('2024')) ||
          (queryLower.includes('núll') && queryLower.includes('kosning')) ||
          (queryLower.includes('peningar') && queryLower.includes('kosning') && queryLower.includes('2024'))) {
        contentBoostClause = `CASE
          WHEN LOWER(content) LIKE '%núll króna%kosningasjóð%' OR LOWER(content) LIKE '%núll%í kosningasjóð%' THEN 4.0
          WHEN LOWER(title) LIKE '%fjármál%klofn%' THEN 3.5
          WHEN LOWER(content) LIKE '%kosningasjóð%' AND LOWER(content) LIKE '%2024%' THEN 3.0
          ELSE ${contentBoostClause} END`;
      }

      // Elítustjórnmál / launastefna queries
      if (queryLower.includes('elítustjórnmál') || queryLower.includes('elítu') ||
          (queryLower.includes('laun') && queryLower.includes('kjör'))) {
        contentBoostClause = `CASE
          WHEN LOWER(title) LIKE '%fjármál%klofn%' THEN 3.5
          WHEN LOWER(content) LIKE '%burt með elítustjórnmál%' THEN 3.0
          WHEN LOWER(content) LIKE '%lækka laun%' AND LOWER(content) LIKE '%vorstjörn%' THEN 2.5
          ELSE ${contentBoostClause} END`;
      }

      // Klofningur / split queries
      if (queryLower.includes('klofning') || queryLower.includes('klofn') ||
          queryLower.includes('rót') || queryLower.includes('sundur')) {
        contentBoostClause = `CASE
          WHEN LOWER(title) LIKE '%fjármál%klofn%' THEN 4.0
          WHEN LOWER(content) LIKE '%rót klofning%' OR LOWER(content) LIKE '%klofningur%' THEN 3.0
          WHEN LOWER(content) LIKE '%vorstjörn%' AND LOWER(content) LIKE '%alþýðufélag%' THEN 2.5
          ELSE ${contentBoostClause} END`;
      }

      // Heimildin Kosningapróf - samsvörun/match percentage queries
      if ((queryLower.includes('samsvör') || queryLower.includes('samsvaran') || queryLower.includes('match')) &&
          (queryLower.includes('heimild') || queryLower.includes('kosningapróf'))) {
        contentBoostClause = `CASE
          WHEN source_type = 'heimildin-2024' AND chunk_id LIKE '%candidate%' THEN 4.0
          WHEN LOWER(content) LIKE '%samsvörun við flokksstefnu%' THEN 3.5
          WHEN source_type = 'heimildin-2024' THEN 2.0
          ELSE ${contentBoostClause} END`;
      }

      // Heimildin Kosningapróf - candidate-specific queries
      if (queryLower.includes('heimild') || (queryLower.includes('kosningapróf') && !queryLower.includes('rúv'))) {
        // Check for candidate names
        if (queryLower.includes('gunnar smári')) {
          contentBoostClause = `CASE
            WHEN chunk_id = 'heimildin-2024-candidate-gunnar_smari_egilsson' THEN 4.5
            WHEN source_type = 'heimildin-2024' AND LOWER(content) LIKE '%gunnar smári%' THEN 3.0
            ELSE ${contentBoostClause} END`;
        } else if (queryLower.includes('sanna') || queryLower.includes('sönnu')) {
          contentBoostClause = `CASE
            WHEN chunk_id = 'heimildin-2024-candidate-sanna_magdalena_mortudottir' THEN 4.5
            WHEN source_type = 'heimildin-2024' AND LOWER(content) LIKE '%sanna%' THEN 3.0
            ELSE ${contentBoostClause} END`;
        } else if (queryLower.includes('davíð') || queryLower.includes('david')) {
          contentBoostClause = `CASE
            WHEN chunk_id = 'heimildin-2024-candidate-david_thor_jonsson' THEN 4.5
            WHEN source_type = 'heimildin-2024' AND LOWER(content) LIKE '%davíð%' THEN 3.0
            ELSE ${contentBoostClause} END`;
        }
      }

      // Heimildin - specific policy queries (löggæsla, arðgreiðsluskatt, etc.)
      if (queryLower.includes('heimild') || queryLower.includes('kosningapróf')) {
        if (queryLower.includes('löggæslu') || queryLower.includes('lögreglu')) {
          contentBoostClause = `CASE
            WHEN source_type = 'heimildin-2024' AND LOWER(content) LIKE '%löggæslu%' THEN 4.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('arðgreiðslu')) {
          contentBoostClause = `CASE
            WHEN source_type = 'heimildin-2024' AND LOWER(content) LIKE '%arðgreiðslu%' THEN 4.0
            ELSE ${contentBoostClause} END`;
        }
      }

      // Kjóstu rétt queries - boost kjosturett-2024 source
      if (queryLower.includes('kjóstu rétt') || queryLower.includes('kjosturett')) {
        contentBoostClause = `CASE
          WHEN source_type = 'kjosturett-2024' THEN 4.0
          ELSE ${contentBoostClause} END`;
      }

      // Kjóstu rétt - specific topic queries
      if (queryLower.includes('kjóstu rétt') || queryLower.includes('kjosturett')) {
        if (queryLower.includes('einkarekstur') || queryLower.includes('heilbrigð')) {
          contentBoostClause = `CASE
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%einkarekstur%heilbrigð%' THEN 5.0
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%einkarekstur%' THEN 4.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('leiguþak') || queryLower.includes('húsnæð')) {
          contentBoostClause = `CASE
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%leiguþak%' THEN 5.0
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%húsnæð%' THEN 4.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('orkufyrirtæk') || queryLower.includes('selja')) {
          contentBoostClause = `CASE
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%selja%orkufyrirtæk%' THEN 5.0
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%orkufyrirtæk%' THEN 4.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('flóttam') || queryLower.includes('hælisleiten')) {
          contentBoostClause = `CASE
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%flóttam%' THEN 5.0
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%hæli%' THEN 4.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('ísrael') || queryLower.includes('viðskiptaþving')) {
          contentBoostClause = `CASE
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%ísrael%viðskiptaþving%' THEN 5.0
            WHEN source_type = 'kjosturett-2024' AND LOWER(content) LIKE '%ísrael%' THEN 4.0
            ELSE ${contentBoostClause} END`;
        }
      }

      // Utanríkismál queries - boost foreign policy sources (handle Icelandic inflections)
      const foreignPolicyTerms = ['nato', 'evrópu', 'esb', 'heimsvald', 'imperial',
        'hernaðar', 'herlaus', 'friðar', 'úkraín', 'palestín', 'ísrael', 'bandarík',
        'kína', 'rússland', 'útanríkis', 'utanríkis'];
      if (foreignPolicyTerms.some(term => queryLower.includes(term))) {
        contentBoostClause = `CASE
          WHEN source_type = 'party-website' AND LOWER(title) LIKE '%utanríkismál%' THEN 5.0
          WHEN source_type = 'heimildin-2024' AND LOWER(title) LIKE '%utanríkismál%' THEN 4.5
          WHEN source_type = 'kjosturett-2024' AND LOWER(title) LIKE '%utanríkismál%' THEN 4.5
          WHEN LOWER(content) LIKE '%nato%' THEN 3.0
          WHEN LOWER(content) LIKE '%evrópu%' THEN 3.0
          WHEN LOWER(content) LIKE '%heimsvald%' THEN 3.0
          WHEN LOWER(content) LIKE '%herlaus%' THEN 3.0
          ELSE ${contentBoostClause} END`;
      }

      // Specific ESB/EU query boost - prioritize the direct answer document
      if (queryLower.includes('evrópu') || queryLower.includes('esb')) {
        contentBoostClause = `CASE
          WHEN LOWER(title) LIKE '%standa utan evrópusamband%' THEN 6.0
          WHEN LOWER(title) LIKE '%evrópusamband%' AND source_type = 'heimildin-2024' THEN 5.0
          WHEN LOWER(content) LIKE '%standa utan%' AND LOWER(content) LIKE '%evrópu%' THEN 4.0
          ELSE ${contentBoostClause} END`;
      }

      // Ideology queries - boost party manifesto/stefna sources
      const ideologyTerms = ['kapítal', 'sósíal', 'stétt', 'auðvald', 'verkalýð',
        'jafnaðar', 'kommún', 'bylt', 'valdataka', 'barátt'];
      if (ideologyTerms.some(term => queryLower.includes(term))) {
        contentBoostClause = `CASE
          WHEN source_type = 'party-website' AND LOWER(title) LIKE '%um sósíalistaflokkinn%' THEN 5.0
          WHEN source_type = 'party-website' AND LOWER(title) LIKE '%stefna%' THEN 4.5
          WHEN LOWER(content) LIKE '%auðvald%' THEN 3.0
          WHEN LOWER(content) LIKE '%stéttabarátt%' THEN 3.0
          WHEN LOWER(content) LIKE '%verkalýð%' THEN 3.0
          ELSE ${contentBoostClause} END`;
      }

      // Viðskiptaráð Kosningaáttaviti queries - boost vidskiptarad-2024 source
      if (queryLower.includes('viðskiptaráð') || queryLower.includes('kosningaáttavit')) {
        contentBoostClause = `CASE
          WHEN source_type = 'vidskiptarad-2024' THEN 4.0
          ELSE ${contentBoostClause} END`;

        // Specific topic boosts for Viðskiptaráð
        if (queryLower.includes('stóreignaskatt')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%stóreignaskatt%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('skólamáltíð')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%skólamáltíð%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('félagsleg') && queryLower.includes('húsnæð')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%félagsleg%húsnæð%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('landsbank')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%landsbank%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('landsvirkjun')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%landsvirkjun%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('jafnlauna')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%jafnlauna%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('loftslag')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%loftslag%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('skammtíma') || queryLower.includes('airbnb')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%skammtíma%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
        if (queryLower.includes('leig') && queryLower.includes('kærunefnd')) {
          contentBoostClause = `CASE
            WHEN source_type = 'vidskiptarad-2024' AND LOWER(content) LIKE '%kærunefnd%' THEN 5.0
            ELSE ${contentBoostClause} END`;
        }
      }
    }

    // Build source type boost CASE statement from config
    const sourceBoostCases = Object.entries(boostConfig.sourceTypeBoosts)
      .filter(([key]) => key !== 'default' && !key.endsWith('*'))
      .map(([type, boost]) => `WHEN source_type = '${type}' THEN ${boost}`)
      .join('\n            ');
    const sourceBoostClause = `CASE
            ${sourceBoostCases}
            ELSE ${boostConfig.sourceTypeBoosts.default || 1.0}
          END`;

    if (boostPolicySources) {
      // Boost policy sources using config - stefna/kosningaaetlun are PRIMARY
      // Also boost if title matches query keywords
      sql = `
        SELECT
          id,
          source_type,
          source_url,
          source_date,
          title,
          content,
          citation,
          (1 - (embedding <=> $1::vector)) *
          ${sourceBoostClause} *
          ${titleBoostClause} *
          ${contentBoostClause} AS similarity
        FROM rag_documents
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) > $2
      `;
    } else {
      sql = `
        SELECT
          id,
          source_type,
          source_url,
          source_date,
          title,
          content,
          citation,
          (1 - (embedding <=> $1::vector)) * ${titleBoostClause} * ${contentBoostClause} AS similarity
        FROM rag_documents
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) > $2
      `;
    }

    // Add source type filter if specified
    if (sourceTypes && sourceTypes.length > 0) {
      sql += ` AND source_type = ANY($3)`;
      params.push(sourceTypes);
    }

    sql += `
      ORDER BY similarity DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await query(sql, params);

    logger.debug('Vector search completed', {
      resultsCount: result.rows.length,
      threshold,
      limit,
      boostPolicySources,
    });

    return result.rows;
  } catch (error) {
    logger.error('Vector search failed', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Hybrid search: combines semantic search with keyword matching
 *
 * @param {number[]} embedding - Query embedding vector
 * @param {string} keywords - Keywords to match
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Combined search results
 */
async function hybridSearch(embedding, keywords, options = {}) {
  const {
    limit = 5,
    semanticWeight = 0.7,
    keywordWeight = 0.3,
  } = options;

  try {
    const vectorStr = `[${embedding.join(',')}]`;

    // Combine semantic similarity with full-text search rank
    const sql = `
      WITH semantic_results AS (
        SELECT
          id,
          1 - (embedding <=> $1::vector) AS semantic_score
        FROM rag_documents
        WHERE embedding IS NOT NULL
      ),
      keyword_results AS (
        SELECT
          id,
          ts_rank(to_tsvector('simple', content), plainto_tsquery('simple', $2)) AS keyword_score
        FROM rag_documents
        WHERE to_tsvector('simple', content) @@ plainto_tsquery('simple', $2)
      )
      SELECT
        d.id,
        d.source_type,
        d.source_url,
        d.source_date,
        d.title,
        d.content,
        d.citation,
        COALESCE(s.semantic_score, 0) * $3 + COALESCE(k.keyword_score, 0) * $4 AS combined_score
      FROM rag_documents d
      LEFT JOIN semantic_results s ON d.id = s.id
      LEFT JOIN keyword_results k ON d.id = k.id
      WHERE s.semantic_score > 0.3 OR k.keyword_score > 0
      ORDER BY combined_score DESC
      LIMIT $5
    `;

    const result = await query(sql, [
      vectorStr,
      keywords,
      semanticWeight,
      keywordWeight,
      limit,
    ]);

    return result.rows;
  } catch (error) {
    logger.error('Hybrid search failed', {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Insert or update a document with embedding
 *
 * @param {Object} doc - Document to insert
 * @returns {Promise<Object>} - Inserted document
 */
async function upsertDocument(doc) {
  const {
    sourceType,
    sourceUrl,
    sourceDate,
    chunkId,
    title,
    content,
    citation,
    embedding,
  } = doc;

  const vectorStr = embedding ? `[${embedding.join(',')}]` : null;

  const sql = `
    INSERT INTO rag_documents (
      source_type, source_url, source_date, chunk_id,
      title, content, citation, embedding
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
    ON CONFLICT (source_type, chunk_id)
    DO UPDATE SET
      source_url = EXCLUDED.source_url,
      source_date = EXCLUDED.source_date,
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      citation = EXCLUDED.citation,
      embedding = EXCLUDED.embedding
    RETURNING id, source_type, chunk_id
  `;

  const result = await query(sql, [
    sourceType,
    sourceUrl,
    sourceDate,
    chunkId,
    title,
    content,
    JSON.stringify(citation),
    vectorStr,
  ]);

  return result.rows[0];
}

/**
 * Get document count by source type
 *
 * @returns {Promise<Array>} - Count per source type
 */
async function getDocumentStats() {
  const sql = `
    SELECT
      source_type,
      COUNT(*) as count,
      COUNT(embedding) as with_embedding
    FROM rag_documents
    GROUP BY source_type
    ORDER BY count DESC
  `;

  const result = await query(sql);
  return result.rows;
}

module.exports = {
  searchSimilar,
  hybridSearch,
  upsertDocument,
  getDocumentStats,
};
