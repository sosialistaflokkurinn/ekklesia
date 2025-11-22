# Firebase Architecture & Troubleshooting

**Last Updated:** 2025-11-22
**Status:** ✅ Active Standard

---

## 1. Singleton Pattern (CRITICAL)

We use a **Singleton Pattern** for Firebase initialization to prevent "Double App Check initialized" errors and ensure consistent state.

### ❌ WRONG (Do NOT do this)
Importing directly from CDN in feature files:
```javascript
// auth.js - WRONG
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getToken } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js';
// This creates a NEW instance, causing conflicts!
```

### ✅ CORRECT (Do this)
Import from our centralized wrapper:
```javascript
// auth.js - CORRECT
import { 
  getFirebaseAuth, 
  getAppCheckTokenValue 
} from '../firebase/app.js';
```

**File Location:** `apps/members-portal/firebase/app.js`

---

## 2. App Check Token Handling

App Check tokens should be retrieved using the wrapper function which handles errors gracefully (e.g. local development without debug token).

```javascript
import { getAppCheckTokenValue } from '../firebase/app.js';

// Returns token string or null (never throws)
const token = await getAppCheckTokenValue();
```

---

## 3. Database Verification (Production)

To verify data in the production database (Cloud SQL), use the proxy scripts.

**Prerequisites:**
- You must be authenticated as a user (not service account)
- Run: `gcloud auth login`

**Commands:**
```bash
# 1. Start Proxy (requires gcloud auth login)
./scripts/database/start-proxy.sh

# 2. Connect via psql
./scripts/database/psql-cloud.sh

# 3. Verify votes (example)
# SELECT count(*) FROM elections.ballots WHERE election_id = '...';
```

**Note:** Service accounts (like CI/CD or AI agents) cannot run these scripts directly due to permission restrictions on `sqladmin` API and Secret Manager. This is a security feature.
