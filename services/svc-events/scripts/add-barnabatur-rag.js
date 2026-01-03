#!/usr/bin/env node
/**
 * Add specific barnabætur chunk to RAG
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

const SOURCE_URL = 'https://sosialistaflokkurinn.is/2024/11/19/betra-plan-i-rikisfjarmalum/';

async function main() {
  const doc = {
    chunkId: 'rikisfjarmalamal-barnabatur',
    title: 'Barnabætur - Kosningaáætlun 2024',
    content: `SPURNING: Hvað segir Sósíalistaflokkurinn um barnabætur?

SVAR:
Í kosningaáætlun Sósíalistaflokksins frá 2024 er lagt til að hækka barnabætur verulega.

NÚVERANDI STAÐA:
- Barnabætur eru um 188.000 kr. á barn á ári
- Barnabætur voru 1,2% af landsframleiðslu 1991 en aðeins 0,35% í dag
- Barnabætur hafa lækkað um 38,6 milljarða á þrjátíu árum

SÖGULEGUR SAMANBURÐUR:
- Árið 1991 voru barnabætur tæplega 283.000 kr. á hvert barn (á núvirði)
- Til að ná sama hlutfalli af landsframleiðslu og 1991 þyrfti að greiða 54,6 milljarða í ár

TILLAGA SÓSÍALISTA:
- Markmið: Öll börn fái barnabætur upp á tæpar 65.000 kr. á mánuði
- Þetta jafngildir persónuafslátti fullorðinna
- Barnabætur yrðu útgreiðanlegar ef foreldrar nýta ekki persónuafslátt

FJÁRMÖGNUN:
Hækkunin yrði að hluta til fjármögnuð með brattari skattstiga og hátekjuþrepum, svo foreldrar með tekjur í þriðja skattþrepi væru jafnsett á eftir en barnafjölskyldur með miðlungstekjur og lægri væru mun betur settar.

HEIMILD: Kosningaáætlun Alþingiskosningar 2024 - Betra plan í ríkisfjármálum
URL: ${SOURCE_URL}`
  };

  console.log('📝 Bæti við: ' + doc.title);
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
      embedding = EXCLUDED.embedding
    RETURNING id
  `;

  const result = await pool.query(sql, [
    'curated-answer',
    SOURCE_URL,
    new Date('2024-11-19'),
    doc.chunkId,
    doc.title,
    doc.content,
    JSON.stringify({
      source: 'Kosningaáætlun Alþingiskosningar 2024',
      document: 'Betra plan í ríkisfjármálum',
      url: SOURCE_URL,
      date: '2024-11-19',
      type: 'election-platform',
      verified: true,
    }),
    vectorStr,
  ]);

  console.log('   ✅ Vistað með ID: ' + result.rows[0].id);
  await pool.end();
}

main().catch(console.error);
