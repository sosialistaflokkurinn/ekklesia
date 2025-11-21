/**
 * Fix Duplicate User - Merge roles from old UID to new UID
 * 
 * Usage: node fix-duplicate-user.js <old-uid> <new-uid>
 * Example: node fix-duplicate-user.js wElbKqQ8mLfYmxhpiUGAnv0vx2g1 NE5e8GpzzBcjxuTHWGuJtTfevPD2
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();
const auth = admin.auth();

async function fixDuplicateUser(oldUid, newUid) {
  console.log(`\n🔧 Merging user data from OLD to NEW UID...\n`);
  console.log(`   Old UID: ${oldUid}`);
  console.log(`   New UID: ${newUid}\n`);

  try {
    // 1. Get data from OLD UID
    console.log('1️⃣  Reading OLD UID data...');
    const oldDoc = await db.collection('users').doc(oldUid).get();
    
    if (!oldDoc.exists) {
      console.error('   ❌ Old UID does not exist in Firestore!');
      process.exit(1);
    }

    const oldData = oldDoc.data();
    console.log('   Old roles:', oldData.roles);
    
    const oldAuthUser = await auth.getUser(oldUid);
    const oldCustomClaims = oldAuthUser.customClaims || {};
    console.log('   Old Auth claims roles:', oldCustomClaims.roles);

    // 2. Get data from NEW UID
    console.log('\n2️⃣  Reading NEW UID data...');
    const newDoc = await db.collection('users').doc(newUid).get();
    
    if (!newDoc.exists) {
      console.error('   ❌ New UID does not exist in Firestore!');
      process.exit(1);
    }

    const newData = newDoc.data();
    console.log('   New roles (before):', newData.roles);

    const newAuthUser = await auth.getUser(newUid);
    const newCustomClaims = newAuthUser.customClaims || {};
    console.log('   New Auth claims roles (before):', newCustomClaims.roles);

    // 3. Merge roles (use roles from OLD UID)
    const rolesToSet = oldData.roles || ['member'];
    
    console.log(`\n3️⃣  Merging roles...`);
    console.log(`   Will set roles to: ${JSON.stringify(rolesToSet)}`);

    // 4. Update Firestore /users/{newUid}
    console.log('\n4️⃣  Updating Firestore /users/ document...');
    await db.collection('users').doc(newUid).update({
      roles: rolesToSet,
      mergedFrom: oldUid,
      mergedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('   ✅ Firestore updated');

    // 5. Update Firebase Auth custom claims
    console.log('\n5️⃣  Updating Firebase Auth custom claims...');
    const updatedClaims = {
      ...newCustomClaims,
      roles: rolesToSet
    };
    await auth.setCustomUserClaims(newUid, updatedClaims);
    console.log('   ✅ Auth custom claims updated');

    // 6. Verify
    console.log('\n6️⃣  Verifying...');
    const verifyDoc = await db.collection('users').doc(newUid).get();
    const verifyData = verifyDoc.data();
    console.log('   Firestore roles:', verifyData.roles);

    const verifyAuthUser = await auth.getUser(newUid);
    const verifyCustomClaims = verifyAuthUser.customClaims || {};
    console.log('   Auth custom claims roles:', verifyCustomClaims.roles);

    // 7. Archive old UID (don't delete yet)
    console.log('\n7️⃣  Archiving old UID...');
    await db.collection('users').doc(oldUid).update({
      archived: true,
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
      replacedBy: newUid
    });
    console.log('   ✅ Old UID archived (not deleted)');

    console.log('\n✅ SUCCESS! User roles merged.');
    console.log('\n📋 Next steps:');
    console.log('   1. User needs to LOG OUT');
    console.log('   2. User needs to LOG IN again');
    console.log('   3. New token will have admin/superuser roles');
    console.log('\n⚠️  Note: Old UID is archived but not deleted (for safety)');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get UIDs from command line
const oldUid = process.argv[2];
const newUid = process.argv[3];

if (!oldUid || !newUid) {
  console.error('❌ Usage: node fix-duplicate-user.js <old-uid> <new-uid>');
  console.error('   Example: node fix-duplicate-user.js wElbKqQ8mLfYmxhpiUGAnv0vx2g1 NE5e8GpzzBcjxuTHWGuJtTfevPD2');
  process.exit(1);
}

fixDuplicateUser(oldUid, newUid).then(() => process.exit(0));
