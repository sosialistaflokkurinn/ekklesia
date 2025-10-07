# The Socialist Party's Voting System (`Kosningakerfi`)

**Proposal for the system's architecture**

**Document Type**: Macro View - System Architecture Overview
**Last Updated**: 2025-10-07
**Status**: Original Design Document

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

## Current Implementation Status (2025-10-07)

### Members System - ✅ Production

**Implementation**: Firebase-based authentication with Kenni.is national eID integration

- **Production URL**: https://ekklesia-prod-10-2025.web.app
- **Technology**: Firebase Hosting + Cloud Functions + Firebase Authentication
- **Authentication**: Direct Kenni.is OAuth PKCE
- **Member Verification**: Kennitala verification against membership list
- **Status**: Operational

**Components**:
- Firebase Hosting (static HTML/CSS)
- Cloud Functions (handleKenniAuth, verifyMembership)
- Firebase Authentication (custom tokens with kennitala claims)
- Firestore (user profiles)

**See**: [members/README.md](../members/README.md) and [CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md)

### Portal System (Events) - 🟡 Deployed (Issues)

**Implementation**: Ekklesia Portal (Python/Morepath)

- **Production URL**: https://portal-ymzrguoifa-nw.a.run.app (returns 503)
- **Technology**: Cloud Run + Cloud SQL PostgreSQL 15
- **Database**: ekklesia-db instance, ekklesia_portal database (created, empty)
- **Status**: Deployed but not operational (dependency resolution issues)

**Components**:
- Cloud Run service (512 MB, Python/Morepath)
- Cloud SQL PostgreSQL 15 (db-f1-micro)
- 24 Alembic database migrations (pending, blocked by 503)

**See**: [portal/DEPLOYMENT.md](../portal/DEPLOYMENT.md) and [PORTAL_DEPLOYMENT_PROGRESS.md](../PORTAL_DEPLOYMENT_PROGRESS.md)

### Voting System - 📦 Ready to Deploy

**Implementation**: Ekklesia Voting (Python/Morepath)

- **Status**: Code committed, ready to deploy
- **Technology**: Same as Portal (Cloud Run + Cloud SQL)
- **Deployment**: Blocked pending Portal service resolution

**See**: [voting/README.md](../voting/README.md)

---

## Architecture Evolution

### Original Vision (This Document)
- JWT tokens for authentication
- Server-to-server communication for voting tokens
- Complete separation between Members, Events, and Elections
- Non-personally identifiable voting tokens

### Current Implementation (2025)
- **Members**: Firebase custom tokens with kennitala claims
- **Portal (Events)**: Ekklesia Portal (open-source e-democracy platform)
- **Voting (Elections)**: Ekklesia Voting (open-source voting module)
- **Integration**: Kenni.is national eID for authentication
- **Cost**: $7-10/month (Cloud SQL only)

---

## Related Documentation

**Current Implementation**:
- [CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md) - Production infrastructure
- [docs/DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Complete documentation index
- [members/README.md](../members/README.md) - Members service
- [portal/README.md](../portal/README.md) - Portal service
- [voting/README.md](../voting/README.md) - Voting service

**Design & Planning**:
- [docs/plans/PORTAL_VOTING_DEPLOYMENT_PLAN.md](plans/PORTAL_VOTING_DEPLOYMENT_PLAN.md) - Deployment plan
- [docs/FIREBASE_MIGRATION_STATUS.md](FIREBASE_MIGRATION_STATUS.md) - Migration history

**Historical**:
- [docs/archive/](archive/) - ZITADEL-era documentation (deprecated)

---

## Project

- **Organization**: Samstaða (Icelandic Social Democratic Party)
- **Platform**: Ekklesia e-democracy platform
- **Repository**: https://github.com/sosialistaflokkurinn/ekklesia
- **Project**: ekklesia-prod-10-2025 (GCP)
- **Region**: europe-west2 (London)
