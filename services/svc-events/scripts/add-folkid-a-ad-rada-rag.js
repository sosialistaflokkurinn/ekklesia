#!/usr/bin/env node
/**
 * Add "Fólkið á að ráða" election platform to RAG
 *
 * Local democracy and governance - Kosningaáætlun 2021
 * https://sosialistaflokkurinn.is/2022/04/20/folkid-a-ad-rada/
 *
 * Note: Website shows 2022 date but this is from 2021 election.
 *
 * Usage: node scripts/add-folkid-a-ad-rada-rag.js
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

const SOURCE_URL = 'https://sosialistaflokkurinn.is/2022/04/20/folkid-a-ad-rada/';
// Note: The actual date is from 2021 election campaign, website shows wrong date
const SOURCE_DATE = new Date('2021-09-01');

const FOLKID_DOCUMENTS = [
  {
    chunkId: 'folkid-a-ad-rada-yfirlit',
    title: 'Fólkið á að ráða - Yfirlit',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um lýðræðisvæðingu samfélagsins?

SVAR:
Sósíalistaflokkurinn vill auka lýðræði með því að færa vald og þjónustu nær fólkinu.

MEGINSJÓNARMIÐ:
- Notendur þjónustu og starfsmenn í almannaþjónustu fái meira vald til ákvarðanatöku
- Minnka ríkisbáknið og færa valdið til íbúanna sjálfra
- Notendur og veitendur almannaþjónustu eru oft í betri stöðu til ákvarðanatöku en kjörnir fulltrúar

UM SVEITARFÉLÖGIN:
- Stór hluti þjónustu við almenning er á verksviði sveitarfélaganna
- Ríkisvaldið horfir framhjá mikilvægi sveitarfélaganna
- Vanfjármögnun kemur í veg fyrir að sveitarfélögin geti sinnt skyldum sínum
- Krefjumst þess að þetta verði leiðrétt í samræmi við raunverulegan kostnað

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Fólkið á að ráða
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'folkid-thridja-stjornsyslustig',
    title: 'Þriðja stjórnsýslustigið - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað er þriðja stjórnsýslustigið?

SVAR:
Sósíalistaflokkurinn vill kanna möguleikann á að koma á þriðja stjórnsýslustigi til að sameina kosti stærðarinnar og nærsamfélagsins.

UM ÞRIÐJA STJÓRNSÝSLUSTIGIÐ:
- Myndi taka yfir verkefni sem nú eru á höndum ríkisins
- Og í sumum tilfellum sveitarfélaganna
- Samvinna myndi gera það mögulegt að veita þjónustu nær íbúum
- Þjónusta sem nú er einungis hægt að sækja til Reykjavíkur yrði aðgengilegri

MARKMIÐ:
- Minnka ríkisbáknið
- Færa valdið og þjónustuna til íbúanna sjálfra
- Sameina kosti stærðar og nærsamfélags

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Fólkið á að ráða
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'folkid-notendarad',
    title: 'Þátttaka notenda í ákvarðanatöku - Kosningaáætlun 2021',
    content: `SPURNING: Hvernig vill Sósíalistaflokkurinn auka þátttöku notenda í ákvarðanatöku?

SVAR:
Sósíalistaflokkurinn vill að notendur og veitendur almannaþjónustu komi formlega að ákvarðanatöku ásamt kjörnum fulltrúum.

DÆMI:
- Starfsmenn og íbúar á hjúkrunarheimilum taki þátt í stefnumótun í þeim málaflokki
- Notendur almenningssamgangna komi að sínum málum
- Kennarar, skólaliðar, nemendur og foreldrar komi að ákvarðanatöku í skólamálum

AÐRAR TILLÖGUR:
- Fólk með beina reynslu af því sem þarf að bæta í nærsamfélaginu sitji í nefndum og ráðum sveitarfélaganna
- Sérfræðiþekking og reynsla starfsfólks verði nýtt til ákvarðanatöku
- Byggt á þekkingu frá t.a.m. vagnstjórum og starfsfólki sorphirðu

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Fólkið á að ráða
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'folkid-beint-lydraedi',
    title: 'Beint lýðræði og íbúakosningar - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um beint lýðræði?

SVAR:
Sósíalistaflokkurinn vill koma á beinu lýðræði með íbúakosningum um málefni sveitarfélaganna.

TILLÖGUR:
- Íbúakosningar um málefni sveitarfélaganna
- Litið verði til Sviss þar sem aðkoma íbúa að málum er ríkur þáttur í stjórnkerfinu
- Netkosningar og allsherjaratkvæðagreiðslur
- Niðurstöðurnar verði bindandi

UM SVISS:
- Aðkoma íbúa er ríkur þáttur í stjórnkerfinu
- Netkosningar notaðar
- Allsherjaratkvæðagreiðslur haldnar reglulega

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Fólkið á að ráða
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'folkid-thatttokufjarlög',
    title: 'Þátttökulýðræðisleg fjárlagagerð - Kosningaáætlun 2021',
    content: `SPURNING: Hvað er þátttökulýðræðisleg fjárlagagerð?

SVAR:
Sósíalistaflokkurinn vill að íbúar sveitarfélaganna taki formlegan þátt í veitingu fjármagns til verkefna í gegnum þátttökulýðræðislega fjárlagagerð (e. Participatory budgeting).

UPPRUNI:
- Á rætur sínar að rekja til stjórnar brasilíska verkamannaflokksins í Porto Alegre
- Porto Alegre hefur stundað þátttökulýðræðislega fjárlagagerð með góðum árangri síðan 1988
- Hefur verið tekið upp í öðrum borgum og bæjum út um heimsbyggðina
- Af stjórnum sósíalista og annarra vinstrimanna

FRAMKVÆMD:
- Í gegnum netið og á almennum fundum
- Kjörnir fulltrúar og íbúar koma saman að fjárlagagerðinni
- Íbúarnir setja þann ramma sem þeir vilja

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Fólkið á að ráða
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'folkid-almenningssamgongur',
    title: 'Almenningssamgöngur og lýðræði - Kosningaáætlun 2021',
    content: `SPURNING: Hvernig vill Sósíalistaflokkurinn breyta stjórnun almenningssamgangna?

SVAR:
Sósíalistaflokkurinn vill að almenningssamgöngur verði hannaðar af fólkinu sem reiðir sig á þær.

TILLÖGUR:
- Strætó verði fyrir fólk og stýrt af fólkinu sem notar strætó
- Framtíð almenningssamgangna verði mótuð út frá kröfum þeirra sem treysta á almenningssamgöngur
- Fulltrúar farþega sitji í stjórn Strætó

MEGINSJÓNARMIÐ:
- Íbúarnir, notendur þjónustunnar og kjörnir fulltrúar komi sameiginlega að stjórnun
- Sameiginleg þekking nýtist sem best
- Þekking vagnstjóra og annars starfsfólks verði nýtt

HEIMILD: Kosningaáætlun Alþingiskosningar 2021 - Fólkið á að ráða
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
      document: 'Fólkið á að ráða',
      url: SOURCE_URL,
      date: '2021-09',
      type: 'election-platform',
      verified: true,
      note: 'Website shows 2022 date, this is from 2021 election',
    }),
    vectorStr,
  ]);

  console.log(`   ✅ Vistað með ID: ${result.rows[0].id}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Bæti við: Fólkið á að ráða (2021 kosningaáætlun)          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nURL: ${SOURCE_URL}`);
  console.log(`ATH: Vefsíðan sýnir ranga dagsetningu - þetta er frá 2021`);
  console.log(`Fjöldi kafla: ${FOLKID_DOCUMENTS.length}\n`);

  try {
    for (const doc of FOLKID_DOCUMENTS) {
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
