# Ekklesia

Custom e-democracy voting platform for **Sósíalistaflokkur Íslands** (Socialist Party of Iceland).

[![Test Cloud Functions](https://github.com/sosialistaflokkurinn/ekklesia/actions/workflows/test-functions.yml/badge.svg)](https://github.com/sosialistaflokkurinn/ekklesia/actions/workflows/test-functions.yml)
[![Security Hygiene](https://github.com/sosialistaflokkurinn/ekklesia/actions/workflows/security-hygiene.yml/badge.svg)](https://github.com/sosialistaflokkurinn/ekklesia/actions/workflows/security-hygiene.yml)

Regnhlífarverkefni fyrir kosningakerfi Sósíalistaflokksins ásamt meðlima og atburðakerfi.

---

## 📚 Documentation

**Start Here**: [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md) - Complete system overview and documentation index

**Quick Links**:
- [Getting Started Guide](docs/README.md) - Learning paths and documentation hub
- [Architecture](docs/architecture/) - System design and technical details
- [Scripts](scripts/README.md) - Deployment and maintenance tools
- [Current Status](DOCUMENTATION_MAP.md#current-status) - Production services and current work

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/sosialistaflokkurinn/ekklesia.git
cd ekklesia

# Read documentation
cat DOCUMENTATION_MAP.md  # System overview
cat docs/README.md        # Documentation hub

# See service-specific setup
cat services/members/README.md
cat services/events/README.md
cat services/elections/README.md
```

---

## 🔒 Security

**Report vulnerabilities**: xj@xj.is

See [SECURITY.md](SECURITY.md) for:
- Coordinated disclosure policy
- Security features and enforcement
- Pre-commit hooks and scanning
- Secrets management practices

---

## 📊 Status

**Production**: ✅ All services operational (November 2025)

- 3 services deployed (Members, Events, Elections)
- Cloud SQL PostgreSQL 15 database
- Firebase Auth + Kenni.is integration
- ~$7-13/month optimized costs

**Details**: See [DOCUMENTATION_MAP.md](DOCUMENTATION_MAP.md) for complete status, architecture, and current work.

---

## 🧑‍💻 Development

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Python 3.11+](https://www.python.org/)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- [gcloud CLI](https://cloud.google.com/sdk/gcloud)
- [PostgreSQL client](https://www.postgresql.org/download/) (psql)

### Security Setup

Install pre-commit hooks for automatic security checks:

```bash
cp scripts/git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Checks**: Secrets scanning, PII detection, political identity, .gitignore validation

### Repository Structure

```
ekklesia/
├── apps/               # Frontend applications (members-portal)
├── services/           # Backend services (members, events, elections)
├── docs/               # Complete documentation (start: docs/README.md)
├── scripts/            # Deployment and maintenance scripts
├── testing/            # E2E tests and test utilities
└── .github/            # GitHub workflows and templates
```

**Complete structure**: [DOCUMENTATION_MAP.md#repository-structure](DOCUMENTATION_MAP.md#-repository-structure)

### Development Guidelines

**Documentation**: All project documentation must be in **English** per [DOCUMENTATION_GUIDE.md](docs/standards/DOCUMENTATION_GUIDE.md).

**Exception**: User-facing UI strings in `values-is/strings.xml` are in Icelandic.

---

## 📞 Support

**Repository**: https://github.com/sosialistaflokkurinn/ekklesia
**Organization**: Sósíalistaflokkur Íslands
**Project**: ekklesia-prod-10-2025
**Security**: xj@xj.is

**Production Consoles**:
- [Firebase Console](https://console.firebase.google.com/project/ekklesia-prod-10-2025)
- [GCP Console](https://console.cloud.google.com/run?project=ekklesia-prod-10-2025)
- [Cloud SQL](https://console.cloud.google.com/sql/instances?project=ekklesia-prod-10-2025)

---

**Last Updated**: November 14, 2025
**Status**: ✅ Phase 5 Complete - Full voting system operational
