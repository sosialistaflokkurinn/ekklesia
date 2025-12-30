#!/usr/bin/env node
/**
 * Add housing policy election platform to RAG
 *
 * "Betra plan í húsnæðismálum" - Kosningaáætlun Alþingiskosningar 2024
 * https://sosialistaflokkurinn.is/2024/11/19/betra-plan-i-husnaedismalum/
 *
 * Usage: node scripts/add-housing-policy-rag.js
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

const SOURCE_URL = 'https://sosialistaflokkurinn.is/2024/11/19/betra-plan-i-husnaedismalum/';
const SOURCE_DATE = new Date('2024-11-19');

const HOUSING_POLICY_DOCUMENTS = [
  {
    chunkId: 'husnaedismal-yfirlit',
    title: 'Betra plan í húsnæðismálum - Yfirlit',
    content: `SPURNING: Hver er húsnæðisstefna Sósíalistaflokksins?

SVAR:
Húsnæðiskostnaður er alvarlegasta ógnin við lífsafkomu almennings í dag. Sósíalistaflokkurinn leggur til stóra húsnæðisbyltingu: Byggingu 50.000 íbúða á tíu árum.

MEGINMARKMIÐ:
- Tryggja öllum landsmönnum öruggt og ódýrt húsnæði
- Stöðva braskvæðingu húsnæðismarkaðarins
- Byggja upp félagslegt húsnæðiskerfi eins og í nágrannalöndum

NÚVERANDI STAÐA:
- Meira en þriðjungur fjölskyldna á erfitt með að ná endum saman
- Uppsafnaður íbúðaskortur er 12.000 íbúðir
- Félagslegt húsnæði er innan við 10% á Íslandi (30-50% í nágrannalöndum)

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'husnaedismal-neydaaradgerdir',
    title: 'Neyðaraðgerðir í húsnæðismálum - Kosningaáætlun 2024',
    content: `SPURNING: Hvaða neyðaraðgerðir leggur Sósíalistaflokkurinn til í húsnæðismálum?

SVAR:
Sósíalistaflokkurinn leggur til eftirfarandi neyðaraðgerðir til að bregðast við ófremdarástandi á húsnæðismarkaði:

1. FJÖLGUN ÍBÚÐA:
- Byggja að lágmarki 4.000 íbúðir á ári næstu þrjú árin
- Uppsetning einingahúsa til að mæta skorti
- Ráðast í framkvæmdir strax

2. TAKMARKA GRÓÐADRIFNA ÚTLEIGU:
- Fjórfaldur fasteignaskattur á aðra íbúð (eins og í Noregi)
- Setja viðmið um leiguverð í samræmi við aðrar hagstærðir
- Aðeins leyfilegt að leigja eigið lögheimili á Airbnb

3. AUÐAR ÍBÚÐIR:
- Kortleggja íbúðir sem standa auðar
- Hærri skattlagning á auðar íbúðir
- Sækja íbúðir sem nýttar eru til atvinnurekstrar og færa á íbúðamarkað

4. SKAMMTÍMALEIGA:
- Skylt að birta fasta- og leyfisnúmer eignar á auglýsingum
- Auka eftirlit með skráningum
- Ferðamenn gisti á hótelum, ekki í íbúðum

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'husnaedismal-50000-ibudir',
    title: 'Stóra húsnæðisbyltingin - 50.000 íbúðir',
    content: `SPURNING: Hvað er stóra húsnæðisbyltingin?

SVAR:
Sósíalistaflokkurinn leggur til byggingu 50.000 íbúða á tíu árum til að eyða húsnæðiskreppunni.

ÞÖRF:
- Uppsafnaður íbúðaskortur: 12.000 íbúðir
- Árleg þörf: 5.000 íbúðir (ekki 3.000 eins og opinberar áætlanir segja)
- Samtals á 10 árum: 50.000 íbúðir

KOSTNAÐUR:
- Heildarkostnaður: 1.500 milljarðar króna
- 150 milljarðar á ári í tíu ár
- 70% frá skuldabréfamarkaði (105 milljarðar/ári)
- 13% frá sveitarfélögum í formi lóða (19,5 milljarðar/ári)
- 17% frá ríkissjóði sem lán (25,5 milljarðar/ári)

SAMANBURÐUR:
- Svíar byggðu milljón íbúðir á tíu árum (1960-1970)
- Það jafngildir 45.000 íbúðum á Íslandi
- 1% launaskattur sem fjármagnaði byggingarátak á 7. og 8. áratugnum skilar 22-23 milljörðum í dag

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'husnaedismal-husnaedissjodur',
    title: 'Húsnæðissjóður almennings - Kosningaáætlun 2024',
    content: `SPURNING: Hvað er Húsnæðissjóður almennings?

SVAR:
Húsnæðissjóður almennings er tillaga Sósíalistaflokksins um fjármögnunarkerfi fyrir félagslegt húsnæði.

HVERNIG VIRKAR ÞAÐ:
1. Húsnæðissjóður almennings aflar fjármagns með útgáfu skuldabréfa
2. Skuldabréfin eru seld lífeyrissjóðum og öðrum fjárfestum
3. Tryggingar eru öruggar: íbúðarhúsnæði í langtímaleigu
4. Vextir sambærilegir ríkisskuldabréfum

FJÁRMÖGNUN:
- 70% frá skuldabréfamarkaði
- 13% frá sveitarfélögum (lóðir)
- 17% frá ríkissjóði (lán á lægstu vöxtum)

LEIGUVERÐ:
- Kostnaði dreift á 120 ár (ekki 40 ár eins og venjulega)
- Leiguverð um helmingi lægra en í dag
- Enginn gróði, okur eða arðgreiðslur í kerfinu

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'husnaedismal-leigufelag',
    title: 'Leigufélög almennings - Kosningaáætlun 2024',
    content: `SPURNING: Hvað eru Leigufélög almennings?

SVAR:
Leigufélög almennings eru hluti af húsnæðisstefnu Sósíalistaflokksins. Húsnæðissjóður almennings leigir húsnæði til þessara félaga.

TEGUNDIR LEIGUFÉLAGA:
- Leigufélög sveitarfélaga
- Leigufélög námsmannafélaga
- Félög öryrkja
- Félög aldraðra
- Félög einstæðra foreldra
- Hvers kyns almannasamtök
- Notendastýrð rekstrarfélög leigjenda

SKIPULAG:
- Leigufélögin eru ekki bundin við eitt hús
- Innan eins húss geta verið íbúðir sem tilheyra ólíkum leigufélögum
- Hönnun getur komið frá Húsnæðissjóði eða Leigufélögum

EIGNARÍBÚÐIR:
- Þeir sem vilja eiga frekar en leigja geta lagt til eigið fé
- Eiga íbúðina á móti Húsnæðissjóðnum
- Eignarhluti vex með mánaðargreiðslum
- Íbúðir eru ekki seldar á opnum markaði - lokað kerfi

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'husnaedismal-byggingafelag',
    title: 'Byggingafélag ríkisins - Kosningaáætlun 2024',
    content: `SPURNING: Hvað er Byggingafélag ríkisins?

SVAR:
Sósíalistaflokkurinn leggur til stofnun Byggingafélags ríkisins til að brjóta niður fákeppni verktaka.

MARKMIÐ:
- Tryggja ódýrar framkvæmdir
- Brjóta niður fákeppni verktaka
- Innleiða óhagnaðardrifna uppbyggingu
- Losna undan okri verktakafyrirtækja

FRAMKVÆMD:
- Ríkið stofni Byggingafélag ríkisins
- Stuðla að stofnun byggingafélaga sveitarfélaganna
- Hvetja til stofnunar samvinnufélaga byggingaverkafólks
- Húsnæðissjóður almennings býður út byggingu íbúðanna

MEGINREGLA:
Okur, gróði og arðgreiðslur eiga ekki heima innan félagslegs húsnæðiskerfis.

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'husnaedismal-ahrif',
    title: 'Áhrif húsnæðisbyltingarinnar - Kosningaáætlun 2024',
    content: `SPURNING: Hver verða áhrif húsnæðisbyltingarinnar?

SVAR:
Stóra húsnæðisbyltingin mun hafa víðtæk jákvæð áhrif á samfélagið:

VÖLDIN FÆRAST:
- Frá bröskurum, verktökum, fjárfestum og bönkum
- Til almennings
- Íbúðir byggðar eftir þörfum fólks, ekki gróðafyrirtækja

LÍFSKJARABÓT:
- Lækkun húsnæðiskostnaðar
- Almenningur hefur meira milli handanna
- Færri þurfa að vera í tveimur eða þremur vinnum
- Fólk á fleiri stundir með börnum sínum
- Meiri tími til félagslífs og þátttöku í samfélaginu

EFNAHAGUR:
- Framboð ódýrra íbúða heldur aftur af verðhækkunum
- Uppbygging skapar atvinnu
- Örvar efnahagslífið
- Dregur úr afkomukvíða

SAMFÉLAG:
- Hönnun og útfærsla íbúða verður lyftistöng
- Fjölbreytni mannlífs eykst
- "Eyðing húsnæðiskreppunnar verður eins og vor að löngum hörðum vetri"

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'husnaedismal-airbnb',
    title: 'Airbnb og skammtímaleiga - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um Airbnb og skammtímaleigu?

SVAR:
Sósíalistaflokkurinn vill takmarka skammtímaleigu til að vernda húsnæðismarkað fyrir íbúa.

TILLÖGUR:
- Einungis leyfilegt að leigja út eigið lögheimili í skammtímaleigu
- Skylt að birta fasta- og leyfisnúmer eignar á auglýsingum
- Auka eftirlit með skráningum
- Slíkar aðgerðir hafa verið teknar upp víðs vegar í löndum í kringum okkur

RÖKSEMDAFÆRSLA:
- Hagnaðardrifnir leigusalar og skammtímaleiga til ferðamanna hafa þrengt að leigjendum
- Stærstur hluti seldra íbúða fer til fólks sem ætlar að leigja þær út til gróða
- Hótel eru nú þegar að berjast við að fylla herbergi
- Ferðamenn geta gist á hótelum, ekki í íbúðum á sprungnum íbúðamarkaði

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'husnaedismal-leiguverð',
    title: 'Leiguverð og húsnæðiskostnaður - Stefna',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um leiguverð?

SVAR:
Sósíalistaflokkurinn vill lækka leiguverð verulega með félagslegu húsnæðiskerfi.

NÚVERANDI STAÐA:
- Húsnæðiskostnaður er alvarlegasta ógnin við lífsafkomu almennings
- Meira en þriðjungur fjölskyldna á erfitt með að ná endum saman
- Stærri og stærri hluti ráðstöfunartekna fer í húsnæði

TILLÖGUR:
- Setja viðmið um leigu í samræmi við aðrar hagstærðir
- Leiguverð í nýja kerfinu um helmingi lægra en í dag
- Kostnaði dreift á 120 ár í stað 40 ára
- Enginn gróði eða arðgreiðslur í félagslegu húsnæðiskerfi

VERND LEIGJENDA:
- Fjórfaldur fasteignaskattur á aðra íbúð (til að draga úr uppsöfnun fjárfesta)
- Kostnaðinum má ekki velta yfir á leigjendur
- Húsnæði er mannréttindi, ekki verkfæri til auðsöfnunar

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í húsnæðismálum
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
      source: 'Kosningaáætlun Alþingiskosningar 2024',
      document: 'Betra plan í húsnæðismálum',
      url: SOURCE_URL,
      date: '2024-11-19',
      type: 'election-platform',
      verified: true,
    }),
    vectorStr,
  ]);

  console.log(`   ✅ Vistað með ID: ${result.rows[0].id}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Bæti við: Betra plan í húsnæðismálum (nóv 2024)           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nURL: ${SOURCE_URL}`);
  console.log(`Fjöldi kafla: ${HOUSING_POLICY_DOCUMENTS.length}\n`);

  try {
    for (const doc of HOUSING_POLICY_DOCUMENTS) {
      await addDocument(doc);
    }

    const countResult = await pool.query(
      "SELECT COUNT(*) FROM rag_documents WHERE source_type = 'curated-answer'"
    );
    console.log(`\n✅ Samtals curated-answer skjöl: ${countResult.rows[0].count}`);

    const housingResult = await pool.query(
      "SELECT chunk_id, title FROM rag_documents WHERE chunk_id LIKE 'husnaedismal%' ORDER BY chunk_id"
    );
    console.log(`\n📋 Húsnæðisskjöl:`);
    for (const row of housingResult.rows) {
      console.log(`   - ${row.title}`);
    }

  } catch (error) {
    console.error('❌ Villa:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
