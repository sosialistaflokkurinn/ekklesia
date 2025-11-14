/**
 * Safety Check - Verify old UID can be safely deleted
 * 
 * Usage: node safety-check-old-uid.js <old-uid>
 * Example: node safety-check-old-uid.js wElbKqQ8mLfYmxhpiUGAnv0vx2g1
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();

async function safetyCheck(oldUid) {
  console.log(`\n🔍 Safety check for OLD UID: ${oldUid}\n`);

  const findings = [];
  let canDelete = true;

  try {
    // 1. Check /users/ collection
    console.log('1️⃣  Checking /users/ collection...');
    const userDoc = await db.collection('users').doc(oldUid).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      findings.push(`   ✅ Found in /users/ - archived: ${data.archived}, replacedBy: ${data.replacedBy}`);
      
      if (!data.archived || !data.replacedBy) {
        findings.push(`   ⚠️  WARNING: Not properly archived!`);
        canDelete = false;
      }
    } else {
      findings.push(`   ℹ️  Not found in /users/`);
    }

    // 2. Check /members/ collection (by kennitala)
    console.log('\n2️⃣  Checking /members/ collection...');
    if (userDoc.exists) {
      const kennitala = userDoc.data().kennitala;
      if (kennitala) {
        const normalizedKennitala = kennitala.replace(/-/g, '');
        const memberDoc = await db.collection('members').doc(normalizedKennitala).get();
        if (memberDoc.exists) {
          findings.push(`   ✅ Found member record for kennitala: ${kennitala.substring(0, 6)}****`);
          findings.push(`   ℹ️  Member data is indexed by kennitala, NOT UID - safe to delete UID`);
        } else {
          findings.push(`   ℹ️  No member record found`);
        }
      }
    }

    // 3. Check for any subcollections under /users/{oldUid}/
    console.log('\n3️⃣  Checking for subcollections under /users/...');
    const userRef = db.collection('users').doc(oldUid);
    const collections = await userRef.listCollections();
    if (collections.length > 0) {
      findings.push(`   ⚠️  WARNING: Found ${collections.length} subcollections:`);
      collections.forEach(col => {
        findings.push(`      - ${col.id}`);
      });
      canDelete = false;
    } else {
      findings.push(`   ✅ No subcollections found`);
    }

    // 4. Check members_audit_log
    console.log('\n4️⃣  Checking members_audit_log...');
    const auditQuery = await db.collection('members_audit_log')
      .where('userId', '==', oldUid)
      .limit(1)
      .get();
    
    if (!auditQuery.empty) {
      findings.push(`   ℹ️  Found audit logs with this UID`);
      findings.push(`   ✅ Audit logs should be preserved (keep archived document for reference)`);
      canDelete = false;  // Keep for audit trail
    } else {
      findings.push(`   ✅ No audit logs found`);
    }

    // 5. Check sync_queue
    console.log('\n5️⃣  Checking sync_queue...');
    const syncQuery = await db.collection('sync_queue')
      .where('userId', '==', oldUid)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    
    if (!syncQuery.empty) {
      findings.push(`   ⚠️  WARNING: Found pending sync queue items!`);
      canDelete = false;
    } else {
      findings.push(`   ✅ No pending sync queue items`);
    }

    // Print findings
    console.log('\n📋 Findings:\n');
    findings.forEach(f => console.log(f));

    // Recommendation
    console.log('\n\n🎯 Recommendation:\n');
    if (canDelete) {
      console.log('   ⚠️  STILL RECOMMENDED: Keep archived for 30 days');
      console.log('   - Archive date will be in document');
      console.log('   - Provides rollback option if issues arise');
      console.log('   - Can safely delete after 30 days if no issues');
    } else {
      console.log('   ❌ DO NOT DELETE YET');
      console.log('   - Resolve warnings above first');
      console.log('   - Or keep archived indefinitely for audit trail');
    }

    console.log('\n💡 To delete later (after 30 days):');
    console.log(`   firebase firestore:delete /users/${oldUid}`);
    console.log(`   OR`);
    console.log(`   node delete-archived-user.js ${oldUid}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Get UID from command line
const oldUid = process.argv[2];

if (!oldUid) {
  console.error('❌ Usage: node safety-check-old-uid.js <old-uid>');
  console.error('   Example: node safety-check-old-uid.js wElbKqQ8mLfYmxhpiUGAnv0vx2g1');
  process.exit(1);
}

safetyCheck(oldUid).then(() => process.exit(0));
