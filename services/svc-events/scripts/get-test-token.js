#!/usr/bin/env node
/**
 * Get Firebase ID Token for Testing
 *
 * Uses Firebase Admin SDK to create a custom token, then exchanges it for an ID token.
 *
 * Usage:
 *   node scripts/get-test-token.js
 */

const admin = require('firebase-admin');
const axios = require('axios');

const API_KEY = 'AIzaSyBsDqnt8G54VAANlucQpI20r3Sw1p2Bcp4';
const TEST_UID = 'test-rag-user';

async function main() {
  // Initialize Admin SDK with application default credentials
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: 'ekklesia-prod-10-2025',
    });
  }

  try {
    console.log('🔑 Creating custom token...');
    const customToken = await admin.auth().createCustomToken(TEST_UID, {
      role: 'member',
    });

    console.log('🔄 Exchanging for ID token...');
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
      {
        token: customToken,
        returnSecureToken: true,
      }
    );

    console.log('\n✅ ID Token (copy this):');
    console.log(response.data.idToken);

    // Also save to env for other scripts
    console.log('\n📝 Or run:');
    console.log(`export FIREBASE_ID_TOKEN="${response.data.idToken}"`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'app/no-app') {
      console.log('💡 Run: gcloud auth application-default login');
    }
  }
}

main();
