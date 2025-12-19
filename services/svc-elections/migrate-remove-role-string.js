#!/usr/bin/env node
/**
 * Migration: Sync roles array from role string, then remove legacy field
 *
 * Background: RBAC was simplified to use only 'roles' array. The legacy 'role'
 * string field was causing confusion and data inconsistencies.
 *
 * This script:
 * 1. Reads all users with a 'role' field
 * 2. Updates 'roles' array to match 'role' string (if different)
 * 3. Deletes the 'role' field
 * 4. Logs all changes
 *
 * Run from: services/svc-elections (has firebase-admin installed)
 * Usage: node migrate-remove-role-string.js [--dry-run]
 */

const admin = require('firebase-admin');

// Initialize Firebase
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();
const dryRun = process.argv.includes('--dry-run');

// Merge role string into roles array (don't lose any permissions)
function mergeRoleIntoArray(roleString, currentRoles) {
  const roles = new Set(currentRoles || ['member']);
  roles.add('member'); // Always have member

  if (roleString === 'admin') {
    roles.add('admin');
  } else if (roleString === 'superuser') {
    roles.add('superuser');
  }

  return Array.from(roles);
}

// Check if arrays are equal (ignoring order)
function arraysEqual(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, i) => val === sortedB[i]);
}

async function migrate() {
  console.log(`\n=== Migration: Sync roles array & remove legacy 'role' field ===`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}\n`);

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  let total = 0;
  let withRoleField = 0;
  let rolesFixed = 0;
  let roleDeleted = 0;

  for (const doc of snapshot.docs) {
    total++;
    const data = doc.data();

    if ('role' in data) {
      withRoleField++;
      const roleString = data.role;
      const currentRoles = data.roles || ['member'];
      const mergedRoles = mergeRoleIntoArray(roleString, currentRoles);
      const needsRolesFix = !arraysEqual(currentRoles, mergedRoles);

      console.log(`[${doc.id}] ${data.fullName || 'Unknown'}`);
      console.log(`  role (string): "${roleString}"`);
      console.log(`  roles (current): ${JSON.stringify(currentRoles)}`);
      console.log(`  roles (merged):  ${JSON.stringify(mergedRoles)}`);

      if (!dryRun) {
        const updateData = {
          role: admin.firestore.FieldValue.delete()
        };

        if (needsRolesFix) {
          updateData.roles = mergedRoles;
          console.log(`  -> MERGED roles: ${JSON.stringify(currentRoles)} -> ${JSON.stringify(mergedRoles)}`);
          rolesFixed++;
        }

        await doc.ref.update(updateData);
        console.log(`  -> DELETED role field`);
        roleDeleted++;
      } else {
        if (needsRolesFix) {
          console.log(`  -> Would MERGE roles: ${JSON.stringify(currentRoles)} -> ${JSON.stringify(mergedRoles)}`);
        } else {
          console.log(`  -> roles OK (already includes ${roleString})`);
        }
        console.log(`  -> Would DELETE role field`);
      }
      console.log('');
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Total users: ${total}`);
  console.log(`With 'role' field: ${withRoleField}`);
  console.log(`Roles fixed: ${rolesFixed}`);
  console.log(`Role field deleted: ${roleDeleted}`);

  if (dryRun && withRoleField > 0) {
    console.log(`\nRun without --dry-run to apply changes.`);
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
