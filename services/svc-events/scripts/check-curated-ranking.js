#!/usr/bin/env node
/**
 * Check how curated answers rank vs other documents
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

const QUESTIONS = [
  { q: 'Hvað segir flokkurinn um kvótakerfið?', expected: 'sjavarutvegur-2021-kvotakerfi' },
  { q: 'Hvað er fjórða þorskastríðið?', expected: 'sjavarutvegur-2021-thorskastrid' },
  { q: 'Hvað er þátttökulýðræðisleg fjárlagagerð?', expected: 'folkid-thatttokufjarlög' },
  { q: 'Hvernig ætlar flokkurinn að byggja 50.000 íbúðir?', expected: 'husnaedi-50000-ibudir' },
  { q: 'Hvað segir flokkurinn um auðlegðarskatt?', expected: 'rikisfjarmalamal-audlegdarskatt' },
];

async function checkQuestion(item) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Spurning: ${item.q}`);
  console.log(`Væntanlegt: ${item.expected}`);

  const embedding = await embeddingService.generateEmbedding(item.q);
  const vectorStr = `[${embedding.join(',')}]`;

  // Find where the expected doc ranks
  const allResults = await pool.query(`
    SELECT chunk_id, title, source_type,
           1 - (embedding <=> $1::vector) as similarity,
           ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) as rank
    FROM rag_documents
    ORDER BY embedding <=> $1::vector
    LIMIT 20
  `, [vectorStr]);

  // Find expected doc
  const expectedResult = await pool.query(`
    SELECT chunk_id, title, 1 - (embedding <=> $1::vector) as similarity
    FROM rag_documents WHERE chunk_id = $2
  `, [vectorStr, item.expected]);

  console.log(`\nTopp 5 niðurstöður:`);
  allResults.rows.slice(0, 5).forEach((row, i) => {
    const marker = row.chunk_id === item.expected ? ' ⬅️ VÆNTANLEGT' : '';
    console.log(`  ${i+1}. [${row.source_type}] ${row.title} (${(row.similarity * 100).toFixed(1)}%)${marker}`);
  });

  if (expectedResult.rows.length > 0) {
    const exp = expectedResult.rows[0];
    const rank = allResults.rows.findIndex(r => r.chunk_id === item.expected) + 1;
    console.log(`\n📊 Væntanlegt skjal "${exp.title}":`);
    console.log(`   Líkindi: ${(exp.similarity * 100).toFixed(1)}%`);
    console.log(`   Raðar: #${rank > 0 ? rank : '>20'}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  Athuga röðun curated-answer skjala                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  try {
    for (const item of QUESTIONS) {
      await checkQuestion(item);
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
