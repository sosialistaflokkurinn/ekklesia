/**
 * Sysadmin AI Chat Route
 *
 * Provides a chat endpoint for superuser system administration assistance.
 * Uses Google Gemini with tool calling for GitHub repository access.
 * Includes real-time system health data for context-aware responses.
 *
 * NOTE: This route was originally built for Moonshot AI (Kimi) but now uses Gemini.
 * The endpoint path /api/kimi/* is kept for backwards compatibility.
 */

const express = require('express');
const axios = require('axios');
const os = require('os');
const logger = require('../utils/util-logger');
const { pool, query } = require('../config/config-database');
const authenticate = require('../middleware/middleware-auth');
const { requireRole } = require('../middleware/middleware-roles');
const gemini = require('../services/service-gemini');
const admin = require('../config/config-firebase');

const router = express.Router();

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
  const status = error.response?.status || error.status;
  const code = error.code;

  // Rate limiting
  if (status === 429) {
    return {
      type: 'rate_limit',
      retryable: true,
      retryAfter: parseInt(error.response?.headers?.['retry-after']) || 60,
      message: 'AI þjónustan er of álagið. Reyndu aftur eftir smá stund.',
      logLevel: 'warn'
    };
  }

  // Authentication errors
  if (status === 401 || status === 403) {
    return {
      type: 'auth_error',
      retryable: false,
      message: 'Villa við auðkenningu við AI þjónustuna.',
      logLevel: 'error'
    };
  }

  // Server errors (5xx)
  if (status >= 500 && status < 600) {
    return {
      type: 'server_error',
      retryable: true,
      message: 'AI þjónustan er tímabundið óaðgengileg.',
      logLevel: 'warn'
    };
  }

  // Timeout
  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return {
      type: 'timeout',
      retryable: true,
      message: 'AI þjónustan svaraði ekki í tíma. Reyndu aftur.',
      logLevel: 'warn'
    };
  }

  // Network errors
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ENETUNREACH') {
    return {
      type: 'network_error',
      retryable: true,
      message: 'Ekki náðist samband við AI þjónustuna. Athugaðu nettengingu.',
      logLevel: 'error'
    };
  }

  // Bad request (usually our fault)
  if (status === 400) {
    return {
      type: 'bad_request',
      retryable: false,
      message: 'Ógild beiðni send til AI þjónustunnar.',
      logLevel: 'error'
    };
  }

  // Context length exceeded
  if (error.message?.includes('context') || error.message?.includes('token')) {
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
    message: 'Óvænt villa kom upp við samskipti við AI þjónustuna.',
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

// =============================================================================
// GCP TOOLS - Database, Firestore, Service Health
// =============================================================================

/**
 * Execute a read-only SQL query on Cloud SQL
 * Security: Only SELECT statements allowed, results limited
 */
async function queryDatabase(sqlQuery, params = []) {
  try {
    // Security: Only allow SELECT statements
    const normalizedQuery = sqlQuery.trim().toUpperCase();
    if (!normalizedQuery.startsWith('SELECT')) {
      return 'Villa: Aðeins SELECT fyrirspurnir eru leyfðar.';
    }

    // Security: Block dangerous keywords
    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'GRANT', 'REVOKE'];
    for (const keyword of dangerousKeywords) {
      if (normalizedQuery.includes(keyword)) {
        return `Villa: ${keyword} er ekki leyft.`;
      }
    }

    // Add LIMIT if not present to prevent huge result sets
    let safeQuery = sqlQuery.trim();
    if (!normalizedQuery.includes('LIMIT')) {
      safeQuery = safeQuery.replace(/;?\s*$/, '') + ' LIMIT 100';
    }

    const result = await query(safeQuery, params);

    if (result.rows.length === 0) {
      return 'Engar niðurstöður fundust.';
    }

    // Format results as readable text
    const columns = Object.keys(result.rows[0]);
    let output = `Niðurstöður (${result.rows.length} raðir):\n\n`;

    // Header
    output += columns.join(' | ') + '\n';
    output += columns.map(() => '---').join(' | ') + '\n';

    // Rows (limit to 50 for readability)
    const displayRows = result.rows.slice(0, 50);
    for (const row of displayRows) {
      output += columns.map(col => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (val instanceof Date) return val.toISOString().split('T')[0];
        return String(val).substring(0, 50);
      }).join(' | ') + '\n';
    }

    if (result.rows.length > 50) {
      output += `\n... og ${result.rows.length - 50} raðir í viðbót`;
    }

    return output;
  } catch (error) {
    return `Villa við SQL fyrirspurn: ${error.message}`;
  }
}

/**
 * Get user activity from Firestore
 */
async function getUserActivity(uid, email) {
  try {
    const db = admin.firestore();
    let userDoc = null;

    if (uid) {
      // Direct lookup by UID
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists) {
        userDoc = { id: doc.id, ...doc.data() };
      }
    } else if (email) {
      // Search by email
      const snapshot = await db.collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        userDoc = { id: doc.id, ...doc.data() };
      }
    }

    if (!userDoc) {
      return `Notandi fannst ekki${uid ? ` (uid: ${uid})` : ''}${email ? ` (email: ${email})` : ''}.`;
    }

    // Format user info
    const lines = [`## Notandi: ${userDoc.displayName || userDoc.email || userDoc.id}`];
    lines.push('');
    lines.push(`- **UID:** ${userDoc.id}`);
    if (userDoc.email) lines.push(`- **Email:** ${userDoc.email}`);
    if (userDoc.role) lines.push(`- **Hlutverk:** ${userDoc.role}`);
    if (userDoc.loginCount) lines.push(`- **Innskráningar:** ${userDoc.loginCount}`);

    if (userDoc.lastLoginAt) {
      const lastLogin = userDoc.lastLoginAt.toDate ? userDoc.lastLoginAt.toDate() : new Date(userDoc.lastLoginAt);
      lines.push(`- **Síðasta innskráning:** ${lastLogin.toLocaleString('is-IS')}`);
    }

    if (userDoc.createdAt) {
      const created = userDoc.createdAt.toDate ? userDoc.createdAt.toDate() : new Date(userDoc.createdAt);
      lines.push(`- **Stofnaður:** ${created.toLocaleString('is-IS')}`);
    }

    return lines.join('\n');
  } catch (error) {
    return `Villa við að sækja notandaupplýsingar: ${error.message}`;
  }
}

/**
 * Get recent logins from Firestore
 */
async function getRecentLogins(limit = 20, hours = 24) {
  try {
    const db = admin.firestore();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshot = await db.collection('users')
      .where('lastLoginAt', '>=', cutoffTime)
      .orderBy('lastLoginAt', 'desc')
      .limit(limit)
      .get();

    if (snapshot.empty) {
      return `Engar innskráningar síðustu ${hours} klukkustundir.`;
    }

    const lines = [`## Nýlegar innskráningar (síðustu ${hours} klst)`];
    lines.push('');
    lines.push('| Notandi | Hlutverk | Innskráning |');
    lines.push('|---------|----------|-------------|');

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const name = data.displayName || data.email || doc.id.substring(0, 8);
      const role = data.role || 'member';
      const lastLogin = data.lastLoginAt?.toDate ? data.lastLoginAt.toDate() : new Date(data.lastLoginAt);
      const timeStr = lastLogin.toLocaleString('is-IS', { dateStyle: 'short', timeStyle: 'short' });
      lines.push(`| ${name} | ${role} | ${timeStr} |`);
    });

    return lines.join('\n');
  } catch (error) {
    return `Villa við að sækja innskráningar: ${error.message}`;
  }
}

/**
 * Get health status from all services
 */
async function getServiceHealth() {
  const services = [
    { name: 'svc-events', url: 'https://events-service-521240388393.europe-west1.run.app/health' },
    { name: 'svc-elections', url: 'https://elections-service-521240388393.europe-west1.run.app/health' },
    { name: 'svc-members', url: 'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/membersHealthProbe' },
    { name: 'Django', url: 'https://starf.sosialistaflokkurinn.is/health/' },
  ];

  const results = await Promise.all(services.map(async (svc) => {
    try {
      const start = Date.now();
      const response = await axios.get(svc.url, { timeout: 10000 });
      const latency = Date.now() - start;
      return {
        name: svc.name,
        status: '✅',
        latency: `${latency}ms`,
        details: response.data?.status || 'healthy'
      };
    } catch (error) {
      return {
        name: svc.name,
        status: '❌',
        latency: '-',
        details: error.message.substring(0, 30)
      };
    }
  }));

  // Add database check
  try {
    const start = Date.now();
    await query('SELECT 1');
    const latency = Date.now() - start;
    results.push({ name: 'Cloud SQL', status: '✅', latency: `${latency}ms`, details: 'connected' });
  } catch (error) {
    results.push({ name: 'Cloud SQL', status: '❌', latency: '-', details: error.message.substring(0, 30) });
  }

  const lines = ['## Heilsa þjónusta'];
  lines.push('');
  lines.push('| Þjónusta | Staða | Latency | Athugasemd |');
  lines.push('|----------|-------|---------|------------|');

  results.forEach(r => {
    lines.push(`| ${r.name} | ${r.status} | ${r.latency} | ${r.details} |`);
  });

  return lines.join('\n');
}

// Tool definitions for Gemini (simplified format)
const SYSADMIN_TOOLS = [
  {
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
  },
  {
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
  },
  {
    name: 'query_database',
    description: 'Keyra read-only SQL fyrirspurn á Cloud SQL gagnagrunninn (PostgreSQL). Aðeins SELECT er leyft.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'SQL SELECT fyrirspurn, t.d. "SELECT COUNT(*) FROM membership_member WHERE is_paying = true"'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_user_activity',
    description: 'Sækja upplýsingar um notanda - innskráningar, hlutverk, síðasta heimsókn. Leita eftir uid eða email.',
    parameters: {
      type: 'object',
      properties: {
        uid: {
          type: 'string',
          description: 'Firebase UID notanda'
        },
        email: {
          type: 'string',
          description: 'Email notanda'
        }
      },
      required: []
    }
  },
  {
    name: 'get_recent_logins',
    description: 'Sýna nýlegar innskráningar í kerfið.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Hámarksfjöldi (default 20)'
        },
        hours: {
          type: 'number',
          description: 'Síðustu X klukkustundir (default 24)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_service_health',
    description: 'Athuga heilsu allra þjónusta (svc-events, svc-elections, svc-members, Django, Cloud SQL).',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

/**
 * Execute a tool call from Gemini
 * @param {object} toolCall - { name, arguments }
 * @returns {Promise<string>} - Tool result
 */
async function executeToolCall(toolCall) {
  const { name, arguments: args } = toolCall;

  switch (name) {
    case 'read_file':
      return await readGitHubFile(args.path);
    case 'list_directory':
      return await listGitHubDirectory(args.path || '');
    case 'query_database':
      return await queryDatabase(args.query);
    case 'get_user_activity':
      return await getUserActivity(args.uid, args.email);
    case 'get_recent_logins':
      return await getRecentLogins(args.limit || 20, args.hours || 24);
    case 'get_service_health':
      return await getServiceHealth();
    default:
      return `Villa: Óþekkt tól '${name}'`;
  }
}

// Base system prompt
const BASE_SYSTEM_PROMPT = `Þú ert kerfisstjórnunaraðstoðarmaður og sérfræðingur í Ekklesia kóðagrunni.

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

## Tól sem þú hefur aðgang að

### GitHub Repository
- \`read_file\`: Lesa skrá úr repo (path t.d. "services/svc-events/src/index.js")
- \`list_directory\`: Sjá innihald möppu (path t.d. "services/svc-events/src" eða "" fyrir rót)

### Gagnagrunnur og kerfisupplýsingar
- \`query_database\`: Keyra read-only SQL á Cloud SQL (aðeins SELECT leyft)
  - Dæmi: "SELECT COUNT(*) FROM membership_member WHERE is_paying = true"
  - Dæmi: "SELECT name, email FROM membership_member LIMIT 10"
- \`get_user_activity\`: Sækja upplýsingar um notanda úr Firestore (uid eða email)
  - Sýnir: innskráningar, hlutverk, síðasta heimsókn
- \`get_recent_logins\`: Sýna nýlegar innskráningar í kerfið
  - Getur takmarkað við X klst og Y fjölda
- \`get_service_health\`: Athuga heilsu allra þjónusta
  - Athugar: svc-events, svc-elections, svc-members, Django, Cloud SQL

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
 * Send a message to the sysadmin AI assistant and get a response
 * Supports tool calling for GitHub repository access
 * Requires superuser role
 *
 * NOTE: Uses Gemini but keeps /api/kimi/* path for backwards compatibility
 */
router.post('/chat', authenticate, requireRole('superuser'), async (req, res) => {
  try {
    const { message, history = [], model: requestedModel } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Skilaboð vantar'
      });
    }

    // Check if Gemini is available
    if (!gemini.isAvailable()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'AI þjónusta er ekki stillt'
      });
    }

    // Check circuit breaker
    if (checkCircuitBreaker()) {
      logger.warn('Sysadmin chat request rejected by circuit breaker', {
        operation: 'sysadmin_circuit_breaker',
        userId: req.user?.uid
      });
      return res.status(503).json({
        error: 'Service Temporarily Unavailable',
        message: 'AI þjónustan er tímabundið óaðgengileg vegna endurtekinna villna. Reyndu aftur eftir mínútu.',
        retryAfter: Math.ceil((circuitBreaker.resetTimeMs - (Date.now() - circuitBreaker.lastFailure)) / 1000)
      });
    }

    // Get real-time system health for context
    const healthContext = await getSystemHealthContext();
    const systemPromptWithHealth = BASE_SYSTEM_PROMPT + healthContext;

    logger.info('Sysadmin chat request', {
      operation: 'sysadmin_chat',
      userId: req.user?.uid,
      messageLength: message.length,
      historyLength: history.length,
      model: requestedModel
    });

    try {
      // Call Gemini with tool support
      const result = await gemini.generateChatWithTools({
        systemPrompt: systemPromptWithHealth,
        message,
        history: history.slice(-10),
        model: requestedModel,
        tools: SYSADMIN_TOOLS,
        executeToolCall,
        maxIterations: 5,
      });

      // Success - reset circuit breaker
      recordSuccess();

      logger.info('Sysadmin chat response', {
        operation: 'sysadmin_chat_response',
        userId: req.user?.uid,
        replyLength: result.reply.length,
        toolIterations: result.toolIterations,
        model: result.model
      });

      res.json({
        reply: result.reply,
        model: result.model,
        modelName: result.modelName
      });

    } catch (apiError) {
      // Record failure for circuit breaker
      recordFailure(apiError);
      throw apiError;
    }

  } catch (error) {
    const errorInfo = classifyError(error);

    logger[errorInfo.logLevel]('Sysadmin chat error', {
      operation: 'sysadmin_chat_error',
      errorType: errorInfo.type,
      error: error.message,
      status: error.response?.status || error.status
    });

    // Return appropriate status code based on error type
    let statusCode = 500;
    if (errorInfo.type === 'rate_limit' || error.status === 429) statusCode = 429;
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

/**
 * GET /api/kimi/models
 * Get available AI models
 * Public endpoint (for UI)
 */
router.get('/models', (req, res) => {
  const models = gemini.getAvailableModels();

  res.json({
    models,
    default: gemini.DEFAULT_MODEL
  });
});

module.exports = router;
