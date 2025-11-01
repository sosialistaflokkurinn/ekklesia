#!/usr/bin/env node
/**
 * Set User Roles
 *
 * Helper script to assign or remove roles via Firebase custom claims.
 *
 * Usage (positional - add roles):
 *   node set-user-roles.js <UID> <role1> [role2] [role3]
 *
 * Usage (flags - add/remove/project):
 *   node set-user-roles.js --uid <UID> --add developer --add meeting_election_manager [--remove member] [--project <PROJECT_ID>]
 *
 * Examples:
 *   node set-user-roles.js abc123xyz developer
 *   node set-user-roles.js --uid def456uvw --add meeting_election_manager --remove member
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var set (service account) OR
 *   - Running in Cloud environment with default credentials, OR
 *   - gcloud auth application-default login
 */

const admin = require('firebase-admin');
const os = require('os');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function parseArgs(argv) {
  const args = { add: [], remove: [], dryRun: false, auditFile: null };
  // Flag mode if any arg starts with '-'
  const hasFlags = argv.some(a => a.startsWith('-'));
  if (!hasFlags) {
    if (argv.length < 2) return { error: 'Usage: node set-user-roles.js <UID> <role1> [role2] ...' };
    const [uid, ...add] = argv;
    return { uid, add, remove: [], project: undefined, dryRun: false, auditFile: null };
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--uid') args.uid = argv[++i];
    else if (a === '--add') args.add.push(argv[++i]);
    else if (a === '--remove') args.remove.push(argv[++i]);
    else if (a === '--project') args.project = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--audit-file') args.auditFile = argv[++i];
  }
  if (!args.uid) return { error: 'Error: --uid is required in flag mode' };
  return args;
}

// Initialize Firebase Admin (uses default credentials or GOOGLE_APPLICATION_CREDENTIALS)
function initAdmin(projectId) {
  if (!admin.apps.length) {
    if (projectId) {
      admin.initializeApp({ projectId });
    } else {
      admin.initializeApp();
    }
  }
}

const VALID_ROLES = ['superuser', 'admin', 'admin', 'member'];

function validateRoles(addRoles = [], removeRoles = []) {
  const invalidAdds = addRoles.filter(r => !VALID_ROLES.includes(r));
  const invalidRemoves = removeRoles.filter(r => !VALID_ROLES.includes(r));
  const invalid = [...invalidAdds, ...invalidRemoves];
  if (invalid.length > 0) {
    console.error(`❌ Invalid role(s): ${invalid.join(', ')}`);
    console.error(`Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }
}

function askConfirm(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, answer => { rl.close(); resolve(answer.trim()); });
  });
}

async function setUserRoles(uid, addRoles, removeRoles) {
  try {
    // Get current user
    const user = await admin.auth().getUser(uid);
    console.log(`Current user: ${user.email || user.uid}`);

    // Get current custom claims
    const currentClaims = user.customClaims || {};
    console.log('Current claims:', JSON.stringify(currentClaims, null, 2));

  const existingRoles = Array.isArray(currentClaims.roles) ? currentClaims.roles : [];
    const rolesSet = new Set(existingRoles);
    (addRoles || []).forEach(r => rolesSet.add(r));
    (removeRoles || []).forEach(r => rolesSet.delete(r));
    const mergedRoles = Array.from(rolesSet);

    // Set new claims (preserve kennitala, isMember, etc.)
    const newClaims = {
      ...currentClaims,
      roles: mergedRoles
    };

  await admin.auth().setCustomUserClaims(uid, newClaims);

    console.log('\n✅ Roles updated successfully!');
    console.log('New claims:', JSON.stringify(newClaims, null, 2));
    console.log('\nℹ️  User must sign out and sign back in for roles to take effect.');

    // Structured audit log for Cloud Logging ingestion
    const auditLog = {
      severity: 'INFO',
      message: 'User roles updated',
      uid,
      roles_before: existingRoles,
      roles_after: mergedRoles,
      added: addRoles,
      removed: removeRoles,
      performed_by: process.env.SUDO_USER || process.env.USER || process.env.USERNAME || 'unknown',
      host: os.hostname(),
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(auditLog));
    // Optional local audit file for environments without central logging
    if (global.__SET_USER_ROLES_AUDIT_FILE__) {
      try {
        fs.mkdirSync(path.dirname(global.__SET_USER_ROLES_AUDIT_FILE__), { recursive: true });
        fs.appendFileSync(global.__SET_USER_ROLES_AUDIT_FILE__, JSON.stringify(auditLog) + '\n');
      } catch (e) {
        console.error('Failed to write audit log file:', e.message);
      }
    }

    return newClaims;
  } catch (error) {
    console.error('❌ Error setting roles:', error.message);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2);
    const parsed = parseArgs(argv);

    if (parsed.error) {
      console.error(parsed.error);
      console.error('');
      console.error('Available roles:');
      console.error('  - developer (highest privileges)');
      console.error('  - meeting_election_manager (open/close elections)');
      console.error('  - event_manager (event configuration)');
      console.error('  - member (regular member)');
      console.error('');
      console.error('Examples:');
      console.error('  node set-user-roles.js abc123xyz developer');
      console.error('  node set-user-roles.js --uid abc123xyz --add developer --remove member');
      process.exit(1);
    }

    // Validate roles
    validateRoles(parsed.add, parsed.remove);

    // Initialize admin early so we can support informative dry-run
    initAdmin(parsed.project);

    // Dry-run support (skip confirmations in dry-run)
    if (parsed.dryRun) {
      try {
        const user = await admin.auth().getUser(parsed.uid);
        const currentClaims = user.customClaims || {};
        const existingRoles = Array.isArray(currentClaims.roles) ? currentClaims.roles : [];
        const rolesSet = new Set(existingRoles);
        (parsed.add || []).forEach(r => rolesSet.add(r));
        (parsed.remove || []).forEach(r => rolesSet.delete(r));
        const mergedRoles = Array.from(rolesSet);

        console.log('🔍 DRY RUN MODE - No changes will be made');
        console.log('Current roles:', JSON.stringify(existingRoles));
        console.log('Would set roles to:', JSON.stringify(mergedRoles));
        console.log('Added:', JSON.stringify(parsed.add || []));
        console.log('Removed:', JSON.stringify(parsed.remove || []));
        process.exit(0);
      } catch (e) {
        console.error('Dry run failed to retrieve user:', e.message);
        process.exit(1);
      }
    }

    // Require confirmation if removing developer role
    if ((parsed.remove || []).includes('superuser')) {
      console.warn('⚠️  WARNING: You are about to remove the "superuser" role.');
      console.warn('This may revoke administrative access for the user.');
      const ans = await askConfirm('Type "CONFIRM" to proceed: ');
      if (ans !== 'CONFIRM') {
        console.error('Aborted: confirmation not provided.');
        process.exit(1);
      }
    }

    // Require confirmation if adding developer role
    if ((parsed.add || []).includes('superuser')) {
      console.warn('⚠️  WARNING: You are about to ADD the "superuser" role.');
      console.warn('This grants full administrative access in some environments.');
      const ans = await askConfirm('Type "CONFIRM" to proceed: ');
      if (ans !== 'CONFIRM') {
        console.error('Aborted: confirmation not provided.');
        process.exit(1);
      }
    }

    // Optional audit file path
    if (parsed.auditFile) {
      global.__SET_USER_ROLES_AUDIT_FILE__ = parsed.auditFile;
    }

    try {
      await setUserRoles(parsed.uid, parsed.add, parsed.remove);
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  })();
}

module.exports = { setUserRoles };
