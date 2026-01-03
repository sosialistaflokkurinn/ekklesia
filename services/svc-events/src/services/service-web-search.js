/**
 * Web Search Service
 *
 * Provides web search functionality as a fallback when RAG doesn't have
 * sufficient information. Uses Brave Search API for privacy-focused search.
 *
 * @module services/service-web-search
 */

const axios = require('axios');
const logger = require('../utils/util-logger');

// Brave Search API Configuration
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
const BRAVE_API_BASE = 'https://api.search.brave.com/res/v1';

// Search configuration
const WEB_SEARCH_CONFIG = {
  maxResults: 5,
  freshness: 'py', // Past year
  country: 'ALL',  // Iceland not supported, use ALL
  searchLang: 'is', // Icelandic
  timeout: 10000,  // 10 seconds
};

/**
 * Check if web search is available (API key configured)
 */
function isWebSearchAvailable() {
  return !!BRAVE_API_KEY;
}

/**
 * Search the web using Brave Search API
 *
 * @param {string} query - The search query
 * @param {Object} options - Search options
 * @param {number} options.count - Number of results (default: 5)
 * @param {string} options.freshness - Freshness filter (pd=day, pw=week, pm=month, py=year)
 * @returns {Promise<Array>} Array of search results
 */
async function searchWeb(query, options = {}) {
  if (!BRAVE_API_KEY) {
    logger.warn('Web search called but BRAVE_API_KEY not configured');
    return [];
  }

  const count = options.count || WEB_SEARCH_CONFIG.maxResults;
  const freshness = options.freshness || WEB_SEARCH_CONFIG.freshness;

  try {
    logger.info('Performing web search', {
      operation: 'web_search',
      query: query.substring(0, 50),
      count,
    });

    const response = await axios.get(`${BRAVE_API_BASE}/web/search`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': BRAVE_API_KEY,
      },
      params: {
        q: query,
        count,
        freshness,
        country: WEB_SEARCH_CONFIG.country,
        search_lang: WEB_SEARCH_CONFIG.searchLang,
        text_decorations: false,
        result_filter: 'web',
      },
      timeout: WEB_SEARCH_CONFIG.timeout,
    });

    const results = response.data?.web?.results || [];

    logger.info('Web search completed', {
      operation: 'web_search_complete',
      resultsFound: results.length,
    });

    // Format results for AI context
    return results.map(result => ({
      title: result.title,
      url: result.url,
      description: result.description,
      age: result.age,
      source: new URL(result.url).hostname,
    }));

  } catch (error) {
    logger.error('Web search failed', {
      operation: 'web_search_error',
      error: error.message,
      status: error.response?.status,
    });

    // Don't throw - return empty results so the flow continues
    return [];
  }
}

/**
 * Format web search results as context for AI
 *
 * @param {Array} results - Web search results
 * @returns {string} Formatted context string
 */
function formatWebResultsAsContext(results) {
  if (!results || results.length === 0) {
    return '';
  }

  const formatted = results.map((result, i) => {
    return `--- Vefleit ${i + 1} ---
Titill: ${result.title}
Heimild: ${result.source}
Slóð: ${result.url}
${result.age ? `Aldur: ${result.age}` : ''}

Lýsing:
${result.description}
`;
  });

  return `
## NIÐURSTÖÐUR ÚR VEFLEIT

Eftirfarandi upplýsingar komu úr vefleit og gætu hjálpað við að svara spurningunni:

${formatted.join('\n')}

MIKILVÆGT: Þegar þú notar upplýsingar úr vefleit, tilgreindu ALLTAF heimildina (t.d. "Samkvæmt frétt á mbl.is...")
`;
}

/**
 * Determine if web search should be triggered based on RAG results
 * Note: RAG similarity scores are boosted (can be 1-10+) so we use 3.0 as threshold
 *
 * @param {Array} ragDocs - Retrieved RAG documents
 * @param {number} threshold - Similarity threshold (default 3.0 for boosted scores)
 * @returns {boolean} True if web search should be triggered
 */
function shouldTriggerWebSearch(ragDocs, threshold = 3.0) {
  // No documents found
  if (!ragDocs || ragDocs.length === 0) {
    return true;
  }

  // Best match is below threshold (accounting for boosts)
  const bestSimilarity = ragDocs[0]?.similarity || 0;
  if (bestSimilarity < threshold) {
    return true;
  }

  return false;
}

/**
 * Check if AI response indicates lack of information
 *
 * @param {string} response - AI response text
 * @returns {boolean} True if response indicates missing info
 */
function responseIndicatesNoInfo(response) {
  const noInfoPatterns = [
    /hef ekki upplýsingar/i,
    /engar upplýsingar/i,
    /ekki aðgang að/i,
    /ekki að finna/i,
    /vantar upplýsingar/i,
    /ekki í mínum heimildum/i,
    /hef ekkert um/i,
  ];

  return noInfoPatterns.some(pattern => pattern.test(response));
}

/**
 * Build a search query optimized for web search
 * Adds context to get better Icelandic political results
 *
 * @param {string} userQuery - Original user query
 * @returns {string} Optimized search query
 */
function buildSearchQuery(userQuery) {
  // Add party context for better results
  const partyContext = 'Sósíalistaflokkurinn Íslands';

  // Check if query already mentions the party
  if (/sósíalist/i.test(userQuery)) {
    return userQuery;
  }

  // Add party context for political queries
  const politicalKeywords = [
    'kosning', 'þingmaður', 'flokkur', 'stefn', 'borgarstjórn',
    'sveitarstjórn', 'framboð', 'kjör', 'alþingi',
  ];

  const isPolitical = politicalKeywords.some(kw =>
    userQuery.toLowerCase().includes(kw)
  );

  if (isPolitical) {
    return `${userQuery} ${partyContext}`;
  }

  return userQuery;
}

module.exports = {
  isWebSearchAvailable,
  searchWeb,
  formatWebResultsAsContext,
  shouldTriggerWebSearch,
  responseIndicatesNoInfo,
  buildSearchQuery,
};
