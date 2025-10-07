# Ekklesia Members Authentication

Firebase + Kenni.is direct OIDC integration for Icelandic authentication with kennitala support.

## Overview

This authentication module provides seamless integration between Kenni.is (Iceland's national authentication service) and Firebase Identity Platform. **No OIDC bridge required** - Firebase handles the entire OAuth/OIDC flow including PKCE.

## Features

- ✅ **Direct OIDC Integration**: Kenni.is → Firebase (no middleware)
- ✅ **Automatic PKCE**: Firebase handles PKCE flow automatically
- ✅ **Kennitala Support**: Extracts and normalizes kennitala from Kenni.is
- ✅ **Claims Mapping**: Cloud Functions ensure consistent claim format
- ✅ **Membership Verification**: Built-in membership checking
- ✅ **Session Management**: Firebase handles tokens and sessions
- ✅ **Type Safety**: Full TypeScript-ready API

## Quick Start

### 1. Setup

```bash
cd members/
./scripts/setup-firebase-kenni.sh
```

### 2. Basic Usage

```javascript
import {
  signInWithKenni,
  handleKenniRedirect,
  getKennitala,
  onAuthStateChanged
} from './auth/kenni-auth.js';

// Initialize app
import { initializeApp } from 'firebase/app';
const app = initializeApp(firebaseConfig);

// Handle redirect on page load
await handleKenniRedirect();

// Listen for auth state changes
onAuthStateChanged(async (user) => {
  if (user) {
    const kennitala = await getKennitala(user);
    console.log('User kennitala:', kennitala);
  } else {
    console.log('User signed out');
  }
});

// Sign in
document.getElementById('loginBtn').addEventListener('click', async () => {
  await signInWithKenni();
});
```

## API Reference

### Authentication Functions

#### `createKenniProvider()`

Creates and configures a Kenni.is OIDC provider.

```javascript
const provider = createKenniProvider();
```

**Returns:** `OAuthProvider` configured for Kenni.is

---

#### `signInWithKenni()`

Sign in using redirect flow (recommended for production).

```javascript
await signInWithKenni();
```

**Returns:** `Promise<void>` - Redirects to Kenni.is

---

#### `signInWithKenniPopup()`

Sign in using popup flow (useful for development/testing).

```javascript
const result = await signInWithKenniPopup();
console.log('User:', result.user);
```

**Returns:** `Promise<UserCredential>`

---

#### `handleKenniRedirect()`

Process OAuth redirect callback. Call this on page load.

```javascript
const result = await handleKenniRedirect();
if (result) {
  console.log('User signed in:', result.user);
  console.log('Kennitala:', result.claims.kennitala);
}
```

**Returns:** `Promise<UserCredential | null>`

---

#### `getKennitala(user)`

Extract kennitala from authenticated user's ID token.

```javascript
const kennitala = await getKennitala(user);
console.log('Kennitala:', kennitala); // "200978-3589"
```

**Parameters:**
- `user` - Firebase User object

**Returns:** `Promise<string | null>` - Kennitala in format DDMMYY-XXXX

---

#### `signOut()`

Sign out the current user.

```javascript
await signOut();
```

**Returns:** `Promise<void>`

---

#### `onAuthStateChanged(callback)`

Listen for authentication state changes.

```javascript
const unsubscribe = onAuthStateChanged((user) => {
  if (user) {
    console.log('Signed in:', user.uid);
  } else {
    console.log('Signed out');
  }
});

// Later: unsubscribe()
```

**Parameters:**
- `callback` - Function called with user object (or null) on state change

**Returns:** `Function` - Unsubscribe function

## Cloud Functions

### `processKenniClaims`

**Trigger:** `beforeUserCreated`

Processes and normalizes kennitala claims when a user is first created.

- Extracts kennitala from various claim names (`kennitala`, `national_id`, `kt`, etc.)
- Validates format (DDMMYY-XXXX)
- Normalizes to consistent format with hyphen
- Stores in custom claims as `kennitala`

### `refreshKenniClaims`

**Trigger:** `beforeUserSignedIn`

Refreshes kennitala claims on each sign-in to ensure they're up-to-date.

### `verifyMembership`

**Type:** Callable function

Checks if user's kennitala is in the membership list.

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const verifyMembership = httpsCallable(functions, 'verifyMembership');

const result = await verifyMembership();
console.log('Is member:', result.data.isMember);
console.log('Kennitala:', result.data.kennitala); // Masked: "200978-****"
```

**Response:**
```javascript
{
  isMember: boolean,
  verified: boolean,
  kennitala: string  // Masked for privacy
}
```

### `updateMembershipList` (Admin only)

**Type:** Callable function

Updates the kennitalas.txt membership list. Requires admin custom claim.

```javascript
const updateList = httpsCallable(functions, 'updateMembershipList');

await updateList({
  kennitalas: [
    '200978-3589',
    '150685-4321',
    // ...
  ]
});
```

## Authentication Flow

```
1. User clicks "Sign In"
   ↓
2. signInWithKenni() redirects to Kenni.is
   ↓
3. User authenticates with Kenni.is
   ↓
4. Kenni.is redirects back with authorization code
   ↓
5. Firebase exchanges code for tokens (PKCE)
   ↓
6. processKenniClaims Cloud Function runs
   - Extracts kennitala
   - Validates format
   - Normalizes to DDMMYY-XXXX
   ↓
7. User created/signed in
   ↓
8. handleKenniRedirect() processes result
   ↓
9. App receives user with kennitala claim
```

## Configuration Files

### `config/firebase-kenni-provider.json`

OIDC provider configuration for Firebase.

```json
{
  "providerId": "oidc.kenni",
  "displayName": "Kenni.is",
  "issuerUri": "https://kenni.is",
  "scopes": ["openid", "profile", "kennitala"]
}
```

### `.env.identity-platform`

Firebase and Kenni.is credentials.

```env
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=...
KENNI_CLIENT_ID=...
KENNI_CLIENT_SECRET=...
```

## Testing

### Test Page

Open [`test/kenni-auth-test.html`](../test/kenni-auth-test.html) to test:

- ✅ Sign in with redirect
- ✅ Sign in with popup
- ✅ Kennitala extraction
- ✅ Token claims inspection
- ✅ Membership verification

### Manual Testing

```bash
# Serve locally
npx http-server -p 8080

# Open test page
open http://localhost:8080/test/kenni-auth-test.html
```

## Security

### PKCE Flow

Firebase automatically handles PKCE (Proof Key for Code Exchange), protecting against:
- Authorization code interception attacks
- Token replay attacks

### Token Validation

- All ID tokens are validated by Firebase
- Kennitala is extracted server-side (Cloud Functions)
- Clients cannot modify custom claims

### Privacy

- Kennitala is only visible to the authenticated user
- Membership verification masks kennitala in responses
- Never log full kennitala in client-side code

### Best Practices

```javascript
// ✅ Good: Get kennitala securely
const kennitala = await getKennitala(user);

// ❌ Bad: Don't access directly (might not exist)
const kennitala = user.customClaims.kennitala;

// ✅ Good: Mask in logs
console.log('Kennitala:', kennitala.slice(0, 7) + '****');

// ❌ Bad: Don't log full kennitala
console.log('Kennitala:', kennitala);
```

## Error Handling

```javascript
try {
  await signInWithKenni();
} catch (error) {
  if (error.code === 'auth/popup-closed-by-user') {
    console.log('User closed popup');
  } else if (error.code === 'auth/operation-not-allowed') {
    console.error('OIDC provider not enabled');
  } else {
    console.error('Authentication error:', error);
  }
}
```

## Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `auth/operation-not-allowed` | OIDC provider not enabled | Enable in Firebase Console |
| `auth/invalid-credential` | Invalid client credentials | Check client_id/secret |
| `auth/unauthorized-domain` | Domain not authorized | Add domain to Firebase authorized domains |
| `auth/popup-closed-by-user` | User closed popup | Handle gracefully, allow retry |

## TypeScript Support

Type definitions for Firebase Auth are included. For custom kennitala typing:

```typescript
import { User } from 'firebase/auth';

interface EkklesiaClaims {
  kennitala?: string;
  isMember?: boolean;
  verifiedAt?: string;
}

async function getKennitalaTyped(user: User): Promise<string | null> {
  const result = await user.getIdTokenResult();
  const claims = result.claims as EkklesiaClaims;
  return claims.kennitala || null;
}
```

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

Requires:
- ES6 module support
- async/await support
- Fetch API

## Documentation

- [Complete Setup Guide](../docs/FIREBASE_KENNI_SETUP.md)
- [Quick Start Guide](../docs/KENNI_QUICKSTART.md)
- [Firebase Auth Docs](https://firebase.google.com/docs/auth)
- [Kenni.is Documentation](https://kenni.is/docs)

## Troubleshooting

See [Troubleshooting Section](../docs/FIREBASE_KENNI_SETUP.md#troubleshooting) in the setup guide.

## License

Part of the Ekklesia Members Service.
