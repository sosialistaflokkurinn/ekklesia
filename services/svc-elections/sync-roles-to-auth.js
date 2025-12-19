#!/usr/bin/env node
/**
 * Sync roles from Firestore /users/ to Firebase Auth Custom Claims
 *
 * Problem: Migration updated Firestore but not Firebase Auth custom claims.
 * getUserRole reads from Auth custom claims, so we need to sync.
 *
 * Usage: node sync-roles-to-auth.js [--dry-run]
 */

const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();
const auth = admin.auth();
const dryRun = process.argv.includes('--dry-run');

async function syncRoles() {
  console.log(`\n=== Sync Firestore roles to Firebase Auth Custom Claims ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Get all users with elevated roles from Firestore
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  let total = 0;
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const data = doc.data();
    const firestoreRoles = data.roles || ['member'];

    // Skip if just member
    if (firestoreRoles.length === 1 && firestoreRoles[0] === 'member') {
      continue;
    }

    total++;

    try {
      // Get current Auth custom claims
      const user = await auth.getUser(uid);
      const currentClaims = user.customClaims || {};
      const authRoles = currentClaims.roles || ['member'];

      // Compare
      const firestoreSorted = [...firestoreRoles].sort().join(',');
      const authSorted = [...authRoles].sort().join(',');
      const needsSync = firestoreSorted !== authSorted;

      console.log(`[${uid}] ${data.fullName || 'Unknown'}`);
      console.log(`  Firestore roles: ${JSON.stringify(firestoreRoles)}`);
      console.log(`  Auth claims:     ${JSON.stringify(authRoles)}`);

      if (needsSync) {
        if (!dryRun) {
          await auth.setCustomUserClaims(uid, { roles: firestoreRoles });
          console.log(`  -> SYNCED to Auth: ${JSON.stringify(firestoreRoles)}`);
          synced++;
        } else {
          console.log(`  -> Would SYNC to Auth: ${JSON.stringify(firestoreRoles)}`);
        }
      } else {
        console.log(`  -> Already in sync`);
        skipped++;
      }
      console.log('');

    } catch (err) {
      console.log(`  -> ERROR: ${err.message}`);
      errors++;
      console.log('');
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Elevated users checked: ${total}`);
  console.log(`Synced: ${synced}`);
  console.log(`Already in sync: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (dryRun && (total - skipped) > 0) {
    console.log(`\nRun without --dry-run to apply changes.`);
  }

  process.exit(0);
}

syncRoles().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
