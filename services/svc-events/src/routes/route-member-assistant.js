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
  maxTokens: 3000,
};

// Admin users excluded from conversation logging (developers/testers)
const ADMIN_EMAILS = [
  'gudrodur@sosialistaflokkurinn.is',
  'gudrodur@gmail.com',
];

/**
 * Check if user is admin (excluded from logging)
 */
function isAdminUser(user) {
  if (!user) return false;
  return ADMIN_EMAILS.includes(user.email);
}

// System prompt for member assistant
const SYSTEM_PROMPT = `Þú ert aðstoðarmaður fyrir félaga í Sósíalistaflokknum.

## HEIMILDAVÍSANIR (MJÖG MIKILVÆGT!)
Þegar þú vitnar í skoðanir eða staðhæfingar VERÐUR þú að tilgreina:
1. HVER sagði/svaraði (flokkurinn, einstaklingur, o.s.frv.)
2. HVENÆR (ár eða dagsetning)
3. Í HVAÐA SAMHENGI (kosningapróf, flokksþing, viðtal, o.s.frv.)

Dæmi á réttu formi:
- "Í kosningaprófi RÚV 2024 svaraði Sósíalistaflokkurinn 'mjög sammála' spurningunni um hvort hækka ætti skatta á auðmenn."
- "Samkvæmt stefnu flokksins á heimasíðu hans (desember 2025) styður flokkurinn..."
- "Í viðtali á Samstöðinni í júní 2025 sagði STOFNANDI_B..."

## REGLUR
1. Svaraðu AÐEINS á grundvelli heimildanna sem þú færð
2. Tilgreindu ALLTAF hver, hvenær, hvar
3. Ef upplýsingar vantar: "Ég hef ekki upplýsingar um þetta í mínum heimildum"
4. Vertu hlutlaus og hlýlegur
5. Svaraðu á íslensku

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

    // Step 3: Format context with documents
    const context = formatContext(retrievedDocs);
    const systemPromptWithContext = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

    // Step 4: Build messages for Kimi
    const messages = [
      { role: 'system', content: systemPromptWithContext },
      ...history.slice(-6).map(h => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Step 5: Call Kimi API
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

    // Step 6: Return response with filtered citations
    const filteredDocs = filterCitations(retrievedDocs, message);
    const citations = extractCitationSummary(filteredDocs);
    const responseTimeMs = Date.now() - startTime;

    logger.info('Member assistant response', {
      operation: 'member_assistant_response',
      userId: req.user?.uid,
      replyLength: kimiReply.length,
      citationsCount: citations.length,
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
        citations,
        model: selectedModel,
        contextDocs: retrievedDocs.length,
        responseTimeMs,
      });
    } else {
      logger.debug('Skipping conversation logging for admin user', {
        operation: 'skip_admin_logging',
        email: req.user?.email,
      });
    }

    res.json({
      reply: kimiReply,
      citations,
      model: selectedModel,
      modelName: modelConfig.name,
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

    // Step 3: Format context with documents
    const context = formatContext(retrievedDocs);
    const systemPromptWithContext = SYSTEM_PROMPT.replace('{{CONTEXT}}', context);

    // Step 4: Build messages for Kimi
    const messages = [
      { role: 'system', content: systemPromptWithContext },
      ...history.slice(-6).map(h => ({
        role: h.role,
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    // Step 5: Call Kimi API
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

    // Step 6: Return response with filtered citations
    const filteredDocs = filterCitations(retrievedDocs, message);
    const citations = extractCitationSummary(filteredDocs);

    res.json({
      reply: kimiReply,
      citations,
      model: selectedModel,
      modelName: modelConfig.name,
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

module.exports = router;
