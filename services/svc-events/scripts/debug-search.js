#!/usr/bin/env node
process.env.GOOGLE_CLOUD_PROJECT = 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_NAME = 'socialism';
process.env.DATABASE_USER = 'socialism';
process.env.DATABASE_PASSWORD = 'Socialism2025#Db';

const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT) || 5433,
  database: process.env.DATABASE_NAME || 'socialism',
  user: process.env.DATABASE_USER || 'socialism',
  password: process.env.DATABASE_PASSWORD,
});

const embeddingService = require('/home/gudro/Development/projects/ekklesia/services/svc-events/src/services/service-embedding');

async function test() {
  const q = 'hverjir vor á lista eflingar og í framboði fyrir flokkinn';
  console.log('Query:', q);
  const embedding = await embeddingService.generateEmbedding(q);

  const result = await pool.query(`
    SELECT
      id,
      title,
      source_type,
      (1 - (embedding <=> $1::vector)) as raw_sim,
      CASE
        WHEN source_type = 'party-website' THEN 1.3
        WHEN source_type = 'discourse-archive' THEN 1.2
        ELSE 1.0
      END as source_boost,
      CASE WHEN LOWER(title) LIKE '%efling%' THEN 1.5 ELSE 1.0 END as title_boost,
      (1 - (embedding <=> $1::vector)) *
      CASE
        WHEN source_type = 'party-website' THEN 1.3
        WHEN source_type = 'discourse-archive' THEN 1.2
        ELSE 1.0
      END *
      CASE WHEN LOWER(title) LIKE '%efling%' THEN 1.5 ELSE 1.0 END as final_sim
    FROM rag_documents
    WHERE id IN (586, 762)
    ORDER BY final_sim DESC
  `, [JSON.stringify(embedding)]);

  console.log('\nComparison:');
  for (const r of result.rows) {
    console.log(r.title);
    console.log('  raw:', parseFloat(r.raw_sim).toFixed(4),
                'source:', r.source_boost,
                'title:', r.title_boost,
                'final:', parseFloat(r.final_sim).toFixed(4));
  }

  pool.end();
  process.exit(0);
}
test().catch(e => { console.error(e.message); process.exit(1); });
