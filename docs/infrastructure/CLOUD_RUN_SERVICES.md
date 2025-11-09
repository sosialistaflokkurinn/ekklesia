# Cloud Run Services Architecture

**Document Type**: Infrastructure Documentation
**Last Updated**: 2025-11-09
**Status**: ✅ Active - Production Services
**Project**: ekklesia-prod-10-2025
**Region**: europe-west2 (London)

---

## Overview

Ekklesia uses [Google Cloud Run](https://cloud.google.com/run) to deploy and manage microservices. The platform consists of **8 independent services** that work together to provide election management, voting, and membership functionality.

**Architecture Philosophy**: [Microservices](https://microservices.io/) approach with small, single-purpose functions that scale independently.

---

## Service Inventory

### Core Voting Services

#### 1. elections-service
**Type**: Node.js Container (Express)
**Purpose**: Anonymous ballot recording, voting, and election administration
**Deployment**: Source-based (Dockerfile)
**URL**: https://elections-service-521240388393.europe-west2.run.app
**Authentication**:
- Public access (token-based voting)
- Firebase Auth (admin API)
**Latest Deploy**: 2025-10-31 (revision 00010-lzw)

**Key Features**:
- Anonymous ballot submission
- One-time token enforcement
- Vote validation and recording
- Results aggregation (server-to-server only)
- **Admin API** (10 endpoints):
  - Full CRUD for elections management
  - Lifecycle management (draft → published → closed)
  - Soft delete (hide/unhide)
  - Hard delete (superadmin only)
  - Results retrieval for closed elections

**Technology Stack**:
- [Node.js 18+](https://nodejs.org/)
- [Express 4.21.2](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/) (via [`pg` 8.11.3](https://node-postgres.com/))
- [Firebase Admin 13.5.0](https://firebase.google.com/docs/admin/setup)

**Code Location**: `services/elections/`

**Dependencies**:
```json
{
  "express": "^4.21.2",
  "pg": "^8.11.3",
  "firebase-admin": "^13.5.0",
  "cors": "^2.8.5",
  "dotenv": "^16.6.1"
}
```

**Security Status**: ✅ 0 vulnerabilities (npm audit)

**Admin API Endpoints** (Added Nov 2025 - Issue #192):

*CRUD Operations:*
1. `GET /api/admin/elections` - List elections (filters: status, hidden, search, pagination)
2. `POST /api/admin/elections` - Create election (draft status)
3. `GET /api/admin/elections/:id` - Get single election
4. `PATCH /api/admin/elections/:id` - Update election (draft only)

*Lifecycle Management:*
5. `POST /api/admin/elections/:id/open` - Publish election
6. `POST /api/admin/elections/:id/close` - Close voting

*Soft Delete:*
7. `POST /api/admin/elections/:id/hide` - Hide election
8. `POST /api/admin/elections/:id/unhide` - Restore hidden election

*Hard Delete & Results:*
9. `DELETE /api/admin/elections/:id` - Permanent delete (superadmin only)
10. `GET /api/admin/elections/:id/results` - Get results (closed elections)

**RBAC Implementation**:
- Middleware: `services/elections/src/middleware/rbacAuth.js`
- Roles: `election-manager` (full CRUD), `superadmin` (+ hard delete)
- Authentication: Firebase token verification with custom claims
- All admin endpoints require valid Firebase ID token

**Database Schema**:
- Migration 003 (`003_admin_features.sql`) adds:
  - `hidden` (BOOLEAN) - Soft delete flag
  - `voting_type` (VARCHAR) - 'single-choice' or 'multi-choice'
  - `max_selections` (INTEGER) - Max selections for multi-choice
  - `eligibility` (VARCHAR) - Who can vote: 'members', 'admins', 'all'
  - `scheduled_start`/`scheduled_end` (TIMESTAMP) - Optional scheduling
  - `updated_by` (VARCHAR) - Last modifier UID

---

#### 2. events-service
**Type**: Node.js Container (Express)
**Purpose**: Election management and voting token issuance
**Deployment**: Source-based (Dockerfile)
**URL**: https://events-service-521240388393.europe-west2.run.app
**Authentication**: Public access (App Check + JWT validation)
**Latest Deploy**: 2025-10-31 (revision 00021-w6g)

**Key Features**:
- Election lifecycle management
- Voting token generation and issuance
- Token validation and tracking
- Audit logging for token operations

**Technology Stack**:
- [Node.js 18+](https://nodejs.org/)
- [Express 4.21.2](https://expressjs.com/)
- [PostgreSQL](https://www.postgresql.org/) (via [`pg` 8.11.3](https://node-postgres.com/))
- [Firebase Admin 13.5.0](https://firebase.google.com/docs/admin/setup)

**Code Location**: `services/events/`

**Dependencies**:
```json
{
  "express": "^4.21.2",
  "pg": "^8.11.3",
  "firebase-admin": "^13.5.0",
  "cors": "^2.8.5",
  "dotenv": "^16.6.1"
}
```

**Security Status**: ✅ 0 vulnerabilities (npm audit)

---

### Authentication & Authorization Services

#### 3. handlekenniauth
**Type**: Cloud Function (Node.js)
**Purpose**: Kenni.is OAuth authentication integration
**Deployment**: Firebase Cloud Functions
**URL**: https://handlekenniauth-521240388393.europe-west2.run.app
**Authentication**: Public access (OAuth callback endpoint)
**Latest Deploy**: 2025-10-30

**Key Features**:
- Kenni.is OAuth 2.0 flow handling
- Government eID authentication
- User profile creation/update
- Session token issuance

**Technology Stack**:
- Node.js (Firebase Functions)
- Firebase Admin SDK
- Firebase Authentication
- Kenni.is API integration

**Code Location**: `services/members/functions/handlekenniauth/`

**Usage**: **Most frequently used service** (136 references in codebase)

**OAuth Flow**:
1. User initiates login
2. Redirect to Kenni.is
3. User authenticates with Icelandic eID
4. Kenni.is redirects back to this service
5. Service validates OAuth code
6. Creates/updates Firebase user
7. Issues session token
8. Redirects to application

---

#### 4. verifymembership
**Type**: Cloud Function (Node.js)
**Purpose**: Real-time membership verification
**Deployment**: Firebase Cloud Functions
**URL**: https://verifymembership-521240388393.europe-west2.run.app
**Authentication**: Require authentication (Firebase Auth)
**Latest Deploy**: 2025-10-29

**Key Features**:
- Verify user is active member
- Check membership status in Django backend
- Cache verification results
- Return membership details (name, email, phone, roles)

**Technology Stack**:
- Node.js (Firebase Functions)
- Firebase Admin SDK
- Django API integration
- Firestore (membership cache)

**Code Location**: `services/members/functions/verifymembership/`

**Usage**: 48 references in codebase (critical security function)

**Verification Flow**:
1. Frontend requests verification (with Firebase token)
2. Service validates Firebase token
3. Service checks Firestore cache (60 min TTL)
4. If cache miss: fetch from Django API
5. Update Firestore with fresh data
6. Return membership details to frontend

---

### Data Synchronization Services

#### 5. syncmembers
**Type**: Cloud Function (Node.js)
**Purpose**: Scheduled hourly membership synchronization
**Deployment**: Firebase Cloud Functions
**URL**: https://syncmembers-521240388393.europe-west2.run.app
**Authentication**: Require authentication (Cloud Scheduler + service account)
**Latest Deploy**: 2025-10-30

**Key Features**:
- Hourly sync from Django backend
- Differential updates (only changed members)
- Firestore members collection update
- Audit logging of sync operations

**Technology Stack**:
- Node.js (Firebase Functions)
- Firebase Admin SDK
- Django API integration
- Cloud Scheduler trigger

**Code Location**: `services/members/functions/syncmembers/`

**Usage**: 19 references in codebase

**Sync Schedule**: Every hour (Cloud Scheduler: `0 * * * *`)

**Sync Process**:
1. Cloud Scheduler triggers function
2. Fetch all members from Django API (`/felagar/api/full/`)
3. Compare with current Firestore members
4. Identify additions, updates, deletions
5. Apply changes to Firestore
6. Log sync results to audit table

---

#### 6. updatememberprofile
**Type**: Cloud Function (Python)
**Purpose**: Update member profile information
**Deployment**: Firebase Cloud Functions
**URL**: https://updatememberprofile-521240388393.europe-west2.run.app
**Authentication**: Require authentication (Firebase Auth)
**Latest Deploy**: 2025-10-30

**Key Features**:
- Update member profile (email, phone, address)
- Push changes to Django backend
- Update Firestore cache
- Validate profile data

**Technology Stack**:
- Python 3.11
- Firebase Admin SDK (Python)
- Django API integration

**Code Location**: `services/members/functions/updatememberprofile/`

**Usage**: 3 references in codebase

**Update Flow**:
1. Frontend sends profile update request
2. Service validates Firebase token
3. Service validates profile data (email format, phone format)
4. Push update to Django API
5. Update Firestore cache
6. Return success confirmation

---

### Audit & Monitoring Services

#### 7. auditmemberchanges
**Type**: Cloud Function (Python)
**Purpose**: Audit logging for member data changes
**Deployment**: Firebase Cloud Functions
**URL**: https://auditmemberchanges-521240388393.europe-west2.run.app
**Authentication**: Require authentication (internal only)
**Latest Deploy**: 2025-10-29

**Key Features**:
- Log all member profile changes
- Track who made changes (admin vs self-service)
- Store change history in Firestore
- Retention: 90 days

**Technology Stack**:
- Python 3.11
- Firebase Admin SDK (Python)
- Firestore (audit logs)

**Code Location**: `services/members/functions/auditmemberchanges/`

**Usage**: 4 references in codebase

**Logged Events**:
- Profile updates (email, phone, address)
- Role changes (admin, member)
- Membership status changes
- Authentication events

**Audit Log Schema**:
```json
{
  "timestamp": "2025-10-31T12:00:00Z",
  "user_id": "firebase_uid",
  "action": "profile_update",
  "changes": {
    "email": {"old": "old@example.com", "new": "new@example.com"}
  },
  "actor": "user_self | admin_uid",
  "ip_address": "1.2.3.4"
}
```

---

#### 8. healthz
**Type**: Cloud Function (Node.js)
**Purpose**: Health check endpoint for monitoring
**Deployment**: Firebase Cloud Functions
**URL**: https://healthz-521240388393.europe-west2.run.app
**Authentication**: Public access
**Latest Deploy**: 2025-10-29

**Key Features**:
- System health status
- Service availability checks
- Database connectivity test
- Response time measurement

**Technology Stack**:
- Node.js (Firebase Functions)
- Firebase Admin SDK

**Code Location**: `services/members/functions/healthz/`

**Usage**: 7 references in codebase

**Health Check Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-31T12:00:00Z",
  "services": {
    "firestore": "ok",
    "auth": "ok",
    "postgres": "ok"
  },
  "version": "1.0.0",
  "uptime": 3600
}
```

---

## Deployment History

### Recent Deployments (Last 7 Days)

| Service | Date | Deployer | Changes |
|---------|------|----------|---------|
| elections-service | 2025-10-31 | gudrodur@sosialistaflokkurinn.is | Dependencies update (express 4.21.2, dotenv 16.6.1) |
| events-service | 2025-10-31 | gudrodur@sosialistaflokkurinn.is | Dependencies update (express 4.21.2, firebase-admin 13.5.0) |
| handlekenniauth | 2025-10-30 | Cloud Run functions | Bug fixes |
| syncmembers | 2025-10-30 | Cloud Run functions | Sync logic improvements |
| updatememberprofile | 2025-10-30 | Cloud Run functions | Profile validation |
| verifymembership | 2025-10-29 | Cloud Run functions | Cache optimization |
| auditmemberchanges | 2025-10-29 | Cloud Run functions | Audit logging enhancements |
| healthz | 2025-10-29 | Cloud Run functions | Health check improvements |

---

## Service Dependencies

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Firebase Hosting)              │
│                     apps/members-portal/                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │handlekenn│   │verifymemb│   │elections-│
   │  iauth   │   │ ership   │   │ service  │
   └────┬─────┘   └────┬─────┘   └────┬─────┘
        │              │              │
        └──────────────┼──────────────┘
                       ▼
              ┌─────────────────┐
              │  events-service │
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │syncmembers│  │updatemem│  │auditmemb│
   └──────────┘  │berprofile│  │erchanges│
                 └──────────┘  └──────────┘
```

### External Dependencies

**PostgreSQL Database (Cloud SQL)**:
- elections-service (voting records)
- events-service (token issuance, audit logs)

**Firebase Services**:
- Authentication (all services)
- Firestore (membership cache, audit logs)
- App Check (elections-service, events-service)

**External APIs**:
- Kenni.is OAuth (handlekenniauth)
- Django Backend API (syncmembers, verifymembership, updatememberprofile)

---

## Scaling Configuration

### Auto-Scaling Settings

| Service | Min Instances | Max Instances | Concurrency | Memory | CPU |
|---------|--------------|---------------|-------------|--------|-----|
| elections-service | 0 | 100 | 80 | 512Mi | 1 |
| events-service | 0 | 100 | 80 | 512Mi | 1 |
| handlekenniauth | 0 | 10 | 80 | 256Mi | 1 |
| verifymembership | 0 | 10 | 80 | 256Mi | 1 |
| syncmembers | 0 | 1 | 1 | 256Mi | 1 |
| updatememberprofile | 0 | 5 | 10 | 256Mi | 1 |
| auditmemberchanges | 0 | 5 | 10 | 256Mi | 1 |
| healthz | 0 | 1 | 80 | 128Mi | 0.5 |

**Scaling Strategy**:
- **Min instances = 0**: Cost optimization (scale to zero when idle)
- **High concurrency**: Maximize throughput per instance
- **Independent scaling**: Each service scales based on its own load

**Expected Load Patterns**:
- **Peak**: During monthly meetings (300-500 concurrent voters)
- **Normal**: Low traffic between meetings
- **Sync jobs**: Hourly scheduled (syncmembers)

---

## Cost Optimization

### Monthly Cost Estimate

**Baseline (Low Traffic)**:
```
elections-service:      $0.50/month (10 requests/day)
events-service:         $0.50/month (10 requests/day)
handlekenniauth:        $1.00/month (50 authentications/month)
verifymembership:       $0.30/month (membership checks)
syncmembers:            $0.20/month (720 hourly runs)
updatememberprofile:    $0.10/month (5 updates/month)
auditmemberchanges:     $0.05/month (audit logging)
healthz:                $0.05/month (health checks)
────────────────────────────────────────────────────
Total:                  ~$2.70/month
```

**Meeting Day (500 attendees, 5 elections)**:
```
elections-service:      $2.00 (2,500 votes + scaling)
events-service:         $1.00 (2,500 token requests)
handlekenniauth:        $0.50 (500 authentications)
verifymembership:       $0.20 (500 verifications)
Other services:         $0.10 (minimal activity)
────────────────────────────────────────────────────
Meeting cost:           ~$3.80
```

**Annual Estimate**: ~$35-50 (baseline + 12 meetings)

**Cost Optimization Strategies**:
1. ✅ Scale to zero when idle
2. ✅ High concurrency per instance
3. ✅ Efficient cold start (small functions)
4. ✅ Cache membership data (reduce Django API calls)
5. ✅ Scheduled sync (hourly, not real-time)

---

## Security Architecture

### Authentication Methods

| Service | Method | Details |
|---------|--------|---------|
| elections-service | Token-based | One-time voting tokens from events-service |
| events-service | JWT + App Check | Firebase JWT + App Check token |
| handlekenniauth | OAuth callback | Kenni.is OAuth 2.0 state validation |
| verifymembership | Firebase Auth | Required Firebase ID token |
| syncmembers | Service account | Cloud Scheduler service account |
| updatememberprofile | Firebase Auth | Required Firebase ID token |
| auditmemberchanges | Internal only | Called by other services |
| healthz | Public | No authentication required |

### Security Features

**elections-service**:
- ✅ One-time token enforcement
- ✅ Anonymous voting (no PII stored)
- ✅ Rate limiting (300 req/sec)
- ✅ CORS restrictions
- ✅ Input validation

**events-service**:
- ✅ JWT signature validation
- ✅ App Check token verification
- ✅ Role-based access control
- ✅ Audit logging (all token operations)
- ✅ Token expiration (15 min default)

**handlekenniauth**:
- ✅ OAuth state validation (CSRF protection)
- ✅ Kenni.is API signature verification
- ✅ Session timeout (24 hours)
- ✅ Secure cookie handling

**verifymembership**:
- ✅ Firebase token validation
- ✅ Membership cache (reduce Django API exposure)
- ✅ Rate limiting per user

**All Services**:
- ✅ HTTPS only
- ✅ Secrets in Secret Manager (not environment variables)
- ✅ Service-to-service authentication
- ✅ Network egress restrictions

---

## Monitoring & Observability

### Cloud Logging

**Log Levels**:
- `ERROR`: Service failures, unhandled exceptions
- `WARN`: Rate limit reached, cache misses, deprecated features
- `INFO`: Normal operations (auth success, vote recorded, sync complete)
- `DEBUG`: Detailed troubleshooting (disabled in production)

**Structured Logging**:
```json
{
  "severity": "INFO",
  "timestamp": "2025-10-31T12:00:00Z",
  "service": "elections-service",
  "event": "vote_recorded",
  "metadata": {
    "election_id": "123",
    "token_hash_prefix": "a1b2c3",
    "response_time_ms": 45
  }
}
```

### Metrics & Alerting

**Key Metrics**:
- Request rate (req/sec)
- Response time (p50, p95, p99)
- Error rate (%)
- Instance count (current/max)
- Memory usage (MB)
- CPU usage (%)

**Alerts** (configured in Cloud Monitoring):
- Error rate > 5% for 5 minutes
- Response time p95 > 1000ms for 5 minutes
- Instance count > 80% of max for 10 minutes
- Service down (no requests for 10 minutes on meeting day)

### Health Check Endpoints

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| elections-service | `/health` | `{"status":"ok"}` |
| events-service | `/health` | `{"status":"ok"}` |
| healthz | `/` | `{"status":"healthy","services":{...}}` |

---

## Deployment Procedures

### Manual Deployment (elections-service, events-service)

**Prerequisites**:
- `gcloud` CLI authenticated
- Firebase CLI authenticated
- Source code updated and tested locally

**Elections Service**:
```bash
cd services/elections

# Deploy to Cloud Run
gcloud run deploy elections-service \
  --source=. \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025

# Verify deployment
curl https://elections-service-521240388393.europe-west2.run.app/health
```

**Events Service**:
```bash
cd services/events

# Deploy to Cloud Run
gcloud run deploy events-service \
  --source=. \
  --region=europe-west2 \
  --project=ekklesia-prod-10-2025

# Verify deployment
curl https://events-service-521240388393.europe-west2.run.app/health
```

### Firebase Functions Deployment

**Deploy All Functions**:
```bash
cd services/members

# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:handlekenniauth
```

**Deploy to Staging First**:
```bash
# Deploy to staging project (if configured)
firebase use staging
firebase deploy --only functions

# Test staging
curl https://handlekenniauth-staging-....run.app/health

# Deploy to production
firebase use production
firebase deploy --only functions
```

---

## Troubleshooting

### Common Issues

#### 1. "Service Unavailable (503)"

**Cause**: Cold start or scaling timeout

**Solution**:
- Wait 10-30 seconds and retry
- For meetings: Pre-warm with `--min-instances=10`
- Check Cloud Run logs for errors

**Investigation**:
```bash
gcloud logging read "resource.labels.service_name=elections-service AND severity>=ERROR" --limit=10
```

#### 2. "Authentication Failed"

**Cause**: Expired Firebase token or invalid App Check token

**Solution**:
- Refresh user authentication
- Check App Check configuration
- Verify Firebase project settings

**Investigation**:
```bash
# Check auth failures
gcloud logging read "resource.labels.service_name=events-service AND textPayload=~'auth.*fail'" --limit=10
```

#### 3. "Database Connection Timeout"

**Cause**: Cloud SQL instance paused or connection pool exhausted

**Solution**:
- Check Cloud SQL instance status
- Restart Cloud SQL if needed
- Increase connection pool size (if persistent issue)

**Investigation**:
```bash
# Check Cloud SQL status
gcloud sql instances describe ekklesia-db --project=ekklesia-prod-10-2025

# Check connection errors
gcloud logging read "resource.labels.service_name=elections-service AND textPayload=~'ECONNREFUSED|ETIMEDOUT'" --limit=10
```

#### 4. "Sync Failed (syncmembers)"

**Cause**: Django API unreachable or rate limited

**Solution**:
- Check Django backend health
- Verify API token in Secret Manager
- Review sync logs for specific error

**Investigation**:
```bash
# Check sync logs
gcloud logging read "resource.labels.service_name=syncmembers AND severity>=ERROR" --limit=10
```

---

## Disaster Recovery

### Service Outage Response

**Critical Services (immediate response required)**:
1. `handlekenniauth` - Users cannot log in
2. `elections-service` - Users cannot vote
3. `events-service` - Token issuance fails

**High Priority (response within 1 hour)**:
4. `verifymembership` - Membership checks fail

**Medium Priority (response within 24 hours)**:
5. `syncmembers` - Hourly sync fails (manual sync possible)
6. `updatememberprofile` - Profile updates fail

**Low Priority (response within 7 days)**:
7. `auditmemberchanges` - Audit logging fails
8. `healthz` - Health check unavailable

### Recovery Procedures

**Step 1: Identify Failed Service**
```bash
# List all services and their status
gcloud run services list --region=europe-west2

# Check recent deployments
gcloud run revisions list --service=elections-service --region=europe-west2 --limit=5
```

**Step 2: Check Logs**
```bash
# Check error logs (last 10 minutes)
gcloud logging read "resource.labels.service_name=elections-service AND severity>=ERROR AND timestamp>=\"$(date -u -d '10 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')\"" --limit=50
```

**Step 3: Rollback (if recent deployment caused issue)**
```bash
# Rollback to previous revision
gcloud run services update-traffic elections-service \
  --to-revisions=elections-service-00009-xyz=100 \
  --region=europe-west2
```

**Step 4: Redeploy (if service is corrupted)**
```bash
# Force new deployment
cd services/elections
gcloud run deploy elections-service \
  --source=. \
  --region=europe-west2 \
  --tag=recovery-$(date +%s)
```

**Step 5: Verify Recovery**
```bash
# Test health endpoint
curl https://elections-service-521240388393.europe-west2.run.app/health

# Check recent logs (no errors)
gcloud logging read "resource.labels.service_name=elections-service AND severity>=ERROR AND timestamp>=\"$(date -u -d '5 minutes ago' '+%Y-%m-%dT%H:%M:%SZ')\"" --limit=10
```

---

## Future Improvements

### Phase 7 Roadmap (TBD)

**Potential Optimizations**:
1. ❓ Merge `healthz` + `auditmemberchanges` into single monitoring service
2. ❓ Add request tracing (Cloud Trace integration)
3. ❓ Implement caching layer (Cloud Memorystore)
4. ❓ Add load testing automation (Artillery/k6)
5. ❓ Multi-region deployment (disaster recovery)

**Not Recommended**:
- ❌ Merging core services (auth, verification, sync, voting)
- ❌ Switching to monolithic architecture
- ❌ Moving to always-on instances (cost increase)

---

## Related Documentation

- [Django Backend System](../systems/DJANGO_BACKEND_SYSTEM.md) - Backend integration details
- Elections Service (see services/elections/)
- Events Service (see services/events/)
- [Members Deployment Guide](../setup/MEMBERS_DEPLOYMENT_GUIDE.md)
- [Operational Procedures](../operations/OPERATIONAL_PROCEDURES.md)
- [Usage Context & Load Patterns](../development/guides/workflows/USAGE_CONTEXT.md)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-10-31 | Initial documentation | Claude + Gemini analysis |
| 2025-10-31 | Deleted unused get-django-token service | Gemini |
| 2025-10-31 | Updated elections-service & events-service dependencies | gudrodur |

---

**Document Status**: ✅ Complete and Verified
**Last Review**: 2025-10-31
**Next Review**: 2025-11-30 (monthly infrastructure review)
