import crypto from 'crypto';

/**
 * Generate a code verifier for PKCE (RFC 7636)
 * @returns {string} Base64URL-encoded random string (43-128 characters)
 */
export function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

/**
 * Generate a code challenge from a code verifier
 * @param {string} verifier - The code verifier
 * @returns {string} Base64URL-encoded SHA256 hash of the verifier
 */
export function generateCodeChallenge(verifier) {
  return base64URLEncode(
    crypto.createHash('sha256').update(verifier).digest()
  );
}

/**
 * Base64URL encode a buffer (RFC 4648 Section 5)
 * @param {Buffer} buffer - The buffer to encode
 * @returns {string} Base64URL-encoded string
 */
function base64URLEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate a random state parameter for CSRF protection
 * @returns {string} Hex-encoded random string
 */
export function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a random nonce for ID token validation
 * @returns {string} Hex-encoded random string
 */
export function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}
