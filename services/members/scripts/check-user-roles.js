/**
 * Check User Roles Diagnostic Script
 * 
 * Usage: node check-user-roles.js <uid>
 * Example: node check-user-roles.js wElbKqQ8mLfYmxhpiUGAnv0vx2g1
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();
const auth = admin.auth();

async function checkUserRoles(uid) {
  console.log(`\n🔍 Checking roles for UID: ${uid}\n`);

  try {
    // 1. Check Firebase Auth custom claims
    console.log('1️⃣  Firebase Auth Custom Claims:');
    const user = await auth.getUser(uid);
    const customClaims = user.customClaims || {};
    console.log('   ', JSON.stringify(customClaims, null, 2));
    console.log('   Roles:', customClaims.roles || 'NOT SET');

    // 2. Check Firestore /users/ collection
    console.log('\n2️⃣  Firestore /users/ document:');
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('   Roles:', userData.roles || 'NOT SET');
      console.log('   Full document:', JSON.stringify(userData, null, 2));
    } else {
      console.log('   ⚠️  Document does NOT exist!');
    }

    // 3. Summary
    console.log('\n📊 Summary:');
    const authRoles = customClaims.roles || [];
    const firestoreRoles = userDoc.exists ? (userDoc.data().roles || []) : [];
    
    console.log('   Auth roles:      ', JSON.stringify(authRoles));
    console.log('   Firestore roles: ', JSON.stringify(firestoreRoles));
    
    if (JSON.stringify(authRoles) === JSON.stringify(firestoreRoles)) {
      console.log('   ✅ MATCH - Roles are synchronized');
    } else {
      console.log('   ❌ MISMATCH - Roles are out of sync!');
      console.log('   🔧 Action: User needs to log out and log in again');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get UID from command line
const uid = process.argv[2];

if (!uid) {
  console.error('❌ Usage: node check-user-roles.js <uid>');
  console.error('   Example: node check-user-roles.js wElbKqQ8mLfYmxhpiUGAnv0vx2g1');
  process.exit(1);
}

checkUserRoles(uid).then(() => process.exit(0));
