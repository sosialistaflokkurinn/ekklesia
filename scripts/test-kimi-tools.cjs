#!/usr/bin/env node
/**
 * Test Kimi API with tool support (like production svc-events)
 * Usage: node test-kimi-tools.js "Your question here"
 *
 * This script properly handles tool calls, just like the production endpoint.
 */

const https = require('https');
const { execSync } = require('child_process');

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

// GitHub config
const GITHUB_REPO = 'sosialistaflokkurinn/ekklesia';
const GITHUB_BRANCH = 'main';
const GITHUB_RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

// Tool definitions (same as production)
const KIMI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lesa skrá úr Ekklesia GitHub repo-inu.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Slóð á skrá, t.d. "services/svc-events/src/index.js"'
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
      description: 'Sýna innihald möppu í Ekklesia GitHub repo-inu.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Slóð á möppu, t.d. "services/svc-events/src". Tómt fyrir rót.'
          }
        },
        required: []
      }
    }
  }
];

// System prompt (with strong tool instructions like production)
const SYSTEM_PROMPT = `Þú ert Kimi, kerfisstjórnunaraðstoðarmaður og sérfræðingur í Ekklesia kóðagrunni.

## TÓLANOTKUNARREGLUR - MJÖG MIKILVÆGT!

Þú VERÐUR að nota tólin í eftirfarandi tilfellum - ALDREI svara án þeirra:

1. **Spurningar um kóða** → Notaðu \`list_directory\` og \`read_file\`
   - "Hvernig virkar X?" → Lestu kóðann fyrst
   - "Hvar er Y?" → Finndu skrána og lestu
   - "Hvaða Z eru?" → Listaðu möppu og lestu skrár

2. **Spurningar um virkni** → Lestu viðeigandi skrár ÁÐUR en þú svarar

**ALDREI** svara spurningum um kóða án þess að lesa hann fyrst!
**ALDREI** segja "Ég skoða..." og síðan EKKI nota tólin - NOTAÐU þau STRAX!

## Tól
- \`read_file\`: Lesa skrá (path t.d. "services/svc-events/src/index.js")
- \`list_directory\`: Sjá innihald möppu (path t.d. "services" eða "" fyrir rót)

## Kerfisarkitektúr
| Þjónusta | Tækni | Hýsing | Region |
|----------|-------|--------|--------|
| svc-members | Python 3.12 | Firebase Functions | europe-west2 |
| svc-events | Node.js v20 | Cloud Run | europe-west1 |
| svc-elections | Node.js v20 | Cloud Run | europe-west1 |
| Frontend | Vanilla JS | Firebase Hosting | global |
| Database | PostgreSQL 15 | Cloud SQL | europe-west1 |

## Gagnagrunnur
- Instance: ekklesia-db-eu1 (europe-west1)
- Database: socialism, User: socialism
- Tenging: cloud-sql-proxy ... --port 5433

## Kostnaður: ~$18-27/mánuður
- Cloud SQL: ~$15-20, Cloud Run: ~$2-5, Firebase: ~$0-1

Svaraðu á íslensku, stuttlega og hnitmiðað. Notaðu tólin til að skoða kóða.`;

/**
 * Fetch URL with promise
 */
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Ekklesia-Kimi-Test',
        ...options.headers
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Read file from GitHub
 */
async function readGitHubFile(path) {
  const safePath = path.replace(/^\/+|\/+$/g, '').trim();
  if (safePath.includes('..')) return 'Villa: Ógild slóð';

  try {
    const url = `${GITHUB_RAW_BASE}/${safePath}`;
    const res = await fetch(url);
    if (res.status === 404) return `Villa: Skráin '${path}' fannst ekki.`;
    const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
    return content.length > 10000 ? content.substring(0, 10000) + '\n... [styttist]' : content;
  } catch (e) {
    return `Villa: ${e.message}`;
  }
}

/**
 * List directory from GitHub
 */
async function listGitHubDirectory(path = '') {
  const safePath = path ? path.replace(/^\/+|\/+$/g, '').trim() : '';
  if (safePath.includes('..')) return 'Villa: Ógild slóð';

  try {
    const url = `${GITHUB_API_BASE}/contents/${safePath}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (res.status === 404) return `Villa: Mappan '${path}' fannst ekki.`;
    if (!Array.isArray(res.data)) return `'${path}' er skrá, ekki mappa.`;

    const items = res.data.map(item => {
      const icon = item.type === 'dir' ? '📁' : '📄';
      return `${icon} ${item.name}`;
    });
    return `Innihald '${path || '/'}':\n${items.join('\n')}`;
  } catch (e) {
    return `Villa: ${e.message}`;
  }
}

/**
 * Execute tool call
 */
async function executeToolCall(toolCall) {
  const { name, arguments: argsStr } = toolCall.function;
  let args;
  try {
    args = JSON.parse(argsStr);
  } catch {
    return `Villa: Ógild færibreytur`;
  }

  console.log(`${colors.dim}   → Tól: ${name}(${args.path || ''})${colors.reset}`);

  switch (name) {
    case 'read_file':
      return await readGitHubFile(args.path);
    case 'list_directory':
      return await listGitHubDirectory(args.path || '');
    default:
      return `Villa: Óþekkt tól '${name}'`;
  }
}

/**
 * Call Kimi API
 */
async function callKimi(apiKey, messages) {
  const body = JSON.stringify({
    model: 'kimi-k2-0711-preview',
    messages,
    tools: KIMI_TOOLS,
    tool_choice: 'auto',
    temperature: 0.7,
    max_tokens: 4000
  });

  const res = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body
  });

  if (res.data.error) {
    throw new Error(res.data.error.message || JSON.stringify(res.data.error));
  }

  return res.data;
}

/**
 * Main chat function with tool loop
 */
async function chat(apiKey, question) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: question }
  ];

  const MAX_ITERATIONS = 8;
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    console.log(`${colors.dim}   Iteration ${iterations}...${colors.reset}`);

    const response = await callKimi(apiKey, messages);
    const choice = response.choices?.[0];
    const assistantMessage = choice?.message;

    if (!assistantMessage) {
      throw new Error('Empty response from Kimi');
    }

    // Check for tool calls
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      // Execute each tool
      for (const toolCall of assistantMessage.tool_calls) {
        const result = await executeToolCall(toolCall);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result.substring(0, 15000) // Limit size
        });
      }

      continue; // Loop for next response
    }

    // No tool calls - final response
    return {
      reply: assistantMessage.content,
      iterations,
      usage: response.usage
    };
  }

  throw new Error('Max iterations reached');
}

/**
 * Get API key from GCP secrets
 */
function getApiKey() {
  try {
    return execSync('gcloud secrets versions access latest --secret=kimi-api-key 2>/dev/null', {
      encoding: 'utf8'
    }).trim();
  } catch {
    console.error(`${colors.red}Error: Could not fetch API key. Run: gcloud auth login${colors.reset}`);
    process.exit(1);
  }
}

/**
 * Main
 */
async function main() {
  const question = process.argv[2] || 'Hvernig virkar auth í kerfinu?';

  console.log(`${colors.blue}=== Kimi Test (with tools) ===${colors.reset}\n`);
  console.log(`${colors.yellow}Fetching API key...${colors.reset}`);
  const apiKey = getApiKey();
  console.log(`${colors.green}✓ API key fetched${colors.reset}\n`);

  console.log(`${colors.blue}Question:${colors.reset} ${question}\n`);
  console.log(`${colors.yellow}Calling Kimi...${colors.reset}`);

  try {
    const result = await chat(apiKey, question);

    console.log(`\n${colors.green}=== Kimi Response ===${colors.reset}\n`);
    console.log(result.reply);
    console.log(`\n${colors.green}=====================${colors.reset}`);
    console.log(`${colors.dim}Iterations: ${result.iterations}, Tokens: ${result.usage?.prompt_tokens || '?'} + ${result.usage?.completion_tokens || '?'}${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

main();
