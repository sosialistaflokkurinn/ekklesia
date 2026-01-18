# Security Policy

## Reporting Vulnerabilities

**Email:** xj@xj.is
**Response:** 48 hours
**Urgent:** Include "[SECURITY]" in subject

---

## Quick Rules

| Never | Always |
|-------|--------|
| Commit `.env`, `*.key.json` | Use GCP Secret Manager |
| Commit PII (kennitala) | Mask in logs: `kennitala[:6]****` |
| `firebase deploy --only functions` | Specify: `--only functions:NAME` |
| Skip rate limiting | Add `check_uid_rate_limit()` |
| Accept unvalidated input | Check length, format, type |

---

## Protected Files

```gitignore
.env, .env.*, *.key.json, *client_secret*, *serviceAccount*.json
*KENNITALA*.md, *.audit.json, scripts/logs/*.jsonl
tmp/, .claude/
```

---

## Detailed Documentation

- **All rules consolidated:** [docs/CRITICAL-RULES.md](docs/CRITICAL-RULES.md)
- **Security patterns:** [docs/SECURITY.md](docs/SECURITY.md)
