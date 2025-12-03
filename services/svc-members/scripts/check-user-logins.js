#!/usr/bin/env node
/**
 * Check user logins from Firestore
 *
 * Usage:
 *   node check-user-logins.js              # Innskráningar í dag
 *   node check-user-logins.js --days 7     # Síðustu 7 daga
 *   node check-user-logins.js --date 2025-11-01  # Tiltekinn dagur
 *   node check-user-logins.js --latest 20  # Síðustu 20 innskráningar
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: 'today',
    days: 1,
    date: null,
    latest: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      options.mode = 'days';
      options.days = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--date' && args[i + 1]) {
      options.mode = 'date';
      options.date = new Date(args[i + 1]);
      i++;
    } else if (args[i] === '--latest' && args[i + 1]) {
      options.mode = 'latest';
      options.latest = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Notkun:
  node check-user-logins.js              # Innskráningar í dag
  node check-user-logins.js --days 7     # Síðustu 7 daga
  node check-user-logins.js --date 2025-11-01  # Tiltekinn dagur
  node check-user-logins.js --latest 20  # Síðustu 20 innskráningar
      `);
      process.exit(0);
    }
  }

  return options;
}

async function checkLogins(options) {
  try {
    let query = db.collection('users');
    let headerText = '';

    if (options.mode === 'latest') {
      headerText = `🔍 Síðustu ${options.latest} innskráningar`;
      query = query.orderBy('lastLogin', 'desc').limit(options.latest);
    } else if (options.mode === 'days') {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - options.days);
      startDate.setHours(0, 0, 0, 0);
      headerText = `🔍 Innskráningar síðustu ${options.days} daga (frá ${startDate.toISOString()})`;
      query = query
        .where('lastLogin', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .orderBy('lastLogin', 'desc');
    } else if (options.mode === 'date') {
      const startDate = new Date(options.date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(options.date);
      endDate.setHours(23, 59, 59, 999);
      headerText = `🔍 Innskráningar ${startDate.toLocaleDateString('is-IS')}`;
      query = query
        .where('lastLogin', '>=', admin.firestore.Timestamp.fromDate(startDate))
        .where('lastLogin', '<=', admin.firestore.Timestamp.fromDate(endDate))
        .orderBy('lastLogin', 'desc');
    } else {
      // Today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      headerText = `🔍 Innskráningar í dag (${today.toLocaleDateString('is-IS')})`;
      query = query
        .where('lastLogin', '>=', admin.firestore.Timestamp.fromDate(today))
        .orderBy('lastLogin', 'desc');
    }

    console.log(headerText);
    console.log('');

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('❌ Engar innskráningar fundust');
      return;
    }

    console.log(`✅ ${snapshot.size} innskráning${snapshot.size === 1 ? '' : 'ar'}:`);
    console.log('');

    let count = 0;
    snapshot.forEach((doc) => {
      count++;
      const data = doc.data();
      const loginDate = data.lastLogin ? data.lastLogin.toDate() : null;

      console.log(`${count}. ${data.fullName || 'Nafnlaus'} (${data.kennitala || 'engin kt'})`);
      console.log(`   Innskráning: ${loginDate ? loginDate.toLocaleString('is-IS') : 'aldrei'}`);
      console.log(`   Email: ${data.email || 'engin'}`);
      console.log(`   Sími: ${data.phoneNumber || 'enginn'}`);
      console.log(`   Félagsmaður: ${data.isMember ? 'Já' : 'Nei'}`);
      if (data.roles && data.roles.length > 0) {
        console.log(`   Hlutverk: ${data.roles.join(', ')}`);
      }
      console.log('');
    });

    console.log('---');
    console.log(`📊 Samtals: ${snapshot.size} innskráning${snapshot.size === 1 ? '' : 'ar'}`);

  } catch (error) {
    console.error('❌ Villa:', error.message);
    if (error.code === 9) {
      console.error('');
      console.error('💡 Ábending: Þú þarft að búa til index í Firestore fyrir þessa fyrirspurn.');
      console.error('   Keyrðu: firebase deploy --only firestore:indexes');
    }
    process.exit(1);
  }
}

const options = parseArgs();
checkLogins(options)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Villa:', error);
    process.exit(1);
  });
