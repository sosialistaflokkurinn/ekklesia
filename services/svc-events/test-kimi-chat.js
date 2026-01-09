/**
 * Test script for Kimi chat API using Firebase Admin SDK
 * Usage: FIREBASE_API_KEY=xxx node test-kimi-chat.js "Your question here"
 *
 * Prerequisites:
 * - gcloud auth application-default login
 * - Service account needs iam.serviceAccounts.signBlob permission
 */

const admin = require('firebase-admin');

const PROJECT_ID = 'ekklesia-prod-10-2025';
const SERVICE_ACCOUNT = `firebase-adminsdk-fbsvc@${PROJECT_ID}.iam.gserviceaccount.com`;

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
    serviceAccountId: SERVICE_ACCOUNT
  });
}

const CHAT_API = 'https://events-service-521240388393.europe-west1.run.app/api/kimi/chat';
const SUPERUSER_UID = process.env.SUPERUSER_UID || 'NE5e8GpzzBcjxuTHWGuJtTfevPD2';

async function ensureSuperuserClaims(uid) {
  // Set custom claims on the user to include 'superuser' role
  // This is read by the auth middleware as decodedToken.roles
  const currentClaims = (await admin.auth().getUser(uid)).customClaims || {};

  if (!currentClaims.roles || !currentClaims.roles.includes('superuser')) {
    const roles = currentClaims.roles || [];
    if (!roles.includes('superuser')) {
      roles.push('superuser');
    }
    await admin.auth().setCustomUserClaims(uid, { ...currentClaims, roles });
    console.log('✅ Custom claims updated - roles:', roles);
    return true; // Claims were updated
  }
  return false; // No changes needed
}

async function getIdToken(uid) {
  // Create custom token
  const customToken = await admin.auth().createCustomToken(uid);

  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) {
    throw new Error('FIREBASE_API_KEY environment variable required');
  }

  // Exchange custom token for ID token
  const response = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: customToken,
        returnSecureToken: true
      })
    }
  );

  const data = await response.json();
  if (data.error) {
    throw new Error('Auth error: ' + data.error.message);
  }
  return data.idToken;
}

async function chat(message, idToken) {
  const response = await fetch(CHAT_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + idToken
    },
    body: JSON.stringify({ message })
  });

  return response.json();
}

async function main() {
  const question = process.argv[2] || 'Hvað eru margir félagar?';

  console.log('🔧 Checking user claims for UID:', SUPERUSER_UID);
  const claimsUpdated = await ensureSuperuserClaims(SUPERUSER_UID);

  if (claimsUpdated) {
    console.log('⚠️  Claims were updated. Getting new token...');
  }

  console.log('🔐 Getting ID token...');
  const idToken = await getIdToken(SUPERUSER_UID);
  console.log('✅ Token obtained\n');

  console.log('❓ Question: ' + question + '\n');
  console.log('⏳ Waiting for response...\n');

  const result = await chat(question, idToken);

  if (result.error) {
    console.error('❌ Error:', result.message);
    if (result.correlation_id) {
      console.error('   Correlation ID:', result.correlation_id);
    }
  } else {
    console.log('🤖 Reply:\n');
    console.log(result.reply);
    console.log('\n📊 Model: ' + (result.modelName || result.model));
  }
}

main().catch(console.error);
