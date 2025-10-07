# The Socialist Party's Voting System (`Kosningakerfi`)

**Proposal for the system's architecture**

**Document Type**: Macro View - System Architecture Overview
**Last Updated**: 2025-10-07
**Status**: ✅ **Active - Primary Architectural Vision** (Restored Oct 7, 2025)

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

⚠️ **UPDATE (Oct 7, 2025)**: Ekklesia Platform evaluation completed and archived. Returning to original election-focused vision.

**Decision**: Build custom Events service for election administration (Option 2: Build Custom "Events" Component).

**See**: [archive/ekklesia-platform-evaluation/README.md](../archive/ekklesia-platform-evaluation/README.md) for Ekklesia evaluation details.

---

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

### Events System (`Atburðir`) - 🔨 To Be Built

**Decision**: Build custom Events service for election administration

- **Purpose**: Election administration, voting token issuance, eligibility management
- **Technology**: To be determined (likely Node.js or Python)
- **Database**: Cloud SQL PostgreSQL 15 (ekklesia-db instance available)
- **Status**: Design phase

**Required Features**:
- Create and manage elections (officer elections, referendums)
- Define eligibility rules (who can vote in which elections)
- Issue one-time voting tokens to eligible members (S2S to Voting)
- Fetch and display results from Voting system
- Admin interface for election management

**See**: Design document to be created

### Voting System (`Kosning`) - 📋 To Be Designed

**Decision**: Evaluate options (Ekklesia Voting standalone vs custom build)

- **Purpose**: Accept voting tokens, record ballots anonymously
- **Technology**: To be determined
- **Database**: Cloud SQL PostgreSQL 15 (shared or separate)
- **Status**: Pending Events service design

**Required Features**:
- Validate one-time voting tokens
- Record ballots anonymously (no PII)
- Enforce one-vote-per-token (database constraint)
- Support multiple voting methods (yes/no, single choice, ranked choice)
- Result tabulation and export

**See**: Design document to be created

---

## Architecture Evolution

### Original Vision (This Document)
- JWT tokens for authentication
- Server-to-server communication for voting tokens
- Complete separation between Members, Events, and Elections
- Non-personally identifiable voting tokens

### Current Implementation (2025)
- **Members**: ✅ Firebase custom tokens with kennitala claims (production)
- **Events**: 🔨 Custom service to be built (election administration)
- **Voting**: 📋 To be designed (anonymous ballot recording)
- **Integration**: Kenni.is national eID for authentication
- **Cost**: Currently $0/month (Firebase free tier), estimated $7-15/month with Events + Voting

---

## Related Documentation

**Current Implementation**:
- [CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md) - Production infrastructure
- [docs/DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md) - Complete documentation index
- [members/README.md](../members/README.md) - Members service (production)

**Design & Planning**:
- Events service design (to be created)
- Voting service design (to be created)
- [docs/FIREBASE_MIGRATION_STATUS.md](FIREBASE_MIGRATION_STATUS.md) - Migration history

**Archived Evaluations**:
- [archive/ekklesia-platform-evaluation/](../archive/ekklesia-platform-evaluation/) - Ekklesia platform evaluation (Oct 2025)
- [docs/ABOUT_EKKLESIA_PLATFORM.md](ABOUT_EKKLESIA_PLATFORM.md) - What is Ekklesia?
- [docs/UPDATED_SYSTEM_VISION.md](UPDATED_SYSTEM_VISION.md) - Proposition-based vision (archived)
- [docs/NAMING_CLARIFICATION.md](NAMING_CLARIFICATION.md) - Naming analysis

**Historical**:
- [docs/archive/](archive/) - ZITADEL-era documentation (deprecated)

---

## Project

- **Organization**: Samstaða (Icelandic Social Democratic Party)
- **Platform**: Custom e-democracy platform for elections
- **Repository**: https://github.com/sosialistaflokkurinn/ekklesia
- **Project**: ekklesia-prod-10-2025 (GCP)
- **Region**: europe-west2 (London)
