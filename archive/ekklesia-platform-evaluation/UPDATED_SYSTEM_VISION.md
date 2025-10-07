# Updated System Vision - Ekklesia Platform Implementation

**Document Type**: Updated Architectural Vision (replacing original election-focused vision)
**Date**: 2025-10-07
**Status**: Active - Aligned with Ekklesia Platform
**Supersedes**: SYSTEM_ARCHITECTURE_OVERVIEW.md (original election-focused vision)

---

## Executive Summary

**Decision**: Adopt the Ekklesia open-source e-democracy platform as-is for Samstaða's democratic participation system.

**Change**: Original vision focused on **elections** (officer selection, referendums). Updated vision uses Ekklesia for **propositions/motions** (policy development, collaborative decision-making).

**Why**: Ekklesia is a mature, production-ready platform designed for e-democracy. Adapting our vision to match Ekklesia's capabilities provides faster time-to-value and proven democratic processes.

---

## System Overview

The democratic participation platform consists of three components:

### 1. Members (`Meðlimir`) - Authentication & Access Control

**Purpose**: Secure authentication and member profile management

**Implementation**: Firebase-based with Kenni.is national eID

**Features**:
- National eID login (Kenni.is OAuth PKCE)
- Member verification (kennitala validation)
- User profiles (Firestore)
- Session management (Firebase Authentication)
- Membership status tracking

**Status**: ✅ Production (https://ekklesia-prod-10-2025.web.app)

### 2. Portal (`Gátt`) - Proposition & Policy Development

**Purpose**: Collaborative policy development through propositions/motions

**Implementation**: Ekklesia Portal (Python/Morepath)

**Features**:
- **Proposition Creation**: Members can submit policy proposals
- **Collaboration**: Gather supporters, build consensus
- **Discussion**: Argue pro/contra with rating system
- **Search**: Full-text search of propositions
- **Markdown Content**: Rich text editing for proposals
- **Multi-language**: Icelandic + other languages
- **Workflow**: Draft → Discussion → Voting → Accepted/Rejected

**Status**: 🟡 Deployed but not operational (https://portal-ymzrguoifa-nw.a.run.app - 503)

### 3. Voting (`Kosning`) - Anonymous Ballot Casting

**Purpose**: Pseudonymous voting on propositions with score voting

**Implementation**: Ekklesia Voting (Python/Morepath)

**Features**:
- **Score Voting**: Vote with scores on multiple options (not just yes/no)
- **Anonymous Ballots**: Pseudonymous voting (no PII in votes)
- **Cryptographic Security**: Optional integration with VVVote
- **Audit Trail**: Verifiable but anonymous
- **One-vote-per-person**: Enforced at database level

**Status**: 📦 Ready to deploy (waiting for Portal resolution)

---

## What Changed from Original Vision

### Original Vision (SYSTEM_ARCHITECTURE_OVERVIEW.md)

**Focus**: Elections (officer selection, board votes, referendums)

**Components**:
- **Members**: Login, issue JWT tokens
- **Events**: Election administration, issue voting tokens
- **Elections**: Record ballots, one election per question

**Use Cases**:
- Elect party treasurer (A, B, or C)
- Board member elections
- Referendum on party policy
- Yes/no votes on proposals

### Updated Vision (This Document)

**Focus**: Propositions/Motions (policy development, collaborative democracy)

**Components**:
- **Members**: Login, issue Firebase custom tokens
- **Portal**: Proposition management, discussion, supporter gathering
- **Voting**: Score voting on propositions with multiple options

**Use Cases**:
- Member proposes: "Change party stance on climate policy"
- Others add arguments pro/contra, rate arguments
- Gather supporters to reach voting threshold
- Vote on proposal with score voting (0-5 points per option)
- Accept/reject based on results

---

## Key Differences: Elections vs Propositions

| Aspect | Elections (Old Vision) | Propositions (New Vision) |
|--------|----------------------|--------------------------|
| **Type** | Candidate selection | Policy decision |
| **Example** | "Vote for treasurer: A, B, or C" | "Proposal: Change climate policy to X" |
| **Process** | Simple: Nominate → Vote → Winner | Complex: Propose → Discuss → Gather supporters → Vote → Accept/Reject |
| **Discussion** | Minimal (candidate statements) | Central feature (pro/contra arguments) |
| **Collaboration** | Not applicable | Core feature (gather supporters) |
| **Voting Method** | Single choice or ranked | Score voting (0-5 points) |
| **Timeline** | Fixed election date | Flexible (depends on support) |

**Bottom Line**: Old vision = "pick a person", New vision = "decide on policy through debate"

---

## Updated Communication Flow

### Part 1: Proposition Creation & Discussion

1. **Member logs into Members** (Firebase Hosting)
   - Authenticates with Kenni.is (national eID)
   - Receives Firebase custom token with kennitala claims
   - Session established in Firestore

2. **Member accesses Portal** (Ekklesia Portal)
   - Portal validates Firebase custom token
   - Member can view existing propositions
   - Member can create new proposition

3. **Proposition Development**
   - Author writes proposal in Markdown
   - Others add pro/contra arguments
   - Community rates arguments (helpful/not helpful)
   - Gather supporters to reach voting threshold

4. **Proposition Reaches Voting Stage**
   - Sufficient supporters gathered (threshold configured in Portal)
   - Portal marks proposition as ready for voting
   - Voting ballot created in Voting system

### Part 2: Voting & Results

5. **Portal initiates voting**
   - Portal creates ballot in Voting system (Server-to-Server API call)
   - Ballot includes proposition text, voting options, deadline
   - Portal displays "Voting Open" status

6. **Member casts vote**
   - Member views proposition in Portal
   - Clicks "Vote" → redirected to Voting system
   - Voting system validates member token
   - Member assigns scores to options (e.g., 0-5 points)
   - Ballot recorded anonymously

7. **Member returns to Portal**
   - Voting system redirects back to Portal
   - Portal shows "You voted" status
   - Member cannot vote again (enforced by Voting)

8. **Voting closes**
   - Deadline reached or admin closes voting
   - Portal fetches results from Voting (Server-to-Server)
   - Results displayed to all members
   - Proposition marked as Accepted/Rejected based on threshold

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Members (Meðlimir)                           │
│                  Firebase + Kenni.is                            │
│                                                                 │
│  • National eID authentication (Kenni.is OAuth PKCE)           │
│  • Member verification (kennitala)                             │
│  • Firebase custom tokens (with claims)                        │
│  • User profiles (Firestore)                                   │
│                                                                 │
│  Production: https://ekklesia-prod-10-2025.web.app            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Firebase custom token
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Portal (Gátt)                                │
│                  Ekklesia Portal                                │
│                                                                 │
│  • Proposition creation & editing                              │
│  • Pro/contra argument discussion                              │
│  • Supporter gathering                                         │
│  • Full-text search                                           │
│  • Admin interface                                            │
│  • Multi-language support (Icelandic)                         │
│                                                                 │
│  Deployed: https://portal-ymzrguoifa-nw.a.run.app (503)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Server-to-Server API
                              │ (Create ballot, fetch results)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Voting (Kosning)                             │
│                  Ekklesia Voting                                │
│                                                                 │
│  • Score voting (0-5 points per option)                        │
│  • Anonymous ballot recording                                  │
│  • One-vote-per-person enforcement                            │
│  • Cryptographic security (optional VVVote)                    │
│  • Result tabulation                                          │
│                                                                 │
│  Ready: Code committed, pending deployment                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### Members → Portal Integration

**Authentication Flow**:
1. User logs into Members (Firebase)
2. Receives Firebase custom token (JWT with kennitala)
3. User navigates to Portal
4. Portal validates Firebase token via Firebase Admin SDK
5. Portal extracts user claims (kennitala, membership status)
6. Portal creates/updates user session

**Required in Portal**:
- Firebase Admin SDK integration
- Token validation middleware
- User mapping (Firebase UID → Portal user)
- Permission extraction from token claims

### Portal → Voting Integration

**Ballot Creation (Server-to-Server)**:
1. Portal determines proposition ready for voting
2. Portal calls Voting API: `POST /api/ballots`
   ```json
   {
     "proposition_id": "uuid",
     "title": "Change climate policy",
     "options": ["Option A", "Option B", "Status Quo"],
     "voting_deadline": "2025-11-01T23:59:59Z",
     "eligible_voters": ["hashed_kennitala_1", "hashed_kennitala_2"]
   }
   ```
3. Voting returns `ballot_id`
4. Portal stores `ballot_id` for tracking

**Vote Casting (User Flow)**:
1. User clicks "Vote" in Portal
2. Portal generates one-time voting token
3. Portal redirects to Voting: `/vote?ballot_id=X&token=Y`
4. Voting validates token, displays ballot
5. User assigns scores, submits
6. Voting redirects back to Portal: `/callback?status=voted`

**Result Fetching (Server-to-Server)**:
1. Voting deadline passes
2. Portal calls Voting API: `GET /api/ballots/{ballot_id}/results`
3. Voting returns scores per option
4. Portal displays results, marks proposition status

---

## Data Models

### Members (Firestore)

```javascript
users/{uid}/
  ├── kennitala: "200978-XXXX" (masked)
  ├── name: "Jón Jónsson"
  ├── email: "jon@example.is"
  ├── phone: "+354 XXX XXXX"
  ├── isMember: true
  ├── membershipStatus: "active"
  ├── roles: ["member", "verified"]
  └── lastLogin: timestamp
```

### Portal (PostgreSQL)

```sql
-- Propositions
propositions
  ├── id (uuid, PK)
  ├── title (text)
  ├── content (markdown text)
  ├── author_id (references users)
  ├── status (draft/discussion/voting/accepted/rejected)
  ├── created_at (timestamp)
  ├── voting_deadline (timestamp, nullable)
  └── ballot_id (uuid, nullable, references voting.ballots)

-- Arguments (pro/contra)
arguments
  ├── id (uuid, PK)
  ├── proposition_id (references propositions)
  ├── author_id (references users)
  ├── type (pro/contra)
  ├── content (markdown text)
  ├── score (integer, from ratings)
  └── created_at (timestamp)

-- Supporters
supporters
  ├── proposition_id (references propositions)
  ├── user_id (references users)
  ├── supported_at (timestamp)
  └── UNIQUE(proposition_id, user_id)

-- Users (synced from Firebase)
users
  ├── id (uuid, PK)
  ├── firebase_uid (text, UNIQUE)
  ├── kennitala_hash (text, UNIQUE)
  ├── display_name (text)
  └── last_sync (timestamp)
```

### Voting (PostgreSQL)

```sql
-- Ballots
ballots
  ├── id (uuid, PK)
  ├── proposition_id (uuid, from Portal)
  ├── title (text)
  ├── options (jsonb array)
  ├── voting_deadline (timestamp)
  ├── status (open/closed)
  └── created_at (timestamp)

-- Votes (anonymous)
votes
  ├── id (uuid, PK)
  ├── ballot_id (references ballots)
  ├── voting_token_hash (text, UNIQUE)
  ├── scores (jsonb: {"option_a": 5, "option_b": 3})
  ├── cast_at (timestamp)
  └── NO user_id, NO kennitala (anonymous)

-- Voting Tokens (one-time use)
voting_tokens
  ├── token_hash (text, PK)
  ├── ballot_id (references ballots)
  ├── user_hash (text, from kennitala)
  ├── issued_at (timestamp)
  ├── used_at (timestamp, nullable)
  └── status (issued/used/expired)
```

---

## Security & Privacy

### Member Data Protection

**In Members (Firebase)**:
- Kennitala stored (for verification)
- Full name, email, phone (from Kenni.is)
- Protected by Firebase security rules

**In Portal**:
- Kennitala hashed (SHA-256 with salt)
- Display name only (no full kennitala)
- User mapping via Firebase UID

**In Voting**:
- NO kennitala (only hashed token)
- NO user identification
- Fully anonymous ballots

### Voting Anonymity

**Token-Based Anonymity**:
1. Portal knows: User X is eligible to vote on ballot Y
2. Portal generates: One-time token T for User X
3. Portal sends to Voting: Token T can vote on ballot Y (no User X identity)
4. User casts vote using Token T
5. Voting records: Token T voted with scores Z
6. **No link between User X and scores Z**

**Audit Trail (Without Anonymity Breach)**:
- Portal logs: "User X received token for ballot Y at timestamp T1"
- Voting logs: "Token for ballot Y was used at timestamp T2"
- Can verify: Token was legitimately issued and used
- **Cannot determine**: How User X voted (scores are anonymous)

---

## Use Cases

### Use Case 1: Member Proposes Climate Policy Change

**Actors**: Jón (member), María (member), Portal Admin

**Flow**:
1. Jón logs into Members with Kenni.is
2. Jón navigates to Portal
3. Jón creates proposition: "Strengthen climate targets to 80% reduction by 2030"
4. Jón writes rationale in Markdown
5. María views proposition, adds pro argument: "Iceland can lead on climate"
6. Others add contra arguments, rate each argument
7. Jón gathers 50 supporters (threshold configured by admin)
8. Portal automatically moves proposition to voting stage
9. Voting opens for 2 weeks
10. 200 members cast votes with scores (0-5 points per option)
11. Results: 65% average score → Accepted
12. Portal marks as "Accepted Policy"
13. Party leadership sees result, implements policy

### Use Case 2: Board Member Initiates Emergency Vote

**Actors**: Admin, Party Members

**Flow**:
1. Admin logs into Portal
2. Admin creates urgent proposition: "Emergency fund allocation for campaign"
3. Admin sets short voting deadline (3 days)
4. Admin bypasses supporter gathering (admin privilege)
5. Portal sends notifications to all members
6. Members vote over 3 days
7. Results appear immediately after deadline
8. Action taken based on result

### Use Case 3: Member Reviews Previous Decisions

**Actors**: Sigríður (member)

**Flow**:
1. Sigríður logs into Portal
2. Sigríður searches: "climate policy 2024"
3. Portal shows all propositions matching search
4. Sigríður filters: "Accepted propositions only"
5. Sigríður views accepted climate propositions
6. Sigríður reviews arguments and voting results
7. Sigríður sees historical democratic decisions

---

## Deployment Plan

### Phase 1: Fix Portal Service (Immediate)

**Objective**: Get Portal operational

**Tasks**:
1. ✅ Cloud SQL database created (ekklesia-db)
2. ✅ Portal service deployed (returns 503)
3. ❌ Fix dependency issues (poetry requirements)
4. ❌ Run 24 Alembic migrations
5. ❌ Verify Portal loads successfully

**Acceptance**: Portal URL returns 200 OK

### Phase 2: Integrate Members → Portal (Week 1)

**Objective**: Single sign-on from Members to Portal

**Tasks**:
1. Add Firebase Admin SDK to Portal
2. Implement token validation middleware
3. Create user mapping (Firebase → Portal users)
4. Extract claims (kennitala, membership status)
5. Create Portal user session
6. Test: Login to Members → Navigate to Portal → See user profile

**Acceptance**: User can access Portal with Members credentials

### Phase 3: Deploy Voting Service (Week 2)

**Objective**: Voting service operational

**Tasks**:
1. Deploy Voting to Cloud Run
2. Create voting database (or use ekklesia-db)
3. Run Voting migrations
4. Verify Voting loads successfully
5. Test ballot creation API (server-to-server)

**Acceptance**: Voting API responds to ballot creation

### Phase 4: Portal → Voting Integration (Week 2-3)

**Objective**: End-to-end voting flow

**Tasks**:
1. Implement ballot creation in Portal
2. Implement voting token generation
3. Implement redirect to Voting
4. Implement callback handling
5. Implement result fetching
6. Test: Create proposition → Vote → See results

**Acceptance**: Complete voting flow works

### Phase 5: Production Hardening (Week 3-4)

**Objective**: Production-ready security and monitoring

**Tasks**:
1. SSL/HTTPS for all services
2. Rate limiting on API endpoints
3. Cloud Armor (DDoS protection)
4. Monitoring dashboards (Cloud Monitoring)
5. Error alerting (email/Slack)
6. Backup strategy for databases
7. Security audit (penetration testing)

**Acceptance**: All security best practices implemented

---

## Success Metrics

### Engagement Metrics

- **Active Members**: Members who log in monthly
- **Propositions Created**: New propositions per month
- **Participation Rate**: % of members who vote on propositions
- **Discussion Activity**: Arguments and ratings per proposition
- **Supporter Gathering**: Average time to reach voting threshold

### Platform Health Metrics

- **Uptime**: 99.9% target (Firebase SLA)
- **Response Time**: < 500ms for Portal pages
- **Error Rate**: < 0.1% of requests
- **Vote Casting Success**: > 99.5% of vote attempts succeed

### Democratic Process Metrics

- **Proposition Acceptance Rate**: % of propositions that pass
- **Turnout**: Average voter participation per ballot
- **Deliberation Depth**: Average arguments per proposition
- **Decision Timeline**: Average time from proposal to result

---

## Cost Estimate

### Current (Members Only)

- Firebase: $0/month (Free Tier)
- **Total**: $0/month

### With Portal + Voting Deployed

- Firebase: $0/month (Free Tier)
- Cloud SQL (db-f1-micro): $7/month
- Cloud Run Portal (512MB, minimal traffic): ~$3/month
- Cloud Run Voting (512MB, minimal traffic): ~$3/month
- **Total**: ~$13-15/month

**Savings vs Original ZITADEL Plan**: $135/month → $13/month = **$122/month saved** (~$1,464/year)

---

## Risks & Mitigations

### Risk 1: Portal Dependency Issues (Current)

**Risk**: Portal 503 issue blocks all progress
**Impact**: High - Cannot proceed without Portal
**Mitigation**:
- Export requirements.txt from poetry.lock (recommended)
- Or manually add dependencies to Dockerfile
- Or use Nix build system
**Status**: In progress (see [portal/DEPLOYMENT.md](../portal/DEPLOYMENT.md))

### Risk 2: Low Member Adoption

**Risk**: Members don't use proposition system
**Impact**: Medium - Platform unused, wasted effort
**Mitigation**:
- User training and documentation
- Start with simple, relevant propositions
- Gamification (badges for participation)
- Email notifications for new propositions
**Status**: Planned

### Risk 3: Spam Propositions

**Risk**: Malicious users create spam propositions
**Impact**: Low - Annoying but manageable
**Mitigation**:
- Require supporter threshold before voting
- Admin moderation capabilities
- Rate limiting on proposition creation
- Report/flag system
**Status**: Built into Ekklesia Portal

### Risk 4: Vote Manipulation

**Risk**: Attempts to vote multiple times or manipulate results
**Impact**: Critical - Undermines democratic trust
**Mitigation**:
- One-time voting tokens (enforced at DB level)
- Anonymous but auditable (logs token issuance)
- Cryptographic voting (optional VVVote integration)
- Regular security audits
**Status**: Built into Ekklesia Voting

---

## Migration from Original Vision

### What We Keep

✅ **Three-component architecture**: Members, Portal (was "Events"), Voting (was "Elections")
✅ **Server-to-Server integration**: Portal → Voting API for ballot management
✅ **Anonymous voting**: No PII in voting system
✅ **One-time tokens**: Single-use voting tokens
✅ **Audit trail**: Verifiable but anonymous
✅ **Kenni.is authentication**: National eID login

### What Changes

🔄 **Use case**: Elections (pick person) → Propositions (decide policy)
🔄 **Voting method**: Single choice → Score voting (0-5 points)
🔄 **Process**: Simple (nominate → vote) → Complex (propose → discuss → gather supporters → vote)
🔄 **Timeline**: Fixed election date → Flexible (depends on support)
🔄 **Platform**: Custom-built → Ekklesia open-source

### Why This Is Better

✅ **Mature platform**: Ekklesia is production-tested
✅ **Rich features**: Discussion, arguments, supporter gathering
✅ **Faster deployment**: Use existing platform vs build from scratch
✅ **Democratic depth**: Score voting + deliberation vs simple yes/no
✅ **Community-driven**: Open-source with active community
✅ **Flexibility**: Can still add election features later if needed

---

## Future Enhancements

### Short-term (Next 3 months)

- Icelandic language interface
- Email notifications for proposition updates
- Mobile-responsive design
- Member profiles with participation history
- Admin dashboard for proposition management

### Medium-term (3-6 months)

- Integration with VVVote for cryptographic voting
- Advanced search and filtering
- Proposition categories/tags
- Member reputation system (based on participation)
- Export results to PDF/CSV

### Long-term (6-12 months)

- Mobile app (iOS/Android)
- Calendar integration for voting deadlines
- Proposition templates (for common policy types)
- Voting analytics dashboard
- AI-assisted argument summarization
- **Optional**: Add election capabilities (if party needs candidate voting)

---

## Conclusion

**Decision**: Adopt Ekklesia platform for proposition-based democratic participation.

**Impact**: Change from election-focused to proposition-focused system.

**Benefits**:
- ✅ Faster time to production (mature platform)
- ✅ Richer democratic process (discussion, deliberation)
- ✅ Lower cost ($13/month vs $135/month)
- ✅ Open-source community support
- ✅ Proven in production

**Trade-offs**:
- ⚠️ Different from original vision (acceptable)
- ⚠️ Learning curve for Ekklesia platform (manageable)
- ⚠️ Less suited for officer elections (can add later if needed)

**Next Steps**:
1. Fix Portal 503 issue
2. Deploy Voting service
3. Integrate Members → Portal → Voting
4. Launch with test propositions
5. Train party members
6. Iterate based on feedback

**This vision is production-ready and achievable within 4-6 weeks.**

---

## References

**Original Vision**:
- [SYSTEM_ARCHITECTURE_OVERVIEW.md](SYSTEM_ARCHITECTURE_OVERVIEW.md) - Election-focused vision
- [NAMING_CLARIFICATION.md](NAMING_CLARIFICATION.md) - Why we changed approach

**Ekklesia Platform**:
- [Ekklesia Documentation](https://docs.ekklesiademocracy.org) - Official docs
- [Ekklesia Portal GitHub](https://github.com/edemocracy/ekklesia-portal)
- [Ekklesia Voting GitHub](https://github.com/edemocracy/ekklesia-voting)

**Current Status**:
- [CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md) - Infrastructure status
- [portal/DEPLOYMENT.md](../portal/DEPLOYMENT.md) - Portal deployment guide
- [members/README.md](../members/README.md) - Members service
- [voting/README.md](../voting/README.md) - Voting service

**GitHub Issues**:
- [Epic #16: Member Core](https://github.com/sosialistaflokkurinn/ekklesia/issues/16)
- [Epic #17: Events - Member Experience](https://github.com/sosialistaflokkurinn/ekklesia/issues/17) (now: Proposition Experience)
- [Epic #18: Voting Service Core](https://github.com/sosialistaflokkurinn/ekklesia/issues/18)
