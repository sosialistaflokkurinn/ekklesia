#!/usr/bin/env node
/**
 * Concurrent Authentication Test (Issue #32)
 * 
 * Tests idempotency of user creation under concurrent authentication attempts.
 * Simulates 5 simultaneous authentication requests with same kennitala.
 * 
 * Expected: Only 1 user document created in Firestore
 * Implementation: Firestore transactions prevent race conditions
 */

const fetch = require('node-fetch');

// Configuration
const AUTH_ENDPOINT = process.env.AUTH_ENDPOINT || 'https://handlekenniauth-ekklesia-prod-10-2025-521240388393.europe-west2.run.app';
const TEST_KENNITALA = process.env.TEST_KENNITALA || '010190-2929'; // Test kennitala
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS || '5', 10);

// Mock OAuth code (would need real code from Kenni.is in production test)
const MOCK_AUTH_CODE = 'test_auth_code_' + Date.now();
const MOCK_PKCE_VERIFIER = 'test_verifier_' + Math.random().toString(36);

/**
 * Send authentication request to handleKenniAuth
 */
async function authenticateUser(requestId) {
  const startTime = Date.now();
  
  try {
    console.log(`[Request ${requestId}] Starting authentication attempt...`);
    
    const response = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': `concurrent-test-${requestId}-${Date.now()}`
      },
      body: JSON.stringify({
        kenniAuthCode: MOCK_AUTH_CODE,
        pkceCodeVerifier: MOCK_PKCE_VERIFIER
      })
    });

    const duration = Date.now() - startTime;
    const status = response.status;
    
    let result;
    try {
      result = await response.json();
    } catch (e) {
      result = { error: 'PARSE_ERROR', text: await response.text() };
    }

    console.log(`[Request ${requestId}] Completed in ${duration}ms - Status: ${status}`);
    
    return {
      requestId,
      status,
      duration,
      success: response.ok,
      result
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Request ${requestId}] Failed after ${duration}ms:`, error.message);
    
    return {
      requestId,
      status: 0,
      duration,
      success: false,
      error: error.message
    };
  }
}

/**
 * Run concurrent authentication test
 */
async function runConcurrentTest() {
  console.log('='.repeat(60));
  console.log('CONCURRENT AUTHENTICATION TEST (Issue #32)');
  console.log('='.repeat(60));
  console.log(`Endpoint: ${AUTH_ENDPOINT}`);
  console.log(`Test Kennitala: ${TEST_KENNITALA.slice(0, 7)}****`);
  console.log(`Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  console.log();

  // Create array of promises for concurrent execution
  const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) => 
    authenticateUser(i + 1)
  );

  console.log(`Launching ${CONCURRENT_REQUESTS} concurrent requests...`);
  const startTime = Date.now();

  // Execute all requests concurrently
  const results = await Promise.all(promises);
  
  const totalDuration = Date.now() - startTime;

  console.log();
  console.log('='.repeat(60));
  console.log('TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log();

  // Analyze results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const statusCodes = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  console.log('Summary:');
  console.log(`  Successful: ${successful.length}/${CONCURRENT_REQUESTS}`);
  console.log(`  Failed: ${failed.length}/${CONCURRENT_REQUESTS}`);
  console.log();

  console.log('Status Codes:');
  Object.entries(statusCodes).forEach(([code, count]) => {
    console.log(`  ${code}: ${count} requests`);
  });
  console.log();

  console.log('Individual Results:');
  results.forEach(r => {
    const emoji = r.success ? '✅' : '❌';
    console.log(`  ${emoji} Request ${r.requestId}: ${r.status} (${r.duration}ms)`);
    if (r.result?.uid) {
      console.log(`     └─ UID: ${r.result.uid}`);
    }
    if (r.error) {
      console.log(`     └─ Error: ${r.error}`);
    }
  });

  console.log();
  console.log('='.repeat(60));
  console.log('EXPECTED BEHAVIOR (Idempotency Test)');
  console.log('='.repeat(60));
  console.log('✅ PASS: Only 1 user created (all requests return same UID)');
  console.log('✅ PASS: Some requests succeed, others get "user already exists"');
  console.log('✅ PASS: No database corruption or duplicate users');
  console.log('❌ FAIL: Multiple different UIDs returned');
  console.log('❌ FAIL: Firestore contains duplicate user documents');
  console.log();

  // Check if all successful requests returned same UID
  const uids = successful
    .map(r => r.result?.uid)
    .filter(Boolean);
  
  const uniqueUids = [...new Set(uids)];

  console.log('='.repeat(60));
  console.log('IDEMPOTENCY CHECK');
  console.log('='.repeat(60));
  
  if (uniqueUids.length === 0) {
    console.log('⚠️  WARNING: No UIDs returned (possible test configuration issue)');
    console.log('    This test requires a real OAuth code from Kenni.is');
  } else if (uniqueUids.length === 1) {
    console.log('✅ PASS: All requests returned same UID');
    console.log(`   UID: ${uniqueUids[0]}`);
    console.log('   Result: Firestore transactions prevented duplicate users');
  } else {
    console.log('❌ FAIL: Multiple UIDs returned - race condition detected!');
    console.log(`   Unique UIDs: ${uniqueUids.length}`);
    uniqueUids.forEach((uid, i) => {
      console.log(`   UID ${i + 1}: ${uid}`);
    });
    console.log('   Result: Firestore transactions NOT working correctly');
  }

  console.log('='.repeat(60));
  console.log();

  // Next steps
  console.log('NEXT STEPS:');
  console.log('1. Check Firestore users collection for duplicate documents');
  console.log('2. Verify Cloud Function logs for race condition handling');
  console.log('3. If test shows PASS: Document results in issue #32');
  console.log('4. If test shows FAIL: Reopen issue #32 and fix race condition');
  console.log();

  return {
    totalRequests: CONCURRENT_REQUESTS,
    successful: successful.length,
    failed: failed.length,
    uniqueUids: uniqueUids.length,
    pass: uniqueUids.length === 1,
    duration: totalDuration
  };
}

// Run test if executed directly
if (require.main === module) {
  runConcurrentTest()
    .then(results => {
      console.log('Test completed');
      process.exit(results.pass ? 0 : 1);
    })
    .catch(error => {
      console.error('Test failed with error:', error);
      process.exit(1);
    });
}

module.exports = { runConcurrentTest, authenticateUser };
