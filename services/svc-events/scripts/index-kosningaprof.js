#!/usr/bin/env node
/**
 * Index RÚV Kosningapróf Data
 *
 * Scrapes election quiz answers from kosningaprof.ruv.is and indexes
 * them into pgvector for RAG semantic search.
 *
 * Usage:
 *   node scripts/index-kosningaprof.js [--dry-run] [--no-embeddings]
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

const embeddingService = require('../src/services/service-embedding');
const vectorSearch = require('../src/services/service-vector-search');

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EMBEDDINGS = process.argv.includes('--no-embeddings');

// RÚV Kosningapróf 2024 data for Sósíalistaflokkurinn
// Source: https://kosningaprof.ruv.is/flokkar/sosialistaflokkur-islands/
const KOSNINGAPROF_2024 = {
  metadata: {
    source: 'RÚV Kosningapróf',
    year: 2024,
    election: 'Alþingiskosningar 2024',
    party: 'Sósíalistaflokkur Íslands',
    url: 'https://kosningaprof.ruv.is/flokkar/sosialistaflokkur-islands/',
  },
  propositions: [
    {
      id: 1,
      question: 'Íslenskt samfélag einkennist af réttlæti, sanngirni og jöfnum tækifærum',
      answer: 'Ósammála',
      explanation: 'Samfélagið einkennist af ójöfnuði þrátt fyrir auð Íslands; þúsundir búa við fátækt og húsnæðiskreppu.',
    },
    {
      id: 2,
      question: 'Auka á vægi einkareksturs í heilbrigðiskerfinu',
      answer: 'Mjög ósammála',
      explanation: 'Styðjum opinbera heilbrigðiskerfið; koma í veg fyrir að einkaaðilar græði á heilsuvandamálum.',
    },
    {
      id: 3,
      question: 'Grunnskólar eiga að kenna börnum að lesa, skrifa og reikna og láta foreldra um að kenna samfélagsleg gildi',
      answer: 'Ósammála',
      explanation: 'Skólar eru samfélög; þeir ættu að undirbúa nemendur fyrir lýðræðislega þátttöku.',
    },
    {
      id: 4,
      question: 'Lágmarkslaun eiga að vera hærri en nú er',
      answer: 'Mjög sammála',
      explanation: 'Styðjum launahækkanir.',
    },
    {
      id: 5,
      question: 'Ríkið á að halda áfram að styðja Samgöngusáttmála höfuðborgarsvæðisins',
      answer: 'Hlutlaus',
      explanation: 'Styðjum almenningssamgöngur en erum á móti vegatollum sem fjármögnun.',
    },
    {
      id: 6,
      question: 'Ísland á að taka þátt í að fjármagna vopnakaup fyrir Úkraínumenn',
      answer: 'Mjög ósammála',
      explanation: 'Fordæmum allt ofbeldi; erum á móti hernaði.',
    },
    {
      id: 7,
      question: 'Draga ætti verulega úr kostnaðarþátttöku sjúklinga í heilbrigðiskerfinu',
      answer: 'Mjög sammála',
      explanation: 'Heilbrigðisþjónusta á að vera gjaldfrjáls.',
    },
    {
      id: 8,
      question: 'Eitt af meginmarkmiðum skattkerfisins á að vera að jafna kjör almennings',
      answer: 'Mjög sammála',
      explanation: 'Styðjum stighækkandi skattlagningu.',
    },
    {
      id: 9,
      question: 'Fyrirtæki sem nýta auðlindir landsins ættu að greiða meira til ríkisins',
      answer: 'Mjög sammála',
      explanation: 'Styðjum auðlindagjöld.',
    },
    {
      id: 10,
      question: 'Íslensk stjórnvöld eiga að tala af meiri festu gegn hernaði Ísraela á Gaza',
      answer: 'Mjög sammála',
      explanation: 'Fordæmum þjóðarmorðið í Palestínu.',
    },
    {
      id: 11,
      question: 'Hækka ætti gjöld á mengunarvalda til að minnka losun gróðurhúsalofttegunda',
      answer: 'Sammála',
      explanation: 'Styðjum stighækkandi kolefnis-/mengunarskatta með félagslegu réttlæti.',
    },
    {
      id: 12,
      question: 'Herða ætti lög eða reglur til að færri sæki hér um alþjóðlega vernd',
      answer: 'Mjög ósammála',
      explanation: 'Erum á móti innflytjendahöftum.',
    },
    {
      id: 13,
      question: 'Íslenskt samfélag var öruggt og friðsælt en er það ekki lengur',
      answer: 'Hlutlaus',
      explanation: 'Nýfrjálshyggja hefur skapað ójöfnuð og hruni á innviðum sem hefur áhrif á lífskjör.',
    },
    {
      id: 14,
      question: 'Komi til annars heimsfaraldurs eiga stjórnvöld að ganga skemmra í sóttvarnaaðgerðum',
      answer: 'Ósammála',
      explanation: 'Efins um minnkaðar sóttvarnir.',
    },
    {
      id: 15,
      question: 'Stjórnvöld eiga að gera allt sem í þeirra valdi stendur til að tryggja að fólk geti áfram búið í Grindavík',
      answer: 'Hlutlaus',
      explanation: 'Hlusta á óskir íbúa; bregðast við á viðeigandi hátt.',
    },
    {
      id: 16,
      question: 'Hagsmunir náttúrunnar eiga að vega þyngra en fjárhagslegir hagsmunir',
      answer: 'Mjög sammála',
      explanation: 'Setjum umhverfisvernd í forgang.',
    },
    {
      id: 17,
      question: 'Efna á til þjóðaratkvæðagreiðslu um aðildarviðræður við ESB',
      answer: 'Hlutlaus',
      explanation: 'Styðjum lýðræðislegan þátttöku almennings í mikilvægum utanríkismálum.',
    },
    {
      id: 18,
      question: 'Innheimta á veggjöld í auknum mæli til að fjármagna vegaframkvæmdir',
      answer: 'Mjög ósammála',
      explanation: 'Allir vegir og brýr eiga að vera gjaldfrjáls og aðgengileg.',
    },
    {
      id: 19,
      question: 'Það er nauðsynlegt að virkja meira á Íslandi',
      answer: 'Mjög ósammála',
      explanation: 'Erum á móti stækkun vatnsaflsvirkjana.',
    },
    {
      id: 20,
      question: 'Slaka ætti á regluverki og kröfum í byggingariðnaði til að flýta húsnæðisuppbyggingu',
      answer: 'Mjög ósammála',
      explanation: 'Viðhalda byggingastöðlum.',
    },
    {
      id: 21,
      question: 'Alþingi á að vinna markvisst að endurskoðun stjórnarskrárinnar',
      answer: 'Ósammála',
      explanation: 'Ný stjórnarskrá hefur þegar verið samþykkt með þjóðaratkvæðagreiðslu; hún ætti að taka strax gildi.',
    },
  ],
  rangeQuestions: [
    {
      id: 'corporate_tax',
      question: 'Fyrirtækjaskattar',
      answer: 'Hærri (4/5)',
      explanation: 'Lægra fyrir smáfyrirtæki; hækka fyrir stærstu fyrirtækin; endurinnleiða aðstöðugjöld.',
    },
    {
      id: 'income_tax',
      question: 'Tekjuskattar',
      answer: 'Mun lægri (0/5)',
      explanation: 'Afnema skatta á lægstu laun og grunnlífeyri.',
    },
    {
      id: 'immigration_integration',
      question: 'Útgjöld til aðlögunar innflytjenda',
      answer: 'Mun meira (4/5)',
      explanation: 'Leggja áherslu á aðlögun frekar en samruna.',
    },
    {
      id: 'decentralization',
      question: 'Flutningur ríkisstarfa til landsbyggðar',
      answer: 'Meira (3/5)',
      explanation: 'Styðjum byggðaþróun.',
    },
    {
      id: 'alcohol_freedom',
      question: 'Frelsi í áfengissölu',
      answer: 'Minna (1/5)',
      explanation: 'Takmarka verslunarframboð.',
    },
  ],
  priorities: [
    'Heilbrigðismál',
    'Húsnæðismál',
    'Vextir og verðbólga',
    'Opinber fjármál og tekjur',
  ],
};

/**
 * Index a single proposition question
 */
async function indexProposition(prop, metadata) {
  const chunkId = `kosningaprof-2024-prop-${prop.id}`;

  // Build searchable content
  const content = `Spurning: ${prop.question}

Svar Sósíalistaflokksins: ${prop.answer}

Útskýring: ${prop.explanation}`;

  // Build citation with full context
  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-10',
    context: 'Kosningapróf RÚV fyrir alþingiskosningar 2024',
    question: prop.question,
    answer: prop.answer,
    url: metadata.url,
  };

  console.log(`   [${prop.id}] ${prop.question.slice(0, 50)}...`);

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
      sourceType: 'kosningaprof-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-10-01',
      chunkId,
      title: prop.question,
      content,
      citation,
      embedding,
    });
  }
}

/**
 * Index a range question
 */
async function indexRangeQuestion(q, metadata) {
  const chunkId = `kosningaprof-2024-range-${q.id}`;

  const content = `Spurning: ${q.question}

Svar Sósíalistaflokksins: ${q.answer}

Útskýring: ${q.explanation}`;

  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-10',
    context: 'Kosningapróf RÚV fyrir alþingiskosningar 2024',
    question: q.question,
    answer: q.answer,
    url: metadata.url,
  };

  console.log(`   [${q.id}] ${q.question}...`);

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
      sourceType: 'kosningaprof-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-10-01',
      chunkId,
      title: q.question,
      content,
      citation,
      embedding,
    });
  }
}

/**
 * Index priority issues
 */
async function indexPriorities(priorities, metadata) {
  const chunkId = 'kosningaprof-2024-priorities';

  const content = `Forgangsröðun Sósíalistaflokksins í kosningaprófi RÚV 2024:

1. ${priorities[0]}
2. ${priorities[1]}
3. ${priorities[2]}
4. ${priorities[3]}

Þessi mál eru mikilvægust fyrir flokkinn í alþingiskosningum 2024.`;

  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: '2024-10',
    context: 'Forgangsröðun í kosningaprófi RÚV 2024',
    priorities: priorities,
    url: metadata.url,
  };

  console.log('   Forgangsröðun...');

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
      sourceType: 'kosningaprof-2024',
      sourceUrl: metadata.url,
      sourceDate: '2024-10-01',
      chunkId,
      title: 'Forgangsröðun Sósíalistaflokksins',
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
  console.log('🗳️  RÚV Kosningapróf Indexer');
  console.log('='.repeat(50));
  console.log(`   Dry Run: ${DRY_RUN}`);
  console.log(`   Skip Embeddings: ${SKIP_EMBEDDINGS}`);

  try {
    const { metadata, propositions, rangeQuestions, priorities } = KOSNINGAPROF_2024;

    console.log(`\n📋 Indexing ${propositions.length} proposition questions...`);
    for (const prop of propositions) {
      await indexProposition(prop, metadata);
    }

    console.log(`\n📊 Indexing ${rangeQuestions.length} range questions...`);
    for (const q of rangeQuestions) {
      await indexRangeQuestion(q, metadata);
    }

    console.log('\n⭐ Indexing priorities...');
    await indexPriorities(priorities, metadata);

    const total = propositions.length + rangeQuestions.length + 1;

    console.log('\n' + '='.repeat(50));
    console.log('✅ Indexing complete!');
    console.log(`   Propositions: ${propositions.length}`);
    console.log(`   Range Questions: ${rangeQuestions.length}`);
    console.log(`   Priorities: 1`);
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
