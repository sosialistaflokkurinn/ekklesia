/**
 * Shared Authentication Utilities
 *
 * Common auth functions used across the member portal.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBsDqnt8G54VAANlucQpI20r3Sw1p2Bcp4",
  authDomain: "ekklesia-prod-10-2025.firebaseapp.com",
  projectId: "ekklesia-prod-10-2025",
  storageBucket: "ekklesia-prod-10-2025.firebasestorage.app",
  messagingSenderId: "521240388393",
  appId: "1:521240388393:web:de2a986ae545e20bb5cd38"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

/**
 * Auth Guard - Redirect to login if not authenticated
 * Call this at the top of protected pages (dashboard, profile)
 */
export function requireAuth() {
  return new Promise((resolve) => {
    const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        // Not authenticated - redirect to login
        window.location.href = '/';
      } else {
        // Authenticated - continue
        resolve(user);
      }
    });
  });
}

/**
 * Get current user
 * Returns null if not authenticated
 */
export function getCurrentUser() {
  return new Promise((resolve) => {
    const unsubscribe = firebaseOnAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * Sign out and redirect to login
 */
export async function signOut() {
  await firebaseSignOut(auth);
  window.location.href = '/';
}

/**
 * Listen for auth state changes
 */
export function onAuthStateChanged(callback) {
  return firebaseOnAuthStateChanged(auth, callback);
}

/**
 * Get user data from token claims
 */
export async function getUserData(user) {
  if (!user) return null;

  const idTokenResult = await user.getIdTokenResult();

  return {
    uid: user.uid,
    displayName: user.displayName,
    kennitala: idTokenResult.claims.kennitala,
    email: idTokenResult.claims.email,
    phoneNumber: idTokenResult.claims.phoneNumber,
    isMember: idTokenResult.claims.isMember || false
  };
}
