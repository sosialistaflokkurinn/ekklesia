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
| `firebase deploy --only functions` | Specify function: `--only functions:NAME` |
| Skip rate limiting | Add `check_uid_rate_limit()` |
| Accept unvalidated input | Check length, format, type |
| `git push --no-verify` | Let pre-commit hooks run |

---

## Protected Files (.gitignore)

```
.env, .env.*, *.key.json, *client_secret*, *serviceAccount*.json
*KENNITALA*.md, *.audit.json, scripts/logs/*.jsonl
tmp/, .claude/
```

---

## Critical Limits

| Type | Limit |
|------|-------|
| Name length | 100 chars |
| Email length | 254 chars |
| `hard_delete` | 3/hour |
| `send_email` | 10/min |
| HTTP timeout | Always set (30s default) |

---

## Detailed Documentation

See [docs/SECURITY.md](docs/SECURITY.md) for complete security patterns.
