#!/usr/bin/env node
/**
 * Test RAG query - searches for similar documents
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

async function searchRAG(query) {
  console.log(`\n🔍 Spurning: "${query}"`);

  const embedding = await embeddingService.generateEmbedding(query);
  const vectorStr = `[${embedding.join(',')}]`;

  const result = await pool.query(`
    SELECT
      title,
      chunk_id,
      1 - (embedding <=> $1::vector) as similarity,
      LEFT(content, 200) as preview
    FROM rag_documents
    WHERE source_type = 'curated-answer'
    ORDER BY embedding <=> $1::vector
    LIMIT 3
  `, [vectorStr]);

  console.log('\n📊 Niðurstöður:');
  result.rows.forEach((row, i) => {
    console.log(`\n${i+1}. ${row.title}`);
    console.log(`   Líkindi: ${(row.similarity * 100).toFixed(1)}%`);
    console.log(`   ${row.preview.substring(0, 100)}...`);
  });

  return result.rows;
}

async function main() {
  const queries = [
    'Hvað er húsnæðissjóður almennings?',
    'Hvernig ætlar flokkurinn að byggja 50000 íbúðir?',
    'Hvað segir flokkurinn um Samherja?',
    'Hvað er fjórða þorskastríðið?',
    'Hvað segir flokkurinn um Porto Alegre og þátttökulýðræði?',
    'Hvað segir flokkurinn um Airbnb?',
  ];

  try {
    for (const q of queries) {
      await searchRAG(q);
      console.log('\n' + '─'.repeat(60));
    }
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
