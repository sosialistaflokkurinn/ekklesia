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

// Error handling configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000
};

// Circuit breaker state (in-memory, resets on restart)
const circuitBreaker = {
  failures: 0,
  lastFailure: null,
  isOpen: false,
  threshold: 5,          // Open circuit after 5 failures
  resetTimeMs: 60000     // Reset after 1 minute
};

/**
 * Check and update circuit breaker state
 */
function checkCircuitBreaker() {
  if (circuitBreaker.isOpen) {
    const timeSinceFailure = Date.now() - circuitBreaker.lastFailure;
    if (timeSinceFailure > circuitBreaker.resetTimeMs) {
      // Reset circuit breaker (half-open state)
      circuitBreaker.isOpen = false;
      circuitBreaker.failures = 0;
      logger.info('Circuit breaker reset', { operation: 'circuit_breaker_reset' });
    }
  }
  return circuitBreaker.isOpen;
}

/**
 * Record a failure in the circuit breaker
 */
function recordFailure(error) {
  circuitBreaker.failures++;
  circuitBreaker.lastFailure = Date.now();

  if (circuitBreaker.failures >= circuitBreaker.threshold) {
    circuitBreaker.isOpen = true;
    logger.warn('Circuit breaker opened', {
      operation: 'circuit_breaker_open',
      failures: circuitBreaker.failures,
      error: error.message
    });
  }
}

/**
 * Record a success, reset failure count
 */
function recordSuccess() {
  circuitBreaker.failures = 0;
}

/**
 * Classify error type and get user-friendly message
 */
function classifyError(error) {
  const status = error.response?.status;
  const code = error.code;

  // Rate limiting
  if (status === 429) {
    return {
      type: 'rate_limit',
      retryable: true,
      retryAfter: parseInt(error.response?.headers?.['retry-after']) || 60,
      message: 'Kimi API er of álagið. Reyndu aftur eftir smá stund.',
      logLevel: 'warn'
    };
  }

  // Authentication errors
  if (status === 401 || status === 403) {
    return {
      type: 'auth_error',
      retryable: false,
      message: 'Villa við auðkenningu við Kimi API.',
      logLevel: 'error'
    };
  }

  // Server errors (5xx)
  if (status >= 500 && status < 600) {
    return {
      type: 'server_error',
      retryable: true,
      message: 'Kimi þjónustan er tímabundið óaðgengileg.',
      logLevel: 'warn'
    };
  }

  // Timeout
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return {
      type: 'timeout',
      retryable: true,
      message: 'Kimi svaraði ekki í tíma. Reyndu aftur.',
      logLevel: 'warn'
    };
  }

  // Network errors
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ENETUNREACH') {
    return {
      type: 'network_error',
      retryable: true,
      message: 'Ekki náðist samband við Kimi. Athugaðu nettengingu.',
      logLevel: 'error'
    };
  }

  // Bad request (usually our fault)
  if (status === 400) {
    return {
      type: 'bad_request',
      retryable: false,
      message: 'Ógild beiðni send til Kimi.',
      logLevel: 'error'
    };
  }

  // Context length exceeded
  if (error.response?.data?.error?.code === 'context_length_exceeded') {
    return {
      type: 'context_exceeded',
      retryable: false,
      message: 'Samtalið er orðið of langt. Byrjaðu nýtt samtal.',
      logLevel: 'warn'
    };
  }

  // Default unknown error
  return {
    type: 'unknown',
    retryable: false,
    message: 'Óvænt villa kom upp við samskipti við Kimi.',
    logLevel: 'error'
  };
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function getRetryDelay(attempt, baseDelay = RETRY_CONFIG.baseDelayMs) {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs);
}

// Service URLs
const ELECTIONS_SERVICE_URL = process.env.ELECTIONS_SERVICE_URL || 'https://elections-service-521240388393.europe-west1.run.app';

// GitHub Repository Configuration
const GITHUB_REPO = 'sosialistaflokkurinn/ekklesia';
const GITHUB_BRANCH = 'main';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

/**
 * Validate repository path to prevent path traversal attacks
 * @param {string} path - Path to validate
 * @returns {string} - Sanitized path
 * @throws {Error} - If path is invalid
 */
function validateRepoPath(path) {
  if (!path || typeof path !== 'string') {
    throw new Error('Path required');
  }

  // Remove leading/trailing slashes and normalize
  const normalized = path.replace(/^\/+|\/+$/g, '').trim();

  // Security: Block path traversal attempts
  if (normalized.includes('..') || normalized.startsWith('.')) {
    throw new Error('Invalid path: traversal not allowed');
  }

  // Security: Only allow alphanumeric, dash, underscore, dot, and slash
  if (!/^[\w\-./]+$/.test(normalized)) {
    throw new Error('Invalid path: contains invalid characters');
  }

  // Security: Limit path length
  if (normalized.length > 200) {
    throw new Error('Invalid path: too long');
  }

  return normalized;
}

/**
 * Fetch a file from the GitHub repository
 */
async function readGitHubFile(path) {
  try {
    // Security: Validate path before use
    const safePath = validateRepoPath(path);
    const url = `${GITHUB_RAW_BASE}/${safePath}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'Accept': 'text/plain' }
    });

    // Limit file size to prevent context overflow
    const content = response.data;
    if (typeof content === 'string' && content.length > 15000) {
      return content.substring(0, 15000) + '\n\n... [Skrá styttist - of löng]';
    }
    return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
  } catch (error) {
    if (error.response?.status === 404) {
      return `Villa: Skráin '${path}' fannst ekki í repo-inu.`;
    }
    return `Villa við að lesa skrá: ${error.message}`;
  }
}

/**
 * List contents of a directory in the GitHub repository
 */
async function listGitHubDirectory(path = '') {
  try {
    // Security: Validate path (empty is allowed for root)
    const safePath = path ? validateRepoPath(path) : '';
    const url = `${GITHUB_API_BASE}/contents/${safePath}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Ekklesia-Kimi-Bot'
      }
    });

    if (!Array.isArray(response.data)) {
      return `'${path}' er skrá, ekki mappa.`;
    }

    const items = response.data.map(item => {
      const icon = item.type === 'dir' ? '📁' : '📄';
      return `${icon} ${item.name}`;
    });

    return `Innihald '${path || '/'}':\n${items.join('\n')}`;
  } catch (error) {
    if (error.response?.status === 404) {
      return `Villa: Mappan '${path}' fannst ekki.`;
    }
    return `Villa við að lesa möppu: ${error.message}`;
  }
}

// Tool definitions for Kimi
const KIMI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lesa skrá úr Ekklesia GitHub repo-inu. Notaðu þetta til að skoða kóða, stillingar eða skjölun.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Slóð á skrá í repo-inu, t.d. "apps/members-portal/superuser/js/kimi-chat.js" eða "services/svc-events/src/routes/route-kimi-chat.js"'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: 'Sýna innihald möppu í Ekklesia GitHub repo-inu. Notaðu þetta til að kanna strúktúr kóðagrunnsins.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Slóð á möppu í repo-inu, t.d. "apps/members-portal/js" eða "services/svc-events/src". Tómt fyrir rót.'
          }
        },
        required: []
      }
    }
  }
];

/**
 * Execute a tool call from Kimi
 */
async function executeToolCall(toolCall) {
  const { name, arguments: argsStr } = toolCall.function;
  let args;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return `Villa: Ógild færibreytur fyrir ${name}`;
  }

  switch (name) {
    case 'read_file':
      return await readGitHubFile(args.path);
    case 'list_directory':
      return await listGitHubDirectory(args.path || '');
    default:
      return `Villa: Óþekkt tól '${name}'`;
  }
}

// Base system prompt
const BASE_SYSTEM_PROMPT = `Þú ert Kimi, kerfisstjórnunaraðstoðarmaður og sérfræðingur í Ekklesia kóðagrunni.

## TÓLANOTKUNARREGLUR - MJÖG MIKILVÆGT!

Þú VERÐUR að nota tólin í eftirfarandi tilfellum - ALDREI svara án þeirra:

1. **Spurningar um kóða** → Notaðu \`list_directory\` og \`read_file\`
   - "Hvernig virkar X?" → Lestu kóðann fyrst
   - "Hvar er Y útfært?" → Finndu skrána og lestu hana
   - "Sýndu mér Z" → Sæktu kóðann

2. **Bestunar/umbóta spurningar** → Lestu viðeigandi skrár ÁÐUR en þú svarar
   - "Hvað mætti bæta?" → Lestu kóðann fyrst, svo tillögur
   - "Eru villur?" → Skoðaðu kóðann fyrst

3. **Skjölun/útskýringar** → Lestu CLAUDE.md eða viðeigandi docs/

**ALDREI** svara spurningum um kóðann án þess að lesa hann fyrst með tólunum!
**ALDREI** segja "Ég skoða..." og síðan ekki nota tólin - NOTAÐU þau strax!

## GitHub Repository
Ekklesia kóðinn er opinn á: https://github.com/sosialistaflokkurinn/ekklesia

Tól:
- \`read_file\`: Lesa skrá (path t.d. "services/svc-events/src/index.js")
- \`list_directory\`: Sjá innihald möppu (path t.d. "services/svc-events/src" eða "" fyrir rót)

## Kerfisarkitektúr
\`\`\`
ekklesia/
├── apps/members-portal/     # Frontend (Firebase Hosting)
│   ├── js/components/       # Reusable UI components
│   ├── js/utils/            # Utility functions
│   ├── js/api/              # API clients
│   ├── styles/              # CSS (bundle)
│   └── superuser/           # Superuser console (þar sem ég bý!)
├── services/
│   ├── svc-members/         # Firebase Functions (Python)
│   │   └── functions/       # Cloud Functions handlers
│   ├── svc-elections/       # Cloud Run (Node.js) - Atkvæðagreiðslur
│   └── svc-events/          # Cloud Run (Node.js) - Viðburðir & Kimi
├── scripts/                 # Automation & deployment
└── docs/                    # Documentation
\`\`\`

## Lykilþjónustur
| Þjónusta | Tækni | Hýsing | Region |
|----------|-------|--------|--------|
| **svc-members** | Python 3.12 | Firebase Functions | europe-west2 |
| **svc-events** | Node.js v20 | Cloud Run | europe-west1 |
| **svc-elections** | Node.js v20 | Cloud Run | europe-west1 |
| **Frontend** | Vanilla JS | Firebase Hosting | global |
| **Database** | PostgreSQL 15 | Cloud SQL | europe-west1 |

**MIKILVÆGT:** Cloud Run þjónusturnar (svc-events, svc-elections) eru **Node.js**, EKKI Python!
Aðeins Firebase Functions (svc-members) notar Python.

- **Firestore**: Sessions, audit logs
- **SendGrid**: Tölvupóstur (free tier)

## Tækniákvarðanir (meðvitaðar)
Eftirfarandi eru MEÐVITAÐAR hönnunarákvarðanir, EKKI veikleikar:

1. **Vanilla ES6 JavaScript** (ekki React/Vue/Svelte)
   - Einfaldara, hraðara, enginn build step
   - Minna dependency hell
   - Auðveldara að viðhalda til lengri tíma

2. **Ekki TypeScript**
   - Sveigjanleiki í þróun
   - JSDoc notað þar sem þarf
   - Minni complexity

3. **Vanilla CSS með CSS variables** (ekki Tailwind)
   - Ekkert build step
   - Læsilegra, auðveldara að debugga
   - Enginn vendor lock-in

4. **Monorepo strúktúr**
   - Samræmd þróun
   - Auðvelt að deila kóða milli þjónusta
   - Ein git saga

5. **ES6 modules í browser** (enginn bundler)
   - Native browser support
   - Einfaldara deployment
   - Hraðari þróun

Kerfið er **7/10 nútímalegt** - cloud native backend, einfaldur og viðhaldanlegur frontend.

## VM vs Serverless samanburður
Ef einhver spyr um VM sem valkost:

**Núverandi (Serverless) - $18-27/mán:**
✅ Kostir: Auto-scaling, engin viðhald, HA innbyggt, pay-per-use
❌ Gallar: Cloud SQL er dýr (~$15-20), cold starts

**VM valkostur - ~$5-15/mán:**
✅ Kostir: Ódýrara, PostgreSQL á VM (~$0), fastur kostnaður
❌ Gallar: Handvirkt viðhald, engin auto-scaling, single point of failure, þarf backup, OS updates

**Hvenær VM?**
- Mjög lítil notkun, fast budget
- Einn kerfisstjóri sem kann Linux

**Hvenær serverless?**
- Breytilegt álag, þarf auto-scaling
- Enginn kerfisstjóri, lágmarks viðhald
- Mission critical (HA mikilvægt)

Ekklesia notar serverless vegna lágmarks viðhalds og áreiðanleika.

## Deployment
- Frontend: \`cd services/svc-members && firebase deploy --only hosting\`
- Functions: \`firebase deploy --only functions:FUNCTION_NAME\`
- Cloud Run: \`cd services/svc-events && ./deploy.sh\`

## Gagnagrunnur (Cloud SQL PostgreSQL)
**Tenging frá local:**
\`\`\`bash
# Byrja Cloud SQL Proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 --port 5433 --gcloud-auth

# Tengjast með psql
PGPASSWORD='<password>' psql -h localhost -p 5433 -U socialism -d socialism
\`\`\`

**Lykilupplýsingar:**
- Instance: \`ekklesia-db-eu1\` (europe-west1)
- Database: \`socialism\`
- User: \`socialism\`
- Port: 5432 (Cloud SQL), 5433 (local proxy)
- Password: Í Secret Manager (\`django-socialism-db-password\`)

**Connection string (þjónustur):**
Þjónusturnar nota Unix socket tengingu í Cloud Run:
\`/cloudsql/ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1\`

## Algengar skipanir
\`\`\`bash
# Logs
gcloud run services logs read svc-events --region europe-west1 --limit 50
gcloud functions logs read FUNCTION_NAME --region europe-west2

# Rollback Cloud Run
gcloud run revisions list --service=svc-events --region=europe-west1
gcloud run services update-traffic svc-events --to-revisions=REVISION=100 --region=europe-west1

# Secrets
gcloud secrets versions access latest --secret=SECRET_NAME
\`\`\`

## Leiðbeiningar
- Svaraðu á íslensku, stuttlega og hnitmiðað
- Notaðu markdown fyrir kóða og skipanir
- Vísa í skrár með path þegar við á (t.d. \`apps/members-portal/js/utils/\`)
- Þegar þú svarar spurningum um heilsu kerfisins, notaðu RAUNVERULEG gögn sem fylgja hér fyrir neðan`;

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
          (SELECT COUNT(*) FROM elections.voting_tokens) as tokens
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

    // Check Firebase Functions (svc-members)
    try {
      const MEMBERS_API_URL = 'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net';
      const start = Date.now();
      const membersHealth = await axios.get(`${MEMBERS_API_URL}/membersHealthProbe`, { timeout: 10000 });
      const latency = Date.now() - start;
      const data = membersHealth.data;

      const isHealthy = data.status === 'healthy';
      const firestoreStatus = data.firestore === 'connected' ? '✅' : '❌';

      lines.push('### svc-members (Firebase Functions)');
      lines.push(`- Staða: ${isHealthy ? '✅ Heilbrigt' : '⚠️ Vandamál'}`);
      lines.push(`- Latency: ${latency}ms`);
      lines.push(`- Firestore: ${firestoreStatus} ${data.firestore}`);
      lines.push(`- Functions: ${data.functions?.total || '?'} deployed`);
      lines.push(`- Region: ${data.region || 'europe-west2'}`);
    } catch (membersError) {
      lines.push('### svc-members (Firebase Functions)');
      lines.push(`- Staða: ❌ Ekki hægt að ná sambandi: ${membersError.message?.substring(0, 50)}`);
    }
    lines.push('');

    // CPU info
    lines.push('### Vélbúnaður');
    lines.push(`- CPU kjarnar: ${os.cpus().length}`);
    lines.push(`- Load average: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}`);
    lines.push('');

    // Cost estimation (based on very low usage - ~50 users, minimal traffic)
    lines.push('### Áætlaður kostnaður (mjög lítil notkun)');
    lines.push('');
    lines.push('**Google Cloud Platform:**');
    lines.push('- Cloud SQL PostgreSQL: ~$15-20/mán (lægsti grunnkostnaður)');
    lines.push('- Cloud Run (svc-events, svc-elections): ~$2-5/mán');
    lines.push('- Firebase Functions: ~$0-1/mán (free tier)');
    lines.push('- Firebase Hosting: ~$0 (free tier)');
    lines.push('- Cloud Storage: ~$0.50/mán');
    lines.push('- Secret Manager: ~$0 (free tier)');
    lines.push('- Cloud Build: ~$0.50/mán');
    lines.push('');
    lines.push('**Tölvupóstur:**');
    lines.push('- SendGrid: ~$0 (free tier, 100 emails/dag)');
    lines.push('');
    lines.push('**Samtals: ~$18-27/mánuður**');
    lines.push('');
    lines.push('_Cloud SQL er stærsti kostnaðurinn. Raunverulegan kostnað má sjá í GCP Console → Billing._');
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
 * Supports tool calling for GitHub repository access
 * Requires superuser role
 */
router.post('/chat', authenticate, requireRole('superuser'), async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Skilaboð vantar'
      });
    }

    if (!KIMI_API_KEY) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Kimi API er ekki stillt'
      });
    }

    // Check circuit breaker
    if (checkCircuitBreaker()) {
      logger.warn('Kimi request rejected by circuit breaker', {
        operation: 'kimi_circuit_breaker',
        userId: req.user?.uid
      });
      return res.status(503).json({
        error: 'Service Temporarily Unavailable',
        message: 'Kimi er tímabundið óaðgengilegur vegna endurtekinna villna. Reyndu aftur eftir mínútu.',
        retryAfter: Math.ceil((circuitBreaker.resetTimeMs - (Date.now() - circuitBreaker.lastFailure)) / 1000)
      });
    }

    // Get real-time system health for context
    const healthContext = await getSystemHealthContext();
    const systemPromptWithHealth = BASE_SYSTEM_PROMPT + healthContext;

    // Build messages array with history
    const messages = [
      { role: 'system', content: systemPromptWithHealth },
      ...history.slice(-10).map(h => ({
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

    // Maximum tool call iterations to prevent infinite loops
    const MAX_TOOL_ITERATIONS = 5;
    let iterations = 0;
    let finalReply = null;

    /**
     * Make API call with retry logic
     */
    async function callKimiWithRetry(requestMessages) {
      let lastError = null;

      for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
          const response = await axios.post(
            `${KIMI_API_BASE}/chat/completions`,
            {
              model: KIMI_MODEL,
              messages: requestMessages,
              tools: KIMI_TOOLS,
              tool_choice: 'auto',
              temperature: 0.7,
              max_tokens: 4000
            },
            {
              headers: {
                'Authorization': `Bearer ${KIMI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              timeout: 90000
            }
          );

          // Success - reset circuit breaker
          recordSuccess();
          return response;

        } catch (error) {
          lastError = error;
          const errorInfo = classifyError(error);

          logger[errorInfo.logLevel]('Kimi API call failed', {
            operation: 'kimi_api_error',
            attempt: attempt + 1,
            maxRetries: RETRY_CONFIG.maxRetries,
            errorType: errorInfo.type,
            retryable: errorInfo.retryable,
            status: error.response?.status,
            error: error.message
          });

          // Don't retry if not retryable
          if (!errorInfo.retryable) {
            recordFailure(error);
            throw error;
          }

          // Don't retry if this was the last attempt
          if (attempt >= RETRY_CONFIG.maxRetries) {
            recordFailure(error);
            throw error;
          }

          // Calculate delay (use retryAfter for rate limits)
          const delay = errorInfo.type === 'rate_limit'
            ? errorInfo.retryAfter * 1000
            : getRetryDelay(attempt);

          logger.info('Retrying Kimi API call', {
            operation: 'kimi_retry',
            attempt: attempt + 1,
            delayMs: delay,
            errorType: errorInfo.type
          });

          await sleep(delay);
        }
      }

      throw lastError;
    }

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const response = await callKimiWithRetry(messages);

      const choice = response.data?.choices?.[0];
      const assistantMessage = choice?.message;

      if (!assistantMessage) {
        throw new Error('Empty response from Kimi');
      }

      // Check if Kimi wants to call tools
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add assistant message with tool calls to conversation
        messages.push(assistantMessage);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          logger.info('Kimi tool call', {
            operation: 'kimi_tool_call',
            tool: toolCall.function.name,
            args: toolCall.function.arguments
          });

          const toolResult = await executeToolCall(toolCall);

          // Add tool result to conversation
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult
          });
        }

        // Continue loop to get Kimi's response after tool execution
        continue;
      }

      // No tool calls - we have the final response
      finalReply = assistantMessage.content;
      break;
    }

    if (!finalReply) {
      throw new Error('No final response from Kimi after tool calls');
    }

    logger.info('Kimi chat response', {
      operation: 'kimi_chat_response',
      userId: req.user?.uid,
      replyLength: finalReply.length,
      toolIterations: iterations
    });

    res.json({
      reply: finalReply,
      model: KIMI_MODEL
    });

  } catch (error) {
    const errorInfo = classifyError(error);

    logger[errorInfo.logLevel]('Kimi chat error', {
      operation: 'kimi_chat_error',
      errorType: errorInfo.type,
      error: error.message,
      status: error.response?.status,
      response: error.response?.data
    });

    // Return appropriate status code based on error type
    let statusCode = 500;
    if (errorInfo.type === 'rate_limit') statusCode = 429;
    else if (errorInfo.type === 'auth_error') statusCode = 503;
    else if (errorInfo.type === 'bad_request') statusCode = 400;
    else if (errorInfo.type === 'context_exceeded') statusCode = 413;

    const responseBody = {
      error: errorInfo.type,
      message: errorInfo.message
    };

    // Add retry-after header for rate limits
    if (errorInfo.type === 'rate_limit' && errorInfo.retryAfter) {
      res.set('Retry-After', String(errorInfo.retryAfter));
      responseBody.retryAfter = errorInfo.retryAfter;
    }

    res.status(statusCode).json(responseBody);
  }
});

module.exports = router;
