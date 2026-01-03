#!/usr/bin/env node
/**
 * Add "Kærleikshagkerfið" election platform to RAG
 *
 * Note: This is from the 2021 parliamentary elections (25 September 2021),
 * not 2024 as the website date incorrectly shows.
 *
 * https://sosialistaflokkurinn.is/2024/11/10/kaerleikshagkerfid/
 *
 * Usage: node scripts/add-kaerleikshagkerfid-rag.js
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

const SOURCE_URL = 'https://sosialistaflokkurinn.is/2024/11/10/kaerleikshagkerfid/';
// Note: The actual date is from 2021 election campaign, website shows wrong date
const SOURCE_DATE = new Date('2021-09-01');

const KAERLEIKSHAGKERFID_DOCUMENTS = [
  {
    chunkId: 'kaerleikshagkerfid-yfirlit',
    title: 'Kærleikshagkerfið - Yfirlit',
    content: `SPURNING: Hvað er kærleikshagkerfið?

SVAR:
Kærleikshagkerfið er hugmyndafræðilegur grunnur Sósíalistaflokksins, kynnt í kosningaáætlun 2021.

SKILGREINING:
"Hagkerfi þar sem auður hinna ríku er ekki aðeins metinn til fjár heldur byrðar hinna fátæku."

MEGINSJÓNARMIÐ:
- Atvinnulífið og hagkerfið á að þjóna fólkinu og samfélaginu, ekki öfugt
- Undirstaða efnahagsstjórnar skal vera samkennd, mannúð og hlýja
- Besta leiðin til að reisa gott samfélag er að byggja það út frá þörfum þeirra sem þurfa mest
- Vonir og væntingar hinna fátæku, veiku og kúguðu eru leiðarljós

ANDSTÆÐAN - DROTTNUNARHAGKERFIÐ:
- Kerfi þar sem hin auðugu og sterku hafa ógnarvöld
- Hin fátæku og veiku hafa lítil sem engin völd yfir lífi sínu
- Afleiðing nýfrjálshyggju síðustu áratuga

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Kærleikshagkerfið
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'kaerleikshagkerfid-nyfrjalsshyggja',
    title: 'Gagnrýni á nýfrjálshyggju - Kærleikshagkerfið',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um nýfrjálshyggju?

SVAR:
Sósíalistaflokkurinn lýsir nýfrjálshyggju sem "valdaafsali almennings til auðvaldsins" og "skammarlegu tímabili".

GAGNRÝNI:
- Nýfrjálshyggjan hélt fram að besta leiðin væri að byggja samfélag út frá hagsmunum hinna sterku
- Þetta hefur reynst afleitt leiðarljós
- Við höfum brotið niður samfélagið
- Veikt stofnanir sem byggðar voru af sósíalískri verkalýðsbaráttu
- Fært völd frá lýðræðislegum vettvangi yfir á markaðinn

SAMANBURÐUR:
- Lýðræði: Hver maður hefur eitt atkvæði
- Markaður: Hver króna hefur eitt atkvæði

NIÐURSTAÐA:
Drottnunarhagkerfi - kerfi þar sem hin auðugu og sterku hafa ógnarvöld en hin fátæku hafa lítil völd.

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Kærleikshagkerfið
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'kaerleikshagkerfid-kostnadur-fatæktar',
    title: 'Kostnaður fátæktar - Kærleikshagkerfið',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um kostnað fátæktar?

SVAR:
Í "Kærleikshagkerfinu" veltir Sósíalistaflokkurinn upp spurningum um raunverulegan kostnað fátæktar og ójöfnuðar.

SPURNINGAR SEM FLOKKURINN VELTIR UPP:
- Hvað kostar að halda tugum þúsunda við nagandi afkomuótta?
- Hvað kostar að gera þúsundum ómögulegt að nýta hæfileika sína?
- Hvað kostar að leggja byrðar fátæktar á láglaunafólk, öryrkja og aðra?
- Hvað kostar að meina börnum af fátækum heimilum fulla þátttöku?
- Hvað kostar snemmbær örorka, tapað fjölskyldulíf?
- Hvað kostar að sumir þurfi að neita sér um læknishjálp?

HÓPAR SEM NEFNDIR ERU:
- Láglaunafólk
- Öryrkjar
- Efnaminna eftirlaunafólk
- Innflytjendur
- Leigjendur
- Námsfólk
- Börn af fátækum heimilum
- Umönnunarstarfsfólk

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Kærleikshagkerfið
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'kaerleikshagkerfid-samvinna',
    title: 'Samvinna og félagsskap - Kærleikshagkerfið',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um samvinnu?

SVAR:
Sósíalistaflokkurinn leggur áherslu á að öll helstu afrek mannkyns hafi verið unnin í samvinnu.

MEGINSJÓNARMIÐ:
- "Við erum félagsverur, rísum hæst þegar samfélag okkar er heilbrigðast, réttlátast og jafnast"
- "Öll helstu afrek sín hefur mannskepnan unnið í samvinnu"
- "Það er einkenni okkar sem tegundar"

SAGA:
- "Þess eru engin dæmi í mannkynssögunni um að samfélög hafi tortímt sér með því að styðja um of við hin veiku"
- "Kærleikurinn er græðandi afl en ekki eyðandi"
- "Þess eru hins vegar mýmörg dæmi um að samfélög hafa fallið vegna græðgi yfirstéttarinnar"

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Kærleikshagkerfið
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'kaerleikshagkerfid-umonnun',
    title: 'Umönnunarstörf og laun - Kærleikshagkerfið',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um umönnunarstörf?

SVAR:
Sósíalistaflokkurinn gagnrýnir hvernig samfélagið metur umönnunarstörf.

GAGNRÝNI:
- Þeir sem sinna umönnunarstörfum, "mikilvægustu störfunum í samfélaginu", fá svo lág laun að þau eiga vart í sig og á
- Þeim eru send skilaboð að þau ættu að finna sér aðra og betri vinnu

SAMANBURÐUR SEM FLOKKURINN GERIR:
- Bankafólk er virt meira í launum en kennarar
- Braskarar eru verðlaunaðir margfalt á við hjúkrunarfólk
- Þeir sem þjóna auðvaldinu eru meir virðir en þeir sem sinna börnum, öldruðum, veikum og sjúkum

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Kærleikshagkerfið
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'kaerleikshagkerfid-framtidarsyn',
    title: 'Framtíðarsýn - Kærleikshagkerfið',
    content: `SPURNING: Hver er framtíðarsýn Sósíalistaflokksins í kærleikshagkerfinu?

SVAR:
Sósíalistaflokkurinn lýsir framtíðarsýn sinni í "Kærleikshagkerfinu" frá kosningabaráttunni 2021.

FRAMTÍÐARSÝN:
- "Samfélag okkar verður ekki réttlátt fyrr en allt fólk innan þess fær að njóta sín"
- "Samfélagið verður ekki fagurt fyrr en við losnum öll undan kúgandi afkomukvíða"
- "Samfélagið verður ekki sterkt fyrr en allt fólk upplifir að á sig sé hlustað"

TILLAGA:
- Hafna drottnunarhagkerfi hinna fáu
- Taka upp kærleikshagkerfi fjöldans
- Láta hagsmuni og raddir fjöldans leiða okkur

ÁKALL:
"Teygjum okkur eftir gleðinni, fegurðinni og kærleikanum. Veljum lífið, líf okkar allra, líf sem mun aðeins blómstra innan lífvænlegs samfélags sem byggt er á samkennd og virðingu."

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Kærleikshagkerfið
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
      document: 'Kærleikshagkerfið',
      url: SOURCE_URL,
      date: '2021-09',
      type: 'election-platform',
      verified: true,
      note: 'Website shows incorrect date (2024), this is from 2021 election',
    }),
    vectorStr,
  ]);

  console.log(`   ✅ Vistað með ID: ${result.rows[0].id}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Bæti við: Kærleikshagkerfið (2021 kosningaáætlun)         ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nURL: ${SOURCE_URL}`);
  console.log(`ATH: Vefsíðan sýnir ranga dagsetningu - þetta er frá 2021`);
  console.log(`Fjöldi kafla: ${KAERLEIKSHAGKERFID_DOCUMENTS.length}\n`);

  try {
    for (const doc of KAERLEIKSHAGKERFID_DOCUMENTS) {
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
