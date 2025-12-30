/**
 * Member Assistant Route
 *
 * RAG-powered AI assistant for party members.
 * Uses pgvector for semantic search and Moonshot AI (Kimi) for responses.
 * Includes proper citation metadata in all responses.
 *
 * @module routes/route-member-assistant
 */

const express = require('express');
const axios = require('axios');
const logger = require('../utils/util-logger');
const authenticate = require('../middleware/middleware-auth');
const embeddingService = require('../services/service-embedding');
const vectorSearch = require('../services/service-vector-search');
const webSearch = require('../services/service-web-search');
const { pool } = require('../config/config-database');

const router = express.Router();

// Kimi API Configuration
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_API_BASE = 'https://api.moonshot.ai/v1';
const KIMI_MODEL_DEFAULT = 'kimi-k2-0711-preview';
const KIMI_MODELS = {
  'kimi-k2-0711-preview': { name: 'Preview (hraður)', timeout: 90000 },
  'kimi-k2-thinking': { name: 'Thinking (nákvæmur)', timeout: 180000 }
};

// RAG Configuration
const RAG_CONFIG = {
  maxDocuments: 3,
  similarityThreshold: 0.4,
  webSearchThreshold: 3.0, // Trigger web search if below this (scores are boosted 1-10+)
  maxTokens: 3000,
};

// Admin users excluded from conversation logging (developers/testers)
const ADMIN_EMAILS = [
  'gudrodur@sosialistaflokkurinn.is',
  'gudrodur@gmail.com',
];

// Admin UIDs that can query analytics
const ADMIN_UIDS = [
  'NE5e8GpzzBcjxuTHWGuJtTfevPD2', // Guðröður
];

// Analytics query patterns (Icelandic)
const ANALYTICS_PATTERNS = [
  /analytics/i,
  /notkun/i,
  /hvernig nota/i,
  /hverjir nota/i,
  /notendur/i,
  /tölfræði/i,
  /yfirlit.*kerfi/i,
  /activity/i,
  /usage/i,
];

// Cached question mappings (suggestion buttons -> question keys)
const CACHED_QUESTIONS = {
  // Kapítalismi
  'Er sósíalistaflokkurinn á móti kapitalisma?': 'kapitalísmi',
  'Er Sósíalistaflokkurinn á móti kapitalisma?': 'kapitalísmi',
  'Er flokkurinn á móti kapitalisma?': 'kapitalísmi',
  'Er flokkurinn á móti kapítalisma?': 'kapitalísmi',
  'Hvað segir flokkurinn um kapitalisma?': 'kapitalísmi',

  // Fyrir alla
  'Er Sósíalistaflokkurinn fyrir alla kjósendur?': 'fyrir-alla',
  'Er sósíalistaflokkurinn fyrir alla kjósendur?': 'fyrir-alla',
  'Er flokkurinn fyrir alla?': 'fyrir-alla',
  'Hverjir geta gengið í flokkinn?': 'fyrir-alla',

  // ESB / Evrópusambandið
  'Hver er afstaða flokksins til Evrópusambandsins?': 'esb',
  'Er flokkurinn á móti Evrópusambandinu?': 'esb',
  'Er flokkurinn á móti ESB?': 'esb',
  'Er sósíalistaflokkurinn á móti ESB?': 'esb',
  'Er Sósíalistaflokkurinn á móti ESB?': 'esb',
  'Er sócíallisti flokkurinn fylgjandi eða á móti Evrópusambandinu?': 'esb',
  'Hvað segir flokkurinn um ESB?': 'esb',
  'Hvað segir flokkurinn um Evrópusambandið?': 'esb',

  // Heimsvaldastefna
  'Er flokkurinn á móti heimsvaldastefnu?': 'heimsvaldastefna',
  'Er Sósíalistaflokkurinn á móti heimsvaldastefnu?': 'heimsvaldastefna',
  'Er sósíalistaflokkurinn á móti heimsvaldastefnu?': 'heimsvaldastefna',
  'Er Sósíalistaflokkurinn að móti heimsvaldastefnu?': 'heimsvaldastefna',
  'Er sósíalistaflokkurinn að móti heimsvaldastefnu?': 'heimsvaldastefna',
  'Hvað segir flokkurinn um NATO?': 'heimsvaldastefna',
  'Er flokkurinn á móti NATO?': 'heimsvaldastefna',
  'Hvað segir flokkurinn um hernaðarmál?': 'heimsvaldastefna',

  // Húsnæðismál
  'Hver er stefna flokksins í húsnæðismálum?': 'husnaedismal',
  'Hvað segir flokkurinn um húsnæðismál?': 'husnaedismal',
  'Hver er húsnæðisstefna flokksins?': 'husnaedismal',

  // Heilbrigðismál
  'Hvað segir flokkurinn um heilbrigðismál?': 'heilbrigdismal',
  'Hver er stefna flokksins í heilbrigðismálum?': 'heilbrigdismal',
  'Hvað segir flokkurinn um heilbrigðiskerfið?': 'heilbrigdismal',

  // Skattar
  'Hver er afstaða flokksins til skatta?': 'skattar',
  'Hvað segir flokkurinn um skatta?': 'skattar',
  'Hver er skattastefna flokksins?': 'skattar',

  // Umhverfismál
  'Hvað segir flokkurinn um loftslagsmál og umhverfisvernd?': 'umhverfismal',
  'Hvað segir flokkurinn um umhverfismál?': 'umhverfismal',
  'Hvað segir flokkurinn um loftslagsmál?': 'umhverfismal',
  'Hver er stefna flokksins í umhverfismálum?': 'umhverfismal',

  // Menntamál
  'Hver er stefna flokksins í menntamálum?': 'menntamal',
  'Hvað segir flokkurinn um menntamál?': 'menntamal',
  'Hvað segir flokkurinn um menntun?': 'menntamal',

  // Vinnumarkaður
  'Hvað segir flokkurinn um réttindi launafólks og stéttarfélög?': 'vinnumarkadur',
  'Hvað segir flokkurinn um vinnumarkaðinn?': 'vinnumarkadur',
  'Hvað segir flokkurinn um launafólk?': 'vinnumarkadur',
  'Hver er stefna flokksins í vinnumarkaðsmálum?': 'vinnumarkadur',

  // Velferð
  'Hvað segir flokkurinn um velferðarkerfið og félagslegt öryggi?': 'velferd',
  'Hvað segir flokkurinn um velferðarmál?': 'velferd',
  'Hver er velferðarstefna flokksins?': 'velferd',

  // Saga
  'Hvenær var flokkurinn stofnaður og af hverjum?': 'saga',
  'Hvenær var flokkurinn stofnaður?': 'saga',
  'Hver stofnaði flokkinn?': 'saga',
  'Hvað er saga flokksins?': 'saga',

  // Uppbygging
  'Hvernig er flokkurinn skipulagður? Hvað eru sellur?': 'uppbygging',
  'Hvernig er flokkurinn skipulagður?': 'uppbygging',
  'Hvað eru sellur?': 'uppbygging',
  'Hvernig virkar flokkurinn?': 'uppbygging',

  // Jafnrétti
  'Hver er afstaða flokksins til jafnréttismála?': 'jafnretti',
  'Hvað segir flokkurinn um jafnrétti?': 'jafnretti',
  'Hvað segir flokkurinn um jafnréttismál?': 'jafnretti',

  // Fötlunarmál
  'Hvað segir flokkurinn um málefni fatlaðs fólks?': 'fotlunarmal',
  'Hvað segir flokkurinn um fötlunarréttindi?': 'fotlunarmal',
  'Hver er stefna flokksins í málefnum fatlaðs fólks?': 'fotlunarmal',

  // Gunnar Smári
  'Er Gunnar Smári ennþá skráður í flokkinn?': 'gunnar-smari-adild',
  'Er Gunnar Smári ennþá skráður i flokkinn?': 'gunnar-smari-adild',
  'Er Gunnar Smári í flokknum?': 'gunnar-smari-adild',

  // Kosningar 2018
  'Hverjir voru í framboði fyrir flokkinn í sveitarstjórnarkosningum 2018?': 'kosningar-2018',
  'Hverjir voru í framboði 2018?': 'kosningar-2018',
  'Frambjóðendur 2018': 'kosningar-2018',
  '2018': 'kosningar-2018',

  // Kosningar 2021
  'Hverjir voru í framboði fyrir flokkinn í Alþingiskosningum 2021?': 'kosningar-2021',
  'Hverjir voru í framboði 2021?': 'kosningar-2021',
  'Frambjóðendur 2021': 'kosningar-2021',
  '2021': 'kosningar-2021',

  // Kosningar 2022
  'Hverjir voru í framboði fyrir flokkinn í sveitarstjórnarkosningum 2022?': 'kosningar-2022',
  'Hverjir voru í framboði 2022?': 'kosningar-2022',
  'Frambjóðendur 2022': 'kosningar-2022',
  '2022': 'kosningar-2022',

  // Kosningar 2024
  'Hverjir voru í framboði fyrir flokkinn í Alþingiskosningum 2024?': 'kosningar-2024',
  'Hverjir voru í framboði 2024?': 'kosningar-2024',
  'Frambjóðendur 2024': 'kosningar-2024',
  '2024': 'kosningar-2024',

  // Klofningur 2025
  'Hvað gerðist í klofningnum 2025?': 'klofningur-2025',
  'Hvað gerðist í klofningunum 2025?': 'klofningur-2025',
  'Klofningur 2025': 'klofningur-2025',
  'Klofningurinn 2025': 'klofningur-2025',
  'Hvað gerðist á aðalfundi 2025?': 'klofningur-2025',
  'Hvað gerðist í flokknum 2025?': 'klofningur-2025',
  'Hvers vegna sagði Sanna af sér?': 'klofningur-2025',
  'Af hverju sagði Sanna af sér?': 'klofningur-2025',
};

/**
 * Check if user is admin (excluded from logging)
 */
function isAdminUser(user) {
  if (!user) return false;
  return ADMIN_EMAILS.includes(user.email);
}

/**
 * Check if message is an analytics query
 */
function isAnalyticsQuery(message) {
  return ANALYTICS_PATTERNS.some(pattern => pattern.test(message));
}

/**
 * Get analytics data and format as AI-friendly response
 */
async function getAnalyticsResponse(days = 7) {
  try {
    const [
      totalEvents,
      uniqueUsers,
      pageViews,
      topPages,
      recentUsers,
      chatUsage,
      deviceStats,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as count FROM user_analytics
         WHERE created_at >= NOW() - INTERVAL '${days} days'`
      ),
      pool.query(
        `SELECT COUNT(DISTINCT user_id) as count FROM user_analytics
         WHERE created_at >= NOW() - INTERVAL '${days} days'`
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM user_analytics
         WHERE event_type = 'page_view' AND created_at >= NOW() - INTERVAL '${days} days'`
      ),
      pool.query(
        `SELECT event_name, COUNT(*) as views
         FROM user_analytics
         WHERE event_type = 'page_view' AND created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY event_name ORDER BY views DESC LIMIT 5`
      ),
      pool.query(
        `SELECT DISTINCT ON (user_id) user_id, user_name, event_name, device_type, created_at
         FROM user_analytics
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         ORDER BY user_id, created_at DESC
         LIMIT 10`
      ),
      pool.query(
        `SELECT event_name, COUNT(*) as count
         FROM user_analytics
         WHERE event_type = 'action' AND created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY event_name ORDER BY count DESC`
      ),
      pool.query(
        `SELECT device_type, COUNT(*) as count
         FROM user_analytics
         WHERE created_at >= NOW() - INTERVAL '${days} days'
         GROUP BY device_type ORDER BY count DESC`
      ),
    ]);

    // Format as readable summary
    const topPagesStr = topPages.rows.map(p => `  - ${p.event_name}: ${p.views} heimsóknir`).join('\n');
    const recentUsersStr = recentUsers.rows.map(u =>
      `  - ${u.user_name || 'Óþekktur'} (${u.device_type}) - ${u.event_name}`
    ).join('\n');
    const chatStats = chatUsage.rows.find(c => c.event_name === 'chat_open');
    const messageStats = chatUsage.rows.find(c => c.event_name === 'chat_message');
    const deviceStr = deviceStats.rows.map(d => `${d.device_type}: ${d.count}`).join(', ');

    return `## Notkun kerfisins (síðustu ${days} dagar)

**Yfirlit:**
- Heildaratburðir: ${totalEvents.rows[0].count}
- Einstakir notendur: ${uniqueUsers.rows[0].count}
- Síðuflettingar: ${pageViews.rows[0].count}

**Vinsælustu síður:**
${topPagesStr || '  Engar síðuflettingar enn'}

**Chat notkun:**
- Chat opnað: ${chatStats?.count || 0} sinnum
- Skilaboð send: ${messageStats?.count || 0}

**Tæki:** ${deviceStr || 'Engin gögn'}

**Nýlegir notendur:**
${recentUsersStr || '  Engir notendur enn'}

*Athugið: Þú (Guðröður) ert ekki í þessum tölum.*`;
  } catch (error) {
    logger.error('Analytics query error', { error: error.message });
    return 'Villa kom upp við að sækja analytics gögn: ' + error.message;
  }
}

/**
 * Look up cached response for a question
 */
async function getCachedResponse(questionText) {
  const questionKey = CACHED_QUESTIONS[questionText];
  if (!questionKey) return null;

  try {
    const result = await pool.query(
      'SELECT response, citations FROM rag_cached_responses WHERE question_key = $1',
      [questionKey]
    );
    if (result.rows.length > 0) {
      logger.info('Cache hit for question', { questionKey });
      return result.rows[0];
    }
  } catch (error) {
    logger.error('Cache lookup error', { error: error.message });
  }
  return null;
}

// System prompt for member assistant
const SYSTEM_PROMPT = `Þú ert aðstoðarmaður fyrir félaga í Sósíalistaflokknum.

## FORGANGUR HEIMILDA (MJÖG MIKILVÆGT!)
Notaðu heimildir í þessari forgangsröð:
1. **Stefnuskjöl flokksins** (policy, kosningaáætlun) - AÐALHEIMILD
2. **Ályktanir og yfirlýsingar** frá aðalfundum eða framkvæmdastjórn
3. **Viðtöl og greinar** þar sem flokkurinn tjáir sig
4. **Kosningapróf** (RÚV, Kjóstu rétt, o.fl.) - VIÐBÓTARHEIMILD, ekki aðalheimild

Byrjaðu ALLTAF á stefnuskjölum ef þau eru til staðar. Kosningapróf eru góð viðbót en ættu ekki að vera eina heimild um stefnu flokksins.

## HEIMILDAVÍSANIR
Þegar þú vitnar í skoðanir eða staðhæfingar VERÐUR þú að tilgreina:
1. HVER sagði/svaraði (flokkurinn, einstaklingur, o.s.frv.)
2. HVENÆR (ár eða dagsetning)
3. Í HVAÐA SAMHENGI (stefnuskjal, kosningapróf, flokksþing, viðtal, o.s.frv.)

Dæmi á réttu formi:
- "Samkvæmt stefnu flokksins (2024) segir í kaflanum um utanríkismál að..."
- "Í kosningaprófi RÚV 2024 staðfesti flokkurinn þessa afstöðu með að svara 'mjög sammála'..."
- "Í viðtali á Samstöðinni í júní 2025 sagði STOFNANDI_B..."

## REGLUR
1. Svaraðu AÐEINS á grundvelli heimildanna sem þú færð
2. BYRJAÐU á stefnuskjölum, bættu við úr kosningaprófum ef við á
3. Tilgreindu ALLTAF hver, hvenær, hvar
4. Ef upplýsingar vantar: "Ég hef ekki upplýsingar um þetta í mínum heimildum"
5. Vertu hlutlaus og hlýlegur
6. Svaraðu á íslensku

## HEIMILD
<context>
{{CONTEXT}}
</context>

Svaraðu spurningunni byggt á ofangreindum heimildum með skýrum heimildavísunum.`;

/**
 * Format retrieved documents as context for Kimi
 */
function formatContext(documents) {
  if (!documents || documents.length === 0) {
    return 'Engar heimildir fundust.';
  }

  const formattedDocs = documents.map((doc, i) => {
    const citation = doc.citation || {};
    const citationStr = [
      citation.who ? `Hver: ${citation.who}` : null,
      citation.when ? `Hvenær: ${citation.when}` : null,
      citation.context ? `Samhengi: ${citation.context}` : null,
      citation.question ? `Spurning: ${citation.question}` : null,
      citation.answer ? `Svar: ${citation.answer}` : null,
      citation.url ? `Slóð: ${citation.url}` : null,
    ].filter(Boolean).join('\n');

    return `--- Heimild ${i + 1} (${doc.source_type}) ---
Titill: ${doc.title}
${citationStr}

Efni:
${doc.content}
`;
  });

  return formattedDocs.join('\n\n');
}

/**
 * Filter citations to prioritize policy sources over person profiles
 * Person profiles often match generic queries but aren't useful as citations
 */
function filterCitations(documents, query) {
  // Check if query is about policy/stefna
  const policyKeywords = ['stefn', 'skoðun', 'áherslu', 'mál', 'kosning'];
  const isPolicyQuery = policyKeywords.some(kw =>
    query.toLowerCase().includes(kw)
  );

  if (!isPolicyQuery) {
    return documents;
  }

  // For policy queries, prioritize policy sources
  const policySources = ['party-website', 'kosningaprof-2024'];
  const prioritized = documents.filter(doc =>
    policySources.includes(doc.source_type)
  );

  // If we have policy sources, use those; otherwise fall back to all
  if (prioritized.length >= 2) {
    return prioritized;
  }

  // Mixed approach: policy sources first, then others
  const others = documents.filter(doc =>
    !policySources.includes(doc.source_type) &&
    doc.source_type !== 'discourse-person' // Exclude person profiles for policy
  );

  return [...prioritized, ...others].slice(0, 5);
}

/**
 * Extract citation summary from documents for frontend display
 */
function extractCitationSummary(documents) {
  return documents.map(doc => {
    const citation = doc.citation || {};
    return {
      type: doc.source_type,
      title: doc.title,
      who: citation.who,
      when: citation.when,
      context: citation.context,
      url: citation.url,
      similarity: doc.similarity,
    };
  });
}

/**
 * Save conversation to database for training/review
 * All conversations are saved for human review (training mode)
 */
async function saveConversation({
  userId,
  userName,
  question,
  response,
  citations,
  model,
  contextDocs,
  responseTimeMs,
}) {
  try {
    await pool.query(
      `INSERT INTO rag_conversations
       (user_id, user_name, question, response, citations, model, context_docs, response_time_ms, assistant_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'member-assistant')`,
      [userId, userName, question, response, JSON.stringify(citations), model, contextDocs, responseTimeMs]
    );
    logger.info('Conversation saved for training', {
      operation: 'save_conversation',
      userId,
      questionLength: question.length,
    });
  } catch (error) {
    // Don't fail the request if saving fails
    logger.error('Failed to save conversation', {
      operation: 'save_conversation_error',
      error: error.message,
    });
  }
}

/**
 * POST /api/member-assistant/chat
 * Send a question and get a RAG-powered response
 * Requires authentication (any member)
 */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, history = [], model: requestedModel } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Spurning vantar',
      });
    }

    // Check for cached response (pre-computed answers for suggestion buttons)
    const cachedResponse = await getCachedResponse(message);
    if (cachedResponse) {
      logger.info('Returning cached response', {
        operation: 'member_assistant_cache_hit',
        userId: req.user?.uid,
      });
      return res.json({
        reply: cachedResponse.response,
        citations: cachedResponse.citations || [],
        model: 'cached',
        cached: true,
      });
    }

    // Check for analytics query (admin only)
    if (ADMIN_UIDS.includes(req.user?.uid) && isAnalyticsQuery(message)) {
      logger.info('Analytics query from admin', {
        operation: 'member_assistant_analytics',
        userId: req.user?.uid,
      });
      const analyticsData = await getAnalyticsResponse(7);
      return res.json({
        reply: analyticsData,
        citations: [],
        model: 'analytics',
        cached: false,
      });
    }

    // Validate and select model (default to preview)
    const selectedModel = requestedModel && KIMI_MODELS[requestedModel]
      ? requestedModel
      : KIMI_MODEL_DEFAULT;
    const modelConfig = KIMI_MODELS[selectedModel];

    if (!KIMI_API_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'AI þjónusta er ekki stillt',
      });
    }

    const startTime = Date.now();

    logger.info('Member assistant query', {
      operation: 'member_assistant_query',
      userId: req.user?.uid,
      messageLength: message.length,
      model: selectedModel,
    });

    // Step 1: Generate embedding for the query
    let queryEmbedding;
    try {
      queryEmbedding = await embeddingService.generateEmbedding(message);
    } catch (embErr) {
      logger.error('Failed to generate query embedding', {
        operation: 'member_assistant_embedding_error',
        error: embErr.message,
      });
      return res.status(500).json({
        error: 'Embedding Error',
        message: 'Ekki tókst að vinna úr spurningunni',
      });
    }

    // Step 2: Search for relevant documents
    let retrievedDocs;
    try {
      retrievedDocs = await vectorSearch.searchSimilar(queryEmbedding, {
        limit: RAG_CONFIG.maxDocuments,
        threshold: RAG_CONFIG.similarityThreshold,
        boostPolicySources: true,
        queryText: message,
      });
    } catch (searchErr) {
      logger.error('Vector search failed', {
        operation: 'member_assistant_search_error',
        error: searchErr.message,
      });
      return res.status(500).json({
        error: 'Search Error',
        message: 'Ekki tókst að leita í heimildum',
      });
    }

    logger.info('RAG documents retrieved', {
      operation: 'member_assistant_rag',
      documentsFound: retrievedDocs.length,
      topSimilarity: retrievedDocs[0]?.similarity,
    });

    // Step 3: Check if we need web search (weak RAG results)
    let webResults = [];
    let webContext = '';

    if (webSearch.isWebSearchAvailable() &&
        webSearch.shouldTriggerWebSearch(retrievedDocs, RAG_CONFIG.webSearchThreshold)) {
      logger.info('Triggering web search due to weak RAG results', {
        operation: 'web_search_trigger',
        topSimilarity: retrievedDocs[0]?.similarity,
        threshold: RAG_CONFIG.webSearchThreshold,
      });

      const searchQuery = webSearch.buildSearchQuery(message);
      webResults = await webSearch.searchWeb(searchQuery, { count: 3 });
      webContext = webSearch.formatWebResultsAsContext(webResults);
    }

    // Step 4: Format context with documents and web results
    const ragContext = formatContext(retrievedDocs);
    const context = ragContext + webContext;
    const systemPromptWithContext = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

    // Step 5: Build messages for Kimi
    const messages = [
      { role: 'system', content: systemPromptWithContext },
      ...history.slice(-6).map(h => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Step 6: Call Kimi API
    let kimiReply;
    try {
      const response = await axios.post(
        `${KIMI_API_BASE}/chat/completions`,
        {
          model: selectedModel,
          messages,
          temperature: 0.7,
          max_tokens: RAG_CONFIG.maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${KIMI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: modelConfig.timeout,
        }
      );

      kimiReply = response.data?.choices?.[0]?.message?.content;

      if (!kimiReply) {
        throw new Error('Empty response from Kimi');
      }
    } catch (kimiErr) {
      logger.error('Kimi API call failed', {
        operation: 'member_assistant_kimi_error',
        error: kimiErr.message,
        status: kimiErr.response?.status,
      });

      // Return user-friendly error messages
      if (kimiErr.response?.status === 429) {
        return res.status(429).json({
          error: 'Rate Limited',
          message: 'Of margar beiðnir. Reyndu aftur eftir smá stund.',
        });
      }

      return res.status(500).json({
        error: 'AI Error',
        message: 'Ekki tókst að fá svar frá AI',
      });
    }

    // Step 6b: Check if response indicates no info - do web search and retry
    if (webResults.length === 0 &&
        webSearch.isWebSearchAvailable() &&
        webSearch.responseIndicatesNoInfo(kimiReply)) {

      logger.info('Response indicates no info, triggering web search', {
        operation: 'web_search_retry',
        userId: req.user?.uid,
      });

      const searchQuery = webSearch.buildSearchQuery(message);
      webResults = await webSearch.searchWeb(searchQuery, { count: 3 });

      if (webResults.length > 0) {
        // Rebuild context with web results
        const webContext = webSearch.formatWebResultsAsContext(webResults);
        const enhancedContext = ragContext + webContext;
        const enhancedPrompt = SYSTEM_PROMPT.replace('{{CONTEXT}}', enhancedContext);

        // Retry Kimi with web context
        const retryMessages = [
          { role: 'system', content: enhancedPrompt },
          ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: message },
        ];

        try {
          const retryResponse = await axios.post(
            `${KIMI_API_BASE}/chat/completions`,
            {
              model: selectedModel,
              messages: retryMessages,
              temperature: 0.7,
              max_tokens: RAG_CONFIG.maxTokens,
            },
            {
              headers: {
                Authorization: `Bearer ${KIMI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              timeout: modelConfig.timeout,
            }
          );

          const retryReply = retryResponse.data?.choices?.[0]?.message?.content;
          if (retryReply) {
            kimiReply = retryReply;
            logger.info('Web search retry successful', {
              operation: 'web_search_retry_success',
              webResultsCount: webResults.length,
            });
          }
        } catch (retryErr) {
          logger.warn('Web search retry failed, using original response', {
            operation: 'web_search_retry_failed',
            error: retryErr.message,
          });
          // Keep original kimiReply
        }
      }
    }

    // Step 7: Return response with filtered citations
    const filteredDocs = filterCitations(retrievedDocs, message);
    const citations = extractCitationSummary(filteredDocs);

    // Add web search results to citations if used
    const webCitations = webResults.map(result => ({
      type: 'web-search',
      title: result.title,
      url: result.url,
      source: result.source,
    }));
    const allCitations = [...citations, ...webCitations];

    const responseTimeMs = Date.now() - startTime;

    logger.info('Member assistant response', {
      operation: 'member_assistant_response',
      userId: req.user?.uid,
      replyLength: kimiReply.length,
      citationsCount: citations.length,
      webSearchUsed: webResults.length > 0,
      webResultsCount: webResults.length,
      responseTimeMs,
    });

    // Save conversation for training/review (non-blocking)
    // Skip logging for admin/developer users
    if (!isAdminUser(req.user)) {
      saveConversation({
        userId: req.user?.uid,
        userName: req.user?.name || req.user?.email,
        question: message,
        response: kimiReply,
        citations: allCitations,
        model: selectedModel,
        contextDocs: retrievedDocs.length,
        responseTimeMs,
        webSearchUsed: webResults.length > 0,
      });
    } else {
      logger.debug('Skipping conversation logging for admin user', {
        operation: 'skip_admin_logging',
        email: req.user?.email,
      });
    }

    res.json({
      reply: kimiReply,
      citations: allCitations,
      model: selectedModel,
      modelName: modelConfig.name,
      webSearchUsed: webResults.length > 0,
    });
  } catch (error) {
    logger.error('Member assistant error', {
      operation: 'member_assistant_error',
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      error: 'Internal Error',
      message: 'Óvænt villa kom upp',
    });
  }
});

/**
 * POST /api/member-assistant/debug/chat
 * Debug endpoint for testing RAG without Firebase auth
 * Requires X-Debug-Key header (for authorized testing only)
 */
const DEBUG_KEY = process.env.RAG_DEBUG_KEY || 'rag-test-2025-secret';

router.post('/debug/chat', async (req, res) => {
  // Verify debug key
  const providedKey = req.headers['x-debug-key'];
  if (providedKey !== DEBUG_KEY) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid debug key',
    });
  }

  try {
    const { message, history = [], model: requestedModel } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Spurning vantar',
      });
    }

    // Validate and select model (default to preview)
    const selectedModel = requestedModel && KIMI_MODELS[requestedModel]
      ? requestedModel
      : KIMI_MODEL_DEFAULT;
    const modelConfig = KIMI_MODELS[selectedModel];

    if (!KIMI_API_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'AI þjónusta er ekki stillt',
      });
    }

    logger.info('Debug member assistant query', {
      operation: 'member_assistant_debug_query',
      messageLength: message.length,
      model: selectedModel,
    });

    // Step 1: Generate embedding for the query
    let queryEmbedding;
    try {
      queryEmbedding = await embeddingService.generateEmbedding(message);
    } catch (embErr) {
      logger.error('Failed to generate query embedding', {
        operation: 'member_assistant_embedding_error',
        error: embErr.message,
      });
      return res.status(500).json({
        error: 'Embedding Error',
        message: 'Ekki tókst að vinna úr spurningunni',
      });
    }

    // Step 2: Search for relevant documents
    let retrievedDocs;
    try {
      retrievedDocs = await vectorSearch.searchSimilar(queryEmbedding, {
        limit: RAG_CONFIG.maxDocuments,
        threshold: RAG_CONFIG.similarityThreshold,
        boostPolicySources: true,
        queryText: message,
      });
    } catch (searchErr) {
      logger.error('Vector search failed', {
        operation: 'member_assistant_search_error',
        error: searchErr.message,
      });
      return res.status(500).json({
        error: 'Search Error',
        message: 'Ekki tókst að leita í heimildum',
      });
    }

    logger.info('RAG documents retrieved (debug)', {
      operation: 'member_assistant_rag_debug',
      documentsFound: retrievedDocs.length,
      topSimilarity: retrievedDocs[0]?.similarity,
    });

    // Step 3: Check if we need web search (weak RAG results)
    let webResults = [];
    let webContext = '';

    if (webSearch.isWebSearchAvailable() &&
        webSearch.shouldTriggerWebSearch(retrievedDocs, RAG_CONFIG.webSearchThreshold)) {
      logger.info('Triggering web search (debug) due to weak RAG results', {
        operation: 'web_search_trigger_debug',
        topSimilarity: retrievedDocs[0]?.similarity,
        threshold: RAG_CONFIG.webSearchThreshold,
      });

      const searchQuery = webSearch.buildSearchQuery(message);
      webResults = await webSearch.searchWeb(searchQuery, { count: 3 });
      webContext = webSearch.formatWebResultsAsContext(webResults);
    }

    // Step 4: Format context with documents and web results
    const ragContext = formatContext(retrievedDocs);
    const context = ragContext + webContext;
    const systemPromptWithContext = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

    // Step 5: Build messages for Kimi
    const messages = [
      { role: 'system', content: systemPromptWithContext },
      ...history.slice(-6).map(h => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Step 6: Call Kimi API
    let kimiReply;
    try {
      const response = await axios.post(
        `${KIMI_API_BASE}/chat/completions`,
        {
          model: selectedModel,
          messages,
          temperature: 0.7,
          max_tokens: RAG_CONFIG.maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${KIMI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: modelConfig.timeout,
        }
      );

      kimiReply = response.data?.choices?.[0]?.message?.content;

      if (!kimiReply) {
        throw new Error('Empty response from Kimi');
      }
    } catch (kimiErr) {
      logger.error('Kimi API call failed', {
        operation: 'member_assistant_kimi_error',
        error: kimiErr.message,
        status: kimiErr.response?.status,
      });

      if (kimiErr.response?.status === 429) {
        return res.status(429).json({
          error: 'Rate Limited',
          message: 'Of margar beiðnir. Reyndu aftur eftir smá stund.',
        });
      }

      return res.status(500).json({
        error: 'AI Error',
        message: 'Ekki tókst að fá svar frá AI',
      });
    }

    // Step 6b: Check if response indicates no info - do web search and retry
    if (webResults.length === 0 &&
        webSearch.isWebSearchAvailable() &&
        webSearch.responseIndicatesNoInfo(kimiReply)) {

      logger.info('Response indicates no info (debug), triggering web search', {
        operation: 'web_search_retry_debug',
      });

      const searchQuery = webSearch.buildSearchQuery(message);
      webResults = await webSearch.searchWeb(searchQuery, { count: 3 });

      if (webResults.length > 0) {
        // Rebuild context with web results
        const webContextRetry = webSearch.formatWebResultsAsContext(webResults);
        const enhancedContext = ragContext + webContextRetry;
        const enhancedPrompt = SYSTEM_PROMPT.replace('{{CONTEXT}}', enhancedContext);

        // Retry Kimi with web context
        const retryMessages = [
          { role: 'system', content: enhancedPrompt },
          ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
          { role: 'user', content: message },
        ];

        try {
          const retryResponse = await axios.post(
            `${KIMI_API_BASE}/chat/completions`,
            {
              model: selectedModel,
              messages: retryMessages,
              temperature: 0.7,
              max_tokens: RAG_CONFIG.maxTokens,
            },
            {
              headers: {
                Authorization: `Bearer ${KIMI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              timeout: modelConfig.timeout,
            }
          );

          const retryReply = retryResponse.data?.choices?.[0]?.message?.content;
          if (retryReply) {
            kimiReply = retryReply;
            logger.info('Web search retry successful (debug)', {
              operation: 'web_search_retry_success_debug',
              webResultsCount: webResults.length,
            });
          }
        } catch (retryErr) {
          logger.warn('Web search retry failed (debug), using original response', {
            operation: 'web_search_retry_failed_debug',
            error: retryErr.message,
          });
        }
      }
    }

    // Step 7: Return response with filtered citations
    const filteredDocs = filterCitations(retrievedDocs, message);
    const citations = extractCitationSummary(filteredDocs);

    // Add web search results to citations if used
    const webCitations = webResults.map(result => ({
      type: 'web-search',
      title: result.title,
      url: result.url,
      source: result.source,
    }));
    const allCitations = [...citations, ...webCitations];

    res.json({
      reply: kimiReply,
      citations: allCitations,
      model: selectedModel,
      modelName: modelConfig.name,
      webSearchUsed: webResults.length > 0,
      debug: true,
    });
  } catch (error) {
    logger.error('Debug member assistant error', {
      operation: 'member_assistant_debug_error',
      error: error.message,
    });

    res.status(500).json({
      error: 'Internal Error',
      message: 'Óvænt villa kom upp',
    });
  }
});

/**
 * GET /api/member-assistant/models
 * Get available Kimi models
 * Public endpoint (for UI)
 */
router.get('/models', (req, res) => {
  const models = Object.entries(KIMI_MODELS).map(([id, config]) => ({
    id,
    name: config.name,
    timeout: config.timeout,
    isDefault: id === KIMI_MODEL_DEFAULT
  }));

  res.json({
    models,
    default: KIMI_MODEL_DEFAULT
  });
});

/**
 * GET /api/member-assistant/stats
 * Get document statistics for the RAG system
 * Public endpoint (for dashboard)
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await vectorSearch.getDocumentStats();

    res.json({
      sources: stats,
      totalDocuments: stats.reduce((sum, s) => sum + parseInt(s.count), 0),
      totalWithEmbeddings: stats.reduce((sum, s) => sum + parseInt(s.with_embedding), 0),
    });
  } catch (error) {
    logger.error('Failed to get RAG stats', {
      operation: 'member_assistant_stats_error',
      error: error.message,
    });

    res.status(500).json({
      error: 'Stats Error',
      message: 'Ekki tókst að sækja tölfræði',
    });
  }
});

// =============================================================================
// TRAINING/REVIEW ENDPOINTS
// For human-in-the-loop training - reviewing and rating conversations
// =============================================================================

/**
 * GET /api/member-assistant/training/conversations
 * List conversations for review
 * Query params: rating (null|good|bad|needs_edit), limit, offset
 */
router.get('/training/conversations', authenticate, async (req, res) => {
  try {
    const { rating, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT id, user_name, question, response, citations, rating,
             reviewer_notes, model, response_time_ms, created_at
      FROM rag_conversations
    `;
    const params = [];

    if (rating === 'unreviewed') {
      query += ' WHERE rating IS NULL';
    } else if (rating) {
      query += ' WHERE rating = $1';
      params.push(rating);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Get counts
    const countsResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE rating IS NULL) as unreviewed,
        COUNT(*) FILTER (WHERE rating = 'good') as good,
        COUNT(*) FILTER (WHERE rating = 'bad') as bad,
        COUNT(*) FILTER (WHERE rating = 'needs_edit') as needs_edit,
        COUNT(*) as total
      FROM rag_conversations
    `);

    res.json({
      conversations: result.rows,
      counts: countsResult.rows[0],
    });
  } catch (error) {
    logger.error('Failed to get training conversations', {
      operation: 'training_list_error',
      error: error.message,
    });
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

/**
 * GET /api/member-assistant/training/conversations/:id
 * Get a single conversation for review
 */
router.get('/training/conversations/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM rag_conversations WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to get conversation', {
      operation: 'training_get_error',
      error: error.message,
    });
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * PUT /api/member-assistant/training/conversations/:id/review
 * Rate/review a conversation
 * Body: { rating: 'good'|'bad'|'needs_edit', notes?, correctedResponse? }
 */
router.put('/training/conversations/:id/review', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, notes, correctedResponse } = req.body;

    if (!['good', 'bad', 'needs_edit'].includes(rating)) {
      return res.status(400).json({ error: 'Invalid rating. Use: good, bad, needs_edit' });
    }

    await pool.query(
      `UPDATE rag_conversations
       SET rating = $1, reviewer_notes = $2, corrected_response = $3,
           reviewed_by = $4, reviewed_at = NOW()
       WHERE id = $5`,
      [rating, notes, correctedResponse, req.user?.uid, id]
    );

    logger.info('Conversation reviewed', {
      operation: 'training_review',
      conversationId: id,
      rating,
      reviewerId: req.user?.uid,
    });

    res.json({ success: true, message: 'Conversation reviewed' });
  } catch (error) {
    logger.error('Failed to review conversation', {
      operation: 'training_review_error',
      error: error.message,
    });
    res.status(500).json({ error: 'Failed to review conversation' });
  }
});

/**
 * GET /api/member-assistant/training/export
 * Export good conversations as training data
 */
router.get('/training/export', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT question,
             COALESCE(corrected_response, response) as response,
             citations, reviewer_notes
      FROM rag_conversations
      WHERE rating = 'good'
      ORDER BY reviewed_at DESC
    `);

    res.json({
      count: result.rows.length,
      trainingData: result.rows,
    });
  } catch (error) {
    logger.error('Failed to export training data', {
      operation: 'training_export_error',
      error: error.message,
    });
    res.status(500).json({ error: 'Failed to export training data' });
  }
});

/**
 * POST /api/member-assistant/admin/generate-cache
 * Generate cached responses for suggestion buttons using thinking model
 * Admin only
 */
router.post('/admin/generate-cache', authenticate, async (req, res) => {
  // Only allow admin users
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { questionKey } = req.body;
  const questions = questionKey
    ? Object.entries(CACHED_QUESTIONS).filter(([_, key]) => key === questionKey)
    : Object.entries(CACHED_QUESTIONS);

  if (questions.length === 0) {
    return res.status(400).json({ error: 'Invalid question key' });
  }

  const results = [];

  for (const [questionText, key] of questions) {
    try {
      logger.info('Generating cached response', { questionKey: key });

      // Generate embedding
      const queryEmbedding = await embeddingService.generateEmbedding(questionText);

      // Search for relevant documents
      const retrievedDocs = await vectorSearch.searchSimilar(queryEmbedding, {
        limit: RAG_CONFIG.maxDocuments,
        threshold: RAG_CONFIG.similarityThreshold,
        boostPolicySources: true,
        queryText: questionText,
      });

      // Format context
      const context = formatContext(retrievedDocs);
      const systemPromptWithContext = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

      // Call Kimi with thinking model
      const response = await axios.post(
        `${KIMI_API_BASE}/chat/completions`,
        {
          model: 'kimi-k2-thinking',
          messages: [
            { role: 'system', content: systemPromptWithContext },
            { role: 'user', content: questionText },
          ],
          temperature: 0.5,
          max_tokens: RAG_CONFIG.maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${KIMI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 180000,
        }
      );

      const reply = response.data?.choices?.[0]?.message?.content;
      const citations = retrievedDocs.map(doc => ({
        title: doc.title,
        source_type: doc.source_type,
        citation: doc.citation,
      }));

      // Save to cache
      await pool.query(
        `INSERT INTO rag_cached_responses (question_key, question_text, response, citations, model, updated_at)
         VALUES ($1, $2, $3, $4, 'kimi-k2-thinking', NOW())
         ON CONFLICT (question_key) DO UPDATE SET
           response = EXCLUDED.response,
           citations = EXCLUDED.citations,
           updated_at = NOW()`,
        [key, questionText, reply, JSON.stringify(citations)]
      );

      results.push({ key, success: true });
      logger.info('Cached response saved', { questionKey: key });

    } catch (error) {
      logger.error('Failed to generate cached response', {
        questionKey: key,
        error: error.message,
      });
      results.push({ key, success: false, error: error.message });
    }
  }

  res.json({
    message: 'Cache generation complete',
    results,
  });
});

/**
 * GET /api/member-assistant/admin/cache-status
 * Check which questions have cached responses
 * Admin only
 */
router.get('/admin/cache-status', authenticate, async (req, res) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const result = await pool.query(
      'SELECT question_key, updated_at FROM rag_cached_responses ORDER BY question_key'
    );

    const cached = result.rows.reduce((acc, row) => {
      acc[row.question_key] = row.updated_at;
      return acc;
    }, {});

    const status = Object.entries(CACHED_QUESTIONS).map(([text, key]) => ({
      key,
      question: text.substring(0, 50) + '...',
      cached: !!cached[key],
      updatedAt: cached[key] || null,
    }));

    res.json({ status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
