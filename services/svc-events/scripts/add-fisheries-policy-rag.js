#!/usr/bin/env node
/**
 * Add fisheries policy election platform to RAG
 *
 * "Brjótum upp Samherja – endurheimtum auðlindirnar" - Kosningaáætlun 2021
 * https://sosialistaflokkurinn.is/2024/11/09/brjotum-upp-samherja-endurheimtum-audlindirnar/
 *
 * Note: Website shows 2024 date but this is from 2021 election.
 *
 * Usage: node scripts/add-fisheries-policy-rag.js
 */

process.env.GOOGLE_CLOUD_PROJECT = 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_NAME = 'socialism';
process.env.DATABASE_USER = 'socialism';
process.env.DATABASE_PASSWORD = 'Socialism2025#Db';

const embeddingService = require('../src/services/service-embedding');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});

const SOURCE_URL = 'https://sosialistaflokkurinn.is/2024/11/09/brjotum-upp-samherja-endurheimtum-audlindirnar/';
const SOURCE_DATE = new Date('2021-09-01');

const FISHERIES_POLICY_DOCUMENTS = [
  {
    chunkId: 'sjavarutvegur-2021-yfirlit',
    title: 'Brjótum upp Samherja - Yfirlit',
    content: `SPURNING: Hver er sjávarútvegsstefna Sósíalistaflokksins?

SVAR:
Sósíalistaflokkurinn vill leggja niður kvótakerfið og byggja réttlátari umgjörð utan um fiskveiðar.

MEGINMARKMIÐ:
- Endurheimta auðlindir hafsins af auðhringunum
- Brjóta upp stórútgerðirnar
- Arðurinn af auðlindunum renni til samfélagsins
- Byggja upp heilbrigða atvinnugrein, lausa undan spillingu

GAGNRÝNI Á KVÓTAKERFIÐ:
- Upphaflega sett á til að vernda fiskistofnana
- Hefur þróast í óskapnað sem einkavætti fiskimið almennings
- Brotið niður byggðir
- Safnað upp auði örfárra sem ógnar lýðræðinu

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Brjótum upp Samherja
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'sjavarutvegur-2021-thorskastrid',
    title: 'Fjórða þorskastríðið - Kosningaáætlun 2021',
    content: `SPURNING: Hvað er fjórða þorskastríðið?

SVAR:
Sósíalistaflokkurinn kallar eftir "fjórða þorskastríðinu" - baráttu til að endurheimta fiskimiðin frá stórútgerðunum.

SÖGULEGUR SAMHENGI:
- Þorskastríðin á síðustu öld voru "hin eiginlega sjálfstæðisbarátta þjóðarinnar"
- Með sigri í þeim var sjálfstæði landsins tryggt
- Grunnur lagður að efnahagslegri uppbyggingu

RÖKSEMDAFÆRSLA:
- Kynslóðirnar sem háðu þorskastríðin börðust ekki til þess að fiskimiðin færðust til örfárra
- Markmiðið var að byggja upp öflugar byggðir, sterk samfélög og blómlegt mannlíf
- Við skuldum þeim kynslóðum að leiðrétta þessi rangindi

TILLAGA:
"Sósíalistar bjóða kjósendum að hefja fjórða þorskastríðið á kjördag með því að greiða Sósíalistaflokknum atkvæði sitt."

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Brjótum upp Samherja
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'sjavarutvegur-2021-samherji',
    title: 'Samherji og stórútgerðir - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um Samherja?

SVAR:
Sósíalistaflokkurinn vill brjóta upp Samherja og aðrar stórútgerðir.

UM SAMHERJA:
- Stærsta og voldugasta stórútgerðin
- Myndi verða klofið upp vegna stærðar sinnar (langsum)
- Og vegna þess að það drottnar yfir allri virðiskeðjunni (þversum)
- "Yfirgangur og frekja þessa fyrirtækis ætti ekki að koma neinum á óvart"

TILLÖGUR:
- Takmarkanir verði settar á umfang stórútgerða
- Stærstu útgerðirnar verði brotnar upp langsum (í tvö eða fleiri félög)
- Útgerðar- og fiskvinnslufyrirtækin verði brotin upp þversum
- Sama fyrirtækið geti ekki veitt, unnið og selt sjálfu sér

RANNSÓKNIR:
- Fimm stærstu útgerðarfyrirtækin verði rannsökuð
- Kanna hvort mútum hafi verið beitt
- Hvort fiskverð hafi verið falsað
- Hvort sjómenn hafi verið hlunnfarnir
- Hvort skotið hafi verið undan skatti

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Brjótum upp Samherja
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'sjavarutvegur-2021-kvotakerfi',
    title: 'Lokun kvótakerfisins - Kosningaáætlun 2021',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um kvótakerfið?

SVAR:
Sósíalistaflokkurinn vill loka kvótakerfinu og taka upp dagakerfi.

GAGNRÝNI Á KVÓTAKERFIÐ:
- Lokað, ófrjálst spillingarkerfi stórútgerða
- Stærstu útgerðirnar ráða yfir of stórum hluta veiðanna
- Þær stjórna allri virðiskeðjunni
- Vísbendingar um að kerfið sé notað til að halda niðri fiskverði og fela arð erlendis

TILLAGA:
- Loka kvótakerfinu strax
- Taka upp dagakerfi fyrir togara og báta
- Þar til fiskiþingin hafa mótað framtíðarstefnu

KOSTIR DAGAKERFIS:
- Ekki brottkast
- Ekki framhjálöndun
- Ekki svindl á vigt
- Allur afli á markað girðir fyrir launaþjófnað og skattsvik

ÚTHLUTAÐIR DAGAR:
- Óframseljanlegir
- Verðmæti undirmálsfiska rennur í ríkissjóð

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Brjótum upp Samherja
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'sjavarutvegur-2021-fiskithing',
    title: 'Fiskiþing - Kosningaáætlun 2021',
    content: `SPURNING: Hvað eru fiskiþing?

SVAR:
Sósíalistaflokkurinn leggur til fiskiþing í hverjum landshluta til að móta fiskveiðistefnu.

UM FISKIÞING:
- Sjómenn, fiskverkafólk og almenningur setjist niður
- Móti fiskveiðistefnuna til lengri tíma
- Slembival notað til að velja fulltrúa (til að losna við yfirgang hagsmunaaðila)

HLUTVERK:
- Kalla eftir upplýsingum og skýrslum sérfræðinga
- Kalla eftir rannsóknum á áhrifum kvótakerfisins
- Meta hagræn, vistvæn og félagsleg áhrif mismunandi aðferða
- Sækja allar nauðsynlegar upplýsingar

MÖGULEGAR NIÐURSTÖÐUR:
- Dagakerfi
- Aflamark
- Leiga heimilda
- Uppbygging samvinnufélaga
- Frjálsar handfæraveiðar
- Ekkert segir að öll þingin þurfi að komast að sömu niðurstöðu

STJÓRNARSKRÁ:
Bundið verði í stjórnarskrá að fiskveiðiauðlindin sé eign þjóðarinnar.

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Brjótum upp Samherja
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'sjavarutvegur-2021-veidigold',
    title: 'Veiðigjöld og handfæraveiðar - Kosningaáætlun 2021',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um veiðigjöld?

SVAR:
Sósíalistaflokkurinn vill innheimta veiðigjöld við löndun.

UM VEIÐIGJÖLD:
- Innheimt við löndun, eins einfalt og virðisaukaskattur
- Gæti verið 24% (sama og virðisaukaskattur)
- Myndi gefa um 35 milljarða króna á ári
- Veiðigjöldin renni jafnt til sveitarfélaga og ríkis

HANDFÆRAVEIÐAR:
- Gefnar frjálsar
- Fimm veiðidagar í viku að eigin vali
- Frá mars til október
- Þrjár rúllur ef einn maður um borð, fjórar ef tveir
- Lúta veðurviðvörun Veðurstofunnar

AFLAHEIMILDIR Í ÚTHAFI:
- Aflaheimildir í Barentshafi, Smugunni o.fl. boðnar upp
- Gætt jafnræðis í uppboði
- Stóru geta ekki keypt allt og lokað fyrir nýja og smærri

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Brjótum upp Samherja
URL: ${SOURCE_URL}`,
  },
];

async function addDocument(doc) {
  console.log(`\n📝 Bæti við: ${doc.title}`);

  console.log('   🔄 Bý til embedding...');
  const embedding = await embeddingService.generateEmbedding(doc.content);
  const vectorStr = `[${embedding.join(',')}]`;

  const sql = `
    INSERT INTO rag_documents (
      source_type, source_url, source_date, chunk_id,
      title, content, citation, embedding
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
    ON CONFLICT (source_type, chunk_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      embedding = EXCLUDED.embedding,
      source_url = EXCLUDED.source_url,
      source_date = EXCLUDED.source_date
    RETURNING id
  `;

  const result = await pool.query(sql, [
    'curated-answer',
    SOURCE_URL,
    SOURCE_DATE,
    doc.chunkId,
    doc.title,
    doc.content,
    JSON.stringify({
      source: 'Kosningaáætlun Alþingiskosningar 2021',
      document: 'Brjótum upp Samherja – endurheimtum auðlindirnar',
      url: SOURCE_URL,
      date: '2021-09',
      type: 'election-platform',
      verified: true,
      note: 'Website shows 2024 date, this is from 2021 election',
    }),
    vectorStr,
  ]);

  console.log(`   ✅ Vistað með ID: ${result.rows[0].id}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Bæti við: Brjótum upp Samherja (2021 kosningaáætlun)      ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nURL: ${SOURCE_URL}`);
  console.log(`ATH: Vefsíðan sýnir ranga dagsetningu - þetta er frá 2021`);
  console.log(`Fjöldi kafla: ${FISHERIES_POLICY_DOCUMENTS.length}\n`);

  try {
    for (const doc of FISHERIES_POLICY_DOCUMENTS) {
      await addDocument(doc);
    }

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM rag_documents WHERE source_type = 'curated-answer'"
    );
    console.log(`\n✅ Samtals curated-answer skjöl: ${countResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Villa:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
