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
      const commonWords = ['hvað', 'segir', 'flokkurinn', 'stefna', 'flokksins', 'afstaða', 'er', 'um', 'til', 'að', 'og', 'eða', 'með', 'móti', 'styður', 'vill', 'hver', 'fyrst', 'fyrsti'];

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
          .replace(/unum$/, '');          // flokkunum -> flokk
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
        'stofn': 'stofnun', 'stofnaður': 'stofnun', 'uppruna': 'stofnun',
        'flokkinn': 'sósíalistaflokkinn', 'hverjir': 'sósíalistaflokkinn',
        'hvað er': 'sósíalistaflokkinn', 'sósíal': 'sósíalistaflokkinn',
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
        'efling': 'efling', 'b-list': 'efling', 'baráttulist': 'efling',
        'sólveig anna': 'efling', 'stéttarfélag': 'efling', 'verkalýð': 'efling',
        'afsögn': 'efling', 'sagði af': 'efling', 'hætt': 'efling',
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

      if (words.length > 0) {
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
        const patterns = allPatterns.join(' OR ');
        titleBoostClause = `CASE WHEN ${patterns} THEN 1.5 ELSE 1.0 END`;
      }
    }

    if (boostPolicySources) {
      // Boost policy sources (party-website, kosningaprof) and reduce person profiles
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
          CASE
            WHEN source_type = 'party-website' THEN 1.3
            WHEN source_type = 'kosningaprof-2024' THEN 1.2
            WHEN source_type = 'discourse-archive' THEN 1.2
            WHEN source_type = 'discourse-person' THEN 0.6
            ELSE 1.0
          END *
          ${titleBoostClause} AS similarity
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
          (1 - (embedding <=> $1::vector)) * ${titleBoostClause} AS similarity
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
