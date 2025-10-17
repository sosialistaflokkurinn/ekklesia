#!/usr/bin/env node
/*
 * Set Firebase custom claims roles for a user
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json \
 *   node set-user-roles.js --uid <UID> --add developer --add meeting_election_manager
 *
 *   # Remove role
 *   node set-user-roles.js --uid <UID> --remove developer
 *
 * Notes:
 * - Requires a service account with permission to set custom claims (Firebase Admin).
 * - Do NOT commit service account keys. Use environment variables/Secret Manager.
 */

const admin = require('firebase-admin');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { add: [], remove: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--uid') opts.uid = args[++i];
    else if (a === '--add') opts.add.push(args[++i]);
    else if (a === '--remove') opts.remove.push(args[++i]);
    else if (a === '--project') opts.projectId = args[++i];
  }
  return opts;
}

async function main() {
  const { uid, add, remove, projectId } = parseArgs();
  if (!uid) {
    console.error('Error: --uid is required');
    process.exit(1);
  }

  // Initialize Admin SDK (Application Default Credentials)
  admin.initializeApp({ projectId });

  const user = await admin.auth().getUser(uid);
  const current = user.customClaims || {};
  const currentRoles = Array.isArray(current.roles) ? current.roles : [];

  let nextRoles = new Set(currentRoles);
  add.forEach(r => nextRoles.add(r));
  remove.forEach(r => nextRoles.delete(r));

  const rolesArray = Array.from(nextRoles);
  const nextClaims = { ...current, roles: rolesArray };

  await admin.auth().setCustomUserClaims(uid, nextClaims);
  console.log(JSON.stringify({
    message: 'Updated user roles',
    uid,
    roles: rolesArray,
  }, null, 2));
}

main().catch(err => {
  console.error('Failed to set roles:', err);
  process.exit(1);
});
