#!/usr/bin/env node
/**
 * Migration: Remove legacy 'role' string field from /users/ documents
 *
 * Background: RBAC was simplified to use only 'roles' array. The legacy 'role'
 * string field was causing confusion and data inconsistencies.
 *
 * This script:
 * 1. Reads all users with a 'role' field
 * 2. Deletes the 'role' field from each document
 * 3. Logs the changes
 *
 * Run from: services/svc-elections (has firebase-admin installed)
 * Usage: node ../svc-members/scripts/migrate-remove-role-string.js [--dry-run]
 */

const admin = require('firebase-admin');

// Initialize Firebase
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();
const dryRun = process.argv.includes('--dry-run');

async function migrate() {
  console.log(`\n=== Migration: Remove legacy 'role' field ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  let total = 0;
  let withRoleField = 0;
  let updated = 0;

  for (const doc of snapshot.docs) {
    total++;
    const data = doc.data();

    if ('role' in data) {
      withRoleField++;
      console.log(`[${doc.id}] ${data.fullName || 'Unknown'}`);
      console.log(`  role (string): "${data.role}"`);
      console.log(`  roles (array):  ${JSON.stringify(data.roles || ['member'])}`);

      if (!dryRun) {
        await doc.ref.update({
          role: admin.firestore.FieldValue.delete()
        });
        console.log(`  -> DELETED role field`);
        updated++;
      } else {
        console.log(`  -> Would delete role field`);
      }
      console.log('');
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total users: ${total}`);
  console.log(`With 'role' field: ${withRoleField}`);
  console.log(`Updated: ${updated}`);

  if (dryRun && withRoleField > 0) {
    console.log(`\nRun without --dry-run to apply changes.`);
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
