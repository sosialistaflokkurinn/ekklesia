# Phase 5 Week 1 Implementation Plan - Epic #43

**Epic**: Membership Sync with Django Backend (#43)
**Branch**: `feature/epic-43-membership-sync`
**Duration**: 1 week (5 business days), runs **parallel with Epic #24**
**Status**: 🟡 Ready to Start
**Target**: Complete membership sync service scaffold and initial Django integration by end of Week 1

---

## Week 1 Overview

Week 1 focuses on **building the membership synchronization infrastructure**:

1. **New Service Creation** - Create membership-sync Cloud Run service (Node.js)
2. **Database Schema** - Create membership and sync_log tables
3. **Django Integration** - Implement Django API client
4. **Scheduling** - Set up Cloud Scheduler for hourly syncs
5. **Testing Infrastructure** - Unit tests and dry-run capability

By end of Week 1:
- ✅ Membership-sync service created and deployed
- ✅ Database schema complete
- ✅ Django API integration working
- ✅ Hourly sync scheduler configured (staging)
- ✅ Dry-run mode available for testing
- ✅ Ready for integration with Epic #24 and #87

---

## Architecture Overview

```
┌─────────────────────┐
│  Cloud Scheduler    │ (hourly trigger)
│  (or webhook)       │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────────────┐
│  Membership-Sync Service         │ NEW SERVICE
│  (Node.js + Express)             │
│  https://membership-sync.run.app │
├──────────────────────────────────┤
│ 1. Fetch members from Django     │
│ 2. Calculate delta (added/removed)
│ 3. Update Cloud SQL members table│
│ 4. Log sync event to sync_log    │
│ 5. Notify Elections/Events via   │
│    REST API                      │
└──────────────────────────────────┘
           │
           ├─────────────────┬─────────────────┐
           ▼                 ▼                 ▼
        Django Backend   Cloud SQL        Webhook
        (fetch members)  (store members)  (notify)
```

---

## Daily Breakdown

### Monday - Service Setup & Database Schema

**Objective**: Create new membership-sync service and database schema

**Tasks**:

1. **Create Service Scaffold** (1.5 hours)
   ```bash
   # Create service structure
   mkdir -p services/membership-sync/{src,src/routes,src/middleware,src/config,tests}

   # Create basic files:
   # - src/index.js (main entry point)
   # - src/config/database.js (PostgreSQL pool)
   # - src/config/django.js (Django API client config)
   # - src/routes/sync.js (sync endpoints)
   # - src/middleware/auth.js (authentication)
   # - package.json (dependencies)
   # - .env.example (configuration template)
   ```

2. **Initialize Node.js Project** (30 min)
   ```bash
   cd services/membership-sync
   npm init -y
   npm install express cors dotenv pg axios
   npm install --save-dev jest supertest nodemon
   ```

3. **Create Database Schema Migration** (2 hours)
   ```sql
   -- File: services/membership-sync/migrations/001_create_membership_tables.sql

   -- Membership table (replaces/extends users table)
   CREATE TABLE IF NOT EXISTS public.members (
     id SERIAL PRIMARY KEY,
     kennitala VARCHAR(10) UNIQUE NOT NULL,
     name VARCHAR(255) NOT NULL,
     email VARCHAR(255),
     phone VARCHAR(20),
     is_active BOOLEAN DEFAULT true,
     added_at TIMESTAMP DEFAULT NOW(),
     removed_at TIMESTAMP,
     sync_source VARCHAR(50) DEFAULT 'django',  -- where this member came from
     external_id VARCHAR(255),  -- Django user ID
     metadata JSONB,  -- extensible data
     last_verified_at TIMESTAMP
   );

   -- Sync log for audit trail
   CREATE TABLE IF NOT EXISTS public.sync_log (
     id SERIAL PRIMARY KEY,
     sync_type VARCHAR(50),  -- 'membership', 'webhook', 'manual'
     sync_timestamp TIMESTAMP DEFAULT NOW(),
     members_added INT DEFAULT 0,
     members_removed INT DEFAULT 0,
     members_verified INT DEFAULT 0,
     error_count INT DEFAULT 0,
     details JSONB,  -- sync details, errors, etc.
     status VARCHAR(50) DEFAULT 'pending'  -- pending/success/failed
   );

   -- Index for membership queries
   CREATE INDEX idx_members_active ON public.members(is_active);
   CREATE INDEX idx_members_kennitala ON public.members(kennitala);
   CREATE INDEX idx_sync_log_timestamp ON public.sync_log(sync_timestamp DESC);
   ```

4. **Test Migration Locally** (30 min)
   ```bash
   # Run migration on dev database
   psql "$DEV_CONN_URI" -f services/membership-sync/migrations/001_create_membership_tables.sql

   # Verify tables created
   psql "$DEV_CONN_URI" -c "\dt public.members"
   psql "$DEV_CONN_URI" -c "\dt public.sync_log"
   ```

**Deliverables**:
- [ ] Service directory structure created
- [ ] package.json with dependencies configured
- [ ] Migration file created and tested
- [ ] .env.example template created
- [ ] Commit: "Create membership-sync service scaffold and database schema"

---

### Tuesday - Django API Integration

**Objective**: Implement Django API client for member fetching

**Tasks**:

1. **Create Django API Client** (2 hours)
   ```javascript
   // File: services/membership-sync/src/config/django.js

   const axios = require('axios');

   class DjangoClient {
     constructor(baseUrl, apiKey) {
       this.baseUrl = baseUrl;
       this.apiKey = apiKey;
       this.client = axios.create({
         baseURL: baseUrl,
         headers: {
           'Authorization': `Bearer ${apiKey}`,
           'Content-Type': 'application/json'
         }
       });
     }

     /**
      * Fetch all active members from Django
      * Expected response format:
      * {
      *   "results": [
      *     { "id": 123, "kennitala": "0101011234", "name": "Name", "email": "email@example.com" },
      *     ...
      *   ]
      * }
      */
     async getMembers() {
       // TODO: Fetch from Django API endpoint
       // Handle pagination if needed
       // Return array of members
     }

     /**
      * Fetch members modified since timestamp
      * Optimization: Only fetch changed members
      */
     async getMembersModifiedSince(timestamp) {
       // TODO: Fetch only changed members
     }

     /**
      * Test Django API connection
      * Verify authentication and response format
      */
     async healthCheck() {
       // TODO: Test connectivity
     }
   }

   module.exports = DjangoClient;
   ```

2. **Create Sync Logic** (2 hours)
   ```javascript
   // File: services/membership-sync/src/services/syncService.js

   class MembershipSyncService {
     constructor(django, pool) {
       this.django = django;
       this.pool = pool;
     }

     /**
      * Main sync operation:
      * 1. Fetch members from Django
      * 2. Compare with current members in Cloud SQL
      * 3. Calculate delta (added, removed, updated)
      * 4. Update database
      * 5. Log sync event
      */
     async performSync(dryRun = false) {
       const client = await this.pool.connect();
       try {
         // Start transaction
         await client.query('BEGIN');

         // Fetch from Django
         const djangoMembers = await this.django.getMembers();

         // Get current members from Cloud SQL
         const currentMembers = await client.query(
           'SELECT kennitala FROM public.members WHERE is_active = true'
         );

         // Calculate delta
         const delta = this.calculateDelta(djangoMembers, currentMembers.rows);

         // Update database (if not dry-run)
         if (!dryRun) {
           // Add new members
           for (const member of delta.added) {
             await client.query(
               'INSERT INTO public.members (kennitala, name, email, is_active) VALUES ($1, $2, $3, true)',
               [member.kennitala, member.name, member.email]
             );
           }

           // Mark removed members as inactive
           for (const kennitala of delta.removed) {
             await client.query(
               'UPDATE public.members SET is_active = false, removed_at = NOW() WHERE kennitala = $1',
               [kennitala]
             );
           }
         }

         // Log sync event
         const syncResult = {
           members_added: delta.added.length,
           members_removed: delta.removed.length,
           members_verified: delta.updated.length,
           dry_run: dryRun,
           timestamp: new Date().toISOString()
         };

         if (!dryRun) {
           await client.query(
             'INSERT INTO public.sync_log (sync_type, members_added, members_removed, members_verified, details, status) VALUES ($1, $2, $3, $4, $5, $6)',
             ['membership', delta.added.length, delta.removed.length, delta.updated.length, JSON.stringify(syncResult), 'success']
           );
         }

         await client.query('COMMIT');
         return syncResult;
       } catch (err) {
         await client.query('ROLLBACK');
         throw err;
       } finally {
         client.release();
       }
     }

     calculateDelta(djangoMembers, currentMembers) {
       // TODO: Calculate which members to add, remove, update
       // Return: { added: [...], removed: [...], updated: [...] }
     }
   }

   module.exports = MembershipSyncService;
   ```

3. **Configuration & Environment Variables** (30 min)
   ```bash
   # .env file template
   NODE_ENV=development
   PORT=8080

   # Database
   DATABASE_URL=postgresql://postgres:password@localhost:5432/ekklesia_dev

   # Django API
   DJANGO_BASE_URL=https://members.example.com
   DJANGO_API_KEY=your-api-key-here

   # Scheduling
   SYNC_ENABLED=true
   SYNC_INTERVAL_MINUTES=60  # Hourly

   # Security
   ADMIN_API_KEY=admin-key-for-triggers
   ```

**Deliverables**:
- [ ] Django API client implemented
- [ ] Membership sync service logic implemented
- [ ] Database transaction handling correct
- [ ] Configuration templated
- [ ] Commit: "Implement Django API integration and membership sync logic"

---

### Wednesday - Service Endpoints & Scheduling

**Objective**: Complete REST endpoints and Cloud Scheduler integration

**Tasks**:

1. **Create Main Service Endpoints** (1.5 hours)
   ```javascript
   // File: services/membership-sync/src/routes/sync.js

   // GET /health
   // Health check endpoint (no auth required)

   // POST /sync (authenticated)
   // Trigger immediate sync (admin only)

   // POST /sync/dry-run (authenticated)
   // Test sync without persisting changes

   // GET /sync/status (authenticated)
   // Get last sync status and results

   // GET /sync/logs (authenticated)
   // List recent sync operations
   ```

2. **Implement Cloud Scheduler Integration** (1.5 hours)
   ```bash
   # Create Cloud Scheduler job
   gcloud scheduler jobs create pubsub membership-sync-job \
     --location=europe-west2 \
     --schedule="0 * * * *" \  # Every hour
     --topic=membership-sync-trigger \
     --message-body='{"sync_type":"scheduled"}'

   # Or use HTTP trigger:
   gcloud scheduler jobs create http membership-sync-job \
     --location=europe-west2 \
     --schedule="0 * * * *" \
     --uri="https://membership-sync.run.app/sync" \
     --http-method=POST \
     --oidc-service-account-email=...
   ```

3. **Service Startup Code** (1 hour)
   ```javascript
   // File: services/membership-sync/src/index.js

   const express = require('express');
   const syncRouter = require('./routes/sync');
   const { pool } = require('./config/database');
   const DjangoClient = require('./config/django');

   const app = express();
   const PORT = process.env.PORT || 8080;

   // Initialize Django client
   const django = new DjangoClient(
     process.env.DJANGO_BASE_URL,
     process.env.DJANGO_API_KEY
   );

   // Middleware
   app.use(express.json());

   // Routes
   app.use('/sync', syncRouter);
   app.get('/health', (req, res) => {
     res.json({ status: 'healthy', service: 'membership-sync' });
   });

   // Start server
   app.listen(PORT, () => {
     console.log(`Membership-sync service running on port ${PORT}`);
   });
   ```

4. **Testing Endpoints** (1 hour)
   ```bash
   # Test health endpoint
   curl http://localhost:8080/health

   # Test dry-run sync
   curl -X POST http://localhost:8080/sync/dry-run \
     -H "Authorization: Bearer $ADMIN_KEY" \
     -H "Content-Type: application/json"

   # Check sync status
   curl http://localhost:8080/sync/status \
     -H "Authorization: Bearer $ADMIN_KEY"
   ```

**Deliverables**:
- [ ] All endpoints implemented
- [ ] Endpoint authentication working
- [ ] Cloud Scheduler configured (staging)
- [ ] Dry-run mode functional
- [ ] Commit: "Add sync service endpoints and Cloud Scheduler integration"

---

### Thursday - Testing & Error Handling

**Objective**: Complete testing and error handling

**Tasks**:

1. **Unit Tests** (1.5 hours)
   ```javascript
   // File: services/membership-sync/tests/sync.test.js

   describe('MembershipSyncService', () => {
     // Test calculateDelta logic
     // Test database transaction rollback on error
     // Test dry-run mode
     // Test error logging
   });
   ```

2. **Integration Tests** (1.5 hours)
   ```bash
   # Test full sync flow:
   # 1. Mock Django API response
   # 2. Call sync endpoint
   # 3. Verify database updated
   # 4. Verify sync_log recorded

   npm run test:integration
   ```

3. **Error Handling** (1.5 hours)
   ```javascript
   // Handle various failure scenarios:
   // - Django API unreachable
   // - Database connection failed
   // - Invalid Django response format
   // - Partial sync failure (some members added, some failed)
   // - Token expired
   // - Rate limiting

   // Log all errors to Cloud Logging
   // Implement retry logic for transient failures
   // Alert on critical failures
   ```

4. **Load Testing** (30 min)
   ```bash
   # Test with different member counts:
   # - 100 members
   # - 1000 members
   # - 10000 members

   # Measure:
   # - Sync duration
   # - Database query performance
   # - Memory usage
   # - CPU usage
   ```

**Deliverables**:
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Error handling comprehensive
- [ ] Load test results documented
- [ ] Commit: "Add comprehensive tests and error handling"

---

### Friday - Documentation & Integration Planning

**Objective**: Document and prepare for integration with other epics

**Tasks**:

1. **API Documentation** (1 hour)
   - Document all endpoints with request/response formats
   - Document error responses
   - Create cURL examples
   - Document environment variables

2. **Deployment Guide** (1 hour)
   ```bash
   # Create: docs/setup/MEMBERSHIP_SYNC_DEPLOYMENT.md

   # Document:
   # - Prerequisites
   # - Environment setup
   # - Deployment steps
   # - Verification steps
   # - Rollback procedure
   # - Troubleshooting
   ```

3. **Integration Planning** (1.5 hours)
   - Review Epic #24 endpoints (how will elections API call membership API?)
   - Review Epic #87 requirements (how will member UI get eligible members?)
   - Document assumptions about:
     - Membership table schema
     - Django API response format
     - Sync timing (on-demand vs scheduled)
     - Notification mechanism (webhook vs polling)

4. **Staging Deployment** (1 hour)
   ```bash
   # Deploy to staging environment
   gcloud run deploy membership-sync-staging \
     --source=services/membership-sync \
     --region=europe-west2 \
     --project=ekklesia-staging-2025

   # Enable Cloud Scheduler (staging)
   # This allows testing hourly syncs without affecting production
   ```

**Deliverables**:
- [ ] API documentation complete
- [ ] Deployment guide written
- [ ] Integration dependencies documented
- [ ] Staging deployment complete
- [ ] Sprint closed with summary

---

## Testing Strategy

### Unit Tests
- Location: `services/membership-sync/tests/`
- Framework: Jest
- Coverage: >90%
- Command: `npm run test:unit`

### Integration Tests
- Mock Django API responses
- Test full sync pipeline
- Verify database state
- Test transaction rollback

### Load Tests
- 100, 1000, 10000 members
- Measure sync duration
- Monitor resource usage

### Dry-Run Mode
- Test sync without persisting
- Preview changes before committing
- Safe way to verify sync logic

---

## Success Criteria

### Week 1 Completion Checklist

**Service Setup** ✅
- [ ] Service directory structure created
- [ ] Node.js project initialized
- [ ] Dependencies installed
- [ ] Configuration templated

**Database** ✅
- [ ] Membership table created
- [ ] Sync log table created
- [ ] Indexes created
- [ ] Migration tested locally

**Django Integration** ✅
- [ ] API client implemented
- [ ] Member fetching works
- [ ] Authentication configured
- [ ] Response parsing correct

**Service Endpoints** ✅
- [ ] POST /sync implemented
- [ ] POST /sync/dry-run implemented
- [ ] GET /sync/status implemented
- [ ] GET /sync/logs implemented
- [ ] GET /health implemented

**Scheduling** ✅
- [ ] Cloud Scheduler configured (staging)
- [ ] Hourly trigger set up
- [ ] Manual trigger endpoint working
- [ ] Retry logic implemented

**Testing** ✅
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Error handling complete
- [ ] Load tests performed

**Documentation** ✅
- [ ] API documentation complete
- [ ] Deployment guide written
- [ ] Environment variables documented
- [ ] Integration plan created

---

## Dependencies & Blockers

### Internal Dependencies
- **Database setup**: ✅ Cloud SQL running
- **Elections service**: Will interact with in Week 2+
- **Members service**: Will provide authentication

### External Dependencies
- **Django API**: Must provide member endpoint
  - Required format: `GET /api/members` → `{ "results": [{ "id", "kennitala", "name", "email" }] }`
  - Required auth: Bearer token via `DJANGO_API_KEY`
  - Required pagination or endpoint to handle 1000+ members

### Potential Blockers
1. **Django API endpoint not ready**
   - *Resolution*: Implement mock Django API for testing until real API available
   - *Location*: `services/membership-sync/src/config/django.mock.js`

2. **Django API response format differs**
   - *Resolution*: Document expected format; build adapter layer
   - *Timeline*: Identify ASAP (Monday)

3. **Member count too large for single request**
   - *Resolution*: Implement pagination in Django client
   - *Performance*: Test with realistic member counts

---

## Development Environment

### Prerequisites
```bash
- Node.js 18+
- PostgreSQL client (psql)
- Docker (optional, for local PostgreSQL)
- Cloud SQL Proxy
```

### Local Testing
```bash
# Start proxy
./cloud-sql-proxy.linux.amd64 -dir=/tmp/cloudsql ekklesia-prod-10-2025:europe-west2:ekklesia-db &

# Install and run
cd services/membership-sync
npm install
npm run dev

# Test endpoint
curl http://localhost:8080/health
```

---

## Parallel Work with Epic #24

**Monday-Wednesday**: Both epics working independently
- Epic #24: Database and admin API
- Epic #43: Membership sync service

**Thursday-Friday**: Integration planning
- How do APIs interact?
- What data flows between them?
- Who calls whom?

**Week 2**: Integration testing
- Test full election lifecycle with membership sync
- Test token generation with real member data
- End-to-end testing

---

## Next Steps (Week 2 Preview)

After Week 1:
1. **Integration with Epic #24** - Admin API calls membership sync
2. **Django API Integration** - Replace mock with real API
3. **Production Scheduling** - Deploy Cloud Scheduler to production
4. **Monitoring & Alerts** - Set up Cloud Monitoring for sync health

---

**Epic Status**: 🟡 Week 1 Ready to Start
**Last Updated**: 2025-10-22
**Branch**: `feature/epic-43-membership-sync`
