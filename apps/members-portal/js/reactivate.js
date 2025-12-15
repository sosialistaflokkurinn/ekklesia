/**
 * Reactivate Account Page Logic
 *
 * Handles account reactivation for soft-deleted users.
 * Users authenticate via Kenni.is and then their account is reactivated.
 *
 * @module reactivate
 */

import { R } from '/i18n/strings-loader.js';
import { debug } from './utils/util-debug.js';
import { auth } from '/js/auth.js';
import {
  signInWithCustomToken,
  getApp,
  httpsCallable,
  getAppCheckTokenValue
} from '/firebase/app.js';

/**
 * Base64 URL encode a buffer
 */
function base64URLEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * SHA-256 hash function
 */
async function sha256(buffer) {
  return await crypto.subtle.digest('SHA-256', buffer);
}

/**
 * Generate PKCE challenge and verifier
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
 * Generate request ID for correlation
 */
function generateRequestId() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate CSRF state parameter
 */
function generateState() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Show content section and hide others
 */
function showSection(sectionId) {
  ['reactivate-content', 'reactivate-success', 'reactivate-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = id === sectionId ? 'block' : 'none';
    }
  });
}

/**
 * Show error with message
 */
function showError(message) {
  const errorMessageEl = document.getElementById('error-message');
  if (errorMessageEl) {
    errorMessageEl.textContent = message;
  }
  showSection('reactivate-error');
}

/**
 * Handle OAuth callback from Kenni.is for reactivation
 */
async function handleReactivationCallback(authCode) {
  debug.log('Processing reactivation callback...');

  try {
    const pkceVerifier = sessionStorage.getItem('pkce_code_verifier_reactivate');
    if (!pkceVerifier) {
      throw new Error('Missing PKCE verifier');
    }

    // Get App Check token
    const appCheckToken = await getAppCheckTokenValue();

    // Call handleKenniAuth to exchange code (but NOT for full login)
    const headers = {
      'Content-Type': 'application/json',
      'X-Request-ID': generateRequestId()
    };
    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    // We need to get the kennitala from the auth response
    // Call handleKenniAuth with a special flag or use the reactivation-specific endpoint
    const response = await fetch(R.string.config_api_handle_auth, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        kenniAuthCode: authCode,
        pkceCodeVerifier: pkceVerifier,
        reactivation: true  // Signal this is for reactivation, not full login
      })
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `${response.status} ${response.statusText}`;

      try {
        if (contentType && contentType.includes('application/json')) {
          const errJson = await response.json();
          errorMessage = errJson.message || errJson.error || errorMessage;
        }
      } catch (e) {
        // Ignore read error
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    debug.log('Auth response received, kennitala:', data.kennitala?.substring(0, 6) + '****');

    // Clear PKCE verifier
    sessionStorage.removeItem('pkce_code_verifier_reactivate');
    sessionStorage.removeItem('oauth_state_reactivate');

    // Now call reactivateSelf with the kennitala
    debug.log('Calling reactivateSelf...');
    const reactivateSelf = httpsCallable('reactivateSelf', R.string.config_firebase_region);
    const result = await reactivateSelf({ kennitala: data.kennitala });

    debug.log('Reactivation successful:', result);

    // Show success
    showSection('reactivate-success');

    // Sign in with the custom token if provided
    if (result.data?.customToken) {
      debug.log('Signing in with custom token...');
      await signInWithCustomToken(auth, result.data.customToken);
    }

    // Redirect to dashboard after delay
    setTimeout(() => {
      window.location.href = '/members-area/dashboard.html';
    }, 2000);

  } catch (error) {
    debug.error('Reactivation failed:', error);
    showError(error.message || 'Villa við endurvöknun');
  }
}

/**
 * Start Kenni.is OAuth flow for reactivation
 */
async function startReactivationAuth() {
  debug.log('Starting reactivation auth flow...');

  const { verifier, challenge } = await generatePKCE();
  sessionStorage.setItem('pkce_code_verifier_reactivate', verifier);

  const state = generateState();
  sessionStorage.setItem('oauth_state_reactivate', state);

  // Build OAuth URL
  const issuerUrl = R.string.config_kenni_issuer;
  const clientId = R.string.config_kenni_client_id;
  // Use a special redirect URI for reactivation, or the same one
  const redirectUri = window.location.origin + '/members-area/reactivate.html';

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
  debug.log('Redirecting to Kenni.is...');
  window.location.assign(authUrl);
}

/**
 * Validate CSRF state parameter
 */
function validateCSRF(returnedState) {
  const storedState = sessionStorage.getItem('oauth_state_reactivate');

  if (!storedState || returnedState !== storedState) {
    debug.error('CSRF validation failed');
    showError('Öryggisvillur - reyndu aftur');
    sessionStorage.removeItem('oauth_state_reactivate');
    sessionStorage.removeItem('pkce_code_verifier_reactivate');
    return false;
  }

  return true;
}

/**
 * Initialize reactivation page
 */
async function init() {
  debug.log('Initializing reactivation page...');

  // Load i18n strings
  await R.load('is');

  // Check if this is an OAuth callback
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');
  const returnedState = urlParams.get('state');

  if (authCode) {
    debug.log('OAuth callback detected');

    // Validate CSRF
    if (!validateCSRF(returnedState)) {
      return;
    }

    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);

    // Handle the callback
    await handleReactivationCallback(authCode);
    return;
  }

  // Setup button handlers
  const reactivateBtn = document.getElementById('btn-reactivate');
  if (reactivateBtn) {
    reactivateBtn.addEventListener('click', startReactivationAuth);
  }

  const retryBtn = document.getElementById('btn-retry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      showSection('reactivate-content');
    });
  }
}

// Run initialization
init().catch(error => {
  debug.error('Reactivation page initialization failed:', error);
  showError('Villa við að hlaða síðu');
});
