# Events Service (`Atburðir`)

**Status**: ✅ Production Deployed (Oct 9, 2025)
**Production URL**: https://events-service-521240388393.europe-west2.run.app
**Architecture**: Option A (Standalone) - No Elections service dependency
**Purpose**: Election administration and voting token issuance

---

## Overview

The Events service is a **pure backend API service** that manages elections and determines who can vote:
- Stores election details (title, description, question, timeline)
- Determines member eligibility (active membership required)
- Issues one-time voting tokens to eligible members
- Stores tokens with audit trail (kennitala → token_hash)

**MVP Scope**: One election, one question, standalone operation

### 🎨 Frontend Architecture

**Important**: This service has **NO user interface**. All web UI (HTML/CSS/JS) is hosted by the Members service.

**Current Approach (Option A)**:
- ✅ **Events Service** (`/events/`) = Pure REST API backend (Node.js/Express)
- ✅ **Members Service** (`/members/public/`) = ALL user-facing web UI (Firebase Hosting)
- ✅ Members service hosts test pages for Events API (`test-events.html`)
- ✅ Clean separation: Backend (Events) vs Frontend (Members)

**Future Consideration (Option B)**:
- 📋 Create dedicated `/frontend/` or `/web/` directory for all HTML/CSS/JS
- 📋 Separate Firebase Hosting site for frontend
- 📋 More complex but cleaner separation long-term
- 📋 Consider when: Project has 5+ services or dedicated frontend team

---

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: Cloud SQL PostgreSQL 15 (ekklesia-db)
- **Auth**: Firebase Admin SDK (verify JWT from Members service)
- **Deployment**: Cloud Run (✅ Production since Oct 9, 2025)

---

## Project Structure

```
events/
├── src/
│   ├── index.js                 # Main Express server
│   ├── config/
│   │   ├── database.js          # Cloud SQL connection pool
│   │   └── firebase.js          # Firebase Admin SDK setup
│   ├── middleware/
│   │   └── auth.js              # JWT authentication middleware
│   ├── services/
│   │   ├── electionService.js   # Election business logic
│   │   └── tokenService.js      # Token generation and management
│   └── routes/
│       └── election.js          # API route handlers
├── migrations/
│   ├── 001_initial_schema.sql   # Database schema (✅ applied)
│   ├── 002_remove_elections_service_id.sql
│   └── README.md                # Migration guide
├── package.json
├── .env.example
└── README.md                    # This file
```

---

## API Endpoints

All endpoints require Firebase JWT authentication:
```
Authorization: Bearer <firebase-id-token>
```

### GET /api/election
Get current election details

**Response**:
```json
{
  "id": "uuid",
  "title": "Prófunarkosning 2025",
  "description": "...",
  "question_text": "...",
  "status": "published",
  "status_message": "Active - voting is open",
  "voting_starts_at": "2025-10-09T11:44:22.705Z",
  "voting_ends_at": "2025-11-08T11:44:22.705Z"
}
```

### POST /api/request-token
Request a one-time voting token

**Response**:
```json
{
  "success": true,
  "token": "64-character-hex-string",
  "expires_at": "2025-10-10T11:44:22.705Z",
  "message": "Token issued successfully...",
  "note": "Save this token securely - you will need it to vote. This token will not be shown again."
}
```

**Eligibility Requirements**:
- Active membership (verified via Firebase JWT claims)
- Election is published and within voting period
- No token previously issued for this member

### GET /api/my-status
Check participation status

**Response**:
```json
{
  "token_issued": true,
  "token_issued_at": "2025-10-09T12:00:00.000Z",
  "expires_at": "2025-10-10T12:00:00.000Z",
  "expired": false,
  "voted": false,
  "voted_at": null
}
```

### GET /api/my-token
Retrieve previously issued token

**Response** (MVP):
```json
{
  "error": "Bad Request",
  "message": "Tokens cannot be retrieved after issuance for security reasons..."
}
```

**Note**: In MVP, tokens are single-use and only the hash is stored. Members must save the token when issued.

### GET /api/results
Get election results

**Response** (MVP - Placeholder):
```json
{
  "message": "Results available after Elections service integration (Phase 2)",
  "election_id": "uuid",
  "election_title": "Prófunarkosning 2025",
  "election_status": "published",
  "note": "MVP implementation does not include Elections service..."
}
```

---

## Local Development

### Prerequisites

1. Node.js 18+ installed
2. PostgreSQL client (`psql`) installed
3. Firebase Admin SDK credentials
4. Database password from Secret Manager

### Setup

1. Install dependencies:
   ```bash
   cd events
   npm install
   ```

2. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

3. Get database password from Secret Manager:
   ```bash
   gcloud secrets versions access latest \
     --secret=postgres-password \
     --project=ekklesia-prod-10-2025
   ```

4. Update `.env`:
   ```env
   DATABASE_HOST=34.147.159.80
   DATABASE_PORT=5432
   DATABASE_NAME=postgres
   DATABASE_USER=postgres
   DATABASE_PASSWORD=<from-secret-manager>
   FIREBASE_PROJECT_ID=ekklesia-prod-10-2025
   PORT=8080
   NODE_ENV=development
   ```

5. Run migrations (if not already applied):
   ```bash
   PGPASSWORD='<password>' psql -h 34.147.159.80 -U postgres -d postgres < migrations/001_initial_schema.sql
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

7. Test health endpoint:
   ```bash
   curl http://localhost:8080/health
   ```

---

## Testing

### Get Firebase ID Token

1. Login to Members service: https://ekklesia-prod-10-2025.web.app
2. Open browser console
3. Get ID token:
   ```javascript
   firebase.auth().currentUser.getIdToken().then(console.log)
   ```

### Test API Endpoints

```bash
# Set token
TOKEN="<firebase-id-token>"

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

# Get results (placeholder)
curl http://localhost:8080/api/results \
  -H "Authorization: Bearer $TOKEN"
```

---

## Database Schema

### election Table
- `id` (UUID) - Primary key
- `title` (VARCHAR) - Election title
- `description` (TEXT) - Election description
- `question_text` (TEXT) - Voting question
- `status` (VARCHAR) - 'draft', 'published', 'closed'
- `voting_starts_at` (TIMESTAMP) - Voting start time
- `voting_ends_at` (TIMESTAMP) - Voting end time
- `created_at` (TIMESTAMP) - Record creation time
- `updated_at` (TIMESTAMP) - Record update time

### voting_tokens Table
- `id` (UUID) - Primary key
- `kennitala` (VARCHAR) - Member national ID (PII - audit trail)
- `token_hash` (VARCHAR) - SHA-256 hash of voting token
- `issued_at` (TIMESTAMP) - Token issuance time
- `expires_at` (TIMESTAMP) - Token expiration time
- `voted` (BOOLEAN) - Whether member has voted
- `voted_at` (TIMESTAMP) - When vote was cast

**Indexes**:
- `kennitala` (unique) - One token per member
- `token_hash` (unique) - Token validation
- `voted` - Query by voting status
- `expires_at` - Cleanup expired tokens

---

## Security Model

### Authentication
- Firebase JWT required for all API endpoints
- Token claims verified: `uid`, `kennitala`, `isMember`
- Active membership enforced

### Voting Tokens
- **Generation**: 32 bytes (256 bits) cryptographically secure random
- **Storage**: SHA-256 hash only (plain token not stored)
- **Expiration**: 24 hours or election end (whichever sooner)
- **One-time use**: Database constraint + voted flag

### Privacy
- **Events service**: Stores kennitala → token_hash (audit trail)
- **Elections service** (Phase 2): Only receives token_hash, never kennitala
- **Separation**: Events can audit who voted, Elections cannot identify voters

---

## MVP Limitations (Option A: Standalone)

**What's included**:
- ✅ One election (Kosning)
- ✅ One question (yes/no/abstain)
- ✅ Firebase JWT authentication
- ✅ Active membership check
- ✅ One-time voting tokens
- ✅ Token storage and audit trail
- ✅ Status checking

**What's deferred to Phase 2**:
- ⏸️ S2S token registration with Elections service
- ⏸️ Actual voting (Elections service integration)
- ⏸️ Results fetching from Elections service
- ⏸️ Vote notification endpoint (S2S callback)

**What's deferred to future**:
- ❌ Multiple elections
- ❌ Multiple questions per election
- ❌ Admin UI (election created via SQL)
- ❌ Role-based access control
- ❌ Complex eligibility rules (dues, roles, etc.)

---

## Deployment (Phase 4 - Planned)

### Build Docker Image

```bash
# Create Dockerfile
# Deploy to Cloud Run
# Configure environment variables
# Connect to Cloud SQL
```

**Planned Cloud Run URL**: `https://events-ymzrguoifa-nw.a.run.app`

---

## Related Documentation

- [Design Document](../docs/design/EVENTS_SERVICE_MVP.md) - MVP design and architecture
- [System Architecture](../docs/SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall system vision
- [Database Migrations](migrations/README.md) - Migration guide

---

## Support

**Production Issues**: Check Cloud Logging
**Database Issues**: Cloud SQL Console → ekklesia-db
**Authentication Issues**: Firebase Console → Authentication
