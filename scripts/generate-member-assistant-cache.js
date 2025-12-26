#!/usr/bin/env node
/**
 * Generate cached responses for Member Assistant suggestion buttons
 *
 * This script calls the Kimi API directly to generate and cache
 * responses for all predefined questions using the thinking model.
 *
 * Usage: node scripts/generate-member-assistant-cache.js
 */

import pg from 'pg';
const { Pool } = pg;

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'socialism',
  user: 'postgres',
  password: process.env.PGPASSWORD,
});

// Kimi API
const KIMI_API_KEY = process.env.KIMI_API_KEY;
const KIMI_API_BASE = 'https://api.moonshot.ai/v1';

// Questions to cache
const CACHED_QUESTIONS = {
  'Er sósíalistaflokkurinn á móti kapitalisma?': 'kapitalísmi',
  'Er Sósíalistaflokkurinn fyrir alla kjósendur?': 'fyrir-alla',
  'Hver er afstaða flokksins til Evrópusambandsins?': 'esb',
  'Er flokkurinn á móti heimsvaldastefnu?': 'heimsvaldastefna',
  'Hver er stefna flokksins í húsnæðismálum?': 'husnaedismal',
  'Hvað segir flokkurinn um heilbrigðismál?': 'heilbrigdismal',
  'Hver er afstaða flokksins til skatta?': 'skattar',
  'Hvað segir flokkurinn um loftslagsmál og umhverfisvernd?': 'umhverfismal',
  'Hver er stefna flokksins í menntamálum?': 'menntamal',
  'Hvað segir flokkurinn um réttindi launafólks og stéttarfélög?': 'vinnumarkadur',
  'Hvað segir flokkurinn um velferðarkerfið og félagslegt öryggi?': 'velferd',
  'Hvenær var flokkurinn stofnaður og af hverjum?': 'saga',
  'Hvernig er flokkurinn skipulagður? Hvað eru sellur?': 'uppbygging',
  'Hver er afstaða flokksins til jafnréttismála?': 'jafnretti',
  'Hvað segir flokkurinn um málefni fatlaðs fólks?': 'fotlunarmal',
};

// System prompt with web search enabled
const SYSTEM_PROMPT = `Þú ert aðstoðarmaður fyrir félaga í Sósíalistaflokknum.

## FORGANGUR HEIMILDA
1. **Stefnuskjöl flokksins** (xj.is/stefna, kosningaáætlun) - AÐALHEIMILD
2. **Ályktanir og yfirlýsingar** frá aðalfundum
3. **Kosningapróf** (RÚV, Kjóstu rétt) - VIÐBÓTARHEIMILD

## REGLUR
1. Notaðu vefleit til að finna upplýsingar á xj.is og sosialistaflokkurinn.is
2. Byrjaðu ALLTAF á stefnuskjölum ef þau eru til staðar
3. Tilgreindu heimild (hvar, hvenær)
4. Svaraðu á íslensku
5. Vertu nákvæmur og hnitmiðaður`;

async function generateResponse(questionText) {
  console.log(`   🔍 Calling Kimi API (no web search for reliability)...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180000);

  try {
    const response = await fetch(`${KIMI_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${KIMI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'kimi-k2-thinking',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: questionText },
        ],
        temperature: 0.5,
        max_tokens: 3000,
        // Removed web search tool - was causing empty responses
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      console.log(`   ⚠️  API returned: ${JSON.stringify(data).substring(0, 200)}`);
    }

    return content || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function saveToCache(key, questionText, response) {
  // Only save if response is not empty
  if (!response || response.length === 0) {
    console.log(`   ⚠️  Skipping save - empty response`);
    return false;
  }

  await pool.query(
    `INSERT INTO rag_cached_responses (question_key, question_text, response, citations, model, updated_at)
     VALUES ($1, $2, $3, '[]', 'kimi-k2-thinking', NOW())
     ON CONFLICT (question_key) DO UPDATE SET
       response = EXCLUDED.response,
       updated_at = NOW()`,
    [key, questionText, response]
  );
  return true;
}

async function needsUpdate(key) {
  const result = await pool.query(
    'SELECT LENGTH(response) as len FROM rag_cached_responses WHERE question_key = $1',
    [key]
  );
  // Needs update if not in DB or response is empty/short
  return !result.rows[0] || result.rows[0].len < 100;
}

async function main() {
  if (!KIMI_API_KEY) {
    console.error('❌ Error: KIMI_API_KEY environment variable not set');
    console.log('Run: export KIMI_API_KEY=$(gcloud secrets versions access latest --secret=kimi-api-key)');
    process.exit(1);
  }

  if (!process.env.PGPASSWORD) {
    console.error('❌ Error: PGPASSWORD environment variable not set');
    console.log('Run: export PGPASSWORD=$(gcloud secrets versions access latest --secret=postgres-password)');
    process.exit(1);
  }

  console.log('🚀 Generating cached responses for Member Assistant...');
  console.log('   Using model: kimi-k2-thinking (with web search)\n');

  const questions = Object.entries(CACHED_QUESTIONS);
  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const [questionText, key] of questions) {
    // Check if this question needs updating
    const needs = await needsUpdate(key);
    if (!needs) {
      console.log(`⏭️  [${success + failed + skipped + 1}/${questions.length}] ${key} - already cached, skipping\n`);
      skipped++;
      continue;
    }

    console.log(`📝 [${success + failed + skipped + 1}/${questions.length}] ${key}`);
    console.log(`   "${questionText.substring(0, 50)}..."`);

    try {
      const startTime = Date.now();
      const response = await generateResponse(questionText);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      const saved = await saveToCache(key, questionText, response);
      if (saved) {
        console.log(`   ✅ Saved (${response.length} chars, ${elapsed}s)\n`);
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
      failed++;
    }

    // Longer delay between requests to avoid rate limiting
    if (success + failed + skipped < questions.length) {
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ Success: ${success}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`========================================`);

  await pool.end();
}

main().catch(console.error);
