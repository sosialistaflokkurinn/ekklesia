#!/usr/bin/env node
/**
 * Test Kimi thinking mode with curated questions
 * Uses the accurate/thinking model for thorough answers
 */

process.env.GOOGLE_CLOUD_PROJECT = 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_NAME = 'socialism';
process.env.DATABASE_USER = 'socialism';
process.env.DATABASE_PASSWORD = 'Socialism2025#Db';

const axios = require('axios');
const embeddingService = require('../src/services/service-embedding');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

const fs = require('fs');
let KIMI_API_KEY = process.env.KIMI_API_KEY;
if (!KIMI_API_KEY && fs.existsSync('/tmp/kimi-key.txt')) {
  KIMI_API_KEY = fs.readFileSync('/tmp/kimi-key.txt', 'utf8').trim();
}
const KIMI_API_BASE = 'https://api.moonshot.ai/v1';

// Test questions from curated content
const TEST_QUESTIONS = [
  // 2021 kosningaáætlanir
  'Hvað er kærleikshagkerfið?',
  'Hvað segir flokkurinn um kvótakerfið?',
  'Hvað er fjórða þorskastríðið?',
  'Hvað segir flokkurinn um Samherja?',
  'Hvað eru fiskiþing?',
  'Hvað er þátttökulýðræðisleg fjárlagagerð?',
  'Hvað er þriðja stjórnsýslustigið?',

  // 2024 kosningaáætlanir
  'Hvað er Húsnæðissjóður almennings?',
  'Hvernig ætlar flokkurinn að byggja 50.000 íbúðir?',
  'Hvað segir flokkurinn um Airbnb?',
  'Hvað segir flokkurinn um gjaldfrjálsar tannlækningar?',
  'Hvað segir flokkurinn um barnabætur?',
  'Hvað segir flokkurinn um auðlegðarskatt?',
];

const vectorSearch = require('../src/services/service-vector-search');

async function searchRAG(query, limit = 5) {
  const embedding = await embeddingService.generateEmbedding(query);

  // Use the same settings as route-member-assistant.js
  const results = await vectorSearch.searchSimilar(embedding, {
    limit,
    threshold: 0.3,
    boostPolicySources: true,
    queryText: query,
  });

  return results;
}

async function askKimi(question, context, useThinking = true) {
  const model = useThinking ? 'kimi-k2-0711-preview' : 'kimi-k2-0711-preview';

  const systemPrompt = `Þú ert Kimi, aðstoðarmaður Sósíalistaflokksins. Svaraðu spurningum um stefnu flokksins á íslensku.

Notaðu eftirfarandi heimildaupplýsingar til að svara:

${context}

Reglur:
- Svaraðu alltaf á íslensku
- Notaðu aðeins upplýsingar úr heimildunum
- Tilgreindu heimildir þegar við á
- Ef þú veist ekki svarið, segðu það hreinskilnislega`;

  try {
    const response = await axios.post(
      `${KIMI_API_BASE}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        temperature: 0.3,
        max_tokens: 1500,
      },
      {
        headers: {
          'Authorization': `Bearer ${KIMI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    return `Villa: ${error.message}`;
  }
}

async function testQuestion(question, index) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`SPURNING ${index + 1}: ${question}`);
  console.log('═'.repeat(70));

  // Search RAG
  console.log('\n🔍 Leita í RAG...');
  const ragResults = await searchRAG(question, 5);

  console.log('\n📚 Heimildaskjöl:');
  ragResults.forEach((doc, i) => {
    const sim = typeof doc.similarity === 'number' ? (doc.similarity * 100).toFixed(1) : '?';
    console.log(`   ${i + 1}. [${doc.source_type}] ${doc.title} (${sim}%)`);
  });

  // Build context
  const context = ragResults.map((doc, i) =>
    `[Heimild ${i + 1}] ${doc.title}\n${doc.content}\nURL: ${doc.source_url}`
  ).join('\n\n---\n\n');

  // Ask Kimi
  console.log('\n🤖 Spyr Kimi (nákvæmur ham)...');
  const answer = await askKimi(question, context, true);

  console.log('\n📝 SVAR:');
  console.log(answer);

  return { question, answer, sources: ragResults.map(r => r.title) };
}

async function main() {
  if (!KIMI_API_KEY) {
    console.error('❌ Vantar KIMI_API_KEY. Keyrðu: gcloud secrets versions access latest --secret=kimi-api-key > /tmp/kimi-key.txt');
    process.exit(1);
  }

  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  Kimi Nákvæmur Ham - Próf á curated spurningum                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\nFjöldi spurninga: ${TEST_QUESTIONS.length}`);

  const results = [];

  try {
    for (let i = 0; i < TEST_QUESTIONS.length; i++) {
      const result = await testQuestion(TEST_QUESTIONS[i], i);
      results.push(result);

      // Small delay between requests
      if (i < TEST_QUESTIONS.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log('\n\n' + '═'.repeat(70));
    console.log('SAMANTEKT');
    console.log('═'.repeat(70));
    console.log(`\n✅ Prófaðar spurningar: ${results.length}`);

  } catch (error) {
    console.error('❌ Villa:', error.message);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
