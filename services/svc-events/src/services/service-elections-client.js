const crypto = require('crypto');
const logger = require('../utils/util-logger');

/**
 * Elections Service S2S Client
 * Server-to-server communication with Elections service
 */

const ELECTIONS_SERVICE_URL = process.env.ELECTIONS_SERVICE_URL || 'https://elections-service-521240388393.europe-west2.run.app';
const S2S_API_KEY = process.env.S2S_API_KEY;

// Security: Timeout for S2S calls
const S2S_TIMEOUT = 30000; // 30 seconds

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), S2S_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Register a voting token with Elections service
 * @param {string} tokenHash - SHA-256 hash of the voting token
 * @returns {Promise<Object>} Registration result
 */
async function registerToken(tokenHash) {
  if (!S2S_API_KEY) {
    throw new Error('S2S_API_KEY not configured');
  }

  logger.info('Registering token with Elections service', {
    operation: 's2s_register_token',
    service: 'elections'
  });

  try {
    const response = await fetchWithTimeout(`${ELECTIONS_SERVICE_URL}/api/s2s/register-token`, {
      method: 'POST',
      headers: {
        'X-API-Key': S2S_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token_hash: tokenHash })
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('Elections service registration failed', {
        operation: 's2s_register_token',
        service: 'elections',
        status: response.status,
        error: data.message || response.statusText
      });
      throw new Error(`Elections service registration failed: ${data.message || response.statusText}`);
    }

    logger.info('Token registered successfully with Elections service', {
      operation: 's2s_register_token',
      service: 'elections'
    });
    return data;
  } catch (error) {
    logger.error('Elections service registration error', {
      operation: 's2s_register_token',
      service: 'elections',
      error: error.message,
      stack: error.stack
    });
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

  logger.info('Fetching results from Elections service', {
    operation: 's2s_fetch_results',
    service: 'elections'
  });

  try {
    const response = await fetchWithTimeout(`${ELECTIONS_SERVICE_URL}/api/s2s/results`, {
      method: 'GET',
      headers: {
        'X-API-Key': S2S_API_KEY
      }
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('Elections service results fetch failed', {
        operation: 's2s_fetch_results',
        service: 'elections',
        status: response.status,
        error: data.message || response.statusText
      });
      throw new Error(`Elections service results fetch failed: ${data.message || response.statusText}`);
    }

    logger.info('Results fetched successfully from Elections service', {
      operation: 's2s_fetch_results',
      service: 'elections',
      total_ballots: data.total_ballots
    });
    return data;
  } catch (error) {
    logger.error('Elections service fetch results error', {
      operation: 's2s_fetch_results',
      service: 'elections',
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Failed to fetch results from Elections service: ${error.message}`);
  }
}

module.exports = {
  registerToken,
  fetchResults
};
