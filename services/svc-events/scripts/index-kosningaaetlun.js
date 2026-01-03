#!/usr/bin/env node
/**
 * Index Kosningaáætlun 2024
 *
 * Indexes the 2024 election manifesto documents from sosialistaflokkurinn.is
 * These are the "Betra plan" series of policy proposals.
 *
 * Source type: 'kosningaaetlun'
 *
 * Usage:
 *   node scripts/index-kosningaaetlun.js [--dry-run] [--no-embeddings]
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

/**
 * Kosningaáætlun 2024 - Election Manifesto Documents
 * From the "Betra plan" series published November 2024
 */
const KOSNINGAAETLUN_2024 = {
  metadata: {
    source: 'sosialistaflokkurinn.is',
    year: '2024',
    lastUpdated: '2024-11',
  },
  documents: [
    {
      id: 'rikisfjarmmal',
      title: 'Kosningaáætlun 2024 - Ríkisfjármál',
      url: 'https://sosialistaflokkurinn.is/2024/11/19/betra-plan-i-rikisfjarmalum/',
      date: '2024-11-19',
      content: `Betra plan í ríkisfjármálum - Kosningaáætlun Sósíalistaflokksins 2024

MEGINMARKMIÐ: Endurreisa tekjustofna ríkisins og tryggja réttláta skattlagningu.

HELSTU TILLÖGUR:

1. AUÐLEGÐARSKATTUR
Innleiða 1% árlegan skatt á nettóeignir yfir 300 milljónir króna. Áætlaðar tekjur: 30-50 milljarðar árlega.

2. HÆRRI FJÁRMAGNSTEKJUSKATTUR
Hækka fjármagnstekjuskatt í 30% (úr 22%). Tekjur af arði og söluhagnaði skattlagðar meira sanngjarnt.

3. LOKA SKATTAHOLUM
Auka eftirlit með skattahólpum, sérstaklega tengdum séreignarsparnaði og flutningi hagnaðar til lágskattaríkja.

4. AUÐLINDAGJÖLD
Hækka auðlindagjöld á sjávarútveg og orkufyrirtæki sem nýta sameiginlegar auðlindir.

5. VÖXTUR SKATTSTOFNA
Auka framleiðni og fjölga launþegum með fjárfestingum í innviðum og menntun.

FJÁRMÖGNUN VELFERÐAR:
Tekjur frá ofangreindum breytingum nýtast til að fjármagna:
- 50.000 íbúðir á 10 árum
- Gjaldfrjálsa grunnþjónustu
- Hækkun barnabóta
- Bætt heilbrigðisþjónustu`,
    },
    {
      id: 'husnaedismal',
      title: 'Kosningaáætlun 2024 - Húsnæðismál',
      url: 'https://sosialistaflokkurinn.is/2024/11/19/betra-plan-i-husnaedismalum/',
      date: '2024-11-19',
      content: `Betra plan í húsnæðismálum - Kosningaáætlun Sósíalistaflokksins 2024

MEGINMARKMIÐ: Byggja 50.000 íbúðir á tíu árum og stöðva braskvæðingu húsnæðismarkaðarins.

Húsnæðiskostnaður er alvarlegasta ógnin við lífsafkomu almennings í dag.

HELSTU TILLÖGUR:

1. 50.000 NÝJAR ÍBÚÐIR
Ríkið byggi 50.000 félagslegar og ódýrar íbúðir næstu 10 árin í samstarfi við sveitarfélög og lífeyrissjóði.

2. HÚSNÆÐISSJÓÐUR ALMENNINGS
Stofna sérstakan húsnæðissjóð sem fjármagnar byggingu félagslegra íbúða. Sjóðurinn láni á lægstu vöxtum.

3. ÞAKI Á HÚSALEIGU
Lögfesta þak á húsaleigu miðað við fermetraverð og staðsetningu. Enginn greiði meira en 25% af ráðstöfunartekjum í húsnæði.

4. TAKMARKANIR Á AIRBNB
Hertar takmarkanir á skammtímaleigu til ferðamanna. Íbúðir til íbúa, ekki til fjárfesta.

5. VERND LEIGJENDA
Leigjendur fái aukið öryggi í húsnæði með langtímaleigusamningum (5+ ár) og takmörkunum á uppsögnum.

6. NÁMSMANNABÚSTAÐIR
Sérstakt átak í byggingu 5.000 námsmannabústaða við háskólasvæði.

FJÁRMÖGNUN:
- Húsnæðissjóður: 70% skuldabréf til lífeyrissjóða
- 13% lóðir frá sveitarfélögum
- 17% hagstæð lán frá ríkissjóði`,
    },
    {
      id: 'gjaldfrjals-grunnthjonusta',
      title: 'Kosningaáætlun 2024 - Gjaldfrjáls grunnþjónusta',
      url: 'https://sosialistaflokkurinn.is/2024/11/16/gjaldfrjals-grunnthjonusta-2/',
      date: '2024-11-16',
      content: `Gjaldfrjáls grunnþjónusta - Kosningaáætlun Sósíalistaflokksins 2024

MEGINMARKMIÐ: Öll grunnþjónusta verði gjaldfrjáls og aðgengileg öllum, óháð efnahag.

HELSTU TILLÖGUR:

1. GJALDFRJÁLS HEILBRIGÐISÞJÓNUSTA
- Afnema öll komugjöld og þjónustugjöld á heilbrigðisstofnunum
- Full niðurgreiðsla á lyfjum
- Tannlækningar gjaldfrjálsar fyrir alla undir 25 ára

2. GJALDFRJÁLS MENNTUN
- Afnema skólagjöld á öllum stigum
- Gjaldfrjáls skólamáltíðir í grunn- og framhaldsskólum
- Námsstyrkir í stað námslána

3. GJALDFRJÁLSAR ALMENNINGSSAMGÖNGUR
- Ókeypis strætisvagnar og almenningssamgöngur
- Sérstök áhersla á landsbyggðina

4. GJALDFRJÁLS BARNAÞJÓNUSTA
- Gjaldfrjálsar leikskóladvöl
- Gjaldfrjálst frístundastarf og tómstundir

5. FJÁRMÖGNUN
Kostnaður við gjaldfrjálsa grunnþjónustu bætist upp með:
- Auðlegðarskatti
- Hærri fjármagnstekjuskatti
- Auðlindagjöldum
- Sparnaði í kerfinu (færri útgjöld til innheimtu)`,
    },
    {
      id: 'kaerleikshagkerfid',
      title: 'Kosningaáætlun 2024 - Kærleikshagkerfið',
      url: 'https://sosialistaflokkurinn.is/2024/11/10/kaerleikshagkerfid/',
      date: '2024-11-10',
      content: `Kærleikshagkerfið - Kosningaáætlun Sósíalistaflokksins 2024

MEGINMARKMIÐ: Umhyggja og velferð fólks verði sett í öndvegi hagkerfisins.

HELSTU TILLÖGUR:

1. STYTTING VINNUVIKUNNAR
Fara í 32 stunda vinnuviku á næstu 10 árum án launaskerðingar. Rannsóknir sýna að styttri vinnuvika bætir heilsu og afköst.

2. BARNABÆTUR FYRIR ALLA
Öll börn fái barnabætur upp á tæpar 65.000 kr. á mánuði - jafngildi persónuafsláttar fullorðinna. Þetta er réttlátara og einfaldara kerfi.

3. VERND BARNAFJÖLSKYLDNA
- Lengra fæðingarorlof (12 mánuðir)
- Betri stuðningur við einstæða foreldra
- Fjölskylduvænt vinnuumhverfi

4. UMHYGGJA SEM FRAMLAG
Viðurkenna umhyggju og heimilisstörf sem raunverulegt framlag til samfélagsins. Þeir sem sinna umönnun eiga að fá sanngjarnar bætur.

5. LÍFEYRIR OG ÖRYGGI
- Hækka lágmarks lífeyri
- Afnema skerðingar á lífeyri vegna annarra tekna
- Tryggja reisn aldraðra og öryrkja

HUGMYNDAFRÆÐI:
Hagkerfið á að þjóna fólkinu - ekki öfugt. Kærleikshagkerfið snýst um að setja velferð, heilsu og hamingju í fyrsta sæti.`,
    },
    {
      id: 'folkid-a-ad-rada',
      title: 'Kosningaáætlun 2024 - Fólkið á að ráða',
      url: 'https://sosialistaflokkurinn.is/2024/11/08/folkid-a-ad-rada/',
      date: '2024-11-08',
      content: `Fólkið á að ráða - Kosningaáætlun Sósíalistaflokksins 2024

MEGINMARKMIÐ: Auka völd almennings og lýðræði í stjórnmálum og hagkerfi.

HELSTU TILLÖGUR:

1. BINDANDI ÞJÓÐARATKVÆÐAGREIÐSLUR
Niðurstöður þjóðaratkvæðagreiðslna skulu ávallt vera bindandi fyrir stjórnvöld. Enginn hélt þjóðaratkvæðagreiðsluna um stjórnarskrána 2012.

2. LÝÐRÆÐISVÆÐING LÍFEYRISSJÓÐA
Sjóðsfélagar eiga að hafa beint val um stjórn og stefnu lífeyrissjóða. Engir pólitískir skipunarvaldhafar.

3. JÖFN ATKVÆÐAVÆGI
Atkvæði allra verði jöfn óháð búsetu. Nú eru atkvæði landsbyggðar oft meira virði en höfuðborgarinnar.

4. LÝÐRÆÐI Á VINNUSTÖÐUM
Starfsmenn eiga að hafa aðkomu að ákvörðunum á vinnustöðum. Kynna valkosti um starfsmannaeign og samvinnufélög.

5. GEGNSÆI Í STJÓRNSÝSLU
Auka gegnsæi í stjórnsýslunni og minnka leyndindalykt. Upplýsingalög styrkt.

6. NYA STJÓRNARSKRÁ
Innleiða nýju stjórnarskrána sem samþykkt var í þjóðaratkvæðagreiðslu 2012.

HUGMYNDAFRÆÐI:
Lýðræði er ekki aðeins kosningar á 4 ára fresti. Það þarf að vera hluti af daglegu lífi fólks - á vinnustað, í sveitarfélagi og í ríkisstjórn.`,
    },
  ],
};

/**
 * Index a single document
 */
async function indexDocument(doc, metadata) {
  const chunkId = `kosningaaetlun-2024-${doc.id}`;

  // Build citation
  const citation = {
    who: 'Sósíalistaflokkur Íslands',
    when: doc.date,
    context: 'Kosningaáætlun 2024',
    section: doc.title,
    url: doc.url,
  };

  console.log(`   [${doc.id}] ${doc.title}`);

  if (!DRY_RUN) {
    let embedding = null;
    if (!SKIP_EMBEDDINGS && doc.content.length > 10) {
      try {
        embedding = await embeddingService.generateEmbedding(doc.content);
      } catch (err) {
        console.error(`   Warning: Embedding failed: ${err.message}`);
      }
    }

    await vectorSearch.upsertDocument({
      sourceType: 'kosningaaetlun',
      sourceUrl: doc.url,
      sourceDate: doc.date,
      chunkId,
      title: doc.title,
      content: doc.content,
      citation,
      embedding,
    });
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('📋 Kosningaáætlun 2024 Indexer');
  console.log('='.repeat(50));
  console.log(`   Source: ${KOSNINGAAETLUN_2024.metadata.source}`);
  console.log(`   Year: ${KOSNINGAAETLUN_2024.metadata.year}`);
  console.log(`   Dry Run: ${DRY_RUN}`);
  console.log(`   Skip Embeddings: ${SKIP_EMBEDDINGS}`);

  try {
    const { metadata, documents } = KOSNINGAAETLUN_2024;

    console.log(`\n📄 Indexing ${documents.length} kosningaáætlun documents...`);
    for (const doc of documents) {
      await indexDocument(doc, metadata);
    }

    console.log('\n' + '='.repeat(50));
    console.log('Done!');
    console.log(`   Documents: ${documents.length}`);

    if (DRY_RUN) {
      console.log('\n Dry run - no changes were made');
    } else {
      // Show database stats
      const dbStats = await vectorSearch.getDocumentStats();
      console.log('\n Database stats:');
      for (const row of dbStats) {
        console.log(`   ${row.source_type}: ${row.count} docs (${row.with_embedding} with embeddings)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\n Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
