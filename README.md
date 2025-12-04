# Ekklesia

E-democracy voting platform for **Sósíalistaflokkur Íslands** (Socialist Party of Iceland).

---

## Quick Start

```bash
git clone https://github.com/sosialistaflokkurinn/ekklesia.git
cd ekklesia
```

**Documentation:** [docs/README.md](docs/README.md)

---

## Structure

```
ekklesia/
├── apps/members-portal/     # Frontend (Firebase Hosting)
├── services/svc-*/          # Backend (Cloud Run)
├── scripts/                 # Automation
└── docs/                    # Documentation
```

---

## Deploy

```bash
# Frontend
cd services/svc-members && firebase deploy --only hosting

# Backend
cd services/svc-elections && ./deploy.sh
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/README.md](docs/README.md) | Overview |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [docs/PATTERNS.md](docs/PATTERNS.md) | Code patterns |
| [docs/SECURITY.md](docs/SECURITY.md) | Security rules |
| [CLAUDE.md](CLAUDE.md) | AI assistant guide |

---

## Security

**Report vulnerabilities:** xj@xj.is

See [SECURITY.md](SECURITY.md) for details.

---

## Links

- **Repository:** https://github.com/sosialistaflokkurinn/ekklesia
- **Firebase:** [Console](https://console.firebase.google.com/project/ekklesia-prod-10-2025)
- **GCP:** [Console](https://console.cloud.google.com/run?project=ekklesia-prod-10-2025)
