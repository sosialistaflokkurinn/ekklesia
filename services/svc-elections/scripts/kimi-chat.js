#!/usr/bin/env node
/**
 * Kimi Chat CLI - Direct API access with full system context
 * Usage: node kimi-chat.js "Your message here"
 */

const https = require('https');
const { execSync } = require('child_process');

// Kimi API Configuration
const KIMI_API_BASE = 'https://api.moonshot.ai/v1';
const KIMI_MODEL = 'kimi-k2-0711-preview';

// System prompt (same as route-kimi-chat.js)
const SYSTEM_PROMPT = `You are Kimi, a system administration assistant and expert on the Ekklesia codebase.

## TOOL USAGE RULES - VERY IMPORTANT!

Since this is a CLI test, you don't have access to tools. Answer based on your knowledge of the codebase structure.

## GitHub Repository
Ekklesia code is open source at: https://github.com/sosialistaflokkurinn/ekklesia

## System Architecture
\`\`\`
ekklesia/
├── apps/members-portal/     # Frontend (Firebase Hosting)
│   ├── js/components/       # Reusable UI components
│   ├── js/utils/            # Utility functions
│   ├── js/api/              # API clients
│   ├── styles/              # CSS (bundle)
│   └── superuser/           # Superuser console
├── services/
│   ├── svc-members/         # Firebase Functions (Python)
│   │   └── functions/       # Cloud Functions handlers
│   ├── svc-elections/       # Cloud Run (Node.js) - Elections/voting
│   │   └── src/
│   │       ├── routes/      # API routes
│   │       ├── middleware/  # Express middleware
│   │       └── utils/       # Utilities
│   └── svc-events/          # Cloud Run (Node.js) - Events & Kimi
│       └── src/
│           ├── routes/      # API routes
│           ├── middleware/  # Express middleware
│           └── utils/       # Utilities
├── scripts/                 # Automation & deployment
└── docs/                    # Documentation
\`\`\`

## Key Services
- **Firebase Hosting**: Frontend at ekklesia-prod-10-2025.web.app
- **Firebase Functions (svc-members)**: Python - Auth, membership, email
- **Cloud Run (svc-events)**: Node.js - Events, Facebook sync, Kimi chat API
- **Cloud Run (svc-elections)**: Node.js - Elections, voting, ballots
- **Cloud SQL PostgreSQL**: Main database (europe-west2)
- **Firestore**: User data, sessions, audit logs
- **Amazon SES**: Email (eu-west-1)

## Recent Backend Improvements (Issues #369-#375)
Both svc-events and svc-elections now have:
- middleware-async-handler.js - Async error wrapper for Express routes
- middleware-rate-limiter.js - IP + User-Agent fingerprinting
- middleware-timeout.js - Request timeout middleware (5s-30s)
- middleware-validation.js - Zod schema validation
- util-transaction.js - Safe transaction handling with rollback
- util-pagination.js - Pagination validation utility
- Database pool: min=2, max=25 connections

## Guidelines
- Answer in English (this is CLI mode)
- Be concise and technical
- Use markdown for code and commands
- Reference file paths when relevant (e.g. \`services/svc-elections/src/middleware/\`)`;

async function getApiKey() {
  try {
    const key = execSync('gcloud secrets versions access latest --secret=kimi-api-key 2>/dev/null', {
      encoding: 'utf-8'
    }).trim();
    return key;
  } catch (error) {
    console.error('Error fetching API key from GCP secrets');
    process.exit(1);
  }
}

async function callKimi(apiKey, message) {
  const data = JSON.stringify({
    model: KIMI_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message }
    ],
    temperature: 0.7,
    max_tokens: 4000
  });

  return new Promise((resolve, reject) => {
    const url = new URL(`${KIMI_API_BASE}/chat/completions`);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.error) {
            reject(new Error(JSON.stringify(json.error, null, 2)));
          } else {
            resolve(json.choices?.[0]?.message?.content || 'No response');
          }
        } catch (e) {
          reject(new Error(`Parse error: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(data);
    req.end();
  });
}

async function main() {
  const message = process.argv.slice(2).join(' ') ||
    'Hello! Can you tell me about the validation middleware in svc-elections?';

  console.log('Fetching API key...');
  const apiKey = await getApiKey();
  console.log(`API key loaded (${apiKey.length} chars)\n`);

  console.log('Message:', message);
  console.log('\nSending to Kimi...\n');

  try {
    const reply = await callKimi(apiKey, message);
    console.log('=== Kimi Response ===\n');
    console.log(reply);
    console.log('\n=====================');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
