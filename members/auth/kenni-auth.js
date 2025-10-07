/**
 * Kenni.is Authentication Module for Firebase
 *
 * Manual OAuth flow with PKCE for Kenni.is authentication.
 * Bypasses Firebase OIDC provider to properly support PKCE.
 *
 * Flow:
 * 1. Frontend generates PKCE verifier + challenge
 * 2. Redirect to Kenni.is with challenge
 * 3. Kenni.is redirects back with authorization code
 * 4. Frontend sends code + verifier to Cloud Function
 * 5. Cloud Function exchanges for tokens and creates custom token
 * 6. Frontend signs in with custom token
 */

import {
  getAuth,
  signInWithCustomToken,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged
} from 'firebase/auth';

// Kenni.is configuration
const KENNI_IS_ISSUER_URL = 'https://idp.kenni.is/sosi-kosningakerfi.is';
const KENNI_IS_CLIENT_ID = '@sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s';
const KENNI_IS_REDIRECT_URI = window.location.origin + '/auth/callback';

/**
 * Base64 URL encode (without padding)
 * @param {Uint8Array} buffer
 * @returns {string}
 */
function base64URLEncode(buffer) {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * SHA-256 hash
 * @param {Uint8Array} buffer
 * @returns {Promise<ArrayBuffer>}
 */
async function sha256(buffer) {
  return await crypto.subtle.digest('SHA-256', buffer);
}

/**
 * Generate PKCE code verifier and challenge
 * @returns {Promise<{verifier: string, challenge: string}>}
 */
async function generatePKCE() {
  // Generate random code verifier (32 bytes = 43 base64url characters)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = base64URLEncode(array);

  // Generate code challenge from verifier using SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await sha256(data);
  const challenge = base64URLEncode(new Uint8Array(hash));

  return { verifier, challenge };
}

/**
 * Initiate Kenni.is OAuth flow
 * Redirects user to Kenni.is for authentication
 * @returns {Promise<void>}
 */
export async function signInWithKenni() {
  try {
    console.log('INFO: Initiating Kenni.is OAuth flow...');

    // Generate PKCE verifier and challenge
    const { verifier, challenge } = await generatePKCE();

    // Store verifier in sessionStorage for callback
    sessionStorage.setItem('pkce_code_verifier', verifier);
    console.log('INFO: PKCE challenge generated, verifier stored in sessionStorage');

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: KENNI_IS_CLIENT_ID,
      redirect_uri: KENNI_IS_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid profile national_id',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    const authUrl = `${KENNI_IS_ISSUER_URL}/oidc/auth?${params.toString()}`;

    console.log('INFO: Redirecting to Kenni.is...');
    console.log('DEBUG: Redirect URI:', KENNI_IS_REDIRECT_URI);

    // Redirect to Kenni.is
    window.location.assign(authUrl);
  } catch (error) {
    console.error('ERROR: Failed to initiate Kenni.is sign-in:', error);
    throw error;
  }
}

/**
 * Handle OAuth callback from Kenni.is
 * Call this on the /auth/callback page
 * @param {string} authorizationCode - The 'code' parameter from URL
 * @returns {Promise<{user: User, uid: string}>}
 */
export async function handleKenniCallback(authorizationCode) {
  try {
    console.log('INFO: Handling Kenni.is callback...');

    // Get PKCE verifier from sessionStorage
    const pkceCodeVerifier = sessionStorage.getItem('pkce_code_verifier');

    if (!pkceCodeVerifier) {
      throw new Error('No PKCE verifier found in sessionStorage. Please start the sign-in flow again.');
    }

    if (!authorizationCode) {
      throw new Error('No authorization code provided');
    }

    console.log('INFO: Calling handleKenniAuth Cloud Function...');

    // Call Cloud Function to exchange code for custom token
    const customToken = await exchangeCodeForCustomToken(authorizationCode, pkceCodeVerifier);

    console.log('INFO: Received custom token from Cloud Function');

    // Sign in to Firebase with custom token
    const auth = getAuth();
    const userCredential = await signInWithCustomToken(auth, customToken);

    console.log('INFO: Successfully signed in with custom token');
    console.log('INFO: User UID:', userCredential.user.uid);

    // Clean up
    sessionStorage.removeItem('pkce_code_verifier');

    return {
      user: userCredential.user,
      uid: userCredential.user.uid
    };
  } catch (error) {
    console.error('ERROR: Failed to handle Kenni.is callback:', error);
    throw error;
  }
}

/**
 * Exchange authorization code for Firebase custom token
 * Calls the handleKenniAuth Cloud Function
 * @param {string} kenniAuthCode - Authorization code from Kenni.is
 * @param {string} pkceCodeVerifier - PKCE verifier from sessionStorage
 * @returns {Promise<string>} Firebase custom token
 */
async function exchangeCodeForCustomToken(kenniAuthCode, pkceCodeVerifier) {
  // Get Firebase project ID from config
  const auth = getAuth();
  const projectId = auth.app.options.projectId;

  // Build Cloud Function URL
  // In production: https://europe-west2-{project}.cloudfunctions.net/handleKenniAuth
  // In emulator: http://127.0.0.1:5001/{project}/europe-west2/handleKenniAuth
  let functionUrl;

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Use Firebase emulator
    functionUrl = `http://127.0.0.1:5001/${projectId}/europe-west2/handleKenniAuth`;
  } else {
    // Use production Cloud Function
    functionUrl = `https://europe-west2-${projectId}.cloudfunctions.net/handleKenniAuth`;
  }

  console.log('INFO: Calling Cloud Function:', functionUrl);

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        kenniAuthCode,
        pkceCodeVerifier
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloud Function responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.customToken) {
      throw new Error('No custom token in Cloud Function response');
    }

    return data.customToken;
  } catch (error) {
    console.error('ERROR: Failed to exchange code for custom token:', error);
    throw error;
  }
}

/**
 * Get kennitala from authenticated user's custom claims
 * @param {User} user - Firebase user object
 * @returns {Promise<string|null>} Kennitala or null if not found
 */
export async function getKennitala(user) {
  if (!user) return null;

  try {
    const idTokenResult = await user.getIdTokenResult();

    // Kennitala is set in custom claims by Cloud Function
    return idTokenResult.claims.kennitala || null;
  } catch (error) {
    console.error('ERROR: Failed to retrieve kennitala:', error);
    return null;
  }
}

/**
 * Get user profile from Firestore
 * @param {User} user - Firebase user object
 * @returns {Promise<Object|null>} User profile or null
 */
export async function getUserProfile(user) {
  if (!user) return null;

  try {
    const { getFirestore, doc, getDoc } = await import('firebase/firestore');
    const db = getFirestore();
    const userDoc = await getDoc(doc(db, 'users', user.uid));

    if (userDoc.exists()) {
      return userDoc.data();
    }

    return null;
  } catch (error) {
    console.error('ERROR: Failed to retrieve user profile:', error);
    return null;
  }
}

/**
 * Sign out current user
 * @returns {Promise<void>}
 */
export async function signOut() {
  const auth = getAuth();
  await firebaseSignOut(auth);
  console.log('INFO: User signed out');
}

/**
 * Set up authentication state observer
 * @param {Function} callback - Called with user object on auth state change
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChanged(callback) {
  const auth = getAuth();
  return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * Check if current URL is the OAuth callback
 * @returns {boolean}
 */
export function isCallbackURL() {
  return window.location.pathname === '/auth/callback';
}

/**
 * Get authorization code from URL parameters
 * @returns {string|null}
 */
export function getAuthCodeFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

/**
 * Get error from URL parameters (if OAuth failed)
 * @returns {Object|null} {error, error_description}
 */
export function getErrorFromURL() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  if (error) {
    return {
      error,
      error_description: params.get('error_description') || 'Unknown error'
    };
  }

  return null;
}
