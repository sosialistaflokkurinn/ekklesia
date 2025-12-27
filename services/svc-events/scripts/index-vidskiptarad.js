#!/usr/bin/env node
/**
 * Index Viðskiptaráð Kosningaáttaviti 2024 Data
 *
 * Indexes Viðskiptaráð election compass (60 questions) with party answers
 * into pgvector for RAG semantic search.
 *
 * Note: Sósíalistaflokkurinn was NOT included in the original survey.
 * Answers are derived from known party positions in Kjóstu rétt, Heimildin, etc.
 *
 * Usage:
 *   node scripts/index-vidskiptarad.js [--dry-run] [--no-embeddings]
 *
 * Requires:
 *   - Cloud SQL proxy running on port 5433
 *   - GCP credentials for Vertex AI
 */

// Set up environment for Cloud SQL BEFORE any imports
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5433';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'socialism';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'socialism';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'Socialism2025#Db';

const fs = require('fs');
const path = require('path');
const embeddingService = require('../src/services/service-embedding');
const vectorSearch = require('../src/services/service-vector-search');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EMBEDDINGS = process.argv.includes('--no-embeddings');

// Load data
const DATA_FILE = path.join(__dirname, '../data/vidskiptarad-2024.json');

// Scale labels for display
const SCALE_LABELS = {
  1: 'Mjög andvíg',
  2: 'Frekar andvíg',
  3: 'Hlutlaus',
  4: 'Frekar fylgjandi',
  5: 'Mjög fylgjandi',
};

/**
 * Index a single question with party answer
 */
async function indexQuestion(idx, question, answerValue, reasoning, metadata) {
  const chunkId = `vidskiptarad-2024-q${idx + 1}`;
  const answerLabel = SCALE_LABELS[answerValue];

  const content = `Fullyrðing ${idx + 1}: ${question}

Afstaða Sósíalistaflokksins: ${answerLabel} (${answerValue}/5)

Rökstuðningur: ${reasoning || 'Byggir á þekktri stefnu flokksins.'}

Þetta er úr Kosningaáttavita Viðskiptaráðs 2024 með 60 fullyrðingum um efnahagsmál og viðskiptaumhverfi.
Athugið: Sósíalistaflokkurinn var ekki með í upprunalegu könnuninni. Svör byggð á þekktri stefnu.`;

  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-12',
    context: 'Kosningaáttaviti Viðskiptaráðs 2024 (svör áætluð)',
    question: question,
    answer: answerLabel,
    answerValue: answerValue,
    isInferred: true,
    url: metadata.url,
  };

  console.log(`   [${idx + 1}] ${question.slice(0, 50)}... → ${answerLabel}`);

  if (!DRY_RUN) {
    let embedding = null;
    if (!SKIP_EMBEDDINGS && content.length > 10) {
      try {
        embedding = await embeddingService.generateEmbedding(content);
      } catch (err) {
        console.error(`   ⚠️  Embedding failed: ${err.message}`);
      }
    }

    await vectorSearch.upsertDocument({
      sourceType: 'vidskiptarad-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-12-01',
      chunkId,
      title: question,
      content,
      citation,
      embedding,
    });
  }
}

/**
 * Index category summaries
 */
async function indexCategorySummaries(data, metadata) {
  const partyAnswers = data.parties.sosialistaflokkurinn.answers;
  const questions = data.questions;

  for (const category of data.categories) {
    const chunkId = `vidskiptarad-2024-cat-${category.id}`;

    const categoryAnswers = category.questions.map((qNum) => {
      const q = questions[qNum - 1];
      const a = partyAnswers[qNum - 1];
      return `- ${q.slice(0, 70)}${q.length > 70 ? '...' : ''}: ${SCALE_LABELS[a]}`;
    });

    // Calculate category stance
    const avgScore =
      category.questions.reduce((sum, qNum) => sum + partyAnswers[qNum - 1], 0) /
      category.questions.length;
    let overallStance;
    if (avgScore <= 1.5) overallStance = 'Mjög andvíg';
    else if (avgScore <= 2.5) overallStance = 'Frekar andvíg';
    else if (avgScore <= 3.5) overallStance = 'Hlutlaus';
    else if (avgScore <= 4.5) overallStance = 'Frekar fylgjandi';
    else overallStance = 'Mjög fylgjandi';

    const content = `${category.name} - Afstaða Sósíalistaflokksins í Kosningaáttavita Viðskiptaráðs

Heildarafstaða: ${overallStance} (meðaltal: ${avgScore.toFixed(1)}/5)

Svör flokksins:

${categoryAnswers.join('\n')}

Athugið: Sósíalistaflokkurinn var ekki með í upprunalegu könnuninni.
Svör byggð á þekktri stefnu úr Kjóstu rétt, Heimildin og stefnuskrá.

Heimild: Kosningaáttaviti Viðskiptaráðs 2024`;

    const citation = {
      who: 'Sósíalistaflokkur Íslands',
      when: '2024-12',
      context: `${category.name} í Kosningaáttavita Viðskiptaráðs 2024`,
      category: category.id,
      overallStance,
      isInferred: true,
      url: metadata.url,
    };

    console.log(`   ${category.name} (${overallStance})...`);

    if (!DRY_RUN) {
      let embedding = null;
      if (!SKIP_EMBEDDINGS && content.length > 10) {
        try {
          embedding = await embeddingService.generateEmbedding(content);
        } catch (err) {
          console.error(`   ⚠️  Embedding failed: ${err.message}`);
        }
      }

      await vectorSearch.upsertDocument({
        sourceType: 'vidskiptarad-2024',
        sourceUrl: metadata.url,
        sourceDate: '2024-12-01',
        chunkId,
        title: `${category.name} - Sósíalistaflokkurinn (Viðskiptaráð)`,
        content,
        citation,
        embedding,
      });
    }
  }

  return data.categories.length;
}

/**
 * Index overall summary
 */
async function indexOverallSummary(data, metadata) {
  const chunkId = 'vidskiptarad-2024-summary';
  const partyAnswers = data.parties.sosialistaflokkurinn.answers;

  // Find strongest positions
  const stronglyAgainst = [];
  const stronglyFor = [];

  data.questions.forEach((q, i) => {
    if (partyAnswers[i] === 1) stronglyAgainst.push(q);
    if (partyAnswers[i] === 5) stronglyFor.push(q);
  });

  const content = `Yfirlit - Sósíalistaflokkurinn í Kosningaáttavita Viðskiptaráðs 2024

Þetta er könnun Viðskiptaráðs með 60 fullyrðingum um efnahagsstefnu.
Sósíalistaflokkurinn var EKKI með í upprunalegu könnuninni.
Svör hér byggð á þekktri stefnu flokksins úr öðrum kosningaprófum.

MJÖG FYLGJANDI (5/5):
${stronglyFor.map((q) => `- ${q.slice(0, 70)}...`).join('\n')}

MJÖG ANDVÍG (1/5):
${stronglyAgainst
  .slice(0, 15)
  .map((q) => `- ${q.slice(0, 70)}...`)
  .join('\n')}
${stronglyAgainst.length > 15 ? `\n... og ${stronglyAgainst.length - 15} fleiri` : ''}

LYKILMUNUR VIÐ VIÐSKIPTARÁÐ:
Flokkurinn er mjög andvígur flestum tillögum Viðskiptaráðs þar sem:
- Andvígur skattalækkunum á fyrirtæki og fjármagnstekjur
- Andvígur einkavæðingu ríkisfyrirtækja (bankar, orkufyrirtæki)
- Andvígur afnámi regluverks og fagverndar
- Styður aukið félagslegt húsnæði og leiguvernd
- Styður gjaldfrjálsar skólamáltíðir
- Styður stóreignaskatt

Heimild: Kosningaáttaviti Viðskiptaráðs 2024`;

  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-12',
    context: 'Yfirlit yfir Kosningaáttavita Viðskiptaráðs 2024',
    isInferred: true,
    url: metadata.url,
  };

  console.log('   Yfirlit...');

  if (!DRY_RUN) {
    let embedding = null;
    if (!SKIP_EMBEDDINGS && content.length > 10) {
      try {
        embedding = await embeddingService.generateEmbedding(content);
      } catch (err) {
        console.error(`   ⚠️  Embedding failed: ${err.message}`);
      }
    }

    await vectorSearch.upsertDocument({
      sourceType: 'vidskiptarad-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-12-01',
      chunkId,
      title: 'Yfirlit - Kosningaáttaviti Viðskiptaráðs 2024',
      content,
      citation,
      embedding,
    });
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('🏢 Viðskiptaráð Kosningaáttaviti 2024 Indexer');
  console.log('='.repeat(50));
  console.log(`   Dry Run: ${DRY_RUN}`);
  console.log(`   Skip Embeddings: ${SKIP_EMBEDDINGS}`);
  console.log('   ⚠️  Athugið: Svör eru ÁÆTLUÐ, ekki opinber');

  try {
    // Load data
    if (!fs.existsSync(DATA_FILE)) {
      throw new Error(`Data file not found: ${DATA_FILE}`);
    }

    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const metadata = {
      url: data.url,
      source: data.source,
    };

    const questions = data.questions;
    const partyData = data.parties.sosialistaflokkurinn;
    const reasoning = partyData.reasoning || {};

    // Index each question
    console.log(`\n📋 Indexing ${questions.length} questions...`);
    for (let i = 0; i < questions.length; i++) {
      await indexQuestion(i, questions[i], partyData.answers[i], reasoning[String(i + 1)], metadata);
    }

    // Index category summaries
    console.log('\n📊 Indexing category summaries...');
    const categoryCount = await indexCategorySummaries(data, metadata);

    // Index overall summary
    console.log('\n💡 Indexing overall summary...');
    await indexOverallSummary(data, metadata);

    const total = questions.length + categoryCount + 1;

    console.log('\n' + '='.repeat(50));
    console.log('✅ Indexing complete!');
    console.log(`   Questions: ${questions.length}`);
    console.log(`   Categories: ${categoryCount}`);
    console.log(`   Summary: 1`);
    console.log(`   Total: ${total}`);

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - no changes were made');
    } else {
      // Show database stats
      const dbStats = await vectorSearch.getDocumentStats();
      console.log('\n📊 Database stats:');
      for (const row of dbStats) {
        console.log(`   ${row.source_type}: ${row.count} docs (${row.with_embedding} with embeddings)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
