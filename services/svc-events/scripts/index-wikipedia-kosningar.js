#!/usr/bin/env node
/**
 * Index Wikipedia Election Results for Sósíalistaflokkur Íslands
 *
 * Indexes election results from Wikipedia into pgvector for RAG semantic search.
 * Covers Alþingiskosningar (parliamentary) and Sveitarstjórnarkosningar (municipal)
 * for years 2018, 2021, 2022, and 2024.
 *
 * Data verified against official election records (Landskjörstjórn / Hagstofa).
 *
 * Usage:
 *   node scripts/index-wikipedia-kosningar.js [--dry-run] [--no-embeddings]
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

const SOURCE_TYPE = 'wikipedia-kosningar';

/**
 * Election results data for Sósíalistaflokkur Íslands.
 * Verified against official records (Hagstofa Íslands, Landskjörstjórn).
 */
const ELECTIONS = [
  {
    id: 'sveitarstjornarkosningar-2018',
    year: 2018,
    type: 'sveitarstjórnarkosningar',
    title: 'Sveitarstjórnarkosningar 2018 - Sósíalistaflokkur Íslands',
    date: '2018-05-26',
    wikiPage: 'Sveitarstjórnarkosningar á Íslandi 2018',
    wikiUrl: 'https://is.wikipedia.org/wiki/Sveitarstj%C3%B3rnarkosningar_%C3%A1_%C3%8Dslandi_2018',
    content: `Sveitarstjórnarkosningar á Íslandi 2018 - Úrslit Sósíalistaflokks Íslands

Sveitarstjórnarkosningarnar 2018 voru haldnar 26. maí 2018. Þetta voru fyrstu kosningarnar sem Sósíalistaflokkur Íslands bauð fram í eftir stofnun flokksins í september 2017.

Reykjavík:
- Sósíalistaflokkur Íslands fékk 3.758 atkvæði (6,4%)
- Flokkurinn fékk 1 borgarfulltrúa (af 23)
- Oddviti: Sanna Magdalena Mörtudóttir (J-listi)
- Sanna Magdalena varð fyrsti kjörni fulltrúi Sósíalistaflokksins

Kópavogur:
- Oddviti: Arnþór Sigurðsson (J-listi)
- Flokkurinn fékk um 3,2% atkvæða

Þetta var mikill árangur fyrir nýstofnaðan flokk sem var aðeins 8 mánaða gamall þegar kosningarnar fóru fram. Flokkurinn fékk fyrsta kjörna fulltrúa sinn, Sönnu Magdalenu Mörtudóttur, í borgarstjórn Reykjavíkur.`,
  },
  {
    id: 'althingiskosningar-2021',
    year: 2021,
    type: 'alþingiskosningar',
    title: 'Alþingiskosningar 2021 - Sósíalistaflokkur Íslands',
    date: '2021-09-25',
    wikiPage: 'Alþingiskosningar 2021',
    wikiUrl: 'https://is.wikipedia.org/wiki/Al%C3%BEingiskosningar_2021',
    content: `Alþingiskosningar á Íslandi 2021 - Úrslit Sósíalistaflokks Íslands

Alþingiskosningarnar 2021 voru haldnar 25. september 2021. Þetta var í fyrsta skiptið sem Sósíalistaflokkur Íslands bauð fram til Alþingis.

Heildarúrslit á landsvísu:
- Sósíalistaflokkur Íslands fékk 8.181 atkvæði (4,1%)
- Flokkurinn fékk ekkert þingsæti (0 af 63)
- Flokkurinn náði ekki 5% þröskuldi jöfnunarsæta
- Listabókstafur: J

Gunnar Smári Egilsson var formaður framkvæmdastjórnar flokksins og leiðtogi í kosningabaráttunni. Flokkurinn bauð fram í öllum 6 kjördæmum.

Oddvitar í kjördæmum:
- Reykjavíkurkjördæmi norður: Gunnar Smári Egilsson
- Reykjavíkurkjördæmi suður: Sanna Magdalena Mörtudóttir

Helstu áherslumál flokksins voru kjarabætur fyrir láglaunafólk, öryrkja og eldri borgara, hærri skattar á hæstu tekjur og uppbrot stórútgerða.

Þrátt fyrir gott gengi í skoðanakönnunum náði flokkurinn ekki yfir 5% þröskuldinn sem þarf til að fá jöfnunarsæti.`,
  },
  {
    id: 'sveitarstjornarkosningar-2022',
    year: 2022,
    type: 'sveitarstjórnarkosningar',
    title: 'Sveitarstjórnarkosningar 2022 - Sósíalistaflokkur Íslands',
    date: '2022-05-14',
    wikiPage: 'Sveitarstjórnarkosningar á Íslandi 2022',
    wikiUrl: 'https://is.wikipedia.org/wiki/Sveitarstj%C3%B3rnarkosningar_%C3%A1_%C3%8Dslandi_2022',
    content: `Sveitarstjórnarkosningar á Íslandi 2022 - Úrslit Sósíalistaflokks Íslands

Sveitarstjórnarkosningarnar 2022 voru haldnar 14. maí 2022.

Reykjavík:
- Sósíalistaflokkur Íslands fékk 4.618 atkvæði
- Flokkurinn fékk 2 borgarfulltrúa (+1 frá 2018)
- Oddviti: Sanna Magdalena Mörtudóttir (J-listi)

Flokkurinn tvöfaldaði borgarfulltrúa sína frá kosningunum 2018 (úr 1 í 2). Ellefu listar buðu fram í Reykjavík. Meirihluti Samfylkingar, Vinstri grænna, Pírata og Viðreisnar féll í þessum kosningum.

Á landsvísu fékk Sósíalistaflokkurinn 2 fulltrúa í sveitarstjórnir (+1 frá 2018).`,
  },
  {
    id: 'althingiskosningar-2024',
    year: 2024,
    type: 'alþingiskosningar',
    title: 'Alþingiskosningar 2024 - Sósíalistaflokkur Íslands',
    date: '2024-11-30',
    wikiPage: 'Alþingiskosningar 2024',
    wikiUrl: 'https://is.wikipedia.org/wiki/Al%C3%BEingiskosningar_2024',
    content: `Alþingiskosningar á Íslandi 2024 - Úrslit Sósíalistaflokks Íslands

Alþingiskosningarnar 2024 voru haldnar 30. nóvember 2024. Kosningarnar voru flýttar úr haustinu 2025 í kjölfar stjórnarslita 13. október 2024.

Heildarúrslit á landsvísu:
- Sósíalistaflokkur Íslands fékk 8.422 atkvæði (4,1%)
- Flokkurinn fékk ekkert þingsæti (0 af 63)
- Flokkurinn náði ekki 5% þröskuldi jöfnunarsæta
- Listabókstafur: J

Sanna Magdalena Mörtudóttir, oddviti flokksins í borgarstjórn Reykjavíkur, tók við sem eiginlegur leiðtogi flokksins í kosningunum í stað Gunnars Smára Egilssonar sem leiddi flokkinn í kosningunum 2021.

Oddvitar í kjördæmum:
- Reykjavíkurkjördæmi norður: Gunnar Smári Egilsson
- Reykjavíkurkjördæmi suður: Sanna Magdalena Mörtudóttir
- Suðvesturkjördæmi: Davíð Þór Jónsson
- Norðvesturkjördæmi: Guðmundur Hrafn Arngrímsson
- Norðausturkjördæmi: Þorsteinn Bergsson
- Suðurkjördæmi: Unnur Rán Reynisdóttir

Þetta var í annað sinn sem flokkurinn bauð fram til Alþingis. Flokkurinn fékk svipað fylgi og 2021 (4,1% báðu árin) en náði ekki yfir 5% þröskuldinn.

Nokkur umræða spannst um fjölda dauðra atkvæða í kosningunum. Samanlagt fylgi framboða sem fengu enga menn kjörna (Sósíalistaflokkurinn, Píratar, Vinstri græn, Lýðræðisflokkurinn, Ábyrg framtíð) var 10,4% og varð til umræðu um hvort þröskuldur jöfnunarsæta (5%) væri of hár.`,
  },
];

/**
 * Summary chunk combining all election results
 */
const SUMMARY = {
  id: 'kosningasaga-samantekt',
  title: 'Kosningasaga Sósíalistaflokks Íslands - Samantekt',
  date: '2024-11-30',
  content: `Kosningasaga Sósíalistaflokks Íslands - Öll kosningaúrslit

Sósíalistaflokkur Íslands var stofnaður í september 2017 og hefur boðið fram í fjórum kosningum:

1. Sveitarstjórnarkosningar 2018 (26. maí 2018):
   - Reykjavík: 3.758 atkvæði (6,4%), 1 borgarfulltrúi
   - Oddviti í Reykjavík: Sanna Magdalena Mörtudóttir
   - Fyrstu kosningar flokksins, Sanna varð fyrsti kjörni fulltrúi

2. Alþingiskosningar 2021 (25. september 2021):
   - Á landsvísu: 8.181 atkvæði (4,1%), 0 þingsæti
   - Leiðtogi: Gunnar Smári Egilsson
   - Bauð fram í öllum 6 kjördæmum, náði ekki 5% þröskuldi

3. Sveitarstjórnarkosningar 2022 (14. maí 2022):
   - Reykjavík: 4.618 atkvæði, 2 borgarfulltrúar (+1)
   - Oddviti í Reykjavík: Sanna Magdalena Mörtudóttir
   - Tvöfaldaði borgarfulltrúa frá 2018

4. Alþingiskosningar 2024 (30. nóvember 2024):
   - Á landsvísu: 8.422 atkvæði (4,1%), 0 þingsæti
   - Leiðtogi: Sanna Magdalena Mörtudóttir
   - Bauð fram í öllum 6 kjördæmum, náði ekki 5% þröskuldi

Flokkurinn hefur enn ekki náð þingsæti en hefur 2 borgarfulltrúa í borgarstjórn Reykjavíkur (frá 2022). Fylgi í alþingiskosningum hefur verið stöðugt í kringum 4,1%.

Heimild: Wikipedia (staðfest gegn opinberum gögnum Hagstofu Íslands og Landskjörstjórnar)`,
};

/**
 * Index a single election result document
 */
async function indexElection(election) {
  const chunkId = `wikipedia-kosningar-${election.id}`;

  const citation = {
    who: 'Wikipedia / Hagstofa Íslands',
    when: election.date,
    context: `${election.title}`,
    url: election.wikiUrl,
    year: election.year,
    electionType: election.type,
  };

  console.log(`   ${election.title}...`);

  if (!DRY_RUN) {
    let embedding = null;
    if (!SKIP_EMBEDDINGS) {
      try {
        embedding = await embeddingService.generateEmbedding(election.content);
      } catch (err) {
        console.error(`   ⚠️  Embedding failed: ${err.message}`);
      }
    }

    await vectorSearch.upsertDocument({
      sourceType: SOURCE_TYPE,
      sourceUrl: election.wikiUrl,
      sourceDate: election.date,
      chunkId,
      title: election.title,
      content: election.content,
      citation,
      embedding,
    });
  }
}

/**
 * Index the summary document
 */
async function indexSummary() {
  const chunkId = `wikipedia-kosningar-${SUMMARY.id}`;

  const citation = {
    who: 'Wikipedia / Hagstofa Íslands',
    when: SUMMARY.date,
    context: SUMMARY.title,
    url: 'https://is.wikipedia.org/wiki/S%C3%B3s%C3%ADalistaflokkur_%C3%8Dslands_(21._%C3%B6ld)',
  };

  console.log(`   ${SUMMARY.title}...`);

  if (!DRY_RUN) {
    let embedding = null;
    if (!SKIP_EMBEDDINGS) {
      try {
        embedding = await embeddingService.generateEmbedding(SUMMARY.content);
      } catch (err) {
        console.error(`   ⚠️  Embedding failed: ${err.message}`);
      }
    }

    await vectorSearch.upsertDocument({
      sourceType: SOURCE_TYPE,
      sourceUrl: 'https://is.wikipedia.org/wiki/S%C3%B3s%C3%ADalistaflokkur_%C3%8Dslands_(21._%C3%B6ld)',
      sourceDate: SUMMARY.date,
      chunkId,
      title: SUMMARY.title,
      content: SUMMARY.content,
      citation,
      embedding,
    });
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('🗳️  Wikipedia Kosningaúrslit Indexer');
  console.log('='.repeat(50));
  console.log(`   Dry Run: ${DRY_RUN}`);
  console.log(`   Skip Embeddings: ${SKIP_EMBEDDINGS}`);
  console.log(`   Source Type: ${SOURCE_TYPE}`);

  try {
    // Index each election
    console.log(`\n📋 Indexing ${ELECTIONS.length} elections...`);
    for (const election of ELECTIONS) {
      await indexElection(election);
    }

    // Index summary
    console.log('\n📊 Indexing summary...');
    await indexSummary();

    const total = ELECTIONS.length + 1;

    console.log('\n' + '='.repeat(50));
    console.log('✅ Indexing complete!');
    console.log(`   Elections: ${ELECTIONS.length}`);
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
