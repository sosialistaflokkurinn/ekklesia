/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Pure, testable functions for OAuth 2.0 PKCE flow.
 * No side effects - can be tested without DOM or network.
 *
 * @module session/pkce
 */

/**
 * Generate cryptographically random string
 *
 * @param {number} length - Length of random string
 * @returns {string} Random string (base64url encoded)
 */
export function generateRandomString(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return base64urlEncode(array);
}

/**
 * Base64-URL encode (without padding)
 *
 * @param {Uint8Array} buffer - Buffer to encode
 * @returns {string} Base64-URL encoded string
 */
export function base64urlEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * SHA-256 hash
 *
 * @param {string} plain - Plain text string
 * @returns {Promise<Uint8Array>} SHA-256 hash
 */
export async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hash);
}

/**
 * Generate PKCE (Proof Key for Code Exchange) challenge and verifier
 *
 * Pure function - returns PKCE pair for OAuth flow.
 *
 * @returns {Promise<{verifier: string, challenge: string}>} PKCE pair
 *
 * @example
 * const { verifier, challenge } = await generatePKCE();
 * // Store verifier in sessionStorage
 * sessionStorage.setItem('pkce_verifier', verifier);
 * // Send challenge to OAuth server
 * const authUrl = `${issuer}/oauth2/authorize?code_challenge=${challenge}...`;
 */
export async function generatePKCE() {
  // Generate random verifier (128 chars = 96 bytes base64url)
  const verifier = generateRandomString(96);

  // Generate challenge (SHA-256 hash of verifier)
  const challengeBuffer = await sha256(verifier);
  const challenge = base64urlEncode(challengeBuffer);

  return { verifier, challenge };
}

/**
 * Build OAuth authorization URL
 *
 * Pure function - constructs URL from parameters.
 *
 * @param {Object} params - OAuth parameters
 * @param {string} params.issuer - OAuth issuer URL
 * @param {string} params.clientId - OAuth client ID
 * @param {string} params.redirectUri - OAuth redirect URI
 * @param {string} params.challenge - PKCE challenge
 * @param {string} params.state - CSRF state parameter
 * @param {string} [params.scope='openid profile'] - OAuth scope
 * @returns {string} Authorization URL
 */
export function buildAuthorizationUrl({ issuer, clientId, redirectUri, challenge, state, scope = 'openid profile' }) {
  const authUrl = new URL(`${issuer}/oidc/auth`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scope);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);

  return authUrl.toString();
}

/**
 * Validate CSRF state parameter
 *
 * Pure function - compares state values.
 *
 * @param {string} returnedState - State from OAuth callback
 * @param {string} storedState - State from sessionStorage
 * @returns {boolean} True if validation passed
 */
export function validateState(returnedState, storedState) {
  return returnedState === storedState;
}
