const crypto = require('crypto');

/**
 * Elections Service S2S Client
 * Server-to-server communication with Elections service
 */

const ELECTIONS_SERVICE_URL = process.env.ELECTIONS_SERVICE_URL || 'https://elections-service-521240388393.europe-west2.run.app';
const S2S_API_KEY = process.env.S2S_API_KEY;

/**
 * Register a voting token with Elections service
 * @param {string} tokenHash - SHA-256 hash of the voting token
 * @returns {Promise<Object>} Registration result
 */
async function registerToken(tokenHash) {
  if (!S2S_API_KEY) {
    throw new Error('S2S_API_KEY not configured');
  }

  console.log(`[Elections S2S] Registering token hash: ${tokenHash.substring(0, 8)}...`);

  try {
    const response = await fetch(`${ELECTIONS_SERVICE_URL}/api/s2s/register-token`, {
      method: 'POST',
      headers: {
        'X-API-Key': S2S_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token_hash: tokenHash })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Elections S2S] Registration failed:', response.status, data);
      throw new Error(`Elections service registration failed: ${data.message || response.statusText}`);
    }

    console.log('[Elections S2S] Token registered successfully');
    return data;
  } catch (error) {
    console.error('[Elections S2S] Registration error:', error);
    throw new Error(`Failed to register token with Elections service: ${error.message}`);
  }
}

/**
 * Fetch election results from Elections service
 * @returns {Promise<Object>} Election results
 */
async function fetchResults() {
  if (!S2S_API_KEY) {
    throw new Error('S2S_API_KEY not configured');
  }

  console.log('[Elections S2S] Fetching results');

  try {
    const response = await fetch(`${ELECTIONS_SERVICE_URL}/api/s2s/results`, {
      method: 'GET',
      headers: {
        'X-API-Key': S2S_API_KEY
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Elections S2S] Fetch results failed:', response.status, data);
      throw new Error(`Elections service results fetch failed: ${data.message || response.statusText}`);
    }

    console.log('[Elections S2S] Results fetched successfully');
    return data;
  } catch (error) {
    console.error('[Elections S2S] Fetch results error:', error);
    throw new Error(`Failed to fetch results from Elections service: ${error.message}`);
  }
}

module.exports = {
  registerToken,
  fetchResults
};
