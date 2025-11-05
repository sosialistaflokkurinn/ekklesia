/**
 * Login Page Logic
 *
 * Handles Kenni.is OAuth authentication with PKCE flow.
 *
 * @module login
 */

import { R } from '/i18n/strings-loader.js';
import { debug } from './utils/debug.js';
import { getCurrentUser, auth, appCheck } from '/js/auth.js';
import { debug } from './utils/debug.js';
import { signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { debug } from './utils/debug.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { debug } from './utils/debug.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { debug } from './utils/debug.js';
import { getToken as getAppCheckToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';
import { debug } from './utils/debug.js';

/**
 * Base64 URL encode a buffer
 *
 * @param {ArrayBuffer} buffer - Buffer to encode
 * @returns {string} Base64 URL encoded string
 */
function base64URLEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * SHA-256 hash function
 *
 * @param {ArrayBuffer} buffer - Buffer to hash
 * @returns {Promise<ArrayBuffer>} Hash result
 */
async function sha256(buffer) {
  return await crypto.subtle.digest('SHA-256', buffer);
}

/**
 * Generate PKCE (Proof Key for Code Exchange) challenge and verifier
 *
 * @returns {Promise<{verifier: string, challenge: string}>} PKCE pair
 */
async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64URLEncode(array);

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await sha256(data);
  const challenge = base64URLEncode(hash);

  return { verifier, challenge };
}

/**
 * Generate a short random request ID for correlation
 * @returns {string}
 */
function generateRequestId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate CSRF state parameter
 *
 * @returns {string} Random hex string
 */
function generateState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Handle OAuth callback from Kenni.is
 *
 * @param {string} authCode - Authorization code from Kenni.is
 * @param {Object} functions - Firebase Functions instance
 */
async function handleOAuthCallback(authCode, functions) {
  const statusEl = document.getElementById('status');
  const statusTextEl = document.getElementById('status-text');
  const authButtonsEl = document.getElementById('auth-buttons');

  statusEl.className = 'status authenticating';
  statusTextEl.textContent = R.string.status_authenticating;
  authButtonsEl.style.display = 'none';

  try {
    const pkceVerifier = sessionStorage.getItem('pkce_code_verifier');
    if (!pkceVerifier) {
      throw new Error(R.string.error_missing_pkce);
    }

    // Get App Check token for enhanced security
    let appCheckTokenResponse;
    try {
      appCheckTokenResponse = await getAppCheckToken(appCheck, false);
      debug.log('✅ App Check token obtained for handleKenniAuth');
    } catch (error) {
      debug.warn('⚠️ App Check token unavailable, continuing without it:', error);
    }

    // Call Cloud Function to exchange code for token
    const headers = { 'Content-Type': 'application/json', 'X-Request-ID': generateRequestId() };
    if (appCheckTokenResponse) {
      headers['X-Firebase-AppCheck'] = appCheckTokenResponse.token;
    }

    const response = await fetch(R.string.config_api_handle_auth, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        kenniAuthCode: authCode,
        pkceCodeVerifier: pkceVerifier
      })
    });

    if (!response.ok) {
      // Read response body once (can't read twice)
      const contentType = response.headers.get('content-type');
      let errorMessage = `${response.status} ${response.statusText}`;

      try {
        if (contentType && contentType.includes('application/json')) {
          const errJson = await response.json();
          const cid = errJson.correlationId ? ` (cid: ${errJson.correlationId})` : '';
          errorMessage = `${errJson.error || 'ERROR'}${cid}${errJson.message ? ` - ${errJson.message}` : ''}`;
        } else {
          const txt = await response.text();
          errorMessage = `${response.status} ${txt}`;
        }
      } catch (readError) {
        // If we can't read the response, use status text
        debug.error('Failed to read error response:', readError);
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();

    // Sign in to Firebase with custom token
    await signInWithCustomToken(auth, data.customToken);

    // Clear PKCE verifier
    sessionStorage.removeItem('pkce_code_verifier');

    // Automatically verify membership after login
    statusTextEl.textContent = R.string.status_verifying_membership;
    try {
      const verifyMembership = httpsCallable(functions, 'verifyMembership');
      await verifyMembership();
      debug.log(R.string.log_membership_verified);
    } catch (verifyError) {
      debug.warn(R.string.log_membership_verify_failed, verifyError);
      // Continue to dashboard even if verification fails
    }

    // Redirect to dashboard
    window.location.href = R.string.path_dashboard;
  } catch (error) {
    debug.error(R.string.log_authentication_error, error);
    statusEl.className = 'status error';
    statusTextEl.textContent = R.format(R.string.error_authentication, error.message);
    authButtonsEl.style.display = 'block';
  }
}

/**
 * Update login page UI strings
 */
function updateLoginStrings() {
  document.title = R.string.page_title;
  document.getElementById('login-title').textContent = R.string.login_title;
  document.getElementById('login-subtitle').textContent = R.string.login_subtitle;
  document.getElementById('status-text').textContent = R.string.status_not_authenticated;
  document.getElementById('btn-login').textContent = R.string.btn_login;
  document.getElementById('login-description').textContent = R.string.btn_login_description;
}

/**
 * Setup login button click handler
 *
 * @param {string} issuerUrl - Kenni.is issuer URL
 * @param {string} clientId - OAuth client ID
 * @param {string} redirectUri - OAuth redirect URI
 */
function setupLoginButton(issuerUrl, clientId, redirectUri) {
  document.getElementById('btn-login').addEventListener('click', async () => {
    const { verifier, challenge } = await generatePKCE();
    sessionStorage.setItem('pkce_code_verifier', verifier);

    // Generate and store CSRF state parameter
    const state = generateState();
    sessionStorage.setItem('oauth_state', state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: R.string.config_oauth_scopes,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: state,
    });

    const authUrl = `${issuerUrl}/oidc/auth?${params.toString()}`;
    window.location.assign(authUrl);
  });
}

/**
 * Handle CSRF validation for OAuth callback
 *
 * @param {string} returnedState - State parameter from OAuth callback
 * @returns {boolean} True if validation passed
 */
function validateCSRF(returnedState) {
  const statusEl = document.getElementById('status');
  const statusTextEl = document.getElementById('status-text');
  const storedState = sessionStorage.getItem('oauth_state');

  debug.log('CSRF validation:', {
    returnedState: returnedState ? `${returnedState.substring(0, 8)}...` : 'null',
    storedState: storedState ? `${storedState.substring(0, 8)}...` : 'null',
    match: returnedState === storedState
  });

  if (!storedState || returnedState !== storedState) {
    statusEl.textContent = R.string.error_csrf_title;
    statusTextEl.textContent = R.string.error_csrf_message;
    statusTextEl.style.color = 'red';
    debug.error(R.string.log_csrf_failed);
    debug.error('CSRF mismatch - this usually means you opened the OAuth redirect in a different browser tab');
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('pkce_code_verifier');
    return false;
  }

  // State validated - clean up
  sessionStorage.removeItem('oauth_state');
  return true;
}

/**
 * Initialize login page
 */
async function init() {
  // Load i18n strings
  await R.load('is');

  // Get Firebase app and functions
  const app = getApp();
  const functions = getFunctions(app, R.string.config_firebase_region);

  // Update UI strings
  updateLoginStrings();

  // Kenni.is configuration
  const KENNI_IS_ISSUER_URL = R.string.config_kenni_issuer;
  const KENNI_IS_CLIENT_ID = R.string.config_kenni_client_id;
  // Use configured redirect URI (must exactly match IdP + backend env)
  const KENNI_IS_REDIRECT_URI = R.string.config_kenni_redirect_uri;

  // Check if this is an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');
  const returnedState = urlParams.get('state');

  if (authCode) {
    // Validate CSRF state parameter
    if (!validateCSRF(returnedState)) {
      return;
    }

    // Handle OAuth callback
    await handleOAuthCallback(authCode, functions);
    return;
  }

  // Check if already authenticated
  const user = await getCurrentUser();
  if (user) {
    // Already logged in - redirect to dashboard
    window.location.href = R.string.path_dashboard;
    return;
  }

  // Setup login button
  setupLoginButton(KENNI_IS_ISSUER_URL, KENNI_IS_CLIENT_ID, KENNI_IS_REDIRECT_URI);
}

// Run initialization
init().catch(error => {
  debug.error('Login initialization failed:', error);
});
