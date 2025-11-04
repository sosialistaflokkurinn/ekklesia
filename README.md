# Ekklesia

Custom e-democracy voting platform for **Sósíalistaflokkur Íslands** (Socialist Party of Iceland).

[![Test Cloud Functions](https://github.com/sosialistaflokkurinn/ekklesia/actions/workflows/test-functions.yml/badge.svg)](https://github.com/sosialistaflokkurinn/ekklesia/actions/workflows/test-functions.yml)
[![Security Hygiene](https://github.com/sosialistaflokkurinn/ekklesia/actions/workflows/security-hygiene.yml/badge.svg)](https://github.com/sosialistaflokkurinn/ekklesia/actions/workflows/security-hygiene.yml)

Regnhlífarverkefni fyrir kosningakerfi Sósíalistaflokksins ásamt meðlima og atburðakerfi.

---

## 📚 Documentation

**Start Here**: [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md) - Master documentation index with complete system overview

**Essential Links**:
- [Current Status](DOCUMENTATION_MAP.md#current-status) - Production services, recent milestones, current work
- [Repository Structure](DOCUMENTATION_MAP.md#-repository-structure) - Complete repository organization
- [System Architecture](docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall system design
- [Getting Started Guide](docs/README.md) - Documentation hub for all topics
- [Scripts Documentation](scripts/README.md) - Deployment and maintenance tools

---

## 🚀 Production Services

**Status**: ✅ All services operational (November 2025)
**Project**: ekklesia-prod-10-2025
**Region**: europe-west2 (London)

| Service | Technology | Status |
|---------|-----------|--------|
| **Members** (Meðlimir) | Firebase + Python Functions | ✅ Production |
| **Events** (Atburðir) | Node.js + Cloud Run | ✅ Production |
| **Elections** (Kosningar) | Node.js + Cloud Run | ✅ Production |
| **Database** | Cloud SQL PostgreSQL 15 | ✅ Production |

**Live URLs**: See [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md#-production-services-november-4-2025) for service endpoints.

### Architecture Overview

- **Members Service**: Firebase Hosting + Cloud Functions - National eID (Kenni.is) authentication
- **Events Service**: Node.js + Express - Election administration and voting token issuance
- **Elections Service**: Node.js + Express - Anonymous ballot recording (no PII)
- **Authentication**: Firebase Auth + Kenni.is OAuth PKCE

**Detailed Architecture**: See [docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md](docs/design/SYSTEM_ARCHITECTURE_OVERVIEW.md)

---

## 🏗️ Key Features

- **Secure Authentication**: National eID integration via Kenni.is
- **Member Verification**: Automatic sync from Django backend
- **Anonymous Voting**: Zero-knowledge ballot recording (no PII in Elections service)
- **Token-Based Security**: One-time SHA-256 hashed tokens
- **Full Audit Trail**: Complete vote tracking with member identity (Events service only)
- **S2S Integration**: Secure server-to-server communication
- **Icelandic Language**: Full UI in Íslenska

**Feature Details**: See [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md#-repository-structure) for complete feature documentation.

---

## 🔒 Security

**Security Status**: 8.5/10 - Production-ready with comprehensive protections

Key security features:
- National eID (Kenni.is) authentication
- OAuth 2.0 PKCE flow (RFC 7636)
- CSRF protection with state validation
- Firestore security rules (role-based access)
- Rate limiting (Cloudflare, 100 req/10sec per IP)
- Anonymous voting (Elections service has zero PII)
- SHA-256 token hashing
- SSL/TLS Full (strict) encryption

**Security Documentation**: See [docs/security/](docs/security/) for complete security analysis and responses.

---

## 💰 Cost

**Monthly**: ~$7-13/month (optimized for infrequent meetings)

- Members Service: $0 (Firebase free tier)
- Events + Elections: $0-3 each (Cloud Run free tier)
- Cloud SQL: ~$7 (db-f1-micro)

**Cost Details**: See [docs/development/guides/workflows/USAGE_CONTEXT.md](docs/development/guides/workflows/USAGE_CONTEXT.md) for load patterns and scaling strategy.

---

## 🧑‍💻 Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- Firebase CLI
- gcloud CLI
- PostgreSQL client (psql)

### Quick Start

```bash
# Clone repository
git clone https://github.com/sosialistaflokkurinn/ekklesia.git
cd ekklesia

# Read documentation
cat docs/README.md  # Start here for learning paths

# See service-specific setup
cat services/members/README.md
cat services/events/README.md
cat services/elections/README.md
```

### Repository Structure

```
ekklesia/
├── apps/               # Frontend applications (members-portal)
├── services/           # Backend services (members, events, elections)
├── docs/               # Complete documentation (start: docs/README.md)
├── data/               # Data files (gitignored - address database)
├── scripts/            # Deployment and maintenance scripts
├── testing/            # E2E tests and test utilities
├── archive/            # Historical/deprecated code
└── .github/            # GitHub workflows and templates
```

**Complete Structure**: See [DOCUMENTATION_MAP.md#-repository-structure](DOCUMENTATION_MAP.md#-repository-structure)

---

## 📊 Current Work (November 2025)

- **Epic #159**: 🔄 Profile Editing & Admin UI (in progress)
- **Epic #103**: ✅ Documentation Organization (complete)
- **Epic #116**: ✅ Members Admin UI (complete)

**Detailed Status**: See [DOCUMENTATION_MAP.md#-current-work](DOCUMENTATION_MAP.md#-current-work) and [DOCUMENTATION_MAP.md#-recent-milestones-november-2025](DOCUMENTATION_MAP.md#-recent-milestones-november-2025)

---

## ⚠️ Note on "prod" Naming

Þetta verkefni notar framleiðslu-innviði (production-grade GCP infrastructure) með `prod` í nafni (verkefni: `ekklesia-prod-10-2025`) vegna þess að **Kenni.is auðkenning krefst slíks umhverfis** (þeir bjóða ekki upp á sandkassa).

Kerfið sjálft er hins vegar á **þróunarstigi**, með óskráða vefslóð og eingöngu prófunarkosningar.

**Full Explanation**: [docs/status/CURRENT_DEVELOPMENT_STATUS.md](docs/status/CURRENT_DEVELOPMENT_STATUS.md)

---

## 📞 Support

**Repository**: https://github.com/sosialistaflokkurinn/ekklesia
**Organization**: Sósíalistaflokkur Íslands
**Project**: ekklesia-prod-10-2025

**Production Consoles**:
- [Firebase Console](https://console.firebase.google.com/project/ekklesia-prod-10-2025)
- [GCP Console](https://console.cloud.google.com/run?project=ekklesia-prod-10-2025)
- [Cloud SQL](https://console.cloud.google.com/sql/instances?project=ekklesia-prod-10-2025)

---

**Last Updated**: November 4, 2025
**Status**: ✅ Phase 5 Complete - Full voting system operational
