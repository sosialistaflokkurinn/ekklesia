#!/usr/bin/env node
/**
 * Test Member Assistant RAG API
 *
 * Tests the RAG-powered member assistant with common questions.
 *
 * Usage:
 *   node scripts/test-member-assistant.js
 *
 * Requires:
 *   - FIREBASE_TEST_EMAIL and FIREBASE_TEST_PASSWORD env vars, OR
 *   - Running against local service with auth disabled
 */

const axios = require('axios');

// Configuration
const API_KEY = 'AIzaSyBsDqnt8G54VAANlucQpI20r3Sw1p2Bcp4';
const SERVICE_URL = process.env.SERVICE_URL || 'https://events-service-521240388393.europe-west1.run.app';
const TEST_EMAIL = process.env.FIREBASE_TEST_EMAIL;
const TEST_PASSWORD = process.env.FIREBASE_TEST_PASSWORD;

// Test questions (common member questions)
const TEST_QUESTIONS = [
  'Hver er stefna flokksins í húsnæðismálum?',
  'Hvað segir flokkurinn um skatta?',
  'Hvernig er lýðræði í flokknum?',
  'Hvað segir flokkurinn um heilbrigðismál?',
  'Hverjir voru frambjóðendur flokksins 2024?',
];

/**
 * Get Firebase ID token via REST API
 */
async function getFirebaseToken() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.log('⚠️  No test credentials - testing without auth');
    return null;
  }

  try {
    const response = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        returnSecureToken: true,
      }
    );
    console.log('✅ Firebase auth successful');
    return response.data.idToken;
  } catch (error) {
    console.error('❌ Firebase auth failed:', error.response?.data?.error?.message || error.message);
    return null;
  }
}

/**
 * Test a single question
 */
async function testQuestion(question, token, index) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📝 Spurning ${index + 1}: ${question}`);
  console.log('='.repeat(60));

  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const startTime = Date.now();
    const response = await axios.post(
      `${SERVICE_URL}/api/member-assistant/chat`,
      { message: question },
      { headers, timeout: 60000 }
    );
    const elapsed = Date.now() - startTime;

    console.log(`\n⏱️  Tími: ${elapsed}ms`);
    console.log(`\n💬 Svar:\n${response.data.reply}`);

    if (response.data.citations?.length > 0) {
      console.log(`\n📚 Heimildir (${response.data.citations.length}):`);
      for (const cite of response.data.citations) {
        const similarity = cite.similarity ? ` (${(cite.similarity * 100).toFixed(1)}%)` : '';
        console.log(`   - [${cite.type}] ${cite.title}${similarity}`);
        if (cite.who) console.log(`     Hver: ${cite.who}`);
        if (cite.when) console.log(`     Hvenær: ${cite.when}`);
        if (cite.context) console.log(`     Samhengi: ${cite.context}`);
      }
    }

    return { success: true, elapsed };
  } catch (error) {
    console.error(`\n❌ Villa: ${error.response?.data?.message || error.message}`);
    if (error.response?.status === 401) {
      console.log('   → Þarf auðkenningu. Stilltu FIREBASE_TEST_EMAIL og FIREBASE_TEST_PASSWORD.');
    }
    return { success: false, error: error.message };
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('🤖 Member Assistant RAG Test');
  console.log('='.repeat(60));
  console.log(`   Service: ${SERVICE_URL}`);
  console.log(`   Questions: ${TEST_QUESTIONS.length}`);

  // Get auth token if credentials provided
  const token = await getFirebaseToken();

  // Test each question
  const results = [];
  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const result = await testQuestion(TEST_QUESTIONS[i], token, i);
    results.push(result);

    // Small delay between questions
    if (i < TEST_QUESTIONS.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Samantekt');
  console.log('='.repeat(60));
  const successful = results.filter(r => r.success).length;
  const avgTime = results.filter(r => r.elapsed).reduce((a, b) => a + b.elapsed, 0) / successful || 0;
  console.log(`   Árangur: ${successful}/${results.length}`);
  console.log(`   Meðaltími: ${avgTime.toFixed(0)}ms`);
}

main().catch(console.error);
