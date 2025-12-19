#!/usr/bin/env node
/**
 * Add data quality flags to /members/ collection
 *
 * Flags added to each member document:
 * - dataFlags.missingContact: true if no phone AND no email
 * - dataFlags.invalidKennitala: true if kennitala is not 10 digits
 * - dataFlags.emptyAddress: true if no street, city, or postal_code
 * - dataFlags.duplicateEntry: true if kennitala starts with 9999
 * - dataFlags.inactive: true if membership.status is not 'active' or 'unpaid'
 *
 * Usage: node add-member-flags.js [--dry-run]
 */

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();
const dryRun = process.argv.includes('--dry-run');

async function addFlags() {
  console.log(`\n=== Adding data quality flags to /members/ ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  const snapshot = await db.collection('members').get();

  let total = 0;
  let flagged = 0;
  const flagCounts = {
    missingContact: 0,
    invalidKennitala: 0,
    emptyAddress: 0,
    duplicateEntry: 0,
    inactive: 0
  };

  let batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 400;

  for (const doc of snapshot.docs) {
    total++;
    const data = doc.data();
    const kennitala = doc.id;

    // Calculate flags
    const flags = {};

    // 1. Missing contact (no phone AND no email)
    const hasPhone = data.profile?.phone && data.profile.phone.trim() !== '';
    const hasEmail = data.profile?.email && data.profile.email.trim() !== '';
    if (!hasPhone && !hasEmail) {
      flags.missingContact = true;
      flagCounts.missingContact++;
    }

    // 2. Invalid kennitala (not 10 digits)
    if (!kennitala || kennitala.length !== 10) {
      flags.invalidKennitala = true;
      flagCounts.invalidKennitala++;
    }

    // 3. Empty address
    const hasAddress = data.address?.street || data.address?.city || data.address?.postal_code;
    if (!hasAddress) {
      flags.emptyAddress = true;
      flagCounts.emptyAddress++;
    }

    // 4. Duplicate entry (9999 prefix)
    if (kennitala && kennitala.startsWith('9999')) {
      flags.duplicateEntry = true;
      flagCounts.duplicateEntry++;
    }

    // 5. Inactive membership (both 'active' and 'unpaid' are valid members)
    const memberStatus = data.membership?.status;
    if (memberStatus !== 'active' && memberStatus !== 'unpaid') {
      flags.inactive = true;
      flagCounts.inactive++;
    }

    // Only update if there are flags to set
    const hasFlags = Object.keys(flags).length > 0;

    if (hasFlags) {
      flagged++;

      if (!dryRun) {
        batch.update(doc.ref, { dataFlags: flags });
        batchCount++;

        // Commit batch if full
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          console.log(`  Committed batch of ${batchCount} updates`);
          batch = db.batch();
          batchCount = 0;
        }
      }

      // Log first few of each type
      if (flagCounts.missingContact <= 3 && flags.missingContact) {
        console.log(`[${kennitala}] ${data.profile?.name} - missingContact`);
      }
      if (flagCounts.invalidKennitala <= 3 && flags.invalidKennitala) {
        console.log(`[${kennitala}] ${data.profile?.name} - invalidKennitala`);
      }
      if (flagCounts.duplicateEntry <= 3 && flags.duplicateEntry) {
        console.log(`[${kennitala}] ${data.profile?.name} - duplicateEntry`);
      }
    } else {
      // Clear any existing flags if member has no issues
      if (!dryRun) {
        batch.update(doc.ref, { dataFlags: admin.firestore.FieldValue.delete() });
        batchCount++;

        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          console.log(`  Committed batch of ${batchCount} updates`);
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
  }

  // Commit remaining
  if (!dryRun && batchCount > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${batchCount} updates`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total members: ${total}`);
  console.log(`Members with flags: ${flagged}`);
  console.log(`\nFlag counts:`);
  console.log(`  missingContact:   ${flagCounts.missingContact}`);
  console.log(`  invalidKennitala: ${flagCounts.invalidKennitala}`);
  console.log(`  emptyAddress:     ${flagCounts.emptyAddress}`);
  console.log(`  duplicateEntry:   ${flagCounts.duplicateEntry}`);
  console.log(`  inactive:         ${flagCounts.inactive}`);

  if (dryRun) {
    console.log(`\nRun without --dry-run to apply changes.`);
  }

  process.exit(0);
}

addFlags().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
