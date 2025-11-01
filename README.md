# Ekklesia

Custom e-democracy voting platform for **Sósíalistaflokkur Íslands** (Socialist Party of Iceland).

Regnhlífarverkefni fyrir kosningakerfi Sósíalistaflokksins ásamt meðlima og atburðakerfi.

---

## Aðeins um "prod" nafngiftina (Note on "prod" Naming)

Þetta verkefni notar framleiðslu-innviði (production-grade GCP infrastructure) með `prod` í nafni (verkefni: `ekklesia-prod-10-2025`) vegna þess að **Kenni.is auðkenning krefst slíks umhverfis** (þeir bjóða ekki upp á sandkassa).

Kerfið sjálft er hins vegar á **þróunarstigi**, með óskráða vefslóð og eingöngu prófunarkosningar.

Nánari upplýsingar má finna í [docs/ENVIRONMENT_CLARIFICATION.md](docs/ENVIRONMENT_CLARIFICATION.md).

---

## 🚀 Production Services

**Status**: ✅ All services operational (October 2025)
**Project**: ekklesia-prod-10-2025
**Region**: europe-west2 (London)

| Service | Technology | Status | URL |
|---------|-----------|--------|-----|
| **Members** (Meðlimir) | Firebase + Python Functions | ✅ Production | https://ekklesia-prod-10-2025.web.app |
| **Events** (Atburðir) | Node.js + Cloud Run | ✅ Production | https://events-service-ymzrguoifa-nw.a.run.app |
| **Elections** (Kosningar) | Node.js + Cloud Run | ✅ Production | https://elections-service-ymzrguoifa-nw.a.run.app |

### Architecture

- **Members Service**: Firebase Hosting + Cloud Functions - National eID (Kenni.is) authentication and membership verification
- **Events Service**: Node.js + Express on Cloud Run - Election administration and voting token issuance
- **Elections Service**: Node.js + Express on Cloud Run - Anonymous ballot recording (no PII)
- **Database**: Cloud SQL PostgreSQL 15 (2 schemas: public, elections)
- **Authentication**: Firebase Auth + Kenni.is OAuth PKCE

---

## 📚 Documentation

**Master Index**: [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md) - Complete documentation map

**Quick Links**:
- [Documentation Hub](docs/README.md) - All documentation
- [Repository Structure](DOCUMENTATION_MAP.md#-repository-structure) - Complete repository guide (in Documentation Map)
- [System Architecture](docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md) - Overall system design
- [Current Status](docs/features/election-voting/production-status.md) - Production infrastructure
- [Services](services/) - Member, Events, and Elections services

---

## 🏗️ Key Features

- **Secure Authentication**: National eID integration via Kenni.is
- **Member Verification**: 2,273 active members (January 2025 roster)
- **Anonymous Voting**: Zero-knowledge ballot recording (no PII in Elections service)
- **Token-Based Security**: One-time SHA-256 hashed tokens
- **Full Audit Trail**: Complete vote tracking in Events service (with member identity)
- **S2S Integration**: Secure server-to-server communication between services
- **Icelandic Language**: Full UI in Icelandic (Íslenska)

---

## 💰 Cost

**Monthly**: ~$7-13/month
- Members Service: $0 (Firebase free tier)
- Events Service: $0-3 (Cloud Run free tier)
- Elections Service: $0-3 (Cloud Run free tier)
- Cloud SQL: ~$7 (db-f1-micro)

---

## 🔒 Security

- **National eID**: Government-issued Kenni.is authentication
- **OAuth 2.0 PKCE**: RFC 7636 public client flow
- **CSRF Protection**: State parameter validation (Issue #33 ✅)
- **Firestore Security Rules**: Role-based access control (Issue #30 ✅)
- **Rate Limiting**: Cloudflare protection - 100 req/10sec per IP (Issue #31 ✅)
- **Origin Protection**: CF-Ray header + IP validation on all services
- **Idempotency**: Race condition protection for user creation (Issue #32 ✅)
- **Anonymity**: Elections service has zero member identity knowledge
- **Audit Logging**: Complete trail in Events service (with PII), system-only logs in Elections (no PII)
- **One-Vote-Per-Token**: Database constraints enforce single vote
- **SHA-256 Hashing**: All tokens cryptographically hashed
- **SSL/TLS**: Full (strict) encryption via Cloudflare

---

## 🧑‍💻 Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- Firebase CLI
- gcloud CLI
- PostgreSQL client (psql)

### Repository Structure

```
ekklesia/
├── services/           # Backend services (Members, Events, Elections)
├── docs/               # Complete documentation (start: docs/README.md)
├── testing/            # Test infrastructure and reports
├── scripts/            # Deployment and utility scripts
├── infrastructure/     # Infrastructure-as-Code configs
└── [config files]
```

### Quick Start

```bash
# Clone repository
git clone https://github.com/sosialistaflokkurinn/ekklesia.git
cd ekklesia

# For new developers: Read docs/README.md for learning paths
# For service-specific setup: See services/{members|events|elections}/README.md
```

---

## 📊 Project Timeline

- **Oct 1, 2025**: Project created, GCP setup
- **Oct 6-7, 2025**: Firebase migration (replaced ZITADEL)
- **Oct 8, 2025**: Members service operational
- **Oct 9, 2025**: Events + Elections services deployed
- **Oct 10, 2025**: Full S2S integration complete
- **Oct 12, 2025**: Security hardening complete (Phase 1-3: Firestore rules, CSRF, rate limiting, Cloudflare automation)

---

## 📞 Support

**Project**: ekklesia-prod-10-2025
**Repository**: https://github.com/sosialistaflokkurinn/ekklesia
**Organization**: Sósíalistaflokkur Íslands
**Account**: gudrodur@sosialistaflokkurinn.is

**Production Consoles**:
- [Firebase Console](https://console.firebase.google.com/project/ekklesia-prod-10-2025)
- [GCP Console](https://console.cloud.google.com/run?project=ekklesia-prod-10-2025)
- [Cloud SQL](https://console.cloud.google.com/sql/instances?project=ekklesia-prod-10-2025)

---

**Last Updated**: October 21, 2025 (Restructured for Phase 5+ growth)
**Repository Status**: ✅ Restructured for scalability - Ready for Phase 5 development
