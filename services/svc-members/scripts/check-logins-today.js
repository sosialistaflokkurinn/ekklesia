#!/usr/bin/env node
/**
 * Check user logins from Firestore
 * Usage: node check-logins-today.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();

async function checkLoginsToday() {
  try {
    // Get start of today (Iceland time UTC+0)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`🔍 Athuga innskráningar frá ${today.toISOString()}`);
    console.log('');

    // Query users collection for users who logged in today
    const usersRef = db.collection('users');
    const snapshot = await usersRef
      .where('lastLogin', '>=', admin.firestore.Timestamp.fromDate(today))
      .orderBy('lastLogin', 'desc')
      .get();

    if (snapshot.empty) {
      console.log('❌ Engir notendur hafa skráð sig inn í dag');

      // Show last 10 logins instead
      console.log('');
      console.log('📊 Síðustu 10 innskráningar:');
      console.log('');

      const recentSnapshot = await usersRef
        .orderBy('lastLogin', 'desc')
        .limit(10)
        .get();

      if (recentSnapshot.empty) {
        console.log('Engar innskráningar fundust');
      } else {
        recentSnapshot.forEach(doc => {
          const data = doc.data();
          const loginDate = data.lastLogin ? data.lastLogin.toDate() : null;
          console.log(`- ${data.fullName || 'Nafnlaus'} (${data.kennitala || 'engin kt'})`);
          console.log(`  Síðast inn: ${loginDate ? loginDate.toISOString() : 'aldrei'}`);
          console.log(`  Email: ${data.email || 'engin'}`);
          console.log('');
        });
      }

      return;
    }

    console.log(`✅ ${snapshot.size} notandi/notendur skráðu sig inn í dag:`);
    console.log('');

    snapshot.forEach(doc => {
      const data = doc.data();
      const loginDate = data.lastLogin.toDate();

      console.log(`- ${data.fullName || 'Nafnlaus'} (${data.kennitala || 'engin kt'})`);
      console.log(`  Innskráning: ${loginDate.toLocaleString('is-IS')}`);
      console.log(`  Email: ${data.email || 'engin'}`);
      console.log(`  Sími: ${data.phoneNumber || 'enginn'}`);
      console.log(`  Félagsmaður: ${data.isMember ? 'Já' : 'Nei'}`);
      console.log('');
    });

    // Summary statistics
    console.log('---');
    console.log(`📊 Samantekt: ${snapshot.size} innskráningar í dag`);

  } catch (error) {
    console.error('❌ Villa:', error.message);
    process.exit(1);
  }
}

checkLoginsToday()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Villa:', error);
    process.exit(1);
  });
