#!/usr/bin/env node
/**
 * Backfill firebase_uid to members collection
 *
 * Links existing /users/{firebaseUid} documents to /members/{kennitala}
 * by adding metadata.firebase_uid field to member documents.
 *
 * This enables bidirectional linking:
 *   /members/{kennitala} → metadata.firebase_uid → /users/{uid}
 *   /users/{uid} → kennitala → /members/{kennitala}
 *
 * Usage:
 *   node backfill-firebase-uid.js [--dry-run] [--project <PROJECT_ID>]
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var set (service account) OR
 *   - Running in Cloud environment with default credentials, OR
 *   - gcloud auth application-default login
 */

const admin = require('firebase-admin');

function parseArgs(argv) {
  const args = { dryRun: false, project: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function initAdmin(projectId) {
  if (!admin.apps.length) {
    if (projectId) {
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp();
    }
  }
  return admin.firestore();
}

async function backfillFirebaseUids(db, dryRun = false) {
  console.log('Backfill firebase_uid to members collection');
  console.log('='.repeat(50));
  if (dryRun) {
    console.log('DRY RUN MODE - No changes will be made\n');
  }

  // Query all users documents
  console.log('Fetching all /users/ documents...');
  const usersSnapshot = await db.collection('users').get();
  console.log(`Found ${usersSnapshot.size} users\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let alreadyLinked = 0;
  let errors = 0;

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const kennitala = userData.kennitala;
    const uid = userDoc.id;

    // Skip users without kennitala
    if (!kennitala) {
      console.log(`SKIP: User ${uid} has no kennitala`);
      skipped++;
      continue;
    }

    // Normalize kennitala (remove hyphen if present)
    const normalizedKennitala = kennitala.replace(/-/g, '');

    // Check if member exists
    const memberRef = db.collection('members').doc(normalizedKennitala);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      console.log(`NOT_FOUND: Member ${normalizedKennitala.slice(0, 6)}**** not found for user ${uid}`);
      notFound++;
      continue;
    }

    // Check if already linked
    const memberData = memberDoc.data();
    const existingUid = memberData?.metadata?.firebase_uid;

    if (existingUid === uid) {
      console.log(`ALREADY: Member ${normalizedKennitala.slice(0, 6)}**** already linked to ${uid}`);
      alreadyLinked++;
      continue;
    }

    if (existingUid && existingUid !== uid) {
      console.log(`CONFLICT: Member ${normalizedKennitala.slice(0, 6)}**** linked to different UID: ${existingUid} (trying to set ${uid})`);
      errors++;
      continue;
    }

    // Update member document
    if (dryRun) {
      console.log(`WOULD_LINK: ${normalizedKennitala.slice(0, 6)}**** → ${uid}`);
      updated++;
    } else {
      try {
        await memberRef.update({
          'metadata.firebase_uid': uid,
          'metadata.firebase_uid_linked_at': admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`LINKED: ${normalizedKennitala.slice(0, 6)}**** → ${uid}`);
        updated++;
      } catch (error) {
        console.error(`ERROR: Failed to update ${normalizedKennitala.slice(0, 6)}****: ${error.message}`);
        errors++;
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY:');
  console.log(`  ${dryRun ? 'Would update' : 'Updated'}: ${updated}`);
  console.log(`  Already linked: ${alreadyLinked}`);
  console.log(`  Skipped (no kennitala): ${skipped}`);
  console.log(`  Member not found: ${notFound}`);
  console.log(`  Errors/conflicts: ${errors}`);
  console.log(`  Total users processed: ${usersSnapshot.size}`);

  return { updated, alreadyLinked, skipped, notFound, errors };
}

// CLI usage
if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const args = parseArgs(argv);

    if (args.help) {
      console.log(`
Backfill firebase_uid to members collection

Usage:
  node backfill-firebase-uid.js [options]

Options:
  --dry-run     Show what would be updated without making changes
  --project     Firebase project ID (optional, uses default if not set)
  --help, -h    Show this help message

Examples:
  node backfill-firebase-uid.js --dry-run
  node backfill-firebase-uid.js --project ekklesia-prod-10-2025
      `);
      process.exit(0);
    }

    try {
      const db = initAdmin(args.project);
      const stats = await backfillFirebaseUids(db, args.dryRun);

      if (args.dryRun) {
        console.log('\nTo apply changes, run without --dry-run flag');
      }

      process.exit(stats.errors > 0 ? 1 : 0);
    } catch (error) {
      console.error('Fatal error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = { backfillFirebaseUids };
