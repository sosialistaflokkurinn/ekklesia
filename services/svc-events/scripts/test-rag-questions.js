#!/usr/bin/env node
/**
 * Test RAG Questions
 * Tests the member assistant with various policy questions
 */

// Set up environment for Cloud SQL
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5433';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'socialism';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'socialism';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'Socialism2025#Db';

const embeddingService = require('../src/services/service-embedding');
const vectorSearch = require('../src/services/service-vector-search');

const QUESTIONS = [
  'Er flokkurinn með eða á móti NATO?',
  'Hvað segir flokkurinn um húsnæðismál?',
  'Hvað er stefna flokksins í menntamálum?',
  'Styður flokkurinn gjaldfrjálsan strætó?',
  'Hvað segir flokkurinn um loftslagsmál?',
  'Hvað er afstaða flokksins til kvótakerfisins?',
];

async function testQuestion(question) {
  console.log('\n' + '='.repeat(70));
  console.log(`📝 SPURNING: ${question}`);
  console.log('='.repeat(70));

  try {
    // Generate embedding for the question
    const embedding = await embeddingService.generateEmbedding(question);

    // Search for relevant documents with policy source boost
    const results = await vectorSearch.searchSimilar(embedding, {
      limit: 5,
      threshold: 0.5,
      boostPolicySources: true,
    });

    console.log(`\n📚 Fundust ${results.length} tengd skjöl:\n`);

    for (let i = 0; i < results.length; i++) {
      const doc = results[i];
      const similarity = (doc.similarity * 100).toFixed(1);
      console.log(`${i + 1}. [${similarity}%] ${doc.title}`);
      console.log(`   Heimild: ${doc.source_type}`);
      if (doc.citation) {
        const citation = typeof doc.citation === 'string' ? JSON.parse(doc.citation) : doc.citation;
        console.log(`   Vísun: ${citation.who} - ${citation.when} - ${citation.context || ''}`);
      }
      // Show first 200 chars of content
      const snippet = doc.content.substring(0, 200).replace(/\n/g, ' ');
      console.log(`   Efni: ${snippet}...`);
      console.log('');
    }

    // Build context for evaluation
    const topDoc = results[0];
    if (topDoc) {
      console.log('─'.repeat(70));
      console.log('🎯 BESTA SVAR (úr efsta skjali):');
      console.log('─'.repeat(70));

      // Extract key content
      const content = topDoc.content;
      const lines = content.split('\n').filter(l => l.trim());

      // Find KJARNASTEFNA if present
      const kjarnaLine = lines.find(l => l.includes('KJARNASTEFNA:'));
      if (kjarnaLine) {
        console.log(`\n${kjarnaLine}\n`);
      }

      // Show first relevant paragraphs
      const relevantContent = lines.slice(0, 10).join('\n');
      console.log(relevantContent);
    }

    return { question, results, success: true };
  } catch (error) {
    console.error(`❌ Villa: ${error.message}`);
    return { question, error: error.message, success: false };
  }
}

async function main() {
  console.log('🧪 RAG Spurningapróf');
  console.log('='.repeat(70));
  console.log(`Prófa ${QUESTIONS.length} spurningar...\n`);

  const results = [];

  for (const question of QUESTIONS) {
    const result = await testQuestion(question);
    results.push(result);
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 SAMANTEKT');
  console.log('='.repeat(70));

  for (const r of results) {
    if (r.success) {
      const topMatch = r.results[0];
      const similarity = topMatch ? (topMatch.similarity * 100).toFixed(1) : 0;
      console.log(`✅ ${r.question}`);
      console.log(`   → Besta samsvörun: ${similarity}% (${topMatch?.title || 'ekkert'})`);
    } else {
      console.log(`❌ ${r.question}`);
      console.log(`   → Villa: ${r.error}`);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
