# Documentation Index

## Status: FIREBASE MIGRATION COMPLETE - PRODUCTION DEPLOYED

**Last Updated**: October 7, 2025
**Current Branch**: feature/database-migration
**Deployment Status**: Firebase + Cloud Run production infrastructure live on GCP
**Documentation**: Root-level status docs + organized docs/ directory

---

## ⚠️ MAJOR ARCHITECTURE CHANGE

**ZITADEL infrastructure has been completely replaced with Firebase Identity Platform**

- **Migration Date**: October 6-7, 2025
- **Reason**: Cost savings ($135/mo → $7-10/mo) + Firebase Free Tier
- **Result**: Direct Firebase + Kenni.is PKCE integration
- **Status**: All ZITADEL resources decommissioned

---

## Quick Links

### Production Services
- **Firebase Hosting**: https://ekklesia-prod-10-2025.web.app
- **Test Page**: https://ekklesia-prod-10-2025.web.app/test.html
- **Members Service**: https://members-ymzrguoifa-nw.a.run.app
- **Portal Service**: https://portal-ymzrguoifa-nw.a.run.app (🟡 deployed, DB not migrated)
- **handleKenniAuth**: https://handlekenniauth-ymzrguoifa-nw.a.run.app
- **verifyMembership**: https://verifymembership-ymzrguoifa-nw.a.run.app
- **Firebase Console**: https://console.firebase.google.com/project/ekklesia-prod-10-2025
- **GCP Console**: https://console.cloud.google.com/run?project=ekklesia-prod-10-2025

### Current Architecture Documentation
- **Production Status**: [/CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md)
- **Portal Deployment**: [/PORTAL_DEPLOYMENT_PROGRESS.md](../PORTAL_DEPLOYMENT_PROGRESS.md)
- **Documentation Map**: [/DOCUMENTATION_MAP.md](../DOCUMENTATION_MAP.md)
- **Performance Notes**: [/PERFORMANCE_NOTES.md](../PERFORMANCE_NOTES.md)

---

## Production Infrastructure Summary

### Current Deployment Architecture (Firebase-based)
```
Production Environment: GCP (europe-west2 - London)

Components:
├── Firebase Services (Free Tier)
│   ├── Hosting: https://ekklesia-prod-10-2025.web.app
│   ├── Authentication: Custom token auth with Kenni.is claims
│   ├── Firestore: User profiles and metadata
│   └── Storage: User data and membership lists
│
├── Cloud Functions (Python 3.11)
│   ├── handleKenniAuth (512 MB)
│   │   └── OAuth PKCE token exchange with Kenni.is
│   └── verifyMembership (256 MB)
│       └── Membership verification against kennitalas.txt
│
├── Cloud Run Services
│   ├── Members (Node.js, 512 MB)
│   │   └── URL: https://members-ymzrguoifa-nw.a.run.app
│   └── Portal (Python/Morepath, 512 MB) 🟡
│       └── URL: https://portal-ymzrguoifa-nw.a.run.app
│
├── Cloud SQL PostgreSQL 15
│   ├── Instance: ekklesia-db
│   ├── Tier: db-f1-micro (614 MB RAM, shared CPU)
│   ├── Storage: 10 GB PD_HDD
│   ├── Database: ekklesia_portal (created, not migrated)
│   └── User: ekklesia_portal
│
└── Secret Manager
    ├── kenni-client-secret (Kenni.is OAuth)
    ├── portal-db-password
    ├── portal-session-secret
    └── members-session-secret (legacy)
```

### Key Identifiers
- **GCP Project**: ekklesia-prod-10-2025 (521240388393)
- **Region**: europe-west2 (London)
- **Firebase Project**: ekklesia-prod-10-2025
- **Kenni.is Client ID**: @sosi-kosningakerfi.is/rafr-nt-kosningakerfi-s-s
- **Kenni.is Issuer**: https://idp.kenni.is/sosi-kosningakerfi.is
- **OAuth Scopes**: openid, profile, national_id, email, phone_number

---

## Documentation Files

### Root-Level Documentation (Primary)
```
/home/gudro/Development/projects/ekklesia/
├── CURRENT_PRODUCTION_STATUS.md    # ⭐ Main production status
├── PORTAL_DEPLOYMENT_PROGRESS.md   # Portal deployment details
├── PORTAL_DEPLOYMENT_STATUS.md     # Portal status (duplicate)
├── DOCUMENTATION_MAP.md            # Complete architecture map
├── PERFORMANCE_NOTES.md            # OAuth performance analysis
├── CHANGELOG_2025-10-05.md         # Migration changelog
└── README.md                       # Project overview
```

### docs/ Directory (Historical + Specs)
```
docs/
├── DOCUMENTATION_INDEX.md          # This file
├── architecture/                   # System design (OUTDATED)
│   ├── identity.md                # ⚠️ ZITADEL-based (deprecated)
│   └── TECHNICAL_SOLUTION.md      # ⚠️ ZITADEL-based (deprecated)
├── specifications/                 # Technical specifications
│   ├── MEMBERS_OIDC_SPEC.md       # ⚠️ ZITADEL-based (deprecated)
│   └── members-oidc-v1.0.md       # ⚠️ ZITADEL-based (deprecated)
├── guides/                         # Implementation guides
│   ├── GITHUB_MCP_GUIDE.md
│   └── MEMBERS_DEPLOYMENT_GUIDE.md # ⚠️ Needs update for Firebase
├── plans/                          # Planning documents
└── archive/                        # Historical files
    └── github_issue_comments.md
```

### Service-Specific Documentation
```
members/
├── README.md                       # Members service overview
└── functions/
    └── main.py                     # Cloud Functions implementation

portal/
├── DEPLOYMENT.md                   # ✅ Portal deployment guide (verified)
├── README.md                       # Portal application docs
└── pyproject.toml                  # Dependencies
```

---

## Current Production Status

### ✅ Fully Operational Services
1. **Firebase Hosting** - Static site and test page
2. **Firebase Authentication** - Custom token auth with Kenni.is
3. **Firestore** - User profile storage
4. **handleKenniAuth** - OAuth PKCE token exchange (512 MB)
   - Captures: kennitala, name, email, phone_number
   - Performance: ~3 seconds (industry standard)
5. **verifyMembership** - Membership verification (256 MB)
6. **Members Service** - Node.js application (512 MB)
7. **Cloud SQL** - PostgreSQL 15 instance (RUNNABLE)

### 🟡 Partially Complete
1. **Portal Service** - Deployed but database not migrated
   - Container: ✅ Deployed (512 MB)
   - Database: 🟡 Created but empty (0 tables)
   - Issue: Python dependency resolution
   - Status: Returns 503 error
   - See: [PORTAL_DEPLOYMENT_PROGRESS.md](../PORTAL_DEPLOYMENT_PROGRESS.md)

### ❌ Deprecated/Removed Services
1. **ZITADEL** - Completely removed (Oct 6)
2. **OIDC Bridge Proxy** - Removed (no longer needed)
3. **Cloud SQL zitadel8** - Deleted
4. **Load Balancer (auth.si-xj.org)** - Removed
5. **All ZITADEL-related secrets** - Deprecated

---

## Migration History

### Timeline
| Date | Event | Impact |
|------|-------|--------|
| Oct 1, 2025 | Project created | Initial GCP setup |
| Oct 2, 2025 | ZITADEL deployed | Initial authentication infrastructure |
| Oct 3, 2025 | Members service deployed | Hello World + OIDC |
| Oct 5, 2025 | ZITADEL integration complete | Kenni.is working via OIDC bridge |
| Oct 6, 2025 | **Firebase migration started** | Cost optimization initiative |
| Oct 7, 2025 | **Firebase migration complete** | Direct Kenni.is PKCE + custom tokens |
| Oct 7, 2025 | Enhanced claims capture | Added email + phone_number scopes |
| Oct 7, 2025 | Portal deployment started | Cloud SQL + Portal service deployed |

### Cost Impact
- **Before (ZITADEL)**: ~$135/month
- **After (Firebase)**: ~$7-10/month
- **Annual Savings**: ~$1,500-1,536

---

## Documentation Status

### ✅ Up-to-Date Documentation
1. **[CURRENT_PRODUCTION_STATUS.md](../CURRENT_PRODUCTION_STATUS.md)** - Complete production overview
2. **[portal/DEPLOYMENT.md](../portal/DEPLOYMENT.md)** - Portal deployment guide (verified Oct 7)
3. **[PORTAL_DEPLOYMENT_PROGRESS.md](../PORTAL_DEPLOYMENT_PROGRESS.md)** - Deployment status
4. **[DOCUMENTATION_MAP.md](../DOCUMENTATION_MAP.md)** - Architecture map
5. **[PERFORMANCE_NOTES.md](../PERFORMANCE_NOTES.md)** - OAuth performance

### ⚠️ Outdated Documentation (ZITADEL-based)
1. **docs/architecture/identity.md** - References ZITADEL infrastructure
2. **docs/architecture/TECHNICAL_SOLUTION.md** - ZITADEL deployment details
3. **docs/specifications/MEMBERS_OIDC_SPEC.md** - ZITADEL OIDC specs
4. **docs/specifications/members-oidc-v1.0.md** - ZITADEL integration
5. **docs/guides/MEMBERS_DEPLOYMENT_GUIDE.md** - ZITADEL-based deployment

**Recommendation**: Archive ZITADEL docs and create new Firebase-based documentation.

---

## Next Steps & Recommendations

### Immediate Actions (Critical)
1. **Fix Portal Dependencies** - Export requirements.txt from poetry.lock
2. **Run Portal Migrations** - Execute 24 Alembic migrations
3. **Verify Portal Health** - Ensure service responds 200 OK
4. **Update Outdated Docs** - Archive ZITADEL docs, create Firebase equivalents

### Short-term Improvements
1. **Documentation Cleanup**
   - Archive all ZITADEL-based documentation
   - Create Firebase integration guide
   - Document current OAuth PKCE flow
   - Update members deployment guide

2. **Portal Service**
   - Grant database privileges manually
   - Test authentication integration
   - Configure monitoring alerts

3. **Monitoring & Operations**
   - Set up Cloud Logging alerts
   - Document operational runbooks
   - Test backup/recovery procedures

### Long-term Enhancements
1. **Production Hardening**
   - Custom domain for Portal service
   - CDN for static assets
   - Multi-region failover planning

2. **Cost Optimization**
   - Monitor Firebase usage (ensure Free Tier)
   - Right-size Cloud SQL (db-f1-micro sufficient?)
   - Review Cloud Run scaling settings

3. **Infrastructure as Code**
   - Terraform configuration
   - Automated deployments
   - Disaster recovery automation

---

## Access & Credentials

### GCP Console Access
- **Project**: ekklesia-prod-10-2025 (521240388393)
- **Region**: europe-west2 (London)
- **Account**: gudrodur@sosialistaflokkurinn.is

### Firebase Console Access
- **Project**: ekklesia-prod-10-2025
- **URL**: https://console.firebase.google.com/project/ekklesia-prod-10-2025
- **Account**: gudrodur@sosialistaflokkurinn.is

### Secret Manager
Production credentials in GCP Secret Manager:
- `kenni-client-secret` - Kenni.is OAuth client secret
- `portal-db-password` - Portal PostgreSQL password
- `portal-session-secret` - Portal session encryption
- `members-session-secret` - Members session (legacy)

### Deprecated Secrets
- `idp-client-id`, `idp-client-secret` - ZITADEL configs
- `zitadel-*` - All ZITADEL-related secrets
- `kenni-client-id`, `kenni-issuer` - Now environment variables

---

## Support & Resources

### Internal Resources
- **Documentation Root**: `/home/gudro/Development/projects/ekklesia/`
- **Code Repository**: Same directory
- **Current Branch**: `feature/database-migration`
- **Main Branch**: `main`

### External Resources
- **Firebase Docs**: https://firebase.google.com/docs
- **GCP Cloud Run**: https://cloud.google.com/run/docs
- **GCP Cloud SQL**: https://cloud.google.com/sql/docs
- **Kenni.is**: https://idp.kenni.is/
- **Reference Repo**: https://github.com/gudrodur/firebase-manual-oauth-pkce

### Contact
- **Primary Contact**: Guðröður (gudro)
- **Production Account**: gudrodur@sosialistaflokkurinn.is
- **Reference Account**: gudrodur@gmail.com
- **Project**: Ekklesia e-democracy platform

---

## Document Maintenance

### Update Schedule
- **Daily**: During active development
- **Weekly**: Production status updates
- **Monthly**: Comprehensive documentation review

### Version Control
All documentation is version-controlled:
- **Current Branch**: `feature/database-migration`
- **Main Branch**: `main`
- **Last Update**: 2025-10-07

### Change Log
- **2025-10-07**: Complete rewrite for Firebase migration
- **2025-10-05**: Firebase migration documentation added
- **2025-10-03**: ZITADEL Phase 4 completion
- **2025-10-01**: Initial documentation structure

---

**End of Documentation Index**

**Note**: This index has been completely rewritten to reflect the current Firebase-based architecture. All references to ZITADEL infrastructure are historical and marked as deprecated.
