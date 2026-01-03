#!/usr/bin/env node
/**
 * Add free basic services election platform to RAG
 *
 * "Gjaldfrjáls grunnþjónusta" - Kosningaáætlun Alþingiskosningar 2024
 * https://sosialistaflokkurinn.is/2024/11/16/gjaldfrjals-grunnthjonusta-2/
 *
 * Usage: node scripts/add-free-services-rag.js
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

const SOURCE_URL = 'https://sosialistaflokkurinn.is/2024/11/16/gjaldfrjals-grunnthjonusta-2/';
const SOURCE_DATE = new Date('2024-11-16');

const FREE_SERVICES_DOCUMENTS = [
  {
    chunkId: 'gjaldfrjals-yfirlit',
    title: 'Gjaldfrjáls grunnþjónusta - Yfirlit',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um gjaldfrjálsa grunnþjónustu?

SVAR:
Sósíalistaflokkurinn vill að grunnþjónusta verði gjaldfrjáls og skilyrðislaus. Þetta er ein af meginkrefjum sósíalískrar verkalýðshreyfingar.

MEGINSJÓNARMIÐ:
- Gjaldfrjáls heilbrigðisþjónusta, menntun og jafn aðgangur að opinberri þjónustu er forsenda jöfnuðar
- Leggja ber af tekjutengingar, skerðingar og gjaldtöku þjónustumegin
- Allir eru jafnir hvað þjónustu varðar
- Þau sem eiga mest og eru helst aflögufær borgi meiri skatta

GAGNRÝNI Á NÚVERANDI KERFI:
- Afrakstur hækkun launa hefur runnið í auknar skattbyrðar á almenning
- Hækkun húsnæðiskostnaðar
- Aukin gjaldtaka fyrir opinbera þjónustu sem áður var gjaldfrjáls

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Gjaldfrjáls grunnþjónusta
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'gjaldfrjals-heilbrigdisthjonusta',
    title: 'Gjaldfrjáls heilbrigðisþjónusta - Kosningaáætlun 2024',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um gjaldfrjálsa heilbrigðisþjónustu?

SVAR:
Sósíalistaflokkurinn vill að öll heilbrigðisþjónusta verði gjaldfrjáls.

TILLÖGUR:
- Komugjöld og önnur gjöld verði felld niður
- Lyf niðurgreidd að fullu
- Bæði líkamleg og geðræn heilsa

GJALDFRJÁLS ÞJÓNUSTA NÆR TIL:
- Tannlækningar og tannréttingar
- Augnlækningar
- Sálfræðiþjónusta
- Sjúkra- og iðjuþjálfun
- Þjónusta talmeinafræðinga
- Áfengis- og fíkniefnameðferðir
- Ráðgjöf og stuðningur fyrir fólk sem orðið hefur fyrir ofbeldi og öðrum áföllum

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Gjaldfrjáls grunnþjónusta
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'gjaldfrjals-menntun',
    title: 'Gjaldfrjáls menntun - Kosningaáætlun 2024',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um gjaldfrjálsa menntun?

SVAR:
Sósíalistaflokkurinn vill að menntun á öllum skólastigum verði gjaldfrjáls.

TILLÖGUR:
- Menntun á öllum skólastigum gjaldfrjáls
- Grunn- og framhaldsskólar bjóði upp á ókeypis máltíðir fyrir nemendur
- Tómstundir barna og ungmenna verði gjaldfrjálsar og aðgengilegar í eða nálægt skólum

HÁSKÓLAMENNTUN:
- Í stað námslána í framhaldsnámi komi styrkjakerfi
- Námsmönnum verði gert kleift að stunda nám án þess að skuldsetja sig um aldur og ævi

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Gjaldfrjáls grunnþjónusta
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'gjaldfrjals-samgongur',
    title: 'Gjaldfrjálsar samgöngur - Kosningaáætlun 2024',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um gjaldfrjálsar samgöngur?

SVAR:
Sósíalistaflokkurinn vill að almenningssamgöngur verði gjaldfrjálsar.

TILLÖGUR:
- Strætisvagnar gjaldfrjálsir
- Borgarlína gjaldfrjáls
- Akstursþjónusta fatlaðs fólks gjaldfrjáls
- Vegatollar verði ekki innheimtir á þjóðvegum

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Gjaldfrjáls grunnþjónusta
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'gjaldfrjals-menning',
    title: 'Gjaldfrjáls menning - Kosningaáætlun 2024',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um gjaldfrjálsa menningu?

SVAR:
Sósíalistaflokkurinn vill að aðgangur að menningarstofnunum verði gjaldfrjáls.

TILLÖGUR:
- Aðgangur að opinberum söfnum verði gjaldfrjáls
- Bókasöfn, menningarstofnanir og almenningsgarðar verði efld
- Þetta verði opin rými þar sem allir mega koma saman óháð efnahagslegri stöðu

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Gjaldfrjáls grunnþjónusta
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'gjaldfrjals-stjornsysla',
    title: 'Gjaldfrjáls stjórnsýsla - Kosningaáætlun 2024',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um gjaldfrjálsa stjórnsýslu?

SVAR:
Sósíalistaflokkurinn vill að opinberar stofnanir innheimti ekki gjöld fyrir þjónustu sína.

TILLÖGUR:
- Opinberar stofnanir eins og sýslumenn innheimti ekki gjöld fyrir þjónustu sína
- Rétturinn til gjafsóknar verði aukinn
- Efla aðgang að gjaldfrjálsri lögfræðiaðstoð
- Þetta á við þá sem þurfa að leita réttar síns gagnvart hinu opinbera, stofnunum og fyrirtækjum

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Gjaldfrjáls grunnþjónusta
URL: ${SOURCE_URL}`,
  },
  {
    chunkId: 'gjaldfrjals-tannlaekningar',
    title: 'Gjaldfrjálsar tannlækningar - Stefna Sósíalistaflokksins',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um tannlækningar?

SVAR:
Sósíalistaflokkurinn vill að tannlækningar og tannréttingar verði gjaldfrjálsar sem hluti af heilbrigðisþjónustu.

TILLÖGUR:
- Tannlækningar gjaldfrjálsar
- Tannréttingar gjaldfrjálsar
- Þetta er hluti af heilbrigðisþjónustu sem ætti að vera gjaldfrjáls

RÖKSEMDAFÆRSLA:
- Gjaldfrjáls heilbrigðisþjónusta, menntun og jafn aðgangur að opinberri þjónustu er forsenda jöfnuðar
- Allir eiga að vera jafnir þegar kemur að þjónustu
- Þeir sem eru best aflögufær borgi meiri skatta - ekki þjónustugjöld

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Gjaldfrjáls grunnþjónusta
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
      document: 'Gjaldfrjáls grunnþjónusta',
      url: SOURCE_URL,
      date: '2024-11-16',
      type: 'election-platform',
      verified: true,
    }),
    vectorStr,
  ]);

  console.log(`   ✅ Vistað með ID: ${result.rows[0].id}`);
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Bæti við: Gjaldfrjáls grunnþjónusta (nóv 2024)            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nURL: ${SOURCE_URL}`);
  console.log(`Fjöldi kafla: ${FREE_SERVICES_DOCUMENTS.length}\n`);

  try {
    for (const doc of FREE_SERVICES_DOCUMENTS) {
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
