# Environment Clarification: Production Tools, Development System

**Last Updated:** 2025-10-22
**Status:** ✅ Active - Important Context for All Team Members

---

## TL;DR

- **GCP Infrastructure:** Production-grade (ekklesia-prod-10-2025 project)
- **Ekklesia System:** Under development (no live users, no real elections)

**This is NOT a contradiction - read below to understand why.**

---

## Why "Production" Infrastructure for Development?

### Kenni.is OAuth Requirement

Kenni.is (Iceland's National eID system) **requires production-grade infrastructure** for OAuth integration:

- ✅ **Real OAuth client credentials** (not test/sandbox mode)
- ✅ **Production Firebase project** for callback URLs
- ✅ **Production Cloud Run endpoints** for API calls
- ✅ **Production domain names** for redirect URIs

**Why?** The Icelandic government's identity provider (Kenni.is) **does not have a test/sandbox mode**. All OAuth integrations - even for development and testing - must use production-grade infrastructure with real credentials.

**What this means:**
- We **must** use the "ekklesia-prod-10-2025" GCP project for all development
- We **must** use production Firebase, Cloud Run, and Cloud SQL instances
- We **must** use real domain names and SSL certificates
- OAuth callbacks will **not work** on localhost or test environments

---

## Terminology Guide

### ✅ Correct Terminology

| Context | Correct Term | Example |
|---------|--------------|---------|
| **GCP Project** | Production infrastructure | "Deploy to production Firebase" |
| **System Status** | Development phase | "System is under development" |
| **User Activity** | No live users | "No production data yet" |
| **Elections** | Test elections only | "Running test elections in development" |
| **Deployment** | Development deployment | "Deploying development version to production infrastructure" |

### ❌ Avoid These Terms

| Incorrect | Why Wrong | Use Instead |
|-----------|-----------|-------------|
| "Production system" | Implies live users | "Development system on production infrastructure" |
| "Production-ready" | Implies ready for real use | "Infrastructure ready for development" |
| "Live environment" | Confusing | "Development environment on production tools" |
| "Test infrastructure" | We can't use test infra | "Production infrastructure for development" |

---

## Current System Status

### What We Have (Infrastructure)

✅ **Production-Grade GCP Infrastructure:**
- Firebase Project: `ekklesia-prod-10-2025`
- Cloud Run services in `europe-west2`
- Cloud SQL PostgreSQL database
- Firebase Hosting with custom domain
- Service accounts and IAM roles
- SSL certificates and production domains

**All deployed and operational.**

### What We DON'T Have (System)

❌ **No Production Use:**
- **URL is unlisted** (not publicly shared with members)
- No official announcement or communication to members
- No real elections (all testing is developmental)
- Only developers know about and use the system for testing
- No service-level agreements (SLAs)
- No 24/7 on-call support

**Important Note:** The system uses **production Kenni.is authentication** (real Icelandic eID), so anyone with an Icelandic eID *could* technically login if they knew the URL. However, the URL is intentionally unlisted and only shared with developers for testing purposes.

**System is under active development.**

---

## Development Workflow

### How Development Works

1. **Write Code**
   ```bash
   # Work on local machine
   git checkout -b feature/my-feature
   # Make changes
   ```

2. **Test Locally** (Limited)
   ```bash
   # Run unit tests
   npm test

   # Run integration tests (requires production infrastructure)
   # OAuth won't work on localhost due to Kenni.is requirement
   ```

3. **Deploy to Production Infrastructure**
   ```bash
   # Deploy to ekklesia-prod-10-2025 project
   gcloud functions deploy handleKenniAuth \
     --project=ekklesia-prod-10-2025 \
     --gen2
   ```

4. **Test on Production Infrastructure**
   ```bash
   # Test OAuth flow (only works with production Firebase)
   # Test API endpoints (only works with production Cloud Run)
   # Test database (only works with production Cloud SQL)
   ```

5. **Iterate**
   - Fix bugs
   - Add features
   - Deploy again
   - Test again

**Note:** All testing happens on production infrastructure, but with test data and no real users.

---

## Safety Measures

### How We Prevent Accidents

Even though we're using production infrastructure and real authentication, we have safeguards:

1. **No Real Elections**
   - All elections are test elections (non-binding)
   - All votes are developmental testing
   - Database can be reset at any time
   - No real decision-making happening

2. **URL is Unlisted**
   - Members are not told the system exists
   - URL not shared publicly or in official communications
   - No marketing or announcements
   - Only developers know the URL for testing

**Note:** The system uses production Kenni.is OAuth, so any Icelandic citizen *could* login with their real eID if they discovered the URL. However, since there are no real elections and the URL is intentionally unlisted, there's no impact if someone accidentally finds it.

3. **Reversible Operations**
   - Database migrations can be rolled back
   - Services can be redeployed
   - Bad data can be deleted
   - Entire database can be reset

4. **Audit Logging**
   - All operations logged
   - All changes tracked
   - Easy to identify and fix issues

**Conclusion:** It's safe to experiment, test, and break things - we're still in development.

---

## Timeline to Production Use

### Current Phase: Development (Phase 5)

**Status:** Building features and testing

**Activities:**
- Developing admin election management (Epic #24)
- Building membership sync (Epic #43)
- Creating member voting interface (Epic #87)
- Testing with developer accounts
- Iterating on feedback

**Timeline:** November 2025 (estimated)

### Next Phase: User Acceptance Testing (UAT)

**Status:** Not started yet

**Activities:**
- Internal testing with small group of real members
- Test elections with real members (non-binding votes)
- Gather feedback and fix issues
- Verify all features work as expected

**Timeline:** December 2025 (estimated)

### Future Phase: Production Use

**Status:** Not started yet

**Activities:**
- Official announcement to all members
- First real election with binding results
- 24/7 monitoring and support
- Service-level agreements (SLAs)
- Production data protection policies

**Timeline:** TBD (when ready and approved)

---

## FAQ

### Q: Why can't we use a test/staging environment?

**A:** Kenni.is OAuth doesn't support test environments. All OAuth integrations - even for development - must use production credentials and production infrastructure.

### Q: Is it safe to deploy to production infrastructure during development?

**A:** Yes! We have no live users, no production data, and no public announcement. The infrastructure is "production-grade" (reliable, secure), but the system is still "under development" (not ready for real use).

### Q: What if we accidentally break something?

**A:** That's fine! We can:
- Redeploy a working version
- Roll back database changes
- Reset test data
- No real users are affected (because there are no real users yet)

### Q: When will the system be "in production"?

**A:** When we:
1. Complete Phase 5 development
2. Complete UAT testing
3. Get approval from stakeholders
4. Publicly announce availability to members
5. Hold the first real election with binding results

**Until then:** It's "development system on production infrastructure."

### Q: How do I talk about this to non-technical people?

**A:** Use this language:
- "We're building the voting system on Google Cloud Platform (production-grade tools)."
- "The system is under active development - not ready for real use yet."
- "We're testing with developer accounts - no real elections happening yet."
- "When it's ready, we'll announce it to members and hold real elections."

---

## Summary

**The key distinction:**

| Aspect | Status |
|--------|--------|
| **Infrastructure** | Production-grade (reliable, secure, expensive) |
| **System** | Under development (testing, iterating, not ready) |
| **Authentication** | Production Kenni.is OAuth (real Icelandic eID) |
| **Accessibility** | Unlisted URL (not publicly shared) |
| **Usage** | Developer testing only (no official member communication) |
| **Data** | Test data only (can be reset at any time) |
| **Elections** | Test elections (non-binding, for development) |
| **Timeline** | Phase 5 development → UAT → Production use |

**Bottom line:** We're using **production tools** to build a **development system**. This is necessary due to Kenni.is OAuth requirements, and it's perfectly safe because we have no real users yet.

---

**Questions?** Ask the development team or refer to:
- [CURRENT_DEVELOPMENT_STATUS.md](status/CURRENT_DEVELOPMENT_STATUS.md) - System status
- [OPERATIONAL_PROCEDURES.md](operations/OPERATIONAL_PROCEDURES.md) - Meeting operations
- [USAGE_CONTEXT.md](development/guides/workflows/USAGE_CONTEXT.md) - Usage patterns

---

**Last Updated:** 2025-10-22
**Applies To:** All Ekklesia development work
**Next Review:** After UAT phase begins
