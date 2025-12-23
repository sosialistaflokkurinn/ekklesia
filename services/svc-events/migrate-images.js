/**
 * One-time migration: Cache existing Facebook images to Cloud Storage
 *
 * Prerequisites:
 * 1. Start cloud-sql-proxy: cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 --port 5433 --gcloud-auth
 * 2. Get database password: gcloud secrets versions access latest --secret=django-socialism-db-password
 * 3. Run: DATABASE_PASSWORD='...' node migrate-images.js
 */

require('dotenv').config();

const admin = require('firebase-admin');
const { Pool } = require('pg');
const axios = require('axios');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const BUCKET_NAME = 'ekklesia-prod-10-2025.firebasestorage.app';
const IMAGE_FOLDER = 'event-images';

// Database config for local proxy
const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  database: 'socialism',
  user: 'socialism',
  password: process.env.DATABASE_PASSWORD
});

function getPublicUrl(filename) {
  return 'https://storage.googleapis.com/' + BUCKET_NAME + '/' + filename;
}

async function cacheImage(sourceUrl, eventId) {
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const filename = IMAGE_FOLDER + '/' + eventId + '.jpg';
  const file = bucket.file(filename);

  // Check if already exists
  const [exists] = await file.exists();
  if (exists) {
    console.log('  Already cached: ' + eventId);
    return getPublicUrl(filename);
  }

  // Download from Facebook
  console.log('  Downloading: ' + sourceUrl.substring(0, 80) + '...');
  const response = await axios.get(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Ekklesia/1.0)'
    }
  });

  // Upload to Cloud Storage
  const contentType = response.headers['content-type'] || 'image/jpeg';
  await file.save(Buffer.from(response.data), {
    metadata: {
      contentType: contentType,
      metadata: {
        sourceUrl: sourceUrl.substring(0, 500),
        cachedAt: new Date().toISOString(),
        eventId: eventId
      }
    }
  });

  await file.makePublic();
  console.log('  Cached: ' + filename);

  return getPublicUrl(filename);
}

async function migrate() {
  console.log('Fetching events with Facebook CDN URLs...');

  const result = await pool.query(
    "SELECT id, facebook_id, image_url FROM external_events WHERE image_url LIKE '%fbcdn.net%' OR image_url LIKE '%facebook.com%'"
  );

  console.log('Found ' + result.rows.length + ' events to migrate');

  for (const row of result.rows) {
    console.log('\nProcessing event ' + row.facebook_id + '...');
    try {
      const newUrl = await cacheImage(row.image_url, row.facebook_id);

      // Update database
      await pool.query(
        'UPDATE external_events SET image_url = $1 WHERE id = $2',
        [newUrl, row.id]
      );
      console.log('  Updated database');
    } catch (error) {
      console.error('  Error: ' + error.message);
    }
  }

  console.log('\nMigration complete!');
  await pool.end();
  process.exit(0);
}

migrate().catch(function(err) {
  console.error('Migration failed:', err);
  process.exit(1);
});
