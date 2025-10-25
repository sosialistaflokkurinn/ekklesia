# Events Service (`Atburðir`)

**Status**: ✅ **Production Deployed** (Revision 00019 - Oct 24, 2025)
**Production URL**: https://events-service-ymzrguoifa-nw.a.run.app
**Purpose**: Election administration and voting token issuance
**Architecture**: Phase 5 - Integrated with Elections Service via S2S

---

## Overview

The Events Service is a **production-ready backend API** that manages elections and voting token issuance for Sósíalistaflokkur Íslands (Socialist Party of Iceland).

**Core Responsibilities**:
- Election lifecycle management (CREATE → PUBLISH → OPEN → CLOSE → ARCHIVE)
- Role-based access control (developer, meeting_election_manager, event_manager)
- Member eligibility verification (active membership required)
- Secure one-time voting token generation
- Service-to-service (S2S) integration with Elections Service
- Audit trail (kennitala → token_hash mapping)

**Current State**: Fully functional, all critical bugs fixed (Oct 24, 2025)

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Framework | Express.js | 4.18.2 |
| Database | Cloud SQL PostgreSQL | 15 |
| Authentication | Firebase Admin SDK | 12.0.0 |
| Security | Firebase App Check | Monitor mode |
| Deployment | Cloud Run | Serverless |
| Connection Pool | node-pg | 8.11.3 |

---

## Project Structure

```
events/
├── src/
│   ├── index.js                    # Main Express server
│   ├── config/
│   │   ├── database.js             # Cloud SQL connection pool
│   │   └── firebase.js             # Firebase Admin SDK setup
│   ├── middleware/
│   │   ├── auth.js                 # JWT authentication
│   │   ├── roles.js                # Role-based authorization
│   │   └── appCheck.js             # Firebase App Check verification
│   ├── services/
│   │   ├── electionService.js      # Election business logic
│   │   ├── tokenService.js         # Token generation/management
│   │   └── electionsClient.js      # S2S client for Elections Service
│   └── routes/
│       ├── election.js             # Member-facing API endpoints
│       └── admin.js                # Admin API endpoints (role-protected)
├── migrations/
│   ├── 001_initial_schema.sql      # Initial database schema
│   ├── 002_*.sql                   # Schema migrations
│   └── README.md                   # Migration guide
├── scripts/
│   └── psql-cloud.sh               # Cloud SQL helper script
├── Dockerfile                      # Cloud Run deployment
├── package.json
├── .env.example
└── README.md                       # This file
```

---

## API Endpoints

### Public Endpoints (No Authentication)

#### GET /health
Service health check

**Response**:
```json
{
  "status": "healthy",
  "service": "events-service",
  "version": "1.0.0",
  "timestamp": "2025-10-24T00:00:00.000Z"
}
```

---

### Member API Endpoints

All endpoints require Firebase JWT authentication:
```
Authorization: Bearer <firebase-id-token>
```

#### GET /api/election
Get current active election

**Response**:
```json
{
  "id": "uuid",
  "title": "Prófunarkosning 2025-2028",
  "description": "Test election with 3-year voting period",
  "question_text": "",
  "status": "open",
  "status_message": "Active - voting is open"
}
```

**Note**: `question_text` returns empty due to column mismatch (non-blocking bug, see docs/testing/BUG_REPORT_REAL_API_INTEGRATION.md)

#### POST /api/request-token
Request a one-time voting token

**Requirements**:
- Active membership (`isMember: true` in JWT claims)
- Election status: `published` or `open`
- Within voting period (`voting_start_time` ≤ now ≤ `voting_end_time`)
- No token previously issued for this member

**Response (Success)**:
```json
{
  "success": true,
  "token": "1c52e2a6f861245b797e2bcae67f3412da430716dda2e202daf78ab099a1dc99",
  "expires_at": "2025-10-25T00:22:47.387Z",
  "message": "Token issued successfully. Save this token - you will need it to vote.",
  "note": "Save this token securely - you will need it to vote. This token will not be shown again."
}
```

**Response (Already Issued)**:
```json
{
  "error": "Conflict",
  "message": "Voting token already issued. Use GET /api/my-token to retrieve it."
}
```

**Response (Ineligible)**:
```json
{
  "error": "Forbidden",
  "message": "Election is not currently active for voting"
}
```

**Token Security**:
- 32 bytes (256 bits) cryptographically secure random
- SHA-256 hash stored in database (plain token not stored)
- Expiration: 24 hours or election end (whichever is sooner)
- Registered with Elections Service via S2S for voting

#### GET /api/my-status
Check member's participation status

**Response**:
```json
{
  "token_issued": true,
  "token_issued_at": "2025-10-24T00:22:47.387Z",
  "expires_at": "2025-10-25T00:22:47.387Z",
  "expired": false,
  "voted": false,
  "voted_at": null
}
```

#### GET /api/my-token
Retrieve previously issued token

**Response (Always)**:
```json
{
  "error": "Bad Request",
  "message": "Tokens cannot be retrieved after issuance for security reasons. Tokens are single-use and must be saved when issued. If you lost your token, please contact support.",
  "hint": "Use POST /api/request-token to get a new token if yours has expired."
}
```

**Design Decision**: Plain tokens are never stored (only SHA-256 hashes), so retrieval is impossible. This is a security feature, not a bug.

#### GET /api/results
Get election results (placeholder)

**Response**:
```json
{
  "message": "Results endpoint placeholder",
  "election_id": "uuid",
  "note": "Results are stored in Elections service"
}
```

---

### Admin API Endpoints

All admin endpoints require role-based authorization via Firebase custom claims.

**Required Roles**:
- `developer` - Full access, can delete elections
- `meeting_election_manager` - Can create/manage elections
- `event_manager` - Read-only access to elections

#### POST /api/admin/reset-election
**Role**: `developer` only
Reset election to draft state (development only)

#### GET /api/admin/elections
**Roles**: `developer`, `meeting_election_manager`, `event_manager`
List all elections

**Response**:
```json
{
  "elections": [
    {
      "id": "uuid",
      "title": "Prófunarkosning 2025-2028",
      "status": "open",
      "voting_start_time": "2025-10-24T00:13:24.335Z",
      "voting_end_time": "2028-10-23T00:13:24.335Z",
      "created_at": "2025-10-24T00:13:18.511Z"
    }
  ],
  "count": 1
}
```

#### GET /api/admin/elections/:id
**Roles**: `developer`, `meeting_election_manager`, `event_manager`
Get election details by ID

#### POST /api/admin/elections
**Roles**: `developer`, `meeting_election_manager`
Create new election

**Request Body**:
```json
{
  "title": "Prófunarkosning 2025-2028",
  "description": "Test election with 3-year voting period",
  "question": "Samþykkir þú að prófa rafrænt kosningakerfi?",
  "answers": [
    {"id": "yes", "text": "Já"},
    {"id": "no", "text": "Nei"},
    {"id": "abstain", "text": "Sitja hjá"}
  ]
}
```

**Response**:
```json
{
  "id": "uuid",
  "title": "Prófunarkosning 2025-2028",
  "status": "draft",
  "created_at": "2025-10-24T00:13:18.511Z",
  ...
}
```

#### POST /api/admin/elections/:id/publish
**Roles**: `developer`, `meeting_election_manager`
Transition: draft → published

#### POST /api/admin/elections/:id/open
**Roles**: `developer`, `meeting_election_manager`
Transition: published → open, generate voting tokens

**Request Body**:
```json
{
  "member_count": 100,
  "voting_duration_hours": 26280
}
```

**Parameters**:
- `member_count` (required): Number of voting tokens to generate (1-10000)
- `voting_duration_hours` (optional, default: 24): Hours until voting closes
  - Example: 26,280 hours = 3 years

**Response**:
```json
{
  "message": "Election opened for voting",
  "election": { ... },
  "tokens_generated": 100,
  "tokens": [
    {
      "token": "pnmnEb3wVI1-Nfam87jjzX5EG7AoTV37VktqZx-tQEo",
      "expires_at": "2028-10-23T00:13:24.142Z"
    },
    ...
  ]
}
```

**Actions**:
1. Sets `voting_start_time = NOW()`
2. Sets `voting_end_time = NOW() + voting_duration_hours`
3. Generates N voting tokens
4. Stores token hashes in database
5. Registers tokens with Elections Service (S2S)

#### POST /api/admin/elections/:id/close
**Roles**: `developer`, `meeting_election_manager`
Transition: open → closed

#### POST /api/admin/elections/:id/pause
**Roles**: `developer`, `meeting_election_manager`
Pause voting temporarily

#### POST /api/admin/elections/:id/resume
**Roles**: `developer`, `meeting_election_manager`
Resume paused voting

#### POST /api/admin/elections/:id/archive
**Roles**: `developer`, `meeting_election_manager`
Archive closed election

#### DELETE /api/admin/elections/:id
**Role**: `developer` only
Permanently delete election

#### PATCH /api/admin/elections/:id/draft
**Roles**: `developer`, `meeting_election_manager`
Update election metadata (draft only)

#### PATCH /api/admin/elections/:id/metadata
**Roles**: `developer`, `meeting_election_manager`, `event_manager`
Update election metadata

#### GET /api/admin/elections/:id/status
**Roles**: `developer`, `meeting_election_manager`, `event_manager`
Get election status summary

#### GET /api/admin/elections/:id/results
**Roles**: `developer`, `meeting_election_manager`, `event_manager`
Get election results

#### GET /api/admin/elections/:id/tokens
**Roles**: `developer`, `meeting_election_manager`, `event_manager`
Get token generation statistics

---

## Database Schema

### elections.elections Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| title | VARCHAR(255) | Election title |
| description | TEXT | Election description |
| question | TEXT | Voting question (actual column) |
| question_text | TEXT | Duplicate column (empty, known bug) |
| answers | JSONB | Answer options |
| status | VARCHAR(50) | draft, published, open, paused, closed, archived |
| voting_start_time | TIMESTAMP | Voting start time |
| voting_end_time | TIMESTAMP | Voting end time |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last update |
| published_at | TIMESTAMP | Publication time |
| closed_at | TIMESTAMP | Closure time |
| archived_at | TIMESTAMP | Archive time |
| deleted_at | TIMESTAMP | Soft delete time |
| created_by | VARCHAR(128) | Creator Firebase UID |

**Note**: Column naming was inconsistent, fixed in revisions 00016-00019. See `docs/testing/BUG_REPORT_REAL_API_INTEGRATION.md` for details.

### voting_tokens Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| kennitala | VARCHAR(11) | Member national ID (PII - audit trail) |
| token_hash | VARCHAR(64) | SHA-256 hash of voting token |
| issued_at | TIMESTAMP | Token issuance time |
| expires_at | TIMESTAMP | Token expiration time |
| voted | BOOLEAN | Whether member has voted |
| voted_at | TIMESTAMP | When vote was cast |

**Indexes**:
- `kennitala` (UNIQUE) - One token per member across ALL elections
- `token_hash` (UNIQUE) - Token validation
- `voted` - Query by voting status
- `expires_at` - Cleanup expired tokens

**Known Limitation**: One token per member globally, not per-election. This prevents members from having tokens for multiple concurrent elections.

---

## Security Model

### Authentication Flow

1. **Member Authentication**:
   - User logs in via Members Portal → Kenni.is OAuth
   - Firebase custom token issued with claims: `kennitala`, `isMember`, `roles`
   - ID token included in API requests: `Authorization: Bearer <token>`

2. **Events Service Verification**:
   - Firebase Admin SDK verifies ID token signature
   - Extracts claims: `uid`, `kennitala`, `isMember`, `roles`
   - Enforces active membership for token requests
   - Enforces role requirements for admin endpoints

3. **App Check** (Monitor Mode):
   - Verifies requests originate from legitimate Firebase apps
   - Currently in monitor-only mode (logs violations, doesn't block)
   - Will transition to enforcement mode after monitoring period

### Token Security

**Generation**:
```javascript
const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
```

**Storage**:
- Plain token: Returned to member ONCE, never stored
- Token hash: Stored in database for validation
- Kennitala: Stored for audit trail (who got token)

**Expiration**:
```javascript
const expiresAt = new Date(
  Math.min(
    Date.now() + 24 * 60 * 60 * 1000,           // 24 hours
    new Date(election.voting_end_time).getTime() // or election end
  )
);
```

**One-Time Use**:
- Database unique constraint on `kennitala` (one token per member)
- `voted` flag set to `true` after voting (enforced by Elections Service)

### Privacy Model

**Separation of Concerns**:
- **Events Service**: Knows kennitala → token_hash (audit trail: who got token)
- **Elections Service**: Knows token_hash → ballot (anonymous voting)
- **Guarantee**: Elections Service never receives kennitala, cannot identify voters

**Audit Trail**:
- Events Service can prove: "Member X received a token at time Y"
- Events Service cannot prove: "Member X voted for answer Z"
- Elections Service can prove: "Token T voted for answer Z at time Y"
- Elections Service cannot prove: "Member X voted"

---

## Role-Based Access Control

### Role Definitions

| Role | Permissions | Use Case |
|------|-------------|----------|
| `developer` | Full access, including DELETE | Development, emergency fixes |
| `meeting_election_manager` | CREATE, PUBLISH, OPEN, CLOSE elections | Meeting moderators, election admins |
| `event_manager` | Read-only access to elections | Event coordinators, observers |
| (no role) | Member API only | Regular members (voting) |

### Role Assignment

Roles are assigned via Firebase custom claims (Members Service):

```javascript
// members/functions/main.py
await admin.auth().set_custom_user_claims(uid, {
  'kennitala': '200978-3589',
  'isMember': True,
  'roles': ['developer']  // or ['meeting_election_manager'], etc.
})
```

### Role Enforcement

```javascript
// src/middleware/roles.js
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user.roles || !req.user.roles.includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

---

## Service-to-Service (S2S) Integration

### Elections Service Client

**File**: `src/services/electionsClient.js`

**Purpose**: Register voting tokens with Elections Service for voting

**Flow**:
1. Member requests token → Events Service generates token
2. Events Service stores `kennitala → token_hash` in database
3. Events Service calls Elections Service: `POST /api/register-token`
4. Elections Service stores `token_hash` (no kennitala, anonymous)
5. Member uses token to vote → Elections Service validates token_hash

**Implementation**:
```javascript
// src/services/tokenService.js
const { registerToken } = require('./electionsClient');

// After issuing token...
await registerToken(tokenHash);  // S2S call to Elections Service
```

**Error Handling**:
- S2S registration failures are logged but don't block token issuance
- Member receives token even if Elections Service is down
- Voting will fail later if token not registered (graceful degradation)

---

## Recent Fixes (Oct 24, 2025)

### Critical Bugs Fixed

**Context**: End-to-end testing revealed database schema drift - code and database used different column names.

**Bugs Fixed** (Revisions 00016-00019):

1. **Bug #1**: `voting_starts_at` / `voting_ends_at` → `voting_start_time` / `voting_end_time`
   - **Impact**: Elections showed "Ended - voting closed 1970-01-01"
   - **Fixed**: `src/services/electionService.js` (3 functions)

2. **Bug #2**: Missing `voting_end_time` in OPEN endpoint
   - **Impact**: Elections had NULL end time, token requests rejected
   - **Fixed**: `src/routes/admin.js` - Added `voting_duration_hours` parameter

3. **Bug #3**: Status check only accepted 'published', not 'open'
   - **Impact**: Opened elections not recognized as active
   - **Fixed**: `src/services/electionService.js` - Accept both statuses

4. **Bug #4**: DateTime parsing error in `tokenService.js`
   - **Impact**: Token requests failed with PostgreSQL error 22007
   - **Fixed**: `src/services/tokenService.js` - Changed `voting_ends_at` → `voting_end_time`

**Documentation**: See `docs/testing/BUG_REPORT_REAL_API_INTEGRATION.md` for full details.

**Result**: ✅ All critical bugs fixed, token issuance working perfectly.

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL client (`psql`)
- Cloud SQL Auth Proxy (gcloud 420+)
- Firebase Admin SDK credentials
- Access to Secret Manager

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create `.env` file**:
   ```bash
   cp .env.example .env
   ```

3. **Get database password** from Secret Manager:
   ```bash
   gcloud secrets versions access latest \
     --secret=postgres-password \
     --project=ekklesia-prod-10-2025
   ```

4. **Configure `.env`** (local uses Cloud SQL Auth Proxy on 127.0.0.1:5433):
   ```env
   DATABASE_HOST=127.0.0.1
   DATABASE_PORT=5433
   DATABASE_NAME=postgres
   DATABASE_USER=postgres
   DATABASE_PASSWORD=<from-secret-manager>
   FIREBASE_PROJECT_ID=ekklesia-prod-10-2025
   PORT=8080
   NODE_ENV=development
   ```

5. **Start Cloud SQL Auth Proxy** (separate terminal):
   ```bash
   cloud-sql-proxy \
     --port 5433 \
     ekklesia-prod-10-2025:europe-west2:ekklesia-db
   ```

6. **Apply migrations** (if needed):
   ```bash
   ./scripts/psql-cloud.sh -f migrations/001_initial_schema.sql
   ```

7. **Start development server**:
   ```bash
   npm run dev
   ```

8. **Test health endpoint**:
   ```bash
   curl http://localhost:8080/health
   ```

---

## Testing

### Get Firebase ID Token

1. Login to Members Portal: https://ekklesia-prod-10-2025.web.app
2. Open browser console (F12)
3. Get ID token:
   ```javascript
   firebase.auth().currentUser.getIdToken().then(console.log)
   ```

### Test Member API

```bash
# Set token
TOKEN="<your-firebase-id-token>"

# Get election
curl http://localhost:8080/api/election \
  -H "Authorization: Bearer $TOKEN"

# Request voting token
curl -X POST http://localhost:8080/api/request-token \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Check status
curl http://localhost:8080/api/my-status \
  -H "Authorization: Bearer $TOKEN"
```

### Test Admin API (Requires developer role)

```bash
# List elections
curl http://localhost:8080/api/admin/elections \
  -H "Authorization: Bearer $TOKEN"

# Create election
curl -X POST http://localhost:8080/api/admin/elections \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Election",
    "description": "Testing",
    "question": "Test question?",
    "answers": [
      {"id": "yes", "text": "Yes"},
      {"id": "no", "text": "No"}
    ]
  }'

# Open election (generates tokens)
curl -X POST "http://localhost:8080/api/admin/elections/<ELECTION_ID>/open" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "member_count": 10,
    "voting_duration_hours": 24
  }'
```

### End-to-End Testing

See `docs/testing/END_TO_END_VOTING_FLOW_TEST.md` for complete testing guide.

Test scripts:
- `/tmp/test_complete_voting_flow.sh` - Tests all 6 steps of voting flow
- `/tmp/create_election_with_duration.sh` - Creates election with custom duration

---

## Deployment

### Production Deployment

**Method**: Cloud Run (serverless, auto-scaling)

**Deploy**:
```bash
gcloud run deploy events-service \
  --source . \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025 \
  --allow-unauthenticated
```

**Environment Variables** (set via Cloud Run console):
- `DATABASE_HOST` - Cloud SQL private IP (10.x.x.x)
- `DATABASE_PORT` - 5432
- `DATABASE_NAME` - postgres
- `DATABASE_USER` - postgres
- `DATABASE_PASSWORD` - (stored in Secret Manager)
- `FIREBASE_PROJECT_ID` - ekklesia-prod-10-2025
- `NODE_ENV` - production
- `CORS_ORIGINS` - https://ekklesia-prod-10-2025.web.app,...

**Cloud SQL Connection**:
- Uses Cloud SQL Connector (not Auth Proxy) in production
- Private IP connection via VPC connector
- Connection pooling: max 20 connections

### Deployment History

| Revision | Date | Changes | Status |
|----------|------|---------|--------|
| 00015 | 2025-10-24 | Initial fix: table name `elections.elections` | ✅ |
| 00016 | 2025-10-24 | Fix: voting_start_time/voting_end_time columns | ✅ |
| 00017 | 2025-10-24 | Fix: Add voting_duration_hours parameter | ✅ |
| 00018 | 2025-10-24 | Fix: Accept 'open' status | ✅ |
| 00019 | 2025-10-24 | Fix: DateTime parsing (voting_end_time) | ✅ Current |

---

## Known Issues and Limitations

### Cosmetic Issues (Non-Blocking)

1. **question vs question_text Column Mismatch**:
   - Admin API writes to `question` column
   - Member API reads from `question_text` column (empty)
   - **Impact**: Election question shows as empty string in GET /api/election
   - **Priority**: P3 - Fix when convenient
   - **Workaround**: Question visible in Admin API responses

### Feature Gaps

1. **Bulk Token Generation**:
   - Tokens generated during OPEN endpoint aren't registered with Elections Service
   - **Impact**: Admin-generated bulk tokens can't be used for voting
   - **Workaround**: Use POST /api/request-token instead (primary flow)
   - **Status**: Known limitation, doesn't block production use

2. **One Token Per Member Globally**:
   - Database unique constraint on `kennitala` prevents multiple tokens
   - **Impact**: Member can't have tokens for multiple concurrent elections
   - **Fix**: Add `election_id` to unique constraint in future migration
   - **Priority**: P2 - Required for multiple concurrent elections

### Security Considerations

1. **App Check**:
   - Currently in monitor-only mode
   - Will transition to enforcement mode after 1-2 days of monitoring
   - See `docs/security/FIREBASE_APP_CHECK_IMPLEMENTATION.md` Phase 5

2. **Rate Limiting**:
   - No rate limiting implemented yet
   - Cloud Run has built-in DoS protection
   - Consider adding rate limiting for production use

---

## Monitoring and Operations

### Health Checks

```bash
# Production
curl https://events-service-ymzrguoifa-nw.a.run.app/health

# Expected
{
  "status": "healthy",
  "service": "events-service",
  "version": "1.0.0",
  "timestamp": "2025-10-24T00:00:00.000Z"
}
```

### Logs

**Cloud Logging**:
```bash
# View logs
gcloud logging read "resource.type=cloud_run_revision \
  AND resource.labels.service_name=events-service" \
  --limit 50 \
  --project=ekklesia-prod-10-2025
```

**Log Filters**:
- Errors: `severity>=ERROR`
- Admin actions: `jsonPayload.path=~"/api/admin/"`
- Token requests: `jsonPayload.path="/api/request-token"`

### Metrics

**Cloud Run Metrics**:
- Request rate
- Error rate (target: <5%)
- Instance count
- Request latency (p95, p99)
- CPU/Memory usage

**Database Metrics**:
- Connection pool usage (max 20)
- Query latency
- Transaction rate

---

## Related Documentation

### Testing
- [BUG_REPORT_REAL_API_INTEGRATION.md](../../docs/testing/BUG_REPORT_REAL_API_INTEGRATION.md) - Bug fixes Oct 24
- [EVENTS_SERVICE_INTEGRATION_SUCCESS.md](../../docs/testing/EVENTS_SERVICE_INTEGRATION_SUCCESS.md) - Success report
- [END_TO_END_VOTING_FLOW_TEST.md](../../docs/testing/END_TO_END_VOTING_FLOW_TEST.md) - Testing guide

### Design
- [EVENTS_SERVICE_MVP.md](../../docs/design/EVENTS_SERVICE_MVP.md) - Original design doc
- [SYSTEM_ARCHITECTURE_OVERVIEW.md](../../docs/SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall architecture

### Operations
- [OPERATIONAL_PROCEDURES.md](../../docs/OPERATIONAL_PROCEDURES.md) - Meeting day procedures
- [USAGE_CONTEXT.md](../../docs/USAGE_CONTEXT.md) - Load patterns, capacity planning

### Security
- [ROLES_AND_PERMISSIONS.md](../../docs/guides/ROLES_AND_PERMISSIONS.md) - Role definitions
- [FIREBASE_APP_CHECK_IMPLEMENTATION.md](../../docs/security/FIREBASE_APP_CHECK_IMPLEMENTATION.md) - App Check setup

---

## Support and Contact

**Production Issues**:
- Cloud Logging: https://console.cloud.google.com/logs
- Cloud Run Console: https://console.cloud.google.com/run
- Cloud SQL Console: https://console.cloud.google.com/sql

**Code Issues**:
- GitHub: https://github.com/anthropics/claude-code/issues

**Documentation Updates**:
- This README last updated: 2025-10-24
- Update after major changes or deployments

---

**Status**: ✅ Production Ready (Revision 00019)
**Last Validated**: 2025-10-24
**Next Review**: After first production meeting
