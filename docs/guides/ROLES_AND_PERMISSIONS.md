# Roles and Permissions (RBAC)

**Classification**: Public - Architecture
**Sensitive Operations**: See internal documentation

This document defines the roles for the Ekklesia platform at a high level. The goal is to follow the principle of least privilege, keep operational actions auditable, and make it easy to reason about who can do what.

**NOTE**: Detailed role assignment procedures and operational runbooks are maintained separately for authorized administrators only.

## Role definitions

- developer (highest privileges)
  - Intended for core platform developers and SREs.
  - Full administrative capabilities across non-voting-critical operations in lower environments; restricted and audited in production.
  - Can perform destructive reset operations during testing (e.g., election data resets), manage config, and run maintenance scripts.

- meeting_election_manager
  - Responsible for a specific meeting/election lifecycle.
  - Can prepare and open/close elections, monitor progress, and access results dashboards.
  - Cannot perform general platform administration outside election management.

- event_manager
  - Manages Events service data and schedules (e.g., configuring event metadata, timelines, announcements).
  - Cannot change election tallies or bypass security boundaries.

- member
  - Regular authenticated party member.
  - Can authenticate, request a voting token (when eligible), vote, and view permitted results.

Notes:
- Role names are lowercase identifiers used in Firebase custom claims (e.g., `roles: ["developer", "meeting_election_manager"]`).
- The `member` capability may be inferred from `isMember: true` claim; adding `member` to the roles array is optional but can help with UI gating.

## Permission matrix (current services)

Legend:
- ✅ allowed
- ❌ forbidden
- — not applicable / not required by role

### Admin Actions Permission Matrix

| Action | Endpoint | developer | meeting_election_manager | event_manager | member |
|--------|----------|-----------|--------------------------|---------------|---------|
| **Election Lifecycle** | | | | | |
| Create election (draft) | POST /api/admin/elections | ✅ | ✅ | ❌ | ❌ |
| Edit draft election | PATCH /api/admin/elections/:id/draft | ✅ | ✅ | ❌ | ❌ |
| Publish election | POST /api/admin/elections/:id/publish | ✅ | ✅ | ❌ | ❌ |
| Pause election | POST /api/admin/elections/:id/pause | ✅ | ✅ | ❌ | ❌ |
| Resume election | POST /api/admin/elections/:id/resume | ✅ | ✅ | ❌ | ❌ |
| Close election | POST /api/admin/elections/:id/close | ✅ | ✅ | ❌ | ❌ |
| Archive election | POST /api/admin/elections/:id/archive | ✅ | ✅ | ❌ | ❌ |
| Delete draft (soft) | DELETE /api/admin/elections/:id | ✅ | ❌ | ❌ | ❌ |
| **Metadata Management** | | | | | |
| Edit election metadata | PATCH /api/admin/elections/:id/metadata | ✅ | ✅ | ✅ | ❌ |
| **Viewing & Monitoring** | | | | | |
| List elections (admin) | GET /api/admin/elections | ✅ | ✅ | ✅ | ❌ |
| Preview election detail | GET /api/admin/elections/:id | ✅ | ✅ | ✅ | ❌ |
| **Developer Operations** | | | | | |
| Reset election data | POST /api/admin/reset-election | ✅ | ❌ | ❌ | ❌ |

**Notes**:
- **developer**: Full access to all admin operations including destructive actions
- **meeting_election_manager**: Can manage full election lifecycle (create → close → archive) but cannot delete or reset
- **event_manager**: Can only edit metadata (title, description, dates) - no lifecycle control
- **member**: No admin access (public endpoints only)

### Members service (Cloud Functions)
- handleKenniAuth (OAuth/PKCE sign-in): member (no special role required beyond authentication)
- verify membership: member
- Admin actions: none exposed currently

### Members portal (Upcoming: Epic #87 Phase 2)
- `/elections` list: visible to authenticated members; contents filtered by eligibility data supplied by Events API (#65).
- `/elections/:id` detail view: member read-only; references eligibility explanation derived from this guide.
- `/roles` page (#68):
  - Renders a trimmed version of the matrix above for self-service transparency.
  - Surfaces contact guidance for requesting elevated roles (links to internal ops docs).
  - References Phase 5 admin tooling once endpoints (#71-#79) are deployed.

### Events service (Node/Express)
**Public (with Firebase auth)**:
- GET /api/election: member ✅
- POST /api/request-token: member ✅
- GET /api/my-status: member ✅
- GET /api/my-token: member ✅ (returns guidance in MVP)
- GET /api/results: member ✅ (graceful if Elections unavailable)

**Admin (role-protected)**:
- POST /api/admin/reset-election: `requireRole('developer')`
  - Scope "mine": delete caller's Events token only (safe)
  - Scope "all": truncate Elections ballots/tokens and clear Events tokens (destructive; confirmation required)
- POST /api/admin/elections: `requireAnyRoles(['developer', 'meeting_election_manager'])`
- PATCH /api/admin/elections/:id/draft: `requireAnyRoles(['developer', 'meeting_election_manager'])`
- POST /api/admin/elections/:id/publish: `requireAnyRoles(['developer', 'meeting_election_manager'])`
- POST /api/admin/elections/:id/close: `requireAnyRoles(['developer', 'meeting_election_manager'])`
- PATCH /api/admin/elections/:id/metadata: `requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager'])`
- GET /api/admin/elections: `requireAnyRoles(['developer', 'meeting_election_manager', 'event_manager'])`
- DELETE /api/admin/elections/:id: `requireRole('developer')`

### Elections service (Node/Express)
**Public voting**:
- POST /api/vote: token-based (no roles)
- GET /api/token-status: token-based (no roles)

**S2S (secured by X-API-Key)**:
- POST /api/s2s/register-token: Events → Elections (no roles)
- GET  /api/s2s/results: Events → Elections (no roles)

**Future admin**:
- Protected admin endpoints (e.g., audit exports, sealed results) guarded by roles (developer/meeting_election_manager) with additional audit logging.

## Storage and propagation of roles

- Source of truth: Firebase Auth custom claims on the user record.
  - Example payload: `{ isMember: true, kennitala: "DDMMYY-XXXX", roles: ["developer", "meeting_election_manager"] }`.
- Propagation:
  - Frontend: read via ID token (`getIdTokenResult()`) and expose to UI for gating.
  - Backend: verify ID token server-side and read roles array for authorization checks.

## How to assign roles

Roles are assigned via Firebase custom claims using admin tooling.

**Operational guidance**:
- Keep the set of `developer` users very small and audited quarterly
- Prefer `meeting_election_manager` for day-to-day election operations
- `event_manager` manages non-voting event content/configuration
- All role assignments must be logged and approved

**Implementation details**: See internal operations documentation for authorized administrators.

## Enforcement patterns (implementation outline)

- Backend (Node):
  - Extend auth middleware to attach `req.user.roles = decodedToken.roles || []`.
  - Add `requireRole('developer')` and `requireAny(['meeting_election_manager', 'developer'])` helpers.
  - Apply to admin routes (e.g., `/api/admin/reset-election`).

- Frontend:
  - Include `roles` in `userData` for UI gating (hide dangerous controls if role missing).

- Members Cloud Function:
  - When issuing Firebase custom token, preserve `roles` from stored user profile (if applicable) or set via admin tools outside auth flow.

## Auditing and safety

- All admin routes should:
  - Log structured, sanitized events with `performed_by` (UID) and correlation IDs.
  - Require confirmation steps for destructive actions (as implemented for reset-all: "RESET ALL").
  - Return before/after counters for transparency.
- Consider a read-only “dry-run” parameter for future admin endpoints.

## Next steps

- Implement `roles` extraction in Events auth middleware and add `requireRole` helpers.
- Gate the test page’s reset section by `developer` role.
- Provide a small CLI script for setting roles (or documented `node` one-liner).
- Add basic unit tests for role middleware.
- Publish member-facing summary snippets for `/roles` page (#68) once Phase 2 UI lands.
- Document admin role request workflow alongside the new weekly membership sync (#88-#92).
