# Security Policy

## Reporting Vulnerabilities

**Email:** xj@xj.is
**Response:** 48 hours
**Urgent:** Include "[SECURITY]" in subject

---

## Quick Rules

| Never | Always |
|-------|--------|
| Commit `.env` files | Use GCP Secret Manager |
| Commit credentials | Use environment variables |
| Commit PII | Mask sensitive data |
| Use `git push --no-verify` | Let hooks run |

---

## Detailed Security Documentation

See [docs/SECURITY.md](docs/SECURITY.md) for:
- Protected files list
- Secrets management
- Pre-commit hooks
- Incident response
