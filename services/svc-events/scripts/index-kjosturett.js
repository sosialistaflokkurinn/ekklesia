#!/usr/bin/env node
/**
 * Index Kjóstu rétt Kosningapróf 2024 Data
 *
 * Indexes Kjóstu rétt election quiz (40 questions) with party answers
 * into pgvector for RAG semantic search.
 *
 * Usage:
 *   node scripts/index-kjosturett.js [--dry-run] [--no-embeddings]
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

// Load Kjóstu rétt data
const DATA_FILE = path.join(__dirname, '../data/kjosturett-2024.json');

// Scale labels for display
const SCALE_LABELS = {
  '0': 'Mjög ósammála',
  '1': 'Ósammála',
  '2': 'Sammála',
  '3': 'Mjög sammála',
  '6': 'Sleppt',
};

/**
 * Parse answer value - handles "3!" format where ! means "important"
 */
function parseAnswer(answerStr) {
  const isImportant = answerStr.includes('!');
  const value = answerStr.replace('!', '');
  return {
    value: parseInt(value, 10),
    label: SCALE_LABELS[value] || 'Óþekkt',
    isImportant,
  };
}

/**
 * Index a single question with party answer
 */
async function indexQuestion(idx, question, partyData, metadata) {
  const chunkId = `kjosturett-2024-q${idx + 1}`;
  const answerStr = partyData.answers[idx];
  const answer = parseAnswer(answerStr);

  const importantText = answer.isImportant ? ' (Mikilvægt fyrir flokkinn)' : '';

  const content = `Spurning ${idx + 1}: ${question}

Svar Sósíalistaflokksins: ${answer.label}${importantText}

Þetta er úr Kosningaprófi Kjóstu rétt 2024 með 40 spurningum um stefnumál.`;

  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-11',
    context: 'Kosningapróf Kjóstu rétt 2024',
    question: question,
    answer: answer.label,
    answerValue: answer.value,
    isImportant: answer.isImportant,
    url: metadata.url,
  };

  console.log(`   [${idx + 1}] ${question.slice(0, 50)}... → ${answer.label}${answer.isImportant ? ' ⭐' : ''}`);

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
      sourceType: 'kjosturett-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-11-01',
      chunkId,
      title: question,
      content,
      citation,
      embedding,
    });
  }
}

/**
 * Index policy topic summaries
 */
async function indexTopicSummaries(data, metadata) {
  const partyAnswers = data.parties.sosialistaflokkurinn.answers;
  const questions = data.questions;

  // Group questions by topic
  const topics = [
    {
      id: 'velferdarmal',
      title: 'Velferðarmál',
      questions: [6, 7, 8, 9], // Örorkulífeyri, sálfræði, fíkniefni
      description: 'Örorka, lífeyrir, sálfræðiþjónusta og fíkniefnastefna',
    },
    {
      id: 'heilbrigdismal',
      title: 'Heilbrigðismál',
      questions: [8, 10, 39], // Sálfræði, einkarekstur, geðheilbrigði
      description: 'Heilbrigðisþjónusta, einkarekstur og geðheilbrigði',
    },
    {
      id: 'husnaedismal',
      title: 'Húsnæðismál',
      questions: [11, 12, 13], // Leiguþak, verðtrygging, félagslegar íbúðir
      description: 'Leiguverð, verðtrygging og félagslegt húsnæði',
    },
    {
      id: 'efnahagsmal',
      title: 'Efnahagsmál',
      questions: [5, 16, 30, 31, 32, 38], // Króna, skuldir, skattar, bankar
      description: 'Gjaldmiðill, ríkisfjármál, skattar og bankar',
    },
    {
      id: 'umhverfismal',
      title: 'Umhverfismál',
      questions: [21, 22, 23, 24, 25, 27, 28], // Orkufyrirtæki, náttúra, virkjanir
      description: 'Náttúruvernd, orkumál og sjávarútvegur',
    },
    {
      id: 'utanrikismal',
      title: 'Utanríkismál',
      questions: [4, 33, 34, 35], // ESB, þróunaraðstoð, flóttamenn, Ísrael
      description: 'Evrópumál, þróunarsamvinna og útlendingamál',
    },
    {
      id: 'samgongumal',
      title: 'Samgöngumál',
      questions: [15, 18, 19, 26], // Flugvöllur, vegatoll, stofnanir, borgarlína
      description: 'Samgöngur, innviðir og byggðamál',
    },
  ];

  for (const topic of topics) {
    const chunkId = `kjosturett-2024-topic-${topic.id}`;

    const topicAnswers = topic.questions.map((qNum) => {
      const q = questions[qNum - 1];
      const answerStr = partyAnswers[qNum - 1];
      const answer = parseAnswer(answerStr);
      const important = answer.isImportant ? ' ⭐' : '';
      return `- ${q.slice(0, 70)}${q.length > 70 ? '...' : ''}: ${answer.label}${important}`;
    });

    const content = `${topic.title} - Afstaða Sósíalistaflokksins í Kjóstu rétt 2024

${topic.description}

Svör flokksins:

${topicAnswers.join('\n')}

Heimild: Kosningapróf Kjóstu rétt 2024`;

    const citation = {
      who: 'Sósíalistaflokkur Íslands',
      when: '2024-11',
      context: `${topic.title} í Kosningaprófi Kjóstu rétt 2024`,
      topic: topic.id,
      url: metadata.url,
    };

    console.log(`   ${topic.title}...`);

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
        sourceType: 'kjosturett-2024',
        sourceUrl: metadata.url,
        sourceDate: '2024-11-01',
        chunkId,
        title: `${topic.title} - Sósíalistaflokkurinn (Kjóstu rétt)`,
        content,
        citation,
        embedding,
      });
    }
  }

  return topics.length;
}

/**
 * Index key positions summary
 */
async function indexKeySummary(data, metadata) {
  const chunkId = 'kjosturett-2024-summary';
  const partyAnswers = data.parties.sosialistaflokkurinn.answers;
  const questions = data.questions;

  // Find important positions (marked with !)
  const importantPositions = partyAnswers
    .map((a, i) => ({ answer: a, question: questions[i], index: i }))
    .filter((item) => item.answer.includes('!'))
    .map((item) => {
      const answer = parseAnswer(item.answer);
      return `- ${item.question.slice(0, 60)}...: ${answer.label}`;
    });

  const content = `Lykilafstöður Sósíalistaflokksins í Kjóstu rétt 2024

Flokkurinn merkti eftirfarandi sem sérstaklega mikilvæg málefni:

${importantPositions.join('\n')}

HELSTU AFSTÖÐUR:

Mjög sammála:
- Hækka örorkulífeyri
- Niðurgreiða sálfræðiþjónustu
- Afglæpavæða neysluskammta fíkniefna
- Setja leiguþak
- Félagslegar íbúðir
- Náttúra vegi þyngra en fjárhagslegir hagsmunir
- Hálendisþjóðgarður
- Hækka skattleysismörk
- Ríkisbanki
- Viðskiptaþvinganir á Ísrael
- Hækka fjármagnstekjuskatt
- Stórátak í geðheilbrigðismálum
- Ný stjórnarskrá

Mjög ósammála:
- Einkarekstur í heilbrigðiskerfi
- Vegatoll
- Einkarekstur í skólum
- Selja orkufyrirtæki
- Einkavæða orkuframleiðslu
- Of margir flóttamenn

Heimild: Kosningapróf Kjóstu rétt 2024`;

  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-11',
    context: 'Lykilafstöður í Kosningaprófi Kjóstu rétt 2024',
    url: metadata.url,
  };

  console.log('   Lykilafstöður...');

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
      sourceType: 'kjosturett-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-11-01',
      chunkId,
      title: 'Lykilafstöður - Kjóstu rétt 2024',
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
  console.log('🗳️  Kjóstu rétt Kosningapróf 2024 Indexer');
  console.log('='.repeat(50));
  console.log(`   Dry Run: ${DRY_RUN}`);
  console.log(`   Skip Embeddings: ${SKIP_EMBEDDINGS}`);

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

    // Index each question
    console.log(`\n📋 Indexing ${questions.length} questions...`);
    for (let i = 0; i < questions.length; i++) {
      await indexQuestion(i, questions[i], partyData, metadata);
    }

    // Index policy topic summaries
    console.log('\n📊 Indexing policy topic summaries...');
    const topicCount = await indexTopicSummaries(data, metadata);

    // Index key summary
    console.log('\n💡 Indexing key positions summary...');
    await indexKeySummary(data, metadata);

    const total = questions.length + topicCount + 1;

    console.log('\n' + '='.repeat(50));
    console.log('✅ Indexing complete!');
    console.log(`   Questions: ${questions.length}`);
    console.log(`   Topics: ${topicCount}`);
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
