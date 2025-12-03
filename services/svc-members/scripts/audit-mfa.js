#!/usr/bin/env node
/**
 * Audit MFA status for users with elevated roles.
 *
 * WARNING: For internal use. Consider moving to a private ops repo if you
 * add emails or notification logic.
 *
 * Usage:
 *   node audit-mfa.js [--project <PROJECT_ID>]
 *
 * Output: JSON lines with uid, email, roles, mfa_enrolled
 */

const admin = require('firebase-admin');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') out.project = args[++i];
  }
  return out;
}

function initAdmin(projectId) {
  if (!admin.apps.length) {
    if (projectId) admin.initializeApp({ projectId });
    else admin.initializeApp();
  }
}

async function listAllUsers() {
  const results = [];
  let nextPageToken = undefined;
  do {
    const resp = await admin.auth().listUsers(1000, nextPageToken);
    results.push(...resp.users);
    nextPageToken = resp.pageToken;
  } while (nextPageToken);
  return results;
}

(async function main() {
  const { project } = parseArgs();
  initAdmin(project);

  const users = await listAllUsers();
  let totalElevated = 0;
  let withMfa = 0;
  const withoutMfa = [];

  const elevated = users.filter(u => {
    const roles = (u.customClaims?.roles) || [];
    return roles.some(r => ['superuser','admin','admin'].includes(r));
  });

  for (const u of elevated) {
    const roles = (u.customClaims?.roles) || [];
    const mfaCount = u.multiFactor?.enrolledFactors?.length || 0;
    const mfa = mfaCount > 0;
    totalElevated++;
    if (mfa) withMfa++; else withoutMfa.push(u.uid);

    const out = {
      uid: u.uid,
      email: u.email || null,
      roles,
      mfa_enrolled: mfa,
      mfa_factor_count: mfaCount
    };
    // Add metadata useful for triage
    const lastSignIn = u.metadata?.lastSignInTime || null;
    const created = u.metadata?.creationTime || null;
    if (lastSignIn) out.last_sign_in = lastSignIn;
    if (created) {
      out.account_age_days = Math.floor((Date.now() - new Date(created).getTime()) / (24*60*60*1000));
    }
    console.log(JSON.stringify(out));
  }

  // Summary to stderr (won't pollute JSON lines on stdout)
  console.error('\n=== MFA Audit Summary ===');
  console.error(`Total elevated users: ${totalElevated}`);
  console.error(`With MFA: ${withMfa} (${totalElevated ? ((withMfa/totalElevated)*100).toFixed(1) : 0}%)`);
  console.error(`Without MFA: ${withoutMfa.length}`);
  if (withoutMfa.length > 0) {
    console.error('Users without MFA:', withoutMfa.join(', '));
  }

  process.exit(withoutMfa.length > 0 ? 1 : 0);
})().catch(err => {
  console.error('Failed to audit MFA:', err);
  process.exit(1);
});
