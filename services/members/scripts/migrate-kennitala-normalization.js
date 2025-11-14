#!/usr/bin/env node
/**
 * Migrate kennitala normalization in Firestore /users/ collection
 *
 * Problem: Some users created before Oct 30, 2025 have kennitölur WITH hyphens
 * in the database (e.g., "010192-2779"). This causes duplicate user creation
 * because the auth system queries for normalized format (e.g., "0101922779").
 *
 * Solution:
 * 1. Find all users with hyphens in kennitala field
 * 2. Normalize to 10-digit format (remove hyphens)
 * 3. Check for duplicates (same person with 2 UIDs)
 * 4. Merge duplicates: Keep older user, migrate data from newer, delete newer
 * 5. Update kennitala to normalized format
 *
 * Usage:
 *   # Dry run (no changes):
 *   node migrate-kennitala-normalization.js --dry-run
 *
 *   # Execute migration:
 *   node migrate-kennitala-normalization.js --execute
 *
 * Safety: Always run --dry-run first!
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--execute');

function normalizeKennitala(kennitala) {
  if (!kennitala) return null;
  return kennitala.replace(/[-\s]/g, '');
}

async function findUsersWithHyphens() {
  console.log('🔍 Finding users with hyphens in kennitala...\n');

  const usersSnapshot = await db.collection('users').get();
  const usersWithHyphens = [];

  usersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.kennitala && data.kennitala.includes('-')) {
      usersWithHyphens.push({
        uid: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : null
      });
    }
  });

  console.log(`Found ${usersWithHyphens.length} users with hyphens\n`);
  return usersWithHyphens;
}

async function findDuplicates(usersWithHyphens) {
  console.log('🔍 Checking for duplicate users...\n');

  const duplicates = [];

  for (const user of usersWithHyphens) {
    const normalized = normalizeKennitala(user.kennitala);

    // Query for users with normalized kennitala (without hyphen)
    const query = db.collection('users').where('kennitala', '==', normalized).limit(5);
    const existingUsers = [];

    const snapshot = await query.get();
    snapshot.forEach(doc => {
      if (doc.id !== user.uid) {
        const data = doc.data();
        existingUsers.push({
          uid: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate() : null
        });
      }
    });

    if (existingUsers.length > 0) {
      duplicates.push({
        kennitala: normalized,
        oldUser: user,  // User with hyphen (older)
        newUsers: existingUsers  // Users without hyphen (newer)
      });
    }
  }

  console.log(`Found ${duplicates.length} duplicate cases\n`);
  return duplicates;
}

async function mergeDuplicateUsers(duplicate) {
  const { kennitala, oldUser, newUsers } = duplicate;

  console.log(`\n📋 Merging duplicate for kennitala: ${kennitala}`);
  console.log(`   Old user (KEEP): ${oldUser.fullName} (${oldUser.uid})`);
  console.log(`   Created: ${oldUser.createdAt ? oldUser.createdAt.toISOString() : 'unknown'}`);
  console.log(`   Roles: ${JSON.stringify(oldUser.roles || ['member'])}`);

  for (const newUser of newUsers) {
    console.log(`\n   New user (DELETE): ${newUser.fullName} (${newUser.uid})`);
    console.log(`   Created: ${newUser.createdAt ? newUser.createdAt.toISOString() : 'unknown'}`);
    console.log(`   Roles: ${JSON.stringify(newUser.roles || ['member'])}`);
  }

  if (DRY_RUN) {
    console.log('   [DRY RUN] Would merge data and delete newer user(s)');
    return { success: true, dryRun: true };
  }

  try {
    // Merge strategy: Keep old user, transfer any missing data from new users
    const updates = {
      kennitala: kennitala,  // Normalize kennitala (remove hyphen)
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    };

    // Transfer roles from new user if old user has fewer roles
    for (const newUser of newUsers) {
      const newRoles = newUser.roles || ['member'];
      const oldRoles = oldUser.roles || ['member'];

      // Keep the most privileged roles
      const mergedRoles = [...new Set([...oldRoles, ...newRoles])];
      if (mergedRoles.length > oldRoles.length) {
        updates.roles = mergedRoles;
        console.log(`   ✅ Merging roles: ${JSON.stringify(oldRoles)} + ${JSON.stringify(newRoles)} = ${JSON.stringify(mergedRoles)}`);
      }

      // Keep most recent membershipVerifiedAt
      if (newUser.membershipVerifiedAt && (!oldUser.membershipVerifiedAt ||
          newUser.membershipVerifiedAt.toDate() > oldUser.membershipVerifiedAt.toDate())) {
        updates.membershipVerifiedAt = newUser.membershipVerifiedAt;
      }
    }

    // Update old user with normalized kennitala and merged data
    await db.collection('users').doc(oldUser.uid).update(updates);
    console.log(`   ✅ Updated old user with normalized kennitala`);

    // Delete Firebase Auth for new users (if they exist)
    for (const newUser of newUsers) {
      try {
        await admin.auth().deleteUser(newUser.uid);
        console.log(`   ✅ Deleted Firebase Auth for: ${newUser.uid}`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          console.log(`   ⚠️  Firebase Auth user not found (already deleted): ${newUser.uid}`);
        } else {
          throw err;
        }
      }

      // Delete Firestore document for new user
      await db.collection('users').doc(newUser.uid).delete();
      console.log(`   ✅ Deleted Firestore doc for: ${newUser.uid}`);
    }

    return { success: true, dryRun: false };

  } catch (error) {
    console.error(`   ❌ Error merging duplicate:`, error);
    return { success: false, error: error.message };
  }
}

async function normalizeUserKennitala(user) {
  const normalized = normalizeKennitala(user.kennitala);

  console.log(`\n📝 Normalizing: ${user.fullName} (${user.uid})`);
  console.log(`   Old: "${user.kennitala}" → New: "${normalized}"`);
  console.log(`   Created: ${user.createdAt ? user.createdAt.toISOString() : 'unknown'}`);

  if (DRY_RUN) {
    console.log('   [DRY RUN] Would update kennitala');
    return { success: true, dryRun: true };
  }

  try {
    await db.collection('users').doc(user.uid).update({
      kennitala: normalized
    });
    console.log(`   ✅ Updated kennitala`);
    return { success: true, dryRun: false };
  } catch (error) {
    console.error(`   ❌ Error updating:`, error);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔧 Kennitala Normalization Migration');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '⚠️  EXECUTE (will modify database)'}`);
  console.log('');

  if (!DRY_RUN) {
    console.log('⚠️  WARNING: This will modify production database!');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Step 1: Find users with hyphens
  const usersWithHyphens = await findUsersWithHyphens();

  if (usersWithHyphens.length === 0) {
    console.log('✅ No users with hyphens found. Database is already normalized!');
    return;
  }

  console.log('Users with hyphens:');
  usersWithHyphens.forEach(u => {
    console.log(`  - ${u.fullName} (${u.kennitala}) - Created: ${u.createdAt ? u.createdAt.toISOString() : 'unknown'}`);
  });
  console.log('');

  // Step 2: Find duplicates
  const duplicates = await findDuplicates(usersWithHyphens);

  // Step 3: Merge duplicates
  if (duplicates.length > 0) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚨 MERGING DUPLICATE USERS');
    console.log('═══════════════════════════════════════════════════════');

    for (const duplicate of duplicates) {
      await mergeDuplicateUsers(duplicate);
    }
  }

  // Step 4: Normalize remaining users (those without duplicates)
  const usersToNormalize = usersWithHyphens.filter(user => {
    return !duplicates.some(dup => dup.oldUser.uid === user.uid);
  });

  if (usersToNormalize.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📝 NORMALIZING REMAINING USERS');
    console.log('═══════════════════════════════════════════════════════');

    for (const user of usersToNormalize) {
      await normalizeUserKennitala(user);
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total users with hyphens: ${usersWithHyphens.length}`);
  console.log(`Duplicate cases found: ${duplicates.length}`);
  console.log(`Users normalized: ${usersToNormalize.length}`);
  console.log('');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN COMPLETE - No changes made');
    console.log('   Run with --execute to apply changes');
  } else {
    console.log('✅ MIGRATION COMPLETE');
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Migration failed:', err);
    process.exit(1);
  });
