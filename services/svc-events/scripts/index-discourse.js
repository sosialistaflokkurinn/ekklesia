#!/usr/bin/env node
/**
 * Index Discourse Archive Data
 *
 * Reads JSON files from discourse-archive and indexes them into pgvector
 * for RAG (Retrieval Augmented Generation) semantic search.
 *
 * Usage:
 *   node scripts/index-discourse.js [--dry-run] [--no-embeddings]
 *
 * Requires:
 *   - Cloud SQL proxy running on port 5433
 *   - GCP credentials for Vertex AI
 */

const fs = require('fs');
const path = require('path');

// Set up environment for Cloud SQL BEFORE any imports
// Uses same var names as config-database.js
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'ekklesia-prod-10-2025';
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5433';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'socialism';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'socialism';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'Socialism2025#Db';

// Configuration
const DISCOURSE_ARCHIVE_PATH = '/home/gudro/Development/discourse-archive/data';
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EMBEDDINGS = process.argv.includes('--no-embeddings');

// Import services (now that environment is set up)
const embeddingService = require('../src/services/service-embedding');
const vectorSearch = require('../src/services/service-vector-search');
const logger = require('../src/utils/util-logger');

/**
 * Initialize services
 */
async function init() {
  console.log('✅ Services initialized');
  console.log(`   Discourse Archive: ${DISCOURSE_ARCHIVE_PATH}`);
  console.log(`   Dry Run: ${DRY_RUN}`);
  console.log(`   Skip Embeddings: ${SKIP_EMBEDDINGS}`);
}

/**
 * Process articles.json
 * Creates one chunk per article with full citation metadata
 */
async function indexArticles() {
  const filePath = path.join(DISCOURSE_ARCHIVE_PATH, 'articles.json');
  if (!fs.existsSync(filePath)) {
    console.log('⏭️  articles.json not found, skipping');
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const articles = data.articles || [];
  let indexed = 0;

  console.log(`\n📰 Indexing ${articles.length} articles...`);

  for (const article of articles) {
    const chunkId = `article-${article.id}`;

    // Build content text with key_quotes (speaker + quote format from actual data)
    const quotesText = article.key_quotes?.map(q =>
      `${q.speaker}: "${q.quote}"`
    ).join('\n');

    const contentParts = [
      article.headline,
      article.context?.background,
      quotesText,
      article.topics?.join(', '),
    ].filter(Boolean);

    const content = contentParts.join('\n\n');

    // Build citation metadata
    const citation = {
      who: article.author?.name || article.source?.name || 'Óþekkt',
      when: article.publication?.date || null,
      context: `Frétt í ${article.source?.name || 'óþekktu miðli'}`,
      headline: article.headline,
      url: article.source?.url,
      event_type: article.event_type,
    };

    console.log(`   [${article.id}] ${article.headline?.slice(0, 50)}...`);

    if (!DRY_RUN) {
      // Generate embedding
      let embedding = null;
      if (!SKIP_EMBEDDINGS && content.length > 10) {
        try {
          embedding = await embeddingService.generateEmbedding(content);
        } catch (err) {
          console.error(`   ⚠️  Embedding failed: ${err.message}`);
        }
      }

      // Insert into database
      await vectorSearch.upsertDocument({
        sourceType: 'discourse-article',
        sourceUrl: article.source?.url,
        sourceDate: article.publication?.date,
        chunkId,
        title: article.headline,
        content,
        citation,
        embedding,
      });
    }

    indexed++;
  }

  return indexed;
}

/**
 * Process people.json
 * Creates one chunk per person with their key actions and quotes
 */
async function indexPeople() {
  const filePath = path.join(DISCOURSE_ARCHIVE_PATH, 'people.json');
  if (!fs.existsSync(filePath)) {
    console.log('⏭️  people.json not found, skipping');
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const people = data.people || [];
  let indexed = 0;

  console.log(`\n👥 Indexing ${people.length} people...`);

  for (const person of people) {
    const chunkId = `person-${person.id}`;

    // Build content text using actual data structure
    const rolesText = person.roles?.join(', ');
    const actionsText = person.key_actions?.join('\n- ');

    const contentParts = [
      `${person.name}`,
      rolesText ? `Hlutverk: ${rolesText}` : null,
      person.status_in_party ? `Staða: ${person.status_in_party}` : null,
      person.faction ? `Fylking: ${person.faction}` : null,
      actionsText ? `Lykilaðgerðir:\n- ${actionsText}` : null,
      person.membership?.joined ? `Skráður: ${person.membership.joined}` : null,
      person.membership?.founding_member ? 'Stofnfélagi' : null,
    ].filter(Boolean);

    const content = contentParts.join('\n\n');

    // Build citation metadata
    const citation = {
      who: person.name,
      when: data.metadata?.last_updated || null,
      context: 'Upplýsingar úr flokksskjalasafni',
      roles: person.roles,
      faction: person.faction,
      status: person.status_in_party,
    };

    console.log(`   [${person.id}] ${person.name}`);

    if (!DRY_RUN) {
      let embedding = null;
      if (!SKIP_EMBEDDINGS && content.length > 10) {
        try {
          embedding = await embeddingService.generateEmbedding(content);
        } catch (err) {
          console.error(`   ⚠️  Embedding failed: ${err.message}`);
        }
      }

      await vectorSearch.upsertDocument({
        sourceType: 'discourse-person',
        sourceUrl: null,
        sourceDate: data.metadata?.last_updated,
        chunkId,
        title: person.name,
        content,
        citation,
        embedding,
      });
    }

    indexed++;
  }

  return indexed;
}

/**
 * Process timeline.json
 * Creates one chunk per event
 */
async function indexTimeline() {
  const filePath = path.join(DISCOURSE_ARCHIVE_PATH, 'timeline.json');
  if (!fs.existsSync(filePath)) {
    console.log('⏭️  timeline.json not found, skipping');
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // Use 'timeline' key (actual structure) not 'events'
  const events = data.timeline || [];
  let indexed = 0;

  console.log(`\n📅 Indexing ${events.length} timeline events...`);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    // Use index if no id field
    const chunkId = `event-${event.id || i + 1}`;

    // Build content text using actual data structure
    const contentParts = [
      `${event.date}: ${event.title}`,
      event.description,
      event.key_outcome,
      event.significance ? `Mikilvægi: ${event.significance}` : null,
    ].filter(Boolean);

    const content = contentParts.join('\n\n');

    // Build citation metadata with source
    const citation = {
      who: 'Sósíalistaflokkurinn',
      when: event.date,
      context: event.title,
      event_type: event.event_type,
      source: event.heimild,
      source_url: event.heimild_url,
    };

    console.log(`   [${i + 1}] ${event.date} - ${event.title?.slice(0, 40)}...`);

    if (!DRY_RUN) {
      let embedding = null;
      if (!SKIP_EMBEDDINGS && content.length > 10) {
        try {
          embedding = await embeddingService.generateEmbedding(content);
        } catch (err) {
          console.error(`   ⚠️  Embedding failed: ${err.message}`);
        }
      }

      await vectorSearch.upsertDocument({
        sourceType: 'discourse-event',
        sourceUrl: event.heimild_url,
        sourceDate: event.date,
        chunkId,
        title: event.title,
        content,
        citation,
        embedding,
      });
    }

    indexed++;
  }

  return indexed;
}

/**
 * Convert year or partial date to full date format
 * "2017" -> "2017-01-01", "2024-05" -> "2024-05-01", "2024-05-26" unchanged
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  if (/^\d{4}$/.test(dateStr)) return `${dateStr}-01-01`;
  if (/^\d{4}-\d{2}$/.test(dateStr)) return `${dateStr}-01`;
  return dateStr;
}

/**
 * Process organizations.json
 */
async function indexOrganizations() {
  const filePath = path.join(DISCOURSE_ARCHIVE_PATH, 'organizations.json');
  if (!fs.existsSync(filePath)) {
    console.log('⏭️  organizations.json not found, skipping');
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const orgs = data.organizations || [];
  let indexed = 0;

  console.log(`\n🏛️ Indexing ${orgs.length} organizations...`);

  for (const org of orgs) {
    const chunkId = `org-${org.id}`;

    const contentParts = [
      `${org.name} - ${org.type || 'Samtök'}`,
      org.description,
      org.purpose,
      org.history,
      `Stofnað: ${org.founded || 'Óþekkt'}`,
    ].filter(Boolean);

    const content = contentParts.join('\n\n');

    const citation = {
      who: org.name,
      when: org.founded || data.metadata?.last_updated,
      context: 'Upplýsingar um samtök',
      type: org.type,
    };

    console.log(`   [${org.id}] ${org.name}`);

    if (!DRY_RUN) {
      let embedding = null;
      if (!SKIP_EMBEDDINGS && content.length > 10) {
        try {
          embedding = await embeddingService.generateEmbedding(content);
        } catch (err) {
          console.error(`   ⚠️  Embedding failed: ${err.message}`);
        }
      }

      await vectorSearch.upsertDocument({
        sourceType: 'discourse-org',
        sourceUrl: null,
        sourceDate: normalizeDate(org.founded),
        chunkId,
        title: org.name,
        content,
        citation,
        embedding,
      });
    }

    indexed++;
  }

  return indexed;
}

/**
 * Process interviews.json
 * Creates one chunk per interview with key quotes and topics
 */
async function indexInterviews() {
  const filePath = path.join(DISCOURSE_ARCHIVE_PATH, 'interviews.json');
  if (!fs.existsSync(filePath)) {
    console.log('⏭️  interviews.json not found, skipping');
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const interviews = data.interviews || [];
  let indexed = 0;

  console.log(`\n🎤 Indexing ${interviews.length} interviews...`);

  for (const interview of interviews) {
    const chunkId = `interview-${interview.id}`;

    // Build participant list
    const participantsText = interview.participants?.map(p =>
      `${p.name} (${p.role})`
    ).join(', ');

    // Build topics
    const topicsText = interview.main_topics?.join(', ');

    const contentParts = [
      interview.title,
      participantsText ? `Þátttakendur: ${participantsText}` : null,
      topicsText ? `Efni: ${topicsText}` : null,
      interview.summary,
    ].filter(Boolean);

    const content = contentParts.join('\n\n');

    // Build citation metadata
    const citation = {
      who: interview.participants?.map(p => p.name).join(', ') || 'Óþekkt',
      when: interview.publication?.date || null,
      context: `Viðtal á ${interview.source?.name || 'óþekktum miðli'}`,
      source: interview.source?.name,
      url: interview.source?.url,
      format: interview.format,
    };

    console.log(`   [${interview.id}] ${interview.title?.slice(0, 50)}...`);

    if (!DRY_RUN) {
      let embedding = null;
      if (!SKIP_EMBEDDINGS && content.length > 10) {
        try {
          embedding = await embeddingService.generateEmbedding(content);
        } catch (err) {
          console.error(`   ⚠️  Embedding failed: ${err.message}`);
        }
      }

      await vectorSearch.upsertDocument({
        sourceType: 'discourse-interview',
        sourceUrl: interview.source?.url,
        sourceDate: interview.publication?.date,
        chunkId,
        title: interview.title,
        content,
        citation,
        embedding,
      });
    }

    indexed++;
  }

  return indexed;
}

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Discourse Archive Indexer');
  console.log('='.repeat(50));

  try {
    await init();

    const stats = {
      articles: await indexArticles(),
      people: await indexPeople(),
      timeline: await indexTimeline(),
      organizations: await indexOrganizations(),
      interviews: await indexInterviews(),
    };

    console.log('\n' + '='.repeat(50));
    console.log('✅ Indexing complete!');
    console.log(`   Articles: ${stats.articles}`);
    console.log(`   People: ${stats.people}`);
    console.log(`   Timeline: ${stats.timeline}`);
    console.log(`   Organizations: ${stats.organizations}`);
    console.log(`   Interviews: ${stats.interviews}`);
    console.log(`   Total: ${Object.values(stats).reduce((a, b) => a + b, 0)}`);

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - no changes were made');
    }

    // Show database stats
    if (!DRY_RUN) {
      const dbStats = await vectorSearch.getDocumentStats();
      console.log('\n📊 Database stats:');
      for (const row of dbStats) {
        console.log(`   ${row.source_type}: ${row.count} docs (${row.with_embedding} with embeddings)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
