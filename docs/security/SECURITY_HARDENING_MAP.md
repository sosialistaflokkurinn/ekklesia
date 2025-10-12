# Security Hardening Implementation Map

**Document Type**: Navigation & Implementation Guide
**Branch**: feature/security-hardening
**Created**: 2025-10-12
**Status**: 🔨 In Progress
**Purpose**: Central map for all security hardening work (Issues #30, #31, #32, #33)

---

## Overview

This document serves as the **central navigation map** for the security hardening branch. It connects all security documents, tracks implementation progress, and provides a clear roadmap.

### Issues Being Addressed

| Issue | Title | Severity | Status | Effort |
|-------|-------|----------|--------|--------|
| [#30](https://github.com/sosialistaflokkurinn/ekklesia/issues/30) | Firestore security rules review | 🔴 CRITICAL | ⏸️ Planned | 2 hours |
| [#31](https://github.com/sosialistaflokkurinn/ekklesia/issues/31) | Rate limiting for Cloud Functions | 🟠 HIGH | 🔨 In Progress | 3-4 hours |
| [#32](https://github.com/sosialistaflokkurinn/ekklesia/issues/32) | Idempotency for user creation | 🟡 MEDIUM | ⏸️ Planned | 30 min |
| [#33](https://github.com/sosialistaflokkurinn/ekklesia/issues/33) | CSRF protection verification | 🟠 HIGH | ⏸️ Planned | 1 hour |

**Total Estimated Effort**: 6.5-7.5 hours
**Target Completion**: Phase 1 (Critical fixes)

---

## Document Structure

### 📋 Planning Documents

#### 1. [SECURITY_HARDENING_PLAN.md](../status/SECURITY_HARDENING_PLAN.md)
**Purpose**: Comprehensive deep dive into all 4 security issues
**Contains**:
- Current state audit (verified via CLI tools)
- Vulnerability assessment for each issue
- Solution options comparison (Cloudflare vs Cloud Armor vs Firebase App Check)
- Cost analysis
- Implementation phases
- Code examples

**Key Sections**:
- Issue #31: Rate Limiting (Cloudflare recommended)
- Issue #33: CSRF Protection (state parameter)
- Issue #32: Idempotency (Firebase UID check)
- Issue #30: Firestore Rules (production security)

**Status**: ✅ Complete - Use as reference for all implementations

---

#### 2. [CLOUDFLARE_SETUP_PLAN.md](../status/CLOUDFLARE_SETUP_PLAN.md)
**Purpose**: Complete guide for Cloudflare DNS implementation
**Contains**:
- Discovery (existing infrastructure: si-xj.org)
- Phase-by-phase implementation guide
- DNS record creation (CNAME for all 4 services)
- Rate limiting configuration
- Application URL updates
- Testing procedures

**Key Phases**:
1. Investigation & Preparation (30 min)
2. Setup API Access (15 min)
3. Create DNS Records (20 min)
4. Configure Rate Limiting (dashboard)
5. **Origin Protection** (2-3 hours) 🔴 CRITICAL
6. Update Application URLs (30 min)
7. Testing & Verification

**Status**: ✅ Complete - Ready for implementation when domain confirmed

---

#### 3. [CLOUDFLARE_BYPASS_PROTECTION.md](CLOUDFLARE_BYPASS_PROTECTION.md) 🔴 CRITICAL
**Purpose**: Prevent attackers from bypassing Cloudflare by hitting direct Cloud Run URLs
**Contains**:
- Attack surface explanation
- Why Cloudflare DNS alone is not enough
- Complete Node.js middleware implementation
- Complete Python decorator implementation
- Cloudflare IP range allowlist (IPv4 + IPv6)
- Testing procedures
- Maintenance guide (monthly IP range updates)

**Critical Insight**: Cloudflare only protects traffic that goes through Cloudflare. Direct URLs remain exposed:
```
❌ https://elections-service-521240388393.europe-west2.run.app
❌ https://events-service-521240388393.europe-west2.run.app
❌ https://handlekenniauth-521240388393.europe-west2.run.app
❌ https://verifymembership-521240388393.europe-west2.run.app
```

**Status**: ✅ Complete - Must implement before Cloudflare DNS goes live

---

### 🛠️ Implementation Assets

#### 4. [cloudflare-dns.sh](../../cloudflare-dns.sh) (Project Root)
**Purpose**: Automated Cloudflare DNS management script
**Contains**:
- Ekklesia-specific configuration (4 Cloud Run services)
- Custom domains: auth, verify, api, vote
- Setup command (create all DNS records)
- Teardown command (delete all records with confirmation)
- Test command (DNS resolution, HTTPS, rate limiting)
- Status command (security status checking)
- GCP Secret Manager integration

**Usage**:
```bash
# Setup all services
./cloudflare-dns.sh setup

# Check security status
./cloudflare-dns.sh status

# Test all endpoints
./cloudflare-dns.sh test

# Delete all records (requires "DELETE" confirmation)
./cloudflare-dns.sh teardown
```

**Status**: ✅ Complete and committed - Ready to use once API token obtained

---

## Implementation Roadmap

### Phase 1: Critical Security Fixes (4-5 hours)

**Priority**: 🔴 MUST DO BEFORE PRODUCTION USE

#### Task 1.1: Firestore Security Rules (Issue #30)
- **Effort**: 2 hours
- **Status**: ⏸️ Not started
- **Files**:
  - `members/firestore.rules` (create/update)
- **Requirements**:
  - User profiles: Only owner can read/write
  - No public read access to user data
  - Server-side membership verification only
- **Testing**: Firebase emulator + manual testing
- **Deployment**: `firebase deploy --only firestore:rules`

**Documents**: See SECURITY_HARDENING_PLAN.md (Issue #30 section)

---

#### Task 1.2: CSRF Protection (Issue #33)
- **Effort**: 1 hour
- **Status**: ⏸️ Not started
- **Files**:
  - `members/public/index.html` (OAuth flow)
  - `members/functions/main.py` (handleKenniAuth function)
- **Requirements**:
  - Generate random state parameter before OAuth redirect
  - Store state in sessionStorage
  - Verify state matches on callback
- **Testing**: Full OAuth flow testing
- **Deployment**: `firebase deploy --only hosting,functions`

**Documents**: See SECURITY_HARDENING_PLAN.md (Issue #33 section)

---

#### Task 1.3: User Creation Idempotency (Issue #32)
- **Effort**: 30 minutes
- **Status**: ⏸️ Not started
- **Files**:
  - `members/functions/main.py` (handleKenniAuth function, line 206-210)
- **Requirements**:
  - Check if Firebase UID already exists before creating
  - Use kennitala-derived UID: `sha256(kennitala)`
  - Pass UID to `auth.create_user(uid=derived_uid)`
- **Testing**: Create user twice with same kennitala (should succeed both times)
- **Deployment**: `firebase deploy --only functions`

**Documents**: See SECURITY_HARDENING_PLAN.md (Issue #32 section)

---

#### Task 1.4: Cloudflare Origin Protection (Issue #31 - Part 1)
- **Effort**: 2-3 hours
- **Status**: ⏸️ Not started
- **Files**:
  - `shared/middleware/cloudflare-check.js` (create new)
  - `members/functions/cloudflare_check.py` (create new)
  - `events/src/index.js` (add middleware)
  - `elections/src/index.js` (add middleware)
  - `members/functions/main.py` (add decorator to both functions)
- **Requirements**:
  - IP allowlist for Cloudflare ranges
  - Reject non-Cloudflare traffic with 403
  - Development bypass with secret header
- **Testing**:
  - Direct URL access (should return 403)
  - Cloudflare URL access (should work)
- **Deployment**: All services must be redeployed

**Documents**: See CLOUDFLARE_BYPASS_PROTECTION.md (complete implementation guide)

---

### Phase 2: Cloudflare DNS Setup (2-3 hours + DNS propagation)

**Priority**: 🟠 AFTER Phase 1 Complete

**Prerequisites**:
- ✅ Cloudflare bypass protection implemented (Task 1.4)
- ⏸️ Domain access confirmed (sosialistaflokkurinn.is)
- ⏸️ Cloudflare API token obtained
- ⏸️ Token stored in GCP Secret Manager

#### Task 2.1: Domain Investigation
- **Effort**: 15 minutes
- **Status**: ⏸️ Blocked (need to contact Samstaða)
- **Actions**:
  - Check si-xj.org status (discovered: still on Cloudflare!)
  - Contact Samstaða about sosialistaflokkurinn.is ownership
  - Determine DNS management access
  - Check for existing Cloudflare account

**Discovery**: si-xj.org IS on Cloudflare (nameservers: bristol/jakub.ns.cloudflare.com)

---

#### Task 2.2: Cloudflare API Setup
- **Effort**: 15 minutes
- **Status**: ⏸️ Blocked (need API token)
- **Actions**:
  - Get Cloudflare API token
  - Store in GCP Secret Manager: `cloudflare-api-token`
  - Test cloudflare-dns.sh script: `./cloudflare-dns.sh list`

**Script**: Already created and committed to project root

---

#### Task 2.3: Create DNS Records
- **Effort**: 20 minutes
- **Status**: ⏸️ Blocked (need API access)
- **Actions**:
  - Run: `./cloudflare-dns.sh setup`
  - Verify: `./cloudflare-dns.sh status`
  - Check: `dig auth.sosialistaflokkurinn.is`

**DNS Records to Create**:
```
auth.sosialistaflokkurinn.is → handlekenniauth-521240388393.europe-west2.run.app
verify.sosialistaflokkurinn.is → verifymembership-521240388393.europe-west2.run.app
api.sosialistaflokkurinn.is → events-service-521240388393.europe-west2.run.app
vote.sosialistaflokkurinn.is → elections-service-521240388393.europe-west2.run.app
```

---

#### Task 2.4: Configure Rate Limiting (Cloudflare Dashboard)
- **Effort**: 20 minutes
- **Status**: ⏸️ Blocked (need DNS records)
- **Actions**:
  - Go to Cloudflare dashboard → Security → WAF
  - Create rate limiting rules (see CLOUDFLARE_SETUP_PLAN.md Phase 4)
  - Test rate limiting: `./cloudflare-dns.sh test`

**Rules to Create**:
1. OAuth endpoint: 100 req/min → block 10 min
2. API endpoints: 300 req/min → challenge
3. Membership: 60 req/min → block 5 min

---

#### Task 2.5: Update Application URLs
- **Effort**: 30 minutes
- **Status**: ⏸️ Blocked (need DNS propagation)
- **Files**:
  - `members/public/index.html` (OAuth URL)
  - `members/public/dashboard.html` (verify URL)
  - `members/public/test-events.html` (Events API URL)
  - `events/src/services/electionsClient.js` (Elections S2S URL)
  - `members/firebase.json` (CSP headers)
- **Actions**:
  - Update all `*.run.app` URLs to custom domains
  - Update Kenni.is OAuth redirect URIs
  - Deploy all services
  - Test end-to-end

**Documents**: See CLOUDFLARE_SETUP_PLAN.md (Phase 6)

---

#### Task 2.6: Testing & Verification
- **Effort**: 30 minutes
- **Status**: ⏸️ Blocked (need Phase 2.5 complete)
- **Actions**:
  - Test OAuth flow: https://ekklesia-prod-10-2025.web.app
  - Test token issuance: Events API
  - Test voting flow: Elections API
  - Test rate limiting: Send 101 requests
  - Monitor Cloudflare dashboard for traffic

**Expected Results**:
- All endpoints work via custom domains
- Direct URLs return 403 Forbidden
- Rate limiting blocks excessive requests
- Cloudflare dashboard shows traffic

---

### Phase 3: Documentation & Cleanup (1 hour)

**Priority**: 🟢 AFTER Phase 1-2 Complete

#### Task 3.1: Update Production Status
- **Effort**: 15 minutes
- **Status**: ⏸️ Blocked (need Phase 1-2 complete)
- **Files**:
  - `docs/status/CURRENT_PRODUCTION_STATUS.md`
- **Actions**:
  - Document Cloudflare setup
  - Update service URLs
  - Add security status section

---

#### Task 3.2: Update Architecture Docs
- **Effort**: 15 minutes
- **Status**: ⏸️ Blocked (need Phase 1-2 complete)
- **Files**:
  - `docs/SYSTEM_ARCHITECTURE_OVERVIEW.md`
- **Actions**:
  - Add Cloudflare as edge layer
  - Update architecture diagram
  - Document security layers

---

#### Task 3.3: Create Operational Runbook
- **Effort**: 30 minutes
- **Status**: ⏸️ Blocked (need Phase 1-2 complete)
- **Files**:
  - `docs/operations/CLOUDFLARE_OPERATIONS.md` (create new)
- **Actions**:
  - Document monthly IP range checks
  - Document DNS record updates
  - Document rate limiting adjustments
  - Document rollback procedures

---

## Progress Tracking

### Completed ✅

| Date | Task | Document/File | Status |
|------|------|---------------|--------|
| Oct 12 | Security audit (CLI verification) | SECURITY_HARDENING_PLAN.md | ✅ Done |
| Oct 12 | Cost analysis (Cloudflare vs alternatives) | SECURITY_HARDENING_PLAN.md | ✅ Done |
| Oct 12 | Cloudflare setup guide | CLOUDFLARE_SETUP_PLAN.md | ✅ Done |
| Oct 12 | Bypass protection guide | CLOUDFLARE_BYPASS_PROTECTION.md | ✅ Done |
| Oct 12 | Automated DNS script | cloudflare-dns.sh | ✅ Done |
| Oct 12 | si-xj.org discovery | CLOUDFLARE_SETUP_PLAN.md | ✅ Done |

### In Progress 🔨

| Task | Status | Blocker | Next Action |
|------|--------|---------|-------------|
| Domain investigation | ⏸️ Paused | Need to contact Samstaða | Ask about sosialistaflokkurinn.is ownership |
| API token | ⏸️ Paused | Need domain access first | Get API token when domain confirmed |

### Planned ⏸️

| Task | Depends On | Estimated Start |
|------|-----------|-----------------|
| Firestore rules (Issue #30) | None | Can start anytime |
| CSRF protection (Issue #33) | None | Can start anytime |
| Idempotency (Issue #32) | None | Can start anytime |
| Origin protection (Issue #31) | None | Can start anytime |
| DNS record creation | API token | After domain confirmed |
| Rate limiting config | DNS records | After DNS created |
| URL updates | DNS propagation | After 24-48 hours |

---

## Cost Summary

### Implementation Costs

| Phase | Description | Time | Cost |
|-------|-------------|------|------|
| Phase 1 | Critical security fixes | 4-5 hours | $0 (code changes) |
| Phase 2 | Cloudflare DNS setup | 2-3 hours | $0 (Cloudflare Free tier) |
| Phase 3 | Documentation | 1 hour | $0 |
| **Total** | **Full implementation** | **7-9 hours** | **$0** |

### Monthly Operational Costs

| Service | Before | After | Savings |
|---------|--------|-------|---------|
| Cloudflare | N/A | $0 | - |
| Rate limiting | Missing | $0 | - |
| DDoS protection | Missing | $0 | - |
| WAF | Missing | $0 | - |
| **Total** | **N/A** | **$0/month** | **$0** |

**vs. Cloud Armor Alternative**: $0.75/month + usage (Cloudflare is $0.75/month cheaper)

---

## Testing Checklist

### Pre-Deployment Tests

- [ ] **Firestore Rules**: Firebase emulator test
- [ ] **CSRF Protection**: Generate state, verify match
- [ ] **Idempotency**: Create user twice (should succeed)
- [ ] **Origin Protection**: Local middleware test

### Post-Deployment Tests (Phase 1)

- [ ] **Firestore Rules**: Try unauthorized access (should fail)
- [ ] **CSRF Protection**: Full OAuth flow (should work)
- [ ] **Idempotency**: Create user twice in production (should succeed)
- [ ] **Origin Protection**: Hit direct URL (should get 403)

### Post-Deployment Tests (Phase 2)

- [ ] **DNS Resolution**: `dig auth.sosialistaflokkurinn.is`
- [ ] **HTTPS**: `curl -I https://auth.sosialistaflokkurinn.is`
- [ ] **Rate Limiting**: Send 101 requests (should get blocked)
- [ ] **Bypass Test**: Hit direct URL (should get 403)
- [ ] **OAuth Flow**: Full authentication (should work)
- [ ] **Token Issuance**: Request voting token (should work)
- [ ] **Voting**: Submit ballot (should work)

---

## Related Documents

### Project Documentation
- [DOCUMENTATION_MAP.md](../DOCUMENTATION_MAP.md) - Master project index
- [SYSTEM_ARCHITECTURE_OVERVIEW.md](../SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall architecture
- [USAGE_CONTEXT.md](../USAGE_CONTEXT.md) - Load patterns and capacity planning

### Security Documentation
- [SECURITY_HARDENING_PLAN.md](../status/SECURITY_HARDENING_PLAN.md) - Detailed security analysis
- [CLOUDFLARE_SETUP_PLAN.md](../status/CLOUDFLARE_SETUP_PLAN.md) - Cloudflare implementation
- [CLOUDFLARE_BYPASS_PROTECTION.md](CLOUDFLARE_BYPASS_PROTECTION.md) - Origin protection

### Operational Documentation
- [CURRENT_PRODUCTION_STATUS.md](../status/CURRENT_PRODUCTION_STATUS.md) - Production services
- [OPERATIONAL_PROCEDURES.md](../OPERATIONAL_PROCEDURES.md) - Meeting day operations

### Service Design
- [EVENTS_SERVICE_MVP.md](../design/EVENTS_SERVICE_MVP.md) - Token issuance service
- [ELECTIONS_SERVICE_MVP.md](../design/ELECTIONS_SERVICE_MVP.md) - Anonymous voting service

---

## Quick Start Guide

### For First-Time Implementation

1. **Read this map** - Understand overall structure
2. **Review SECURITY_HARDENING_PLAN.md** - Understand all 4 issues
3. **Start with Phase 1** (can do in parallel):
   - Issue #30: Firestore rules (2 hours)
   - Issue #33: CSRF protection (1 hour)
   - Issue #32: Idempotency (30 min)
   - Issue #31: Origin protection (2-3 hours)
4. **Proceed to Phase 2** (sequential):
   - Get domain access
   - Get API token
   - Create DNS records
   - Configure rate limiting
   - Update URLs
   - Test everything
5. **Finish with Phase 3** - Update documentation

### For Maintenance

1. **Monthly**: Check Cloudflare IP ranges
   ```bash
   curl https://www.cloudflare.com/ips-v4
   curl https://www.cloudflare.com/ips-v6
   ```
2. **As needed**: Adjust rate limiting rules
3. **As needed**: Update DNS records

---

## Decision Log

### Key Decisions Made

| Date | Decision | Rationale | Document |
|------|----------|-----------|----------|
| Oct 12 | Use Cloudflare over Cloud Armor | $0 vs $0.75/month, better features | SECURITY_HARDENING_PLAN.md |
| Oct 12 | Implement origin protection | Prevent Cloudflare bypass | CLOUDFLARE_BYPASS_PROTECTION.md |
| Oct 12 | Use automated script for DNS | Reproducible, version controlled | cloudflare-dns.sh |
| Oct 12 | Phase 1 before Phase 2 | Critical security first, then DNS | This document |

### Open Questions

| Question | Status | Next Step |
|----------|--------|-----------|
| Does Samstaða own sosialistaflokkurinn.is? | ⏸️ Open | Contact Samstaða |
| Can we access si-xj.org Cloudflare account? | ⏸️ Open | Ask about existing account |
| What rate limits are acceptable? | ⏸️ Open | Test with real usage patterns |

---

## Branch Status

**Branch**: `feature/security-hardening`
**Parent**: `feature/elections-design-and-ops-docs`
**Created**: Oct 12, 2025
**Status**: 🔨 Active Development

### Commits
1. ✅ `feat: create customized Cloudflare security management script`
2. ✅ `docs: add critical Cloudflare bypass protection documentation`

### Files Changed
- `cloudflare-dns.sh` (new, 563 lines)
- `docs/security/CLOUDFLARE_BYPASS_PROTECTION.md` (new, 700+ lines)
- `docs/status/SECURITY_HARDENING_PLAN.md` (updated)
- `docs/status/CLOUDFLARE_SETUP_PLAN.md` (updated)
- `docs/security/SECURITY_HARDENING_MAP.md` (this file, new)

### Next PR
- **Title**: Security Hardening: Cloudflare Rate Limiting + Critical Fixes (Issues #30, #31, #32, #33)
- **Target Branch**: `main` (after PR #29 merged)
- **Planned**: After Phase 1 complete and tested

---

## Contact & Escalation

### For Questions
- Review documents in order: Map → Plan → Specific guide
- Check decision log for context
- Review related GitHub issues

### For Blockers
- Domain access: Contact Samstaða
- Technical issues: Check testing checklist
- Cost concerns: Review cost summary

---

**Document Version**: 1.0
**Last Updated**: 2025-10-12
**Status**: 🔨 Active - Living document (update as work progresses)
**Next Review**: After Phase 1 complete
