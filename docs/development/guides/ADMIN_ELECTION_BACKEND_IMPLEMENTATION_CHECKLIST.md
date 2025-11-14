# Admin Election Backend Implementation - Lessons Learned Checklist

**Epic:** #186 - Member Voting Experience (Backend Phase)  
**Related:** Epic #192 - Admin Elections Dashboard  
**Date:** November 6, 2025  
**Branch:** `feature/epic-186-member-voting-experience`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Backend Implementation Checklist](#backend-implementation-checklist)
3. [Database Migration Lessons](#database-migration-lessons)
4. [RBAC Implementation](#rbac-implementation)
5. [Cloud SQL Proxy Setup](#cloud-sql-proxy-setup)
6. [Service Configuration](#service-configuration)
7. [Testing Strategy](#testing-strategy)
8. [Common Issues & Solutions](#common-issues--solutions)
9. [Deployment Checklist](#deployment-checklist)
10. [Next Steps](#next-steps)

---

## Overview

This checklist documents everything learned while implementing the backend for Epic #186 admin election management. Use this as a reference for future backend work on the Elections Service.

**What was implemented:**
- ✅ 10 admin CRUD endpoints for election management
- ✅ RBAC middleware (election-manager vs superadmin roles)
- ✅ Database migration 003 (hidden flag, voting_type, max_selections)
- ✅ Admin route registration in main app
- ✅ Local development environment configuration

**Status:** Backend complete, ready for endpoint testing

---

## Backend Implementation Checklist

### Phase 1: Admin Routes (CRUD Endpoints)

**File:** `services/elections/src/routes/admin.js`

- [x] **GET /api/admin/elections** - List all elections with filters
  - Supports: status, includeHidden, search, limit, offset
  - RBAC: election-manager or superadmin
  
- [x] **GET /api/admin/elections/:id** - Get single election details
  - Returns full election object with all metadata
  - RBAC: election-manager or superadmin
  
- [x] **POST /api/admin/elections** - Create new election (draft)
  - Validates: title, question, answers (min 2), voting_type, max_selections
  - Sets created_by, updated_by from Firebase UID
  - RBAC: election-manager or superadmin
  
- [x] **PATCH /api/admin/elections/:id** - Update election (draft only)
  - Can modify: title, question, answers, voting_type, max_selections, description
  - Validates draft status before allowing edits
  - RBAC: election-manager or superadmin
  
- [x] **POST /api/admin/elections/:id/open** - Open election (publish)
  - Changes status: draft → published
  - Sets opened_at timestamp
  - RBAC: election-manager or superadmin
  
- [x] **POST /api/admin/elections/:id/close** - Close election
  - Changes status: published → closed
  - Sets closed_at timestamp
  - RBAC: election-manager or superadmin
  
- [x] **POST /api/admin/elections/:id/hide** - Hide election (soft delete)
  - Sets hidden = TRUE
  - Does not change status
  - Reversible (see unhide)
  - RBAC: election-manager or superadmin
  
- [x] **POST /api/admin/elections/:id/unhide** - Unhide election (restore)
  - Sets hidden = FALSE
  - Restores election to member view
  - RBAC: election-manager or superadmin
  
- [x] **DELETE /api/admin/elections/:id** - Permanently delete election
  - Hard delete from database (IRREVERSIBLE)
  - Requires extra confirmation in UI
  - RBAC: **superadmin ONLY**
  
- [x] **GET /api/admin/elections/:id/results** - Get election results
  - Returns vote counts, percentages, winner
  - Only for closed elections
  - RBAC: election-manager or superadmin

**Key Learning:**
- Always implement soft delete (hide/unhide) before hard delete
- Hard delete should require superadmin role ONLY
- Separate draft editing from published elections (no edits after publish)
- Audit logging essential for all admin actions

---

### Phase 2: RBAC Middleware

**File:** `services/elections/src/middleware/rbacAuth.js`

- [x] **verifyFirebaseToken** - Decode and verify Firebase ID token
  - Extracts user claims from token
  - Validates token signature
  - Attaches user info to req.user
  
- [x] **requireElectionManager** - Check for election-manager or superadmin role
  - Allows: `{ role: "election-manager" }` or `{ role: "superadmin" }`
  - Returns 403 if unauthorized
  
- [x] **requireSuperadmin** - Check for superadmin role ONLY
  - Allows: `{ role: "superadmin" }` ONLY
  - Used for hard delete endpoint
  - Returns 403 if not superadmin

**Firebase Custom Claims Setup:**
```javascript
// Set custom claims (admin SDK)
admin.auth().setCustomUserClaims(uid, { role: 'election-manager' });
admin.auth().setCustomUserClaims(uid, { role: 'superadmin' });

// Verify claims (client side - force token refresh)
const idTokenResult = await firebase.auth().currentUser.getIdTokenResult(true);
console.log(idTokenResult.claims.role); // 'election-manager' or 'superadmin'
```

**Key Learning:**
- Firebase custom claims are perfect for RBAC
- Always verify tokens on every request (don't trust client)
- Two-tier permissions: election-manager (most ops) + superadmin (dangerous ops)
- Force token refresh after role changes: `getIdTokenResult(true)`

---

### Phase 3: Database Migration

**File:** `services/elections/migrations/003_admin_features.sql`

**Added Columns:**
1. **hidden** (BOOLEAN) - Soft delete flag
2. **voting_type** (VARCHAR) - 'single-choice' or 'multi-choice'
3. **max_selections** (INTEGER) - Max choices for multi-choice (default: 1)
4. **eligibility** (VARCHAR) - 'members', 'admins', or 'all'
5. **scheduled_start** (TIMESTAMP) - Optional scheduled start time
6. **scheduled_end** (TIMESTAMP) - Optional scheduled end time
7. **updated_by** (VARCHAR) - Firebase UID of last modifier

**Added Constraints:**
```sql
-- Voting type must be valid
CHECK (voting_type IN ('single-choice', 'multi-choice'))

-- Max selections must be >= 1 and <= answer count
CHECK (max_selections >= 1 AND max_selections <= jsonb_array_length(answers))

-- Eligibility must be valid
CHECK (eligibility IN ('members', 'admins', 'all'))

-- Status constraint (updated to remove 'open' and 'deleted')
CHECK (status IN ('draft', 'published', 'paused', 'closed', 'archived'))
```

**Data Migration Steps (CRITICAL):**
```sql
-- Step 1: Fix elections with 0 answers (violates max_selections >= 1)
UPDATE elections
SET max_selections = 1
WHERE jsonb_array_length(answers) = 0;

-- Step 2: Fix elections where max_selections > answer_count
UPDATE elections
SET max_selections = jsonb_array_length(answers)
WHERE max_selections > jsonb_array_length(answers);

-- Step 3: Migrate old 'open' status to 'published'
UPDATE elections
SET status = 'published'
WHERE status = 'open';
```

**Key Learning:**
- **ALWAYS migrate existing data BEFORE adding constraints**
- Test migration against production-like data first
- Check for edge cases (0 answers, NULL values, old status values)
- Add indexes for new columns used in WHERE clauses
- Use comments to document column purpose

**Migration Workflow:**
1. Add column with default value (no constraint yet)
2. Migrate existing data to satisfy future constraint
3. Add constraint after data is clean
4. Add indexes for performance
5. Add comments for documentation

---

### Phase 4: Route Registration

**File:** `services/elections/src/index.js`

- [x] Import admin router: `const adminRouter = require('./routes/admin');`
- [x] Register admin routes: `app.use('/api/admin', adminRouter);`
- [x] Update 404 handler to list all admin endpoints
- [x] Update startup console output to show admin routes

**Before:**
```javascript
// Only member routes
app.use('/api', electionsRouter);
```

**After:**
```javascript
// Member routes
app.use('/api', electionsRouter);

// Admin routes (RBAC protected)
app.use('/api/admin', adminRouter);
```

**404 Handler Update:**
```javascript
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /api/elections',
      'GET /api/elections/:id',
      'POST /api/elections/:id/vote',
      // ... admin endpoints
      'GET /api/admin/elections',
      'POST /api/admin/elections',
      'PATCH /api/admin/elections/:id',
      'DELETE /api/admin/elections/:id',
      // ... etc
    ]
  });
});
```

**Key Learning:**
- Keep member and admin routes separate (`/api` vs `/api/admin`)
- Document all endpoints in 404 handler (helpful for API discovery)
- Update startup console output for developer awareness
- Group admin endpoints under `/api/admin` prefix for clarity

---

## Database Migration Lessons

### Lesson 1: Data Migration BEFORE Constraints

**❌ Wrong Order:**
```sql
ALTER TABLE elections ADD COLUMN max_selections INTEGER;
ALTER TABLE elections ADD CONSTRAINT valid_max_selections CHECK (max_selections >= 1);
-- ERROR: Constraint violation! Existing rows have NULL or 0
```

**✅ Correct Order:**
```sql
-- Step 1: Add column with default (no constraint)
ALTER TABLE elections ADD COLUMN max_selections INTEGER DEFAULT 1;

-- Step 2: Fix existing data
UPDATE elections SET max_selections = 1 WHERE jsonb_array_length(answers) = 0;
UPDATE elections SET max_selections = jsonb_array_length(answers) 
WHERE max_selections > jsonb_array_length(answers);

-- Step 3: Add constraint (data is now clean)
ALTER TABLE elections ADD CONSTRAINT valid_max_selections 
CHECK (max_selections >= 1 AND max_selections <= jsonb_array_length(answers));
```

---

### Lesson 2: Test Against Production-Like Data

**Problem:** Migration worked on empty dev database, failed on production with real data.

**Solution:**
1. Export production data sample: `pg_dump --data-only --table=elections > elections_sample.sql`
2. Load into test database
3. Run migration against test database
4. Fix data issues
5. Re-run migration until clean
6. Then apply to production

**Test Query:**
```sql
-- Check for data that would violate constraints
SELECT id, title, status, jsonb_array_length(answers) as answer_count, max_selections
FROM elections
WHERE max_selections > jsonb_array_length(answers) -- Would fail constraint
   OR jsonb_array_length(answers) = 0;              -- Would fail constraint
```

---

### Lesson 3: Handle Edge Cases

**Edge Cases Encountered:**
1. Elections with 0 answers (test data)
2. Elections with max_selections > answer_count
3. Elections with old status values ('open' instead of 'published')
4. NULL values in new columns

**Fix:**
```sql
-- Handle edge case: elections with no answers
UPDATE elections 
SET answers = '[{"id": "answer_1", "text": "Yes"}, {"id": "answer_2", "text": "No"}]'::jsonb,
    max_selections = 1
WHERE jsonb_array_length(answers) = 0;
```

---

### Lesson 4: Use Indexes for New Columns

```sql
-- Index for filtering hidden elections (soft delete)
CREATE INDEX IF NOT EXISTS idx_elections_hidden ON elections(hidden);

-- Index for scheduled elections
CREATE INDEX IF NOT EXISTS idx_elections_scheduled_start 
ON elections(scheduled_start) WHERE scheduled_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_elections_scheduled_end 
ON elections(scheduled_end) WHERE scheduled_end IS NOT NULL;
```

**Why:** Query performance on `WHERE hidden = FALSE` and `WHERE scheduled_start < NOW()`

---

## RBAC Implementation

### Firebase Custom Claims Pattern

**Set Claims (Admin SDK - server side):**
```javascript
const admin = require('firebase-admin');

// Promote user to election-manager
await admin.auth().setCustomUserClaims(uid, { 
  role: 'election-manager',
  permissions: ['create', 'edit', 'open', 'close', 'hide', 'unhide']
});

// Promote user to superadmin
await admin.auth().setCustomUserClaims(uid, { 
  role: 'superadmin',
  permissions: ['*'] // All permissions
});
```

**Verify Claims (Client side - frontend):**
```javascript
// Get current user's role
const idTokenResult = await firebase.auth().currentUser.getIdTokenResult(true); // Force refresh
const userRole = idTokenResult.claims.role;

if (userRole === 'superadmin') {
  // Show delete button
} else if (userRole === 'election-manager') {
  // Hide delete button
}
```

**Backend Middleware:**
```javascript
// Verify Firebase token and extract claims
async function verifyFirebaseToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || null,
      permissions: decodedToken.permissions || []
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Require election-manager or superadmin
function requireElectionManager(req, res, next) {
  if (!req.user || !['election-manager', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Requires election-manager role' });
  }
  next();
}

// Require superadmin ONLY
function requireSuperadmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden: Requires superadmin role' });
  }
  next();
}
```

---

## Cloud SQL Proxy Setup

### Local Development Setup

**Step 1: Install Cloud SQL Proxy**
```bash
wget https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud-sql-proxy
chmod +x cloud-sql-proxy
sudo mv cloud-sql-proxy /usr/local/bin/
```

**Step 2: Authenticate with Google Cloud**
```bash
# Login to Google Cloud
gcloud auth login

# Set Application Default Credentials (REQUIRED for Cloud SQL Proxy)
gcloud auth application-default login

# Set project
gcloud config set project ekklesia-prod-10-2025
```

**⚠️ CRITICAL:** Cloud SQL Proxy requires **Application Default Credentials**, not just `gcloud auth login`.

**Error if ADC missing:**
```
Failed to connect to localhost:5432: could not find default credentials
```

**Fix:**
```bash
gcloud auth application-default login
```

---

**Step 3: Start Cloud SQL Proxy**
```bash
# Start proxy (runs in foreground)
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db \
  --port 5432

# Or run in background
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db \
  --port 5432 &
```

**Step 4: Test Connection**
```bash
# Test with psql
PGPASSWORD="your-password" psql -h localhost -p 5432 -U ekklesia-admin -d ekklesia-db

# If connected successfully:
ekklesia-db=> \dt elections.*
```

---

### Common Cloud SQL Proxy Issues

**Issue 1: Port Already in Use**
```
Error: listen tcp 127.0.0.1:5432: bind: address already in use
```

**Solution:**
```bash
# Find process using port 5432
lsof -ti:5432

# Kill process
lsof -ti:5432 | xargs kill -9

# Restart proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5432
```

---

**Issue 2: Connection Refused**
```
Error: connection refused
```

**Checklist:**
- [ ] Cloud SQL Proxy is running: `ps aux | grep cloud-sql-proxy`
- [ ] Application Default Credentials set: `gcloud auth application-default login`
- [ ] Correct instance connection name: `ekklesia-prod-10-2025:europe-west2:ekklesia-db`
- [ ] Correct port: `5432` (not `5433`)
- [ ] Firewall allows localhost connections

---

**Issue 3: Wrong Port in Service Config**
```
Error: connect ECONNREFUSED 127.0.0.1:5433
```

**Problem:** Service trying to connect to port 5433, proxy listening on 5432.

**Solution:** Update `.env` file:
```bash
# .env
DB_PORT=5432  # NOT 5433
```

---

## Service Configuration

### Environment Variables (.env)

**File:** `services/elections/.env`

**Required Variables:**
```bash
# Database Configuration
DB_HOST=localhost                              # Cloud SQL Proxy host
DB_PORT=5432                                   # Cloud SQL Proxy port (NOT 5433)
DB_NAME=ekklesia-db
DB_USER=ekklesia-admin
DB_PASSWORD=<from-secret-manager>             # Get from Secret Manager
DB_SSL=false                                  # Cloud SQL Proxy handles encryption

# Firebase Configuration
FIREBASE_PROJECT_ID=ekklesia-prod-10-2025
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Service Configuration
PORT=3001                                     # Elections service port
NODE_ENV=development
LOG_LEVEL=debug

# CORS (optional)
ALLOWED_ORIGINS=http://localhost:5000,https://ekklesia-prod-10-2025.web.app
```

---

### Get Database Password from Secret Manager

```bash
# View secret versions
gcloud secrets versions list ekklesia-db-password --project ekklesia-prod-10-2025

# Get latest password
gcloud secrets versions access latest --secret="ekklesia-db-password" --project ekklesia-prod-10-2025
```

**Add to .env:**
```bash
DB_PASSWORD=<paste-password-here>
```

---

### .env.example Template

**File:** `services/elections/.env.example`

```bash
# Database Configuration (Cloud SQL via proxy)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ekklesia-db
DB_USER=ekklesia-admin
DB_PASSWORD=get-from-secret-manager
DB_SSL=false

# Firebase
FIREBASE_PROJECT_ID=ekklesia-prod-10-2025
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Service
PORT=3001
NODE_ENV=development
LOG_LEVEL=debug
```

**Instructions:**
1. Copy `.env.example` to `.env`
2. Get database password: `gcloud secrets versions access latest --secret="ekklesia-db-password"`
3. Update `DB_PASSWORD` with real password
4. Update `GOOGLE_APPLICATION_CREDENTIALS` path

---

### Start Service Locally

```bash
# Navigate to service directory
cd services/elections

# Install dependencies (if not already done)
npm install

# Start service
npm run dev

# Expected output:
# Elections Service running on http://localhost:3001
# Database connected successfully
# Admin endpoints registered:
#   GET    /api/admin/elections
#   POST   /api/admin/elections
#   GET    /api/admin/elections/:id
#   PATCH  /api/admin/elections/:id
#   POST   /api/admin/elections/:id/open
#   POST   /api/admin/elections/:id/close
#   POST   /api/admin/elections/:id/hide
#   POST   /api/admin/elections/:id/unhide
#   DELETE /api/admin/elections/:id
#   GET    /api/admin/elections/:id/results
```

---

## Testing Strategy

### ⚠️ CRITICAL: Why Localhost Testing Doesn't Work

**Problem:** Cannot test admin endpoints locally with Firebase authentication.

**Root Cause:** Kenni.is (Iceland's National eID System) OAuth integration.

**Detailed Explanation:**

The Ekklesia platform uses **Kenni.is** (Auðkenni) for user authentication, which is Iceland's national electronic ID system. This system:

1. **Requires Production Infrastructure:** Kenni.is does NOT provide a test/sandbox mode
2. **No Local OAuth Flow:** OAuth redirects must go to registered production URLs
3. **Cannot Spoof Tokens:** Firebase ID tokens include Kenni.is claims that cannot be generated locally

**What This Means:**
- ❌ Cannot test authenticated endpoints on `localhost:3001`
- ❌ Cannot login with Kenni.is locally
- ❌ Cannot get valid Firebase ID tokens locally
- ✅ MUST deploy to Cloud Run to test with real authentication
- ✅ CAN test database logic locally (without auth)

**Testing Workflow:**
```bash
# Step 1: Test database logic locally (no auth)
# Connect to Cloud SQL via proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5432

# Run service locally
cd services/elections
npm run dev

# Test endpoints WITHOUT authentication (will get 401, but proves routes work)
curl http://localhost:3001/api/admin/elections
# Expected: {"error":"Unauthorized","message":"Missing or invalid Authorization header"}
# This proves the route exists and RBAC middleware is working

# Step 2: Deploy to Cloud Run for authenticated testing
./deploy.sh

# Step 3: Get Firebase token from production frontend
# Login to https://ekklesia-prod-10-2025.web.app with Kenni.is
# Open browser console:
firebase.auth().currentUser.getIdToken().then(t => console.log(t))

# Step 4: Test deployed endpoints with real token
curl -H "Authorization: Bearer REAL_TOKEN" \
  https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections
```

**Reference:** See `docs/ENVIRONMENT_CLARIFICATION.md` for full explanation of Kenni.is constraints.

**Local Testing Limitations:**
- ✅ Database queries and migrations
- ✅ Route registration (check for 401, not 404)
- ✅ Business logic (without auth context)
- ❌ RBAC permissions (requires real Firebase tokens)
- ❌ End-to-end API testing (requires Kenni.is login)
- ❌ Frontend integration (requires production URLs)

---

### Phase 1: Database Migration Testing

**Test migration against dev database:**
```bash
# Connect to dev database
PGPASSWORD="password" psql -h localhost -p 5432 -U ekklesia-admin -d ekklesia-db

# Run migration
\i services/elections/migrations/003_admin_features.sql

# Verify schema changes
\d elections.elections

# Check constraints
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'elections.elections'::regclass;

# Verify data migration
SELECT id, title, status, hidden, voting_type, max_selections, 
       jsonb_array_length(answers) as answer_count
FROM elections.elections;
```

---

### Phase 2: Local Route Testing (No Auth)

**Purpose:** Verify routes are registered correctly, even though we can't test authentication locally.

**What to Test:**
- Routes return 401 Unauthorized (NOT 404 Not Found)
- RBAC middleware is attached
- Error messages are correct

```bash
# Start service locally
cd services/elections
npm run dev

# Test admin routes (should get 401, not 404)
curl http://localhost:3001/api/admin/elections
# ✅ Expected: {"error":"Unauthorized","message":"Missing or invalid Authorization header","code":"MISSING_AUTH_TOKEN"}
# ❌ Wrong: {"error":"Not Found","message":"Route GET /api/admin/elections not found"}

# Test with invalid token (should get 401 with different message)
curl -H "Authorization: Bearer invalid-token" http://localhost:3001/api/admin/elections
# Expected: {"error":"Unauthorized","message":"Invalid token"}
```

**Key Learning:** 
- 401 response = route exists, auth required ✅
- 404 response = route not registered ❌

---

### Phase 3: Production Endpoint Testing (With Auth)

**Prerequisites:**
1. Service deployed to Cloud Run
2. User logged in to https://ekklesia-prod-10-2025.web.app
3. Firebase ID token obtained from browser console

**Get Firebase ID Token:**
```javascript
// In browser console (logged in to frontend)
const token = await firebase.auth().currentUser.getIdToken();
console.log(token);
// Copy token for curl commands
```

**Test Endpoints with curl:**

**1. List Elections**
```bash
curl -X GET "http://localhost:3001/api/admin/elections?includeHidden=true" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json"
```

**2. Get Single Election**
```bash
curl -X GET "http://localhost:3001/api/admin/elections/election_1" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**3. Create Election (Draft)**
```bash
curl -X POST "http://localhost:3001/api/admin/elections" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Election",
    "question": "Should we implement feature X?",
    "answers": [
      {"id": "answer_1", "text": "Yes"},
      {"id": "answer_2", "text": "No"}
    ],
    "voting_type": "single-choice",
    "max_selections": 1
  }'
```

**4. Update Election (Draft)**
```bash
curl -X PATCH "http://localhost:3001/api/admin/elections/election_1" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Test Election",
    "description": "This is a test"
  }'
```

**5. Open Election (Publish)**
```bash
curl -X POST "http://localhost:3001/api/admin/elections/election_1/open" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**6. Close Election**
```bash
curl -X POST "http://localhost:3001/api/admin/elections/election_1/close" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**7. Hide Election (Soft Delete)**
```bash
curl -X POST "http://localhost:3001/api/admin/elections/election_1/hide" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**8. Unhide Election (Restore)**
```bash
curl -X POST "http://localhost:3001/api/admin/elections/election_1/unhide" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**9. Delete Election (Hard Delete - Superadmin Only)**
```bash
curl -X DELETE "http://localhost:3001/api/admin/elections/election_1" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

**10. Get Results**
```bash
curl -X GET "http://localhost:3001/api/admin/elections/election_1/results" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN"
```

---

### Phase 3: RBAC Testing

**Test as election-manager (should work for most endpoints):**
```bash
# Get token as election-manager user
# Test endpoints 1-9 (should all work)
# Test DELETE endpoint (should fail with 403)
```

**Test as superadmin (should work for all endpoints):**
```bash
# Get token as superadmin user
# Test all 10 endpoints (should all work including DELETE)
```

**Test without authentication (should fail):**
```bash
# Try any endpoint without Authorization header (should get 401)
curl -X GET "http://localhost:3001/api/admin/elections"
# Expected: 401 Unauthorized
```

---

## Common Issues & Solutions

### Issue 1: Service Won't Start - Missing .env

**Error:**
```
Error: DB_PASSWORD is not defined in environment
```

**Solution:**
1. Copy `.env.example` to `.env`
2. Get database password from Secret Manager
3. Update `.env` with real values

```bash
cp services/elections/.env.example services/elections/.env
# Edit .env and add real DB_PASSWORD
```

---

### Issue 2: Port Mismatch (5432 vs 5433)

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5433
```

**Problem:** Service config has `DB_PORT=5433`, but Cloud SQL Proxy listening on `5432`.

**Solution:** Update `.env`:
```bash
DB_PORT=5432  # NOT 5433
```

---

### Issue 3: Migration Constraint Violations

**Error:**
```
ERROR: new row for relation "elections" violates check constraint "valid_max_selections"
DETAIL: Failing row contains (..., max_selections=0, answers=[])
```

**Problem:** Existing data violates new constraint.

**Solution:** Add data migration BEFORE constraint:
```sql
-- Fix data first
UPDATE elections SET max_selections = 1 WHERE jsonb_array_length(answers) = 0;

-- Then add constraint
ALTER TABLE elections ADD CONSTRAINT valid_max_selections CHECK (...);
```

---

### Issue 4: Firebase Token Expired

**Error:**
```
401 Unauthorized: Token expired
```

**Solution:** Get new token:
```javascript
// In browser console
const token = await firebase.auth().currentUser.getIdToken(true); // Force refresh
console.log(token);
```

---

### Issue 5: Cloud SQL Proxy Not Running

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Check:**
```bash
# Is proxy running?
ps aux | grep cloud-sql-proxy

# If not, start it:
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5432
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Database migration tested on dev database
- [ ] All admin endpoints tested locally
- [ ] RBAC tested (election-manager vs superadmin)
- [ ] Edge cases handled (0 answers, old status values)
- [ ] Migration includes data migration steps
- [ ] Code committed and pushed to branch
- [ ] Pull request created and reviewed

---

### Deployment Steps

**1. Run Database Migration on Production**
```bash
# Connect to production via Cloud SQL Proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5432

# In another terminal, connect with psql
PGPASSWORD="prod-password" psql -h localhost -p 5432 -U ekklesia-admin -d ekklesia-db

# Run migration
\i services/elections/migrations/003_admin_features.sql

# Verify
\d elections.elections
SELECT * FROM elections.elections LIMIT 5;
```

**2. Deploy Elections Service to Cloud Run**

**⚠️ CRITICAL DEPLOYMENT LESSONS (November 6, 2025):**

**Issue:** Cloud Run kept using old revision despite pushing new commits and rebuilding Docker images.

**Root Cause:** Cloud Run will sometimes hold onto an old revision name (e.g., `elections-service-00010-lzw`) even when deploying new images with different digests. This happens when the service configuration hasn't changed enough to trigger a new revision.

**Solution:** Delete the service and redeploy from scratch.

```bash
# Step 1: Ensure all commits are pushed to origin
git status  # Should show "Your branch is up to date with 'origin/...'"
git push origin feature/epic-186-member-voting-experience

# Step 2: Build and deploy with deploy.sh
cd services/elections
./deploy.sh

# Step 3: Verify the deployment
curl https://elections-service-ymzrguoifa-nw.a.run.app/health

# Step 4: Test admin routes (should get 401 Unauthorized, NOT 404)
curl https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections
# Expected: {"error":"Unauthorized","message":"Missing or invalid Authorization header","code":"MISSING_AUTH_TOKEN"}
# ❌ WRONG: {"error":"Not Found","message":"Route GET /api/admin/elections not found"}
```

**If you get 404 instead of 401:**
1. Check local code has admin routes: `grep -n "adminRouter" src/index.js`
2. Check git commits are pushed: `git log origin/HEAD..HEAD` (should be empty)
3. **Delete service and redeploy:**

```bash
# Delete the stuck service
gcloud run services delete elections-service --region europe-west2 --quiet

# Redeploy from scratch
./deploy.sh

# Verify new deployment
curl https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections
# Should now get 401 Unauthorized (routes exist, auth required)
```

**Why This Happens:**
- Cloud Run uses revision names (e.g., `00010-lzw`) to track deployments
- Sometimes the same revision name is reused even with new code
- The revision may be using a cached Docker image layer
- Deleting the service forces a completely fresh deployment with new revision numbers

**Deploy Script (services/elections/deploy.sh):**
```bash
# Build and deploy
cd services/elections

# The deploy.sh script:
# 1. Builds Docker image with gcloud builds submit
# 2. Pushes to GCR (gcr.io/ekklesia-prod-10-2025/elections-service)
# 3. Deploys to Cloud Run with proper env vars and secrets
# 4. Connects to Cloud SQL instance

./deploy.sh
```

**Manual Deploy (if deploy.sh fails):**
```bash
# Build image
gcloud builds submit --tag gcr.io/ekklesia-prod-10-2025/elections-service .

# Deploy to Cloud Run
gcloud run deploy elections-service \
  --image gcr.io/ekklesia-prod-10-2025/elections-service:latest \
  --platform managed \
  --region europe-west2 \
  --allow-unauthenticated \
  --max-instances 100 \
  --min-instances 0 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 5s \
  --concurrency 50 \
  --port 8081 \
  --add-cloudsql-instances "ekklesia-prod-10-2025:europe-west2:ekklesia-db" \
  --set-env-vars "NODE_ENV=production,DATABASE_HOST=/cloudsql/ekklesia-prod-10-2025:europe-west2:ekklesia-db,DATABASE_PORT=5432,DATABASE_NAME=postgres,DATABASE_USER=postgres,CORS_ORIGINS=https://ekklesia-prod-10-2025.web.app^https://ekklesia-prod-10-2025.firebaseapp.com,LOG_LEVEL=info" \
  --set-secrets "DATABASE_PASSWORD=postgres-password:latest,S2S_API_KEY=elections-s2s-api-key:latest"

# Get service URL
gcloud run services describe elections-service --region europe-west2 --format 'value(status.url)'
```

**3. Test Deployed Service**
```bash
# Health check (no auth required)
curl https://elections-service-ymzrguoifa-nw.a.run.app/health
# Expected: {"status":"healthy","service":"elections-service","version":"1.0.0"}

# Admin routes (auth required - should get 401)
curl https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections
# Expected: {"error":"Unauthorized",...}

# Test with Firebase token (from frontend)
# Login to https://ekklesia-prod-10-2025.web.app
# Open browser console and run:
#   firebase.auth().currentUser.getIdToken().then(t => console.log(t))
# Copy token and test:

curl -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections
# Expected: JSON array of elections
```

**4. Update Frontend API URLs**
```javascript
// apps/members-portal/js/api/elections-api.js
const API_BASE_URL = 'https://elections-service-ymzrguoifa-nw.a.run.app/api';
const ADMIN_API_BASE_URL = 'https://elections-service-ymzrguoifa-nw.a.run.app/api/admin';
```

---

### Deployment Troubleshooting

**Problem 1: Admin Routes Return 404 Instead of 401**

**Symptoms:**
```bash
curl https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections
# Returns: {"error":"Not Found","message":"Route GET /api/admin/elections not found"}
# Should return: {"error":"Unauthorized",...}
```

**Diagnosis:**
```bash
# Check if local code has admin routes
grep -n "adminRouter" services/elections/src/index.js
# Should show: const adminRouter = require('./routes/admin');
#              app.use('/api/admin', adminRouter);

# Check if commits are pushed
git status
git log origin/HEAD..HEAD  # Should be empty

# Check revision in Cloud Run
gcloud run revisions list --service elections-service --region europe-west2
```

**Solution:**
```bash
# Delete service and redeploy
gcloud run services delete elections-service --region europe-west2 --quiet
cd services/elections && ./deploy.sh

# Verify
curl https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections
# Should now get 401 Unauthorized
```

**Problem 2: Same Revision Name After Deployment**

**Symptoms:**
- Deploy succeeds but revision name doesn't change
- Same revision name across multiple deployments
- Example: `elections-service-00010-lzw` persists despite new code

**Why:** Cloud Run may reuse revision names when the service spec (env vars, resources, etc.) hasn't changed.

**Solution:** Delete and redeploy the service entirely.

**Problem 3: Docker Build Cache Issues**

**Symptoms:**
- New code not appearing in deployed service
- Same Docker image digest despite code changes

**Solution:**
```bash
# Modify a file to bust cache (e.g., add a comment)
# Then rebuild
gcloud builds submit --tag gcr.io/ekklesia-prod-10-2025/elections-service .
./deploy.sh
```

---

### Post-Deployment Verification

- [x] Health endpoint working: `curl https://elections-service-ymzrguoifa-nw.a.run.app/health`
- [x] Admin endpoints exist (return 401, not 404)
- [ ] Admin endpoints accessible with Firebase token
- [ ] RBAC working (test with election-manager and superadmin tokens)
- [ ] Database migration successful (check schema and data)
- [ ] Service logs show no errors: `gcloud run services logs read elections-service --region europe-west2`
- [ ] Frontend can call admin API (CORS configured correctly)
- [ ] Audit logging working (check `elections.admin_audit_log` table)

**Verification Commands:**
```bash
# 1. Check service is running
gcloud run services describe elections-service --region europe-west2

# 2. Check logs for startup messages
gcloud run services logs read elections-service --region europe-west2 --limit 50

# 3. List revisions and traffic split
gcloud run revisions list --service elections-service --region europe-west2

# 4. Test health endpoint
curl https://elections-service-ymzrguoifa-nw.a.run.app/health

# 5. Verify admin routes registered (should get 401, not 404)
curl https://elections-service-ymzrguoifa-nw.a.run.app/api/admin/elections
```

---

## Next Steps

### Immediate (Backend Testing)
1. [ ] Obtain Firebase ID token for testing
2. [ ] Test all 10 admin endpoints with curl/Postman
3. [ ] Verify RBAC permissions (election-manager vs superadmin)
4. [ ] Test error scenarios (invalid data, auth failures)
5. [ ] Document API responses and error codes

### Short-Term (Frontend Integration)
1. [ ] Create admin elections dashboard UI (Epic #192)
2. [ ] Implement election creation wizard
3. [ ] Add edit/hide/delete actions
4. [ ] Build results viewer
5. [ ] Test end-to-end (UI → API → Database)

### Long-Term (Production)
1. [ ] Deploy to Cloud Run
2. [ ] Monitor logs and performance
3. [ ] Add audit log viewer
4. [ ] Implement analytics dashboard
5. [ ] User acceptance testing

---

## Related Documentation

- **Epic #186:** Member Voting Experience (https://github.com/sosialistaflokkurinn/ekklesia/issues/186)
- **Epic #192:** Admin Elections Dashboard (https://github.com/sosialistaflokkurinn/ekklesia/issues/192)
- **Migration File:** `services/elections/migrations/003_admin_features.sql`
- **Admin Routes:** `services/elections/src/routes/admin.js`
- **RBAC Middleware:** `services/elections/src/middleware/rbacAuth.js`

---

**Created:** November 6, 2025  
**Status:** Backend Complete, Ready for Testing  
**Next Phase:** Admin Dashboard UI (Epic #192)
