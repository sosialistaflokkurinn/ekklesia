/**
 * Kimi AI Chat Route
 *
 * Provides a chat endpoint for superuser system administration assistance.
 * Uses Moonshot AI (Kimi) k2-0711-preview model.
 * Includes real-time system health data for context-aware responses.
 */

const express = require('express');
const axios = require('axios');
const os = require('os');
const logger = require('../utils/util-logger');
const { pool, query } = require('../config/config-database');
const authenticate = require('../middleware/middleware-auth');
const { requireRole } = require('../middleware/middleware-roles');

const router = express.Router();

// Kimi API Configuration
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_API_BASE = 'https://api.moonshot.ai/v1';
const KIMI_MODEL = 'kimi-k2-0711-preview';

// Service URLs
const ELECTIONS_SERVICE_URL = process.env.ELECTIONS_SERVICE_URL || 'https://elections-service-521240388393.europe-west2.run.app';

// Base system prompt
const BASE_SYSTEM_PROMPT = `Þú ert kerfisstjórnunaraðstoðarmaður fyrir Ekklesia félagakerfi Sósíalistaflokks Íslands.

Kerfið samanstendur af:
- Firebase Hosting (frontend - members-portal)
- Firebase Functions (svc-members - Python)
- Cloud Run þjónustur (svc-elections, svc-events - Node.js)
- Cloud SQL PostgreSQL (gagnagrunnur)
- Firestore (notendagögn)
- Amazon SES (tölvupóstur)

Þú getur hjálpað með:
- Útskýra hvernig kerfið virkar
- Greina vandamál og stinga upp á lausnum
- Svara spurningum um uppsetningu og stillingar
- Hjálpa við deployment og viðhald
- Útskýra kóða og arkitektúr

Svaraðu á íslensku, stuttlega og hnitmiðað. Notaðu markdown fyrir kóða og skipanir.
Þegar þú svarar spurningum um heilsu kerfisins, notaðu RAUNVERULEG gögn sem fylgja hér fyrir neðan.`;

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

/**
 * Format uptime to human readable
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Get real-time system health summary for Kimi context
 */
async function getSystemHealthContext() {
  try {
    const lines = [`\n\n---\n## RAUNVERULEG KERFISHEILSA (${new Date().toLocaleString('is-IS')})\n`];

    // Runtime stats
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    lines.push('### svc-events (þessi þjónusta)');
    lines.push(`- Staða: ✅ Í gangi`);
    lines.push(`- Uptime: ${formatUptime(uptime)}`);
    lines.push(`- Minni: ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)} (${Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)}%)`);
    lines.push(`- Node.js: ${process.version}`);
    lines.push('');

    // Database stats
    try {
      const dbTest = await query('SELECT NOW() as now');
      const sizeResult = await query(`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
      const tableStats = await query(`
        SELECT
          (SELECT COUNT(*) FROM external_events) as events,
          (SELECT COUNT(*) FROM voting_tokens) as tokens
      `);
      const lastSync = await query(`
        SELECT sync_type, events_count, completed_at
        FROM external_events_sync_log WHERE status = 'success'
        ORDER BY completed_at DESC LIMIT 1
      `);

      lines.push('### Gagnagrunnur (Cloud SQL PostgreSQL)');
      lines.push(`- Staða: ✅ Tengdur`);
      lines.push(`- Stærð: ${sizeResult.rows[0].size}`);
      lines.push(`- Viðburðir (external_events): ${tableStats.rows[0].events}`);
      lines.push(`- Atkvæðagreiðslur (voting_tokens): ${tableStats.rows[0].tokens}`);
      lines.push(`- Pool: ${pool.totalCount} total, ${pool.idleCount} idle, ${pool.waitingCount} waiting`);
      if (lastSync.rows[0]) {
        lines.push(`- Síðasta sync: ${lastSync.rows[0].sync_type} - ${lastSync.rows[0].events_count} items (${new Date(lastSync.rows[0].completed_at).toLocaleString('is-IS')})`);
      }
      lines.push('');
    } catch (dbError) {
      lines.push('### Gagnagrunnur');
      lines.push(`- Staða: ❌ Villa: ${dbError.message}`);
      lines.push('');
    }

    // Check elections service
    try {
      const start = Date.now();
      const electionsHealth = await axios.get(`${ELECTIONS_SERVICE_URL}/health`, { timeout: 5000 });
      const latency = Date.now() - start;
      lines.push('### svc-elections');
      lines.push(`- Staða: ${electionsHealth.data?.status === 'healthy' ? '✅ Heilbrigt' : '⚠️ Vandamál'}`);
      lines.push(`- Latency: ${latency}ms`);
      lines.push(`- Version: ${electionsHealth.data?.version || 'unknown'}`);
    } catch (electionsError) {
      lines.push('### svc-elections');
      lines.push(`- Staða: ❌ Ekki hægt að ná sambandi`);
    }
    lines.push('');

    // CPU info
    lines.push('### Vélbúnaður');
    lines.push(`- CPU kjarnar: ${os.cpus().length}`);
    lines.push(`- Load average: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}`);
    lines.push('---');

    return lines.join('\n');
  } catch (error) {
    logger.warn('Failed to get system health context', { error: error.message });
    return '\n\n[Ekki tókst að sækja kerfisheilsu gögn]';
  }
}

/**
 * POST /api/kimi/chat
 * Send a message to Kimi and get a response
 * Requires superuser role
 */
router.post('/chat', authenticate, requireRole('superuser'), async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message is required'
      });
    }

    if (!KIMI_API_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Kimi API not configured'
      });
    }

    // Get real-time system health for context
    const healthContext = await getSystemHealthContext();
    const systemPromptWithHealth = BASE_SYSTEM_PROMPT + healthContext;

    // Build messages array with history
    const messages = [
      { role: 'system', content: systemPromptWithHealth },
      ...history.slice(-10).map(h => ({  // Keep last 10 messages for context
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: message }
    ];

    logger.info('Kimi chat request', {
      operation: 'kimi_chat',
      userId: req.user?.uid,
      messageLength: message.length,
      historyLength: history.length
    });

    const response = await axios.post(
      `${KIMI_API_BASE}/chat/completions`,
      {
        model: KIMI_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${KIMI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error('Empty response from Kimi');
    }

    logger.info('Kimi chat response', {
      operation: 'kimi_chat_response',
      userId: req.user?.uid,
      replyLength: reply.length
    });

    res.json({
      reply,
      model: KIMI_MODEL
    });

  } catch (error) {
    logger.error('Kimi chat error', {
      operation: 'kimi_chat_error',
      error: error.message,
      response: error.response?.data
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get response from Kimi'
    });
  }
});

module.exports = router;
