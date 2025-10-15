/**
 * Login Page Logic
 *
 * Handles OAuth 2.0 PKCE flow with Kenni.is and Firebase custom token authentication.
 *
 * New architecture:
 * - Pure PKCE functions in /session/pkce.js (testable)
 * - Firebase services from /firebase/app.js (single import)
 * - DOM helpers from /ui/dom.js (validated)
 * - Clear separation of concerns
 *
 * Flow:
 * 1. User clicks "Login with Kenni.is"
 * 2. Generate PKCE challenge + state (CSRF protection)
 * 3. Redirect to Kenni.is OAuth authorize endpoint
 * 4. User authenticates with Kenni.is
 * 5. Kenni.is redirects back with auth code
 * 6. Exchange code for custom Firebase token (Cloud Function)
 * 7. Sign in to Firebase with custom token
 * 8. Redirect to dashboard
 *
 * @module login
 */

import { R } from '/i18n/strings-loader.js';
import { getCurrentUser } from '/session/auth.js';
import { getFirebaseAuth, signInWithCustomToken, getAppCheckTokenValue, httpsCallable } from '/firebase/app.js';
import { generatePKCE, generateRandomString, buildAuthorizationUrl, validateState } from '/session/pkce.js';
import { setTextContent, addEventListener, validateElements, getElementByIdSafe } from '/ui/dom.js';

/**
 * Required DOM elements for login page
 */
const LOGIN_ELEMENTS = [
  'login-title',
  'login-subtitle',
  'status-text',
  'btn-login',
  'login-description',
  'login-error'
];

/**
 * Validate login page DOM structure
 *
 * @throws {Error} If required elements are missing
 */
function validateLoginPage() {
  validateElements(LOGIN_ELEMENTS, 'login page');
}

/**
 * Update login page strings
 *
 * @param {Object} strings - i18n strings object
 */
function updateLoginStrings(strings) {
  document.title = strings.page_title_login;
  setTextContent('login-title', strings.login_title, 'login page');
  setTextContent('login-subtitle', strings.login_subtitle, 'login page');
  setTextContent('status-text', strings.status_not_authenticated, 'login page');
  setTextContent('btn-login', strings.btn_login, 'login page');
  setTextContent('login-description', strings.btn_login_description, 'login page');
}

/**
 * Show error message on login page
 *
 * @param {string} message - Error message
 */
function showError(message) {
  const errorElement = getElementByIdSafe('login-error', 'login page');
  errorElement.textContent = message;
  errorElement.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  const errorElement = getElementByIdSafe('login-error', 'login page');
  errorElement.style.display = 'none';
}

/**
 * Start OAuth login flow
 *
 * Generates PKCE challenge and redirects to Kenni.is.
 *
 * @param {Object} config - OAuth configuration from i18n
 */
async function startLogin(config) {
  try {
    hideError();

    // Generate PKCE challenge + verifier
    const { verifier, challenge } = await generatePKCE();

    // Generate CSRF state
    const state = generateRandomString(32);

    // Store verifier and state in sessionStorage (needed for callback)
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('csrf_state', state);

    // Build authorization URL
    // Use configured OAuth scopes (includes national_id for kennitala)
    const authUrl = buildAuthorizationUrl({
      issuer: config.kenni_issuer,
      clientId: config.kenni_client_id,
      redirectUri: config.kenni_redirect_uri,
      challenge,
      state,
      scope: R.string.config_oauth_scopes
    });

    // Redirect to Kenni.is
    window.location.href = authUrl;
  } catch (error) {
    console.error('Login start failed:', error);
    showError(R.string.error_authentication);
  }
}

/**
 * Handle OAuth callback from Kenni.is
 *
 * Validates CSRF, exchanges auth code for Firebase custom token,
 * and signs in to Firebase.
 *
 * @param {string} authCode - Authorization code from Kenni.is
 */
async function handleCallback(authCode) {
  try {
    // Get stored PKCE verifier and CSRF state
    const verifier = sessionStorage.getItem('pkce_verifier');
    const storedState = sessionStorage.getItem('csrf_state');

    if (!verifier) {
      throw new Error('PKCE verifier not found (session expired?)');
    }

    // Validate CSRF state
    const urlParams = new URLSearchParams(window.location.search);
    const returnedState = urlParams.get('state');

    if (!validateState(returnedState, storedState)) {
      throw new Error('CSRF validation failed (possible attack)');
    }

    // Call handleKenniAuth Cloud Function to exchange code for custom Firebase token
    // Use direct Cloud Run URL (not Cloud Functions URL) for proper CORS
    const handleKenniAuthUrl = R.string.config_api_handle_auth;

    // Get App Check token (security requirement)
    const appCheckToken = await getAppCheckTokenValue();

    const headers = {
      'Content-Type': 'application/json',
    };

    // Include App Check token if available
    if (appCheckToken) {
      headers['X-Firebase-AppCheck'] = appCheckToken;
    }

    const response = await fetch(handleKenniAuthUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        kenniAuthCode: authCode,
        pkceCodeVerifier: verifier
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`handleKenniAuth failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const { customToken } = result;

    if (!customToken) {
      throw new Error('No custom token received from server');
    }

    // Sign in to Firebase with custom token (modular SDK)
    const auth = getFirebaseAuth();
    await signInWithCustomToken(auth, customToken);

    // Refresh membership status (update custom claims)
    // This ensures the user's claims are current before redirecting to dashboard
    try {
      const region = R.string.config_firebase_region;
      const verifyMembershipFn = httpsCallable('verifyMembership', region);
      await verifyMembershipFn();
      console.log('✅ Membership status refreshed after login');
    } catch (error) {
      // Non-critical: If membership verification fails, still allow login
      // Dashboard/profile pages will show cached membership status
      console.warn('⚠️ Membership verification failed after login (non-critical):', error);
    }

    // Clean up session storage
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('csrf_state');

    // Redirect to dashboard
    window.location.href = '/dashboard.html';
  } catch (error) {
    console.error('OAuth callback error:', error);
    showError(R.format(R.string.error_authentication, error.message));

    // Clean up session storage
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('csrf_state');

    // Clear URL parameters (remove ?code=... from URL)
    window.history.replaceState({}, document.title, '/');
  }
}

/**
 * Check if already authenticated and redirect
 */
async function checkAuthAndRedirect() {
  const user = await getCurrentUser();
  if (user) {
    // Already authenticated - redirect to dashboard
    window.location.href = '/dashboard.html';
  }
}

/**
 * Initialize login page
 *
 * @returns {Promise<void>}
 */
async function init() {
  // Validate DOM structure
  validateLoginPage();

  // Load i18n strings (cached if already loaded)
  await R.load('is');

  // Update login page strings
  updateLoginStrings(R.string);

  // Check if already authenticated
  await checkAuthAndRedirect();

  // Check if OAuth callback (URL has ?code=...)
  const urlParams = new URLSearchParams(window.location.search);
  const authCode = urlParams.get('code');

  if (authCode) {
    // Handle OAuth callback
    await handleCallback(authCode);
  } else {
    // Setup login button
    addEventListener('btn-login', 'click', async () => {
      const config = {
        kenni_issuer: R.string.config_kenni_issuer,
        kenni_client_id: R.string.config_kenni_client_id,
        kenni_redirect_uri: R.string.config_kenni_redirect_uri
      };
      await startLogin(config);
    }, 'login page');
  }
}

// Run initialization
init().catch(error => {
  console.error('Login page initialization failed:', error);
  showError(R.string.error_authentication);
});
