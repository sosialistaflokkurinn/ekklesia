#!/usr/bin/env node
/**
 * Index Heimildin Kosningapróf 2024 Data
 *
 * Indexes Heimildin election quiz (70 questions) with candidate comparisons
 * into pgvector for RAG semantic search.
 *
 * Usage:
 *   node scripts/index-heimildin.js [--dry-run] [--no-embeddings]
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

// Load Heimildin data
const DATA_FILE = path.join(__dirname, '../data/heimildin-kosningaprof-2024.json');

// Scale labels for display
const SCALE_LABELS = {
  1: 'Mjög ósammála',
  2: 'Frekar ósammála',
  3: 'Hlutlaus',
  4: 'Frekar sammála',
  5: 'Mjög sammála',
};

/**
 * Index a single question with party answer
 */
async function indexQuestion(idx, question, partyAnswer, metadata) {
  const chunkId = `heimildin-2024-q${idx + 1}`;
  const answerLabel = SCALE_LABELS[partyAnswer];

  const content = `Fullyrðing ${idx + 1}: ${question}

Svar Sósíalistaflokksins: ${answerLabel} (${partyAnswer}/5)

Þetta er úr Kosningaprófi Heimildarinnar 2024 með 70 fullyrðingum.`;

  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-11',
    context: 'Kosningapróf Heimildarinnar 2024',
    question: question,
    answer: answerLabel,
    answerValue: partyAnswer,
    url: metadata.url,
  };

  console.log(`   [${idx + 1}] ${question.slice(0, 50)}...`);

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
      sourceType: 'heimildin-2024',
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
 * Index candidate comparison data
 */
async function indexCandidateComparison(candidate, candidateData, questions, partyAnswers, metadata) {
  const chunkId = `heimildin-2024-candidate-${candidate}`;

  // Find differences
  const differences = [];
  for (let i = 0; i < 70; i++) {
    if (candidateData.values[i] !== partyAnswers[i]) {
      differences.push({
        q: i + 1,
        question: questions[i],
        party: SCALE_LABELS[partyAnswers[i]],
        candidate: SCALE_LABELS[candidateData.values[i]],
        diff: Math.abs(candidateData.values[i] - partyAnswers[i]),
      });
    }
  }

  // Sort by biggest differences first
  differences.sort((a, b) => b.diff - a.diff);

  const topDiffs = differences.slice(0, 5);
  const diffText = topDiffs
    .map(
      (d) =>
        `- ${d.question.slice(0, 60)}... (flokkur: ${d.party}, ${candidateData.name}: ${d.candidate})`
    )
    .join('\n');

  const content = `${candidateData.name} - Samanburður við stefnu Sósíalistaflokksins

Flokkur: ${candidateData.party}
Kjördæmi: ${candidateData.constituency}
Sæti: ${candidateData.seat}. sæti
Samsvörun við flokksstefnu: ${candidateData.matchPercent}%

Fjöldi fullyrðinga þar sem ${candidateData.name} svarar öðruvísi en flokkurinn: ${differences.length} af 70

Stærsti munur:
${diffText}

Heimild: Kosningapróf Heimildarinnar 2024`;

  const citation = {
    who: candidateData.name,
    party: candidateData.party,
    when: '2024-11',
    context: 'Samanburður við flokksstefnu í Kosningaprófi Heimildarinnar 2024',
    matchPercent: candidateData.matchPercent,
    totalDifferences: differences.length,
    url: metadata.url,
  };

  console.log(`   ${candidateData.name} (${candidateData.matchPercent}% samsvörun)...`);

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
      sourceType: 'heimildin-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-11-01',
      chunkId,
      title: `${candidateData.name} - Kosningapróf Heimildarinnar`,
      content,
      citation,
      embedding,
    });
  }
}

/**
 * Index key policy areas summary
 */
async function indexPolicySummaries(data, metadata) {
  const partyAnswers = data.answers.sosialistaflokkurinn_ideal.values;
  const questions = data.questions;

  // Group questions by topic
  const topics = [
    {
      id: 'efnahagsmal',
      title: 'Efnahagsmál',
      questions: [6, 8, 9, 22, 30, 31, 38, 50, 54],
      description: 'Skattar, ríkisfjármál og efnahagsstefna',
    },
    {
      id: 'velferdmal',
      title: 'Velferðarmál',
      questions: [2, 7, 18, 20, 28, 51, 55, 56],
      description: 'Heilbrigði, menntun og velferð',
    },
    {
      id: 'husnaedismal',
      title: 'Húsnæðismál',
      questions: [9, 45, 48, 49],
      description: 'Félagslegt húsnæði og leigumarkaður',
    },
    {
      id: 'umhverfismal',
      title: 'Umhverfismál',
      questions: [11, 16, 19, 37, 58, 60],
      description: 'Náttúruvernd og orkumál',
    },
    {
      id: 'utanrikismal',
      title: 'Utanríkismál',
      questions: [5, 7, 46, 57, 59, 68, 69],
      description: 'NATO, ESB, flóttamenn og alþjóðamál',
    },
    {
      id: 'lydraedi',
      title: 'Lýðræði og réttindi',
      questions: [15, 27, 34, 44, 62, 63, 65, 66],
      description: 'Stjórnarskrá, tjáningarfrelsi og lýðræði',
    },
  ];

  for (const topic of topics) {
    const chunkId = `heimildin-2024-topic-${topic.id}`;

    const topicAnswers = topic.questions.map((qNum) => {
      const q = questions[qNum - 1];
      const a = partyAnswers[qNum - 1];
      return `- ${q.slice(0, 70)}${q.length > 70 ? '...' : ''}: ${SCALE_LABELS[a]}`;
    });

    const content = `${topic.title} - Afstaða Sósíalistaflokksins

${topic.description}

Svör flokksins í Kosningaprófi Heimildarinnar 2024:

${topicAnswers.join('\n')}

Heimild: Kosningapróf Heimildarinnar 2024`;

    const citation = {
      who: 'Sósíalistaflokkur Íslands',
      when: '2024-11',
      context: `${topic.title} í Kosningaprófi Heimildarinnar 2024`,
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
        sourceType: 'heimildin-2024',
        sourceUrl: metadata.url,
        sourceDate: '2024-11-01',
        chunkId,
        title: `${topic.title} - Sósíalistaflokkurinn`,
        content,
        citation,
        embedding,
      });
    }
  }

  return topics.length;
}

/**
 * Index key insights document
 */
async function indexKeyInsights(data, metadata) {
  const chunkId = 'heimildin-2024-insights';

  const content = `Lykilinnsýn úr Kosningaprófi Heimildarinnar 2024

Sósíalistaflokkurinn náði 90% samsvörun við ráðgert svar flokksins.

FRAMBJÓÐENDUR OG SAMSVÖRUN:
- Davíð Þór Jónsson (Vinstri græn): 90% samsvörun
- Sanna Magdalena Mörtudóttir (Sósíalistaflokkurinn): 88% samsvörun
- Gunnar Smári Egilsson (Sósíalistaflokkurinn): 82% samsvörun

ALLIR SAMMÁLA UM:
${data.keyInsights.commonAgreements.map((a) => `- ${a}`).join('\n')}

STÆRSTI ÁGREININGUR GUNNARS SMÁRA VIÐ FLOKKSSTEFNU:
${data.keyInsights.biggestDisagreements.gunnar_smari.map((d) => `- ${d}`).join('\n')}

STÆRSTI ÁGREININGUR SÖNNU VIÐ FLOKKSSTEFNU:
${data.keyInsights.biggestDisagreements.sanna.map((d) => `- ${d}`).join('\n')}

Heimild: Kosningapróf Heimildarinnar 2024`;

  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-11',
    context: 'Lykilinnsýn úr Kosningaprófi Heimildarinnar 2024',
    url: metadata.url,
  };

  console.log('   Lykilinnsýn...');

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
      sourceType: 'heimildin-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-11-01',
      chunkId,
      title: 'Lykilinnsýn - Kosningapróf Heimildarinnar 2024',
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
  console.log('📰 Heimildin Kosningapróf 2024 Indexer');
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
    const partyAnswers = data.answers.sosialistaflokkurinn_ideal.values;

    // Index each question
    console.log(`\n📋 Indexing ${questions.length} questions...`);
    for (let i = 0; i < questions.length; i++) {
      await indexQuestion(i, questions[i], partyAnswers[i], metadata);
    }

    // Index candidate comparisons
    console.log('\n👥 Indexing candidate comparisons...');
    const candidates = ['gunnar_smari_egilsson', 'sanna_magdalena_mortudottir', 'david_thor_jonsson'];
    for (const candidate of candidates) {
      await indexCandidateComparison(
        candidate,
        data.answers[candidate],
        questions,
        partyAnswers,
        metadata
      );
    }

    // Index policy topic summaries
    console.log('\n📊 Indexing policy topic summaries...');
    const topicCount = await indexPolicySummaries(data, metadata);

    // Index key insights
    console.log('\n💡 Indexing key insights...');
    await indexKeyInsights(data, metadata);

    const total = questions.length + candidates.length + topicCount + 1;

    console.log('\n' + '='.repeat(50));
    console.log('✅ Indexing complete!');
    console.log(`   Questions: ${questions.length}`);
    console.log(`   Candidates: ${candidates.length}`);
    console.log(`   Topics: ${topicCount}`);
    console.log(`   Insights: 1`);
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
