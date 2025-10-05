# Google Authentication Linking - Migration Plan

**Version:** 1.0.0
**Date:** 2025-10-05
**Status:** 📋 Planned (Not Started)
**Priority:** Medium
**Estimated Effort:** 2-3 days

---

## Overview

Migrate from "Kenni.is every time" to "Kenni.is once, then Google" authentication pattern, based on the proven kosningakerfi prototype.

**Current Flow:**
```
Every Login:
User → Kenni.is OIDC → Extract kennitala → Create session
```

**Target Flow:**
```
First Time (Verification):
User → Kenni.is OIDC → Extract kennitala → Create Firebase account → Link Google

Subsequent Logins:
User → Google Login → Already linked to verified kennitala
```

---

## Benefits

### User Experience
- ✅ Kenni.is verification only required **once**
- ✅ Subsequent logins via familiar Google button
- ✅ Faster login for returning users
- ✅ Better mobile experience

### Security
- ✅ Kennitala stored in Firestore (encrypted at rest)
- ✅ Audit trail of all authentications
- ✅ Proper database instead of text file
- ✅ Firebase security rules for access control

### Maintainability
- ✅ Leverage Firebase's built-in Google auth
- ✅ No custom OIDC Bridge for daily logins
- ✅ Simpler session management
- ✅ Proven pattern from kosningakerfi prototype

---

## Architecture Changes

### Current Architecture
```
┌─────────┐     ┌──────────────┐     ┌──────────┐     ┌─────────┐
│ Browser │────▶│ OIDC Bridge  │────▶│ Kenni.is │────▶│ Members │
└─────────┘     └──────────────┘     └──────────┘     └─────────┘
                 (PKCE provider)                      (kennitalas.txt)
```

### Target Architecture
```
┌─────────┐     ┌──────────────────┐     ┌──────────┐
│ Browser │────▶│ Firebase Auth    │────▶│ Members  │
└─────────┘     │ - Google (daily) │     └──────────┘
                │ - Kenni.is (1st) │            │
                └──────────────────┘            ▼
                         │              ┌──────────────┐
                         │              │  Firestore   │
                         └─────────────▶│ - users/     │
                                        │ - kennitalas/│
                                        └──────────────┘
```

---

## Migration Steps

### Phase 1: Firestore Setup (Day 1)

**1.1 Create Firestore Database**
```bash
# Enable Firestore in Firebase Console
gcloud firestore databases create --location=europe-west2 --project=ekklesia-prod-10-2025
```

**1.2 Design Data Model**
```javascript
// Collection: users
users/{uid} {
  kennitala: string,          // Hashed or encrypted
  kennitalaCleartext: string, // For admin verification (encrypted)
  verifiedAt: timestamp,
  googleEmail: string,
  googleUid: string,
  name: string,
  roles: array,              // ['member', 'admin', etc.]
  createdAt: timestamp,
  lastLoginAt: timestamp
}

// Collection: audit_log
audit_log/{id} {
  uid: string,
  action: string,           // 'kenni_verification', 'google_login', etc.
  timestamp: timestamp,
  ip: string,
  userAgent: string
}
```

**1.3 Security Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only backend can write
    }

    // Audit logs are admin-only
    match /audit_log/{logId} {
      allow read: if request.auth.token.admin == true;
      allow write: if false; // Only backend can write
    }
  }
}
```

### Phase 2: Backend Changes (Day 1-2)

**2.1 Add Firestore Admin SDK**
```bash
cd members
npm install firebase-admin
```

**2.2 Create User Service**
```javascript
// members/src/services/userService.js
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

const db = getFirestore();

export async function createOrUpdateUser(kennitala, firebaseUser) {
  const userRef = db.collection('users').doc(firebaseUser.uid);

  const userData = {
    kennitala: hashKennitala(kennitala),
    kennitalaCleartext: encrypt(kennitala), // For admin verification
    verifiedAt: new Date(),
    googleEmail: firebaseUser.email,
    googleUid: firebaseUser.uid,
    name: firebaseUser.displayName,
    roles: ['member'],
    lastLoginAt: new Date()
  };

  await userRef.set(userData, { merge: true });

  // Log audit trail
  await db.collection('audit_log').add({
    uid: firebaseUser.uid,
    action: 'kenni_verification',
    timestamp: new Date(),
    kennitala: hashKennitala(kennitala)
  });

  return userData;
}

export async function getUserByUid(uid) {
  const doc = await db.collection('users').doc(uid).get();
  return doc.exists ? doc.data() : null;
}

function hashKennitala(kennitala) {
  return crypto.createHash('sha256').update(kennitala + process.env.SALT).digest('hex');
}

function encrypt(text) {
  // Use GCP KMS or similar for production
  const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}
```

**2.3 Update Authentication Flow**
```javascript
// members/src/routes/auth.js

// First-time verification with Kenni.is
fastify.post('/verify-kenni', async (request, reply) => {
  const { idToken, oauthAccessToken } = request.body;

  // Verify Firebase token
  const decodedToken = await admin.auth().verifyIdToken(idToken);

  // Extract kennitala from OIDC Bridge token
  const kennitala = await extractKennitala(oauthAccessToken);

  // Create/update user in Firestore
  await createOrUpdateUser(kennitala, decodedToken);

  // Link Google provider if not already linked
  // (Firebase handles this automatically on subsequent Google logins)

  return { success: true, verified: true };
});

// Subsequent Google logins
fastify.post('/verify-google', async (request, reply) => {
  const { idToken } = request.body;

  // Verify Firebase token
  const decodedToken = await admin.auth().verifyIdToken(idToken);

  // Check if user exists and is verified
  const user = await getUserByUid(decodedToken.uid);

  if (!user) {
    return { success: false, error: 'User must verify with Kenni.is first' };
  }

  // Update last login
  await db.collection('users').doc(decodedToken.uid).update({
    lastLoginAt: new Date()
  });

  // Log audit trail
  await db.collection('audit_log').add({
    uid: decodedToken.uid,
    action: 'google_login',
    timestamp: new Date()
  });

  return { success: true, user };
});
```

### Phase 3: Frontend Changes (Day 2)

**3.1 Update Login Page**
```html
<!-- members/src/views/login.html -->

<!-- Show both login options -->
<div class="login-options">
  <!-- First-time users -->
  <div class="first-time-section">
    <h3>Fyrsta skiptið?</h3>
    <p>Staðfestu þig með rafrænum skilríkjum</p>
    <button id="kenni-signin-btn" class="kenni-signin-btn">
      🏛️ Staðfesta með Kenni.is
    </button>
  </div>

  <!-- Returning users -->
  <div class="returning-section">
    <h3>Skráður notandi?</h3>
    <p>Innskráning með Google</p>
    <button id="google-signin-btn" class="google-signin-btn">
      <img src="/google-logo.svg"> Innskrá með Google
    </button>
  </div>
</div>
```

**3.2 Add Google Sign-In**
```javascript
// Add Google provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

document.getElementById('google-signin-btn').onclick = () => {
  firebase.auth().signInWithPopup(googleProvider)
    .then((result) => {
      // Verify with backend
      result.user.getIdToken().then((idToken) => {
        fetch('/verify-google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        })
        .then(r => r.json())
        .then(data => {
          if (data.success) {
            window.location.href = '/profile';
          } else {
            // User not verified - show message
            alert('Þú þarft að staðfesta þig með Kenni.is fyrst');
          }
        });
      });
    });
};
```

### Phase 4: Data Migration (Day 3)

**4.1 Migrate kennitalas.txt to Firestore**
```javascript
// members/scripts/migrate-kennitalas.js
import admin from 'firebase-admin';
import fs from 'fs';

admin.initializeApp();
const db = admin.firestore();

async function migrateKennitalas() {
  const data = fs.readFileSync('members/data/kennitalas.txt', 'utf8');
  const kennitalas = data.split('\n').filter(k => k.trim());

  const batch = db.batch();

  for (const kennitala of kennitalas) {
    // Create a placeholder document for each kennitala
    // Will be updated when user first logs in with Google
    const docRef = db.collection('verified_kennitalas').doc(hashKennitala(kennitala));
    batch.set(docRef, {
      kennitalaHash: hashKennitala(kennitala),
      verified: true,
      linkedUid: null, // Will be set when user logs in
      createdAt: new Date()
    });
  }

  await batch.commit();
  console.log(`Migrated ${kennitalas.length} kennitalas to Firestore`);
}

migrateKennitalas();
```

**4.2 Run Migration**
```bash
cd members
node scripts/migrate-kennitalas.js
```

**4.3 Backup Text File**
```bash
mv members/data/kennitalas.txt members/data/kennitalas.txt.backup
```

### Phase 5: Testing (Day 3)

**5.1 Test First-Time Kenni.is Flow**
- [ ] Login with Kenni.is
- [ ] Verify kennitala extracted
- [ ] Check Firestore user created
- [ ] Verify audit log entry

**5.2 Test Google Login Flow**
- [ ] Login with Google (should fail - not verified)
- [ ] Complete Kenni.is verification
- [ ] Logout
- [ ] Login with Google (should succeed)
- [ ] Check session created
- [ ] Verify audit log entry

**5.3 Test Edge Cases**
- [ ] User tries Google before Kenni.is verification
- [ ] User tries to verify twice with Kenni.is
- [ ] Invalid kennitala
- [ ] Network errors during verification

### Phase 6: Deployment (Day 3)

**6.1 Deploy Backend Changes**
```bash
cd members
npm install
gcloud run deploy members \
  --source . \
  --region europe-west2 \
  --allow-unauthenticated
```

**6.2 Update Environment Variables**
```bash
# Add Firestore and encryption keys
gcloud run services update members \
  --update-env-vars FIRESTORE_ENABLED=true \
  --update-env-vars ENCRYPTION_KEY=<from-secret-manager>
```

**6.3 Monitor Deployment**
```bash
# Watch logs for errors
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=members" \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)"
```

---

## Rollback Plan

If issues occur, rollback is simple:

**1. Revert Code**
```bash
git revert HEAD
git push
```

**2. Redeploy Previous Version**
```bash
gcloud run services update members \
  --image gcr.io/ekklesia-prod-10-2025/members:previous-version
```

**3. Restore kennitalas.txt**
```bash
mv members/data/kennitalas.txt.backup members/data/kennitalas.txt
```

---

## Post-Migration Cleanup

After successful deployment and testing:

**1. Remove OIDC Bridge** (optional - keep for other services)
```bash
# If only used for Members service
gcloud run services delete oidc-bridge-proxy --region europe-west2
```

**2. Archive Legacy Code**
```bash
mkdir archive/kenni-direct-auth
mv members/src/routes/auth-kenni-direct.js archive/kenni-direct-auth/
```

**3. Update Documentation**
- Update DOCUMENTATION_MAP.md
- Update members/README.md
- Create GOOGLE_AUTH_MIGRATION.md with lessons learned

---

## Cost Impact

**Current:**
- OIDC Bridge: ~$5-10/month
- No database costs (text file)

**After Migration:**
- Firestore (free tier): $0/month (low usage)
- OIDC Bridge: Can be removed (~$5-10/month savings)
- **Net Cost Change:** Neutral or slight savings

---

## References

- **Prototype:** https://github.com/gudrodur/kosningakerfi
- **Firebase Multi-Provider:** https://firebase.google.com/docs/auth/web/account-linking
- **Firestore Security:** https://firebase.google.com/docs/firestore/security/get-started
- **Current Implementation:** `members/src/routes/auth.js`

---

## Success Criteria

- [ ] First-time users can verify with Kenni.is
- [ ] Verified users can login with Google
- [ ] All kennitalas migrated to Firestore
- [ ] Audit trail working
- [ ] No increase in login time
- [ ] Zero data loss during migration
- [ ] Rollback tested and working

---

**Next Steps:**
1. Review this plan with team
2. Schedule 3-day implementation sprint
3. Set up Firestore database
4. Begin Phase 1

**Status:** Ready for implementation when prioritized
