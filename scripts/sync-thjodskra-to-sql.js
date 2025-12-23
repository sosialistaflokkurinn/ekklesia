#!/usr/bin/env node
/**
 * Sync Þjóðskrá Results to Cloud SQL
 *
 * Updates membership_simpleaddress with addresses from thjodskra-results.json
 * Data used by heatmap: https://felagar.sosialistaflokkurinn.is/members-area/heatmap.html
 *
 * Prerequisites:
 *   - Cloud SQL Proxy running on port 5433
 *   - PGPASSWORD environment variable set
 *
 * Usage:
 *   export PGPASSWORD=$(gcloud secrets versions access latest --secret=django-socialism-db-password)
 *   node scripts/sync-thjodskra-to-sql.js [--dry-run]
 *
 * Documentation: ~/.claude/thjodskra-lookup/README.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_FILE = path.join(__dirname, 'thjodskra-results.json');

const { Pool } = pg;

// Configuration
const DRY_RUN = process.argv.includes('--dry-run');

// Database connection
const pool = new Pool({
  host: '127.0.0.1',
  port: 5433,
  user: 'socialism',
  password: process.env.PGPASSWORD,
  database: 'socialism',
});

async function main() {
  console.log('📊 Syncing Þjóðskrá Results to Cloud SQL');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Read results
  const data = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
  console.log(`   Source: ${data.source}`);
  console.log(`   Date: ${data.lookup_date}`);
  console.log(`   Total records: ${data.total}\n`);

  const results = {
    updated: 0,
    skipped_not_found: 0,
    skipped_unspecified: 0,
    skipped_abroad: 0,
    not_in_db: 0,
    errors: 0,
  };

  const client = await pool.connect();

  try {
    for (const entry of data.results) {
      const kt = entry.kt;

      // Skip entries that weren't found
      if (!entry.found) {
        console.log(`   ⏭️  ${kt}: Not found in Þjóðskrá`);
        results.skipped_not_found++;
        continue;
      }

      // Skip unspecified addresses
      if (entry.heimili === 'Ótilgreindu') {
        console.log(`   ⏭️  ${kt}: Unspecified address (${entry.nafn})`);
        results.skipped_unspecified++;
        continue;
      }

      // Skip abroad
      if (entry.heimili === 'Abroad' || entry.sveitarfelag === 'Abroad') {
        console.log(`   ⏭️  ${kt}: Living abroad (${entry.nafn})`);
        results.skipped_abroad++;
        continue;
      }

      // Skip unknown addresses
      if (entry.heimili === 'Unknown' || entry.nafn === 'Unknown') {
        console.log(`   ⏭️  ${kt}: Unknown data`);
        results.skipped_unspecified++;
        continue;
      }

      try {
        // Find comrade by SSN
        const comradeResult = await client.query(
          'SELECT id, name FROM membership_comrade WHERE ssn = $1',
          [kt]
        );

        if (comradeResult.rows.length === 0) {
          console.log(`   ❓ ${kt}: Not found in database`);
          results.not_in_db++;
          continue;
        }

        const comrade = comradeResult.rows[0];

        if (DRY_RUN) {
          console.log(`   [DRY-RUN] Would update ${kt}: ${entry.nafn} → ${entry.heimili}, ${entry.postnumer} ${entry.sveitarfelag}`);
          results.updated++;
          continue;
        }

        // Update or insert address
        const updateResult = await client.query(`
          UPDATE membership_simpleaddress
          SET raw_address = $1,
              postal_code = $2,
              city = $3,
              country = 'Ísland'
          WHERE comrade_id = $4
          RETURNING comrade_id
        `, [entry.heimili, entry.postnumer, entry.sveitarfelag, comrade.id]);

        if (updateResult.rows.length === 0) {
          // No existing address, insert one
          await client.query(`
            INSERT INTO membership_simpleaddress (comrade_id, raw_address, postal_code, city, country)
            VALUES ($1, $2, $3, $4, 'Ísland')
          `, [comrade.id, entry.heimili, entry.postnumer, entry.sveitarfelag]);
        }

        console.log(`   ✅ ${kt}: ${entry.nafn} → ${entry.heimili}, ${entry.postnumer} ${entry.sveitarfelag}`);
        results.updated++;

      } catch (err) {
        console.log(`   ❌ ${kt}: Error - ${err.message}`);
        results.errors++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${results.updated}`);
  console.log(`   ⏭️  Not in Þjóðskrá: ${results.skipped_not_found}`);
  console.log(`   ⏭️  Unspecified address: ${results.skipped_unspecified}`);
  console.log(`   ⏭️  Living abroad: ${results.skipped_abroad}`);
  console.log(`   ❓ Not in database: ${results.not_in_db}`);
  console.log(`   ❌ Errors: ${results.errors}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
