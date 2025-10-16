#!/usr/bin/env node
/**
 * Set User Roles
 *
 * Helper script to assign roles to users via Firebase custom claims.
 *
 * Usage:
 *   node set-user-roles.js <UID> <role1> [role2] [role3]
 *
 * Example:
 *   node set-user-roles.js abc123xyz developer
 *   node set-user-roles.js def456uvw meeting_election_manager member
 *
 * Requirements:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var set (service account)
 *   - Or running in Cloud environment with default credentials
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin (uses default credentials or GOOGLE_APPLICATION_CREDENTIALS)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'ekklesia-prod-10-2025'
  });
}

async function setUserRoles(uid, newRoles) {
  try {
    // Get current user
    const user = await admin.auth().getUser(uid);
    console.log(`Current user: ${user.email || user.uid}`);

    // Get current custom claims
    const currentClaims = user.customClaims || {};
    console.log('Current claims:', JSON.stringify(currentClaims, null, 2));

    // Merge roles (preserve existing roles + add new ones)
    const existingRoles = Array.isArray(currentClaims.roles) ? currentClaims.roles : [];
    const mergedRoles = Array.from(new Set([...existingRoles, ...newRoles]));

    // Set new claims (preserve kennitala, isMember, etc.)
    const newClaims = {
      ...currentClaims,
      roles: mergedRoles
    };

    await admin.auth().setCustomUserClaims(uid, newClaims);

    console.log('\n✅ Roles updated successfully!');
    console.log('New claims:', JSON.stringify(newClaims, null, 2));
    console.log('\nℹ️  User must sign out and sign back in for roles to take effect.');

    return newClaims;
  } catch (error) {
    console.error('❌ Error setting roles:', error.message);
    throw error;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: node set-user-roles.js <UID> <role1> [role2] ...');
    console.error('');
    console.error('Available roles:');
    console.error('  - developer (highest privileges)');
    console.error('  - meeting_election_manager (open/close elections)');
    console.error('  - event_manager (event configuration)');
    console.error('  - member (regular member)');
    console.error('');
    console.error('Example:');
    console.error('  node set-user-roles.js abc123xyz developer');
    process.exit(1);
  }

  const [uid, ...roles] = args;

  // Validate roles
  const validRoles = ['developer', 'meeting_election_manager', 'event_manager', 'member'];
  const invalidRoles = roles.filter(r => !validRoles.includes(r));

  if (invalidRoles.length > 0) {
    console.error(`❌ Invalid roles: ${invalidRoles.join(', ')}`);
    console.error(`Valid roles: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  setUserRoles(uid, roles)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { setUserRoles };
