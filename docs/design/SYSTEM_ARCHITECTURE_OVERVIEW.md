# The Socialist Party's Voting System (`Kosningakerfi`)

**Proposal for the system's architecture**

**Document Type**: Macro View - System Architecture Overview
**Last Updated**: 2025-10-09
**Status**: ✅ **Active - Primary Architectural Vision** (Events MVP Deployed Oct 9, 2025)

---

## System (`Kerfi`)

The voting system consists of three main components:

* **Members (`Meðlimir`)**
    * Member registry
    * Permissions (`Réttindi`) and attributes of members
    * Status of membership fees

* **Events (`Atburðir`)**
    * Election administration
    * Types of elections
    * Member permissions (`Réttindi`) for participation

* **Voting (`Kosning`)**
    * Securely records election results

---

## The System (`Kerfi`) and Its Components

* The **Member-system** (`Meðlima-kerfið`) manages permissions (`réttindi`) and members.
* The **Event-system** (`Atburða-kerfið`) manages election events and who can vote in which election, based on information from the **Members** (`Meðlimum`) system.
* The **Election-system** (`Kosninga-kerfið`) manages the actual voting process but has no direct connection to **Members** (`Meðlimi`) or **Events** (`Atburði`).

---

## Communication Flow: Part 1

1. Users log into the **Members** (`Meðlimi`) system.
2. They receive a JWT token that can be used on the **Members** (`Meðlimum`) and **Events** (`Atburðum`) systems.
3. The user is forwarded to the **Events** (`Atburði`) system.
4. They can view relevant elections, depending on the permissions (`réttindi`) defined in the JWT from **Members** (`Meðlimum`).
5. The user views ongoing elections in **Events** (`Atburðum`) and chooses to participate.
6. **Events** (`Atburðir`) sends a non-personally identifiable, single-use voting token to the **Elections** (`Kosningar`) system (Server-to-Server) and to the user.
7. The user is forwarded to the **Elections** (`Kosningar`) system.
8. The user uses their voting token and casts their vote.

---

## Communication Flow: Part 2

1. The user is sent back to **Events** (`Atburði`) after voting.
    * The voting token is now marked as "used" in the **Elections** (`Kosningum`) system and cannot be used again.
2. The user can repeat the process to answer more questions, as applicable and configured in **Events** (`Atburðum`).
3. A moderator decides when an election is finished.
    * Permissions (`Réttindi`) to close an election come from **Members** (`Meðlimum`) and are included in the JWT access token.
4. **Events** (`Atburðir`) fetches the results from **Elections** (`Kosningum`) (Server-to-Server).
5. **Events** (`Atburðir`) marks the election as finished within the **Elections** (`Kosningum`) system.
6. **Events** (`Atburðir`) displays the results to everyone with the appropriate permissions (`réttindi`).
    * This applies to everyone logged into **Events** (`Atburði`) with permissions to see the results.

---

## The Simple Version

* **Members (`Meðlimir`):** Handles login and issues an access token.
* **Events (`Atburðir`):** Determines permissions (`réttindi`), issues a voting token to logged-in members who are eligible to vote, and also forwards it to the **Elections** (`Kosninga`) system via a server-to-server (S2S) call.
* **Elections (`Kosningar`):** Receives votes and records them, linking them to a specific election defined in **Events** (`Atburðum`) (connected via ID). It has no information about members or the content of the elections.

---

## System Components and Work Chunks

### Members (`Meðlimir`)

* **Task:** Migrate from the old system to a new foundation.
* **Components:**
    * Database
    * REST API
    * Clients (website, app, etc.)
* **Simple initial setup:**
    * Members (`Meðlimir`)
    * Roles/Permissions (`Rullur/Réttindi`)
    * Membership fees (initially just a status marker, not a full management system)

### Elections (`Kosningar`)

* **Task:** Start with a very simple setup.
* **Scope:** One election, one question.

### Events (`Atburðir`)

* **Components:**
    * Database
    * REST API
    * Does not require a client.

---

## Auditing (`Endurskoðun`)

* **Events** (`Atburðir`) logs all voting requests.
    * Each time **Events** (`Atburðir`) creates a voting token, it is logged in a table (using a hash of the credentials).
    * It also logs which permissions (`réttindi`) were granted with the issued credentials.
* **Elections** (`Kosningar`) also maintains a list of voting tokens.
    * **Elections** (`Kosningar`) logs to a logging table in the same manner, both when the voting token is initially created and again when a member casts their vote.
* **Audit Trail:**
    * This arrangement makes it possible to audit all elections.
    * There is a clear and verifiable link between those who were issued permissions (`réttindi`) to participate, what those permissions were, and proof that those permissions were used in a specific election.

---

## Current Implementation Status (2025-10-09)

⚠️ **UPDATE (Oct 9, 2025)**: Events Service MVP deployed to production! All core voting infrastructure now operational.

**Decision**: Build custom Events and Voting services for election administration.

**See**: [archive/ekklesia-platform-evaluation/README.md](../../archive/ekklesia-platform-evaluation/README.md) for Ekklesia evaluation details.

---

### Members System (`Meðlimir`) - ✅ Production

**Implementation**: Firebase-based authentication with Kenni.is national eID integration

- **Production URL**: https://ekklesia-prod-10-2025.web.app
- **Technology**: Firebase Hosting + Cloud Functions + Firebase Authentication
- **Authentication**: Direct Kenni.is OAuth PKCE
- **Member Verification**: Kennitala verification against membership list (2,273 members)
- **Status**: ✅ Operational (Oct 6, 2025)

**Components**:
- Firebase Hosting (static HTML/CSS/JS)
- Cloud Functions (handleKenniAuth, verifyMembership)
- Firebase Authentication (custom tokens with kennitala claims)
- Firestore (user profiles)
- Firebase Storage (membership list)

**See**: [services/members/README.md](../../services/members/README.md) and [CURRENT_PRODUCTION_STATUS.md](../status/CURRENT_DEVELOPMENT_STATUS.md)

### Events System (`Atburðir`) - ✅ Production (MVP)

**Implementation**: Node.js election administration service deployed to Cloud Run

- **Production URL**: https://events-service-ymzrguoifa-nw.a.run.app
- **Test Page**: https://ekklesia-prod-10-2025.web.app/test-events.html
- **Technology**: Node.js 18 + Express + Cloud SQL PostgreSQL 15
- **Database**: Cloud SQL PostgreSQL 15 (ekklesia-db instance)
- **Deployment**: Cloud Run (serverless, auto-scaling)
- **Status**: ✅ Production (Oct 9, 2025) - All endpoints operational

**MVP Scope (Deployed)**:
- ✅ One election (Prófunarkosning 2025)
- ✅ One question (yes/no/abstain)
- ✅ Active membership eligibility check
- ✅ One-time voting tokens (SHA-256 hashed, 32 bytes)
- ✅ Token storage with audit trail (kennitala → token_hash)
- ✅ Firebase JWT authentication
- ✅ 5 API endpoints (health, election, request-token, my-status, my-token)
- ✅ S2S token registration with Elections service (Phase 5 Complete, Oct 10, 2025)

**Production Test Results** (Oct 9, 2025):
- Health check: ✅ Passing
- Election details: ✅ Passing
- Token issuance: ✅ Working (with conflict detection)
- Status check: ✅ Working

**Deferred to Future Phases**:
- Multiple elections
- Complex eligibility rules (dues, roles)
- Admin UI
- Elections service integration

**Implementation Timeline**: 1 day (4 phases completed Oct 9, 2025)

**See**:
- [EVENTS_SERVICE_MVP.md](./EVENTS_SERVICE_MVP.md) - Design document
- [../archive/testing-logs/EVENTS_SERVICE_TESTING_LOG.md](../archive/testing-logs/EVENTS_SERVICE_TESTING_LOG.md) - Testing journey & deployment (archived Oct 11)

### Elections System (`Kosningar`) - ✅ Production (Oct 9, 2025)

**Status**: ✅ MVP Deployed to Production
**URL**: https://elections-service-ymzrguoifa-nw.a.run.app

- **Purpose**: Anonymous ballot recording (no PII, no member authentication)
- **Technology**: Node.js + Express + PostgreSQL
- **Deployment**: Cloud Run (serverless, europe-west2)

**MVP Features** (Production):
- ✅ Accept voting tokens (S2S registered by Events)
- ✅ Record ballots anonymously (no PII, timestamp rounded to minute)
- ✅ Enforce one-vote-per-token (database constraints + row-level locking)
- ✅ Calculate and return results (S2S to Events via `/api/s2s/results`)
- ✅ Audit logging (no PII, token hash prefix only)

**API Endpoints**:
- `POST /api/s2s/register-token` - Register voting token (S2S, API key)
- `GET /api/s2s/results` - Fetch results (S2S, API key)
- `POST /api/vote` - Submit ballot (public, token-based)
- `GET /api/token-status` - Check token validity (public, token-based)

**See**: [ELECTIONS_SERVICE_MVP.md](./ELECTIONS_SERVICE_MVP.md) - Design document

---

## Architecture Evolution

### Original Vision (This Document)
- JWT tokens for authentication
- Server-to-server communication for voting tokens
- Complete separation between Members, Events, and Elections
- Non-personally identifiable voting tokens

### Current Implementation (Oct 2025)
- **Members**: ✅ Firebase custom tokens with kennitala claims (production, Oct 6)
- **Events (MVP)**: ✅ Deployed to production - election admin, token issuance (Oct 9)
- **Elections (MVP)**: ✅ Deployed to production - anonymous ballot recording (Oct 9)
- **Integration**: ✅ S2S communication complete - Events ↔ Elections (Phase 5, Oct 10)
- **Authentication**: Kenni.is national eID for authentication
- **Cost**: $7-13/month (Cloud SQL + Cloud Run, both services in production)

### Decommissioned Services (Oct 2025)
- **Portal Service**: ❌ Decommissioned from Cloud Run (Oct 8, 2025)
  - Reason: External Ekklesia Portal does not match election requirements
  - See: [archive/ekklesia-platform-evaluation/README.md](../../archive/ekklesia-platform-evaluation/README.md)

---

## Related Documentation

**Current Implementation**:
- [CURRENT_PRODUCTION_STATUS.md](../status/CURRENT_DEVELOPMENT_STATUS.md) - Production infrastructure
- [DOCUMENTATION_MAP.md](../DOCUMENTATION_MAP.md) - Complete documentation index
- [services/members/README.md](../../services/members/README.md) - Members service (production)

**Design & Planning**:
- [ELECTIONS_SERVICE_MVP.md](ELECTIONS_SERVICE_MVP.md) - Elections MVP design (one election, one question)
- [../archive/migrations/FIREBASE_MIGRATION_STATUS.md](../archive/migrations/FIREBASE_MIGRATION_STATUS.md) - Migration history (archived Oct 11)

**Archived Evaluations**:
- [archive/ekklesia-platform-evaluation/](../archive/ekklesia-platform-evaluation/) - Ekklesia platform evaluation (Oct 2025)
- archive docs (see archive/) - What is Ekklesia?
- archive docs (see archive/) - Proposition-based vision (archived)
- archive docs (see archive/) - Naming analysis

**Historical**:
- [archive/](../../archive/) - ZITADEL-era documentation (deprecated)

---

## Project

- **Organization**: Sósíalistaflokkur Íslands (Socialist Party of Iceland)
- **Platform**: Custom e-democracy platform for elections
- **Repository**: https://github.com/sosialistaflokkurinn/ekklesia
- **Project**: ekklesia-prod-10-2025 (GCP)
- **Region**: europe-west2 (London)
