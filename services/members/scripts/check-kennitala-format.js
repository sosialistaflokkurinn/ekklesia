// Check how many Firestore users have hyphens in kennitala field
// This script is READ-ONLY (no writes)

const admin = require('firebase-admin');

// Initialize with default credentials
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();

async function checkKennitalaFormats() {
  console.log('🔍 Checking kennitala formats in /users/ collection...\n');

  const usersSnapshot = await db.collection('users').get();

  let withHyphen = [];
  let withoutHyphen = [];
  let invalid = [];

  usersSnapshot.forEach(doc => {
    const data = doc.data();
    const kennitala = data.kennitala;

    if (!kennitala) {
      invalid.push({ uid: doc.id, fullName: data.fullName, reason: 'Missing kennitala' });
      return;
    }

    if (kennitala.includes('-')) {
      withHyphen.push({
        uid: doc.id,
        kennitala: kennitala,
        fullName: data.fullName,
        createdAt: data.createdAt ? data.createdAt.toDate() : null
      });
    } else if (/^\d{10}$/.test(kennitala)) {
      withoutHyphen.push({
        uid: doc.id,
        kennitala: kennitala,
        fullName: data.fullName,
        createdAt: data.createdAt ? data.createdAt.toDate() : null
      });
    } else {
      invalid.push({
        uid: doc.id,
        kennitala: kennitala,
        fullName: data.fullName,
        reason: 'Invalid format'
      });
    }
  });

  console.log(`📊 Results:`);
  console.log(`   Total users: ${usersSnapshot.size}`);
  console.log(`   ✅ Correct format (no hyphen): ${withoutHyphen.length}`);
  console.log(`   ❌ Incorrect format (with hyphen): ${withHyphen.length}`);
  console.log(`   ⚠️  Invalid: ${invalid.length}`);
  console.log('');

  if (withHyphen.length > 0) {
    console.log('❌ Users with HYPHEN in kennitala (need migration):');
    withHyphen.forEach(u => {
      const createdStr = u.createdAt ? u.createdAt.toISOString() : 'unknown';
      console.log(`   - ${u.fullName} (${u.kennitala}) - Created: ${createdStr}`);
      console.log(`     UID: ${u.uid}`);
    });
    console.log('');
  }

  if (invalid.length > 0) {
    console.log('⚠️  Invalid kennitala formats:');
    invalid.forEach(u => {
      console.log(`   - ${u.fullName}: ${u.reason}`);
      if (u.kennitala) console.log(`     Value: "${u.kennitala}"`);
    });
  }

  // Check for potential duplicates
  const kennitalaNormalized = new Map();
  [...withHyphen, ...withoutHyphen].forEach(u => {
    const normalized = u.kennitala.replace('-', '');
    if (!kennitalaNormalized.has(normalized)) {
      kennitalaNormalized.set(normalized, []);
    }
    kennitalaNormalized.get(normalized).push(u);
  });

  const duplicates = Array.from(kennitalaNormalized.entries())
    .filter(([_, users]) => users.length > 1);

  if (duplicates.length > 0) {
    console.log('');
    console.log('🚨 DUPLICATE USERS DETECTED:');
    duplicates.forEach(([normalized, users]) => {
      console.log(`\n   Kennitala: ${normalized}`);
      users.forEach(u => {
        const createdStr = u.createdAt ? u.createdAt.toISOString() : 'unknown';
        console.log(`   - ${u.fullName} (${u.kennitala})`);
        console.log(`     UID: ${u.uid}`);
        console.log(`     Created: ${createdStr}`);
      });
    });
  }
}

checkKennitalaFormats()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
