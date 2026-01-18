# Critical Rules

Single source of truth for all project rules. Referenced by CLAUDE.md and pre-commit hooks.

**Last Updated:** 2026-01-16

---

## Commands: Never Do These

| Command | Why It's Banned | Alternative |
|---------|-----------------|-------------|
| `firebase deploy --only functions` | Redeploys ALL functions (~130MB), wipes secrets from containers not in deploy | `firebase deploy --only functions:NAME` |
| `python3 -m http.server` | CORS blocks Firebase Auth | `firebase serve --only hosting` |
| `git push --no-verify` | Bypasses pre-commit hooks that catch secrets/PII | Let hooks run |
| `gcloud functions deploy` without `--gen2` | Deploys Gen1 functions incorrectly | Always use `--gen2` flag |

---

## Code: Never Do These

| Pattern | Why It's Banned | Alternative |
|---------|-----------------|-------------|
| Hardcode Icelandic text | Breaks i18n | Add strings to `i18n/values-is/*.xml` |
| Commit `.env` or credentials | Secrets exposed in git history | GCP Secret Manager |
| Commit PII (kennitala) | GDPR violation, legal risk | Mask: `kennitala[:6]****` |
| Create duplicate code | Maintenance nightmare | Check `js/components/`, `js/utils/` |
| Mix annotation/env secrets | Inconsistent secret access | Only `valueFrom.secretKeyRef` in YAML |
| `debug('msg')` | debug is object not function | `debug.log('module', 'msg')` |
| `date.toLocaleDateString('is-IS')` | Inconsistent browser support | `formatDateIcelandic(date)` |
| Direct Firebase CDN imports | Bypasses version management | `import from '/firebase/app.js'` |
| `localStorage` in admin areas | PII persists after close | `sessionStorage` |
| `innerHTML` with user data | XSS vulnerability | `escapeHTML()` or `textContent` |

---

## Code: Always Do These

| Action | Why | How |
|--------|-----|-----|
| Search existing code first | Reuse > recreate | Check `js/components/`, `js/utils/` |
| Follow naming conventions | Consistency | `[domain]-[name].js` pattern |
| Run CSS bundle build | Changes need rebuild | `./scripts/build-css-bundle.sh` |
| Check CSS versions | Prevent cache issues | `./scripts/check-css-versions.sh` |
| Verify secrets after deploy | Confirm mounting | `gcloud run services describe` |
| Use `--gcloud-auth` for proxy | Avoids ADC issues | `cloud-sql-proxy ... --gcloud-auth` |
| Add rate limiting | Prevent abuse | `check_uid_rate_limit()` |
| Add input validation | Prevent injection | Length, format, type checks |
| Add HTTP timeout | Prevent hangs | `timeout=30` on requests |
| Use `requireAuth()` | Proper redirect | Not custom auth rejection |

---

## Security Limits

| Type | Limit | Enforced By |
|------|-------|-------------|
| Name length | 100 chars | Input validation |
| Email length | 254 chars | Input validation |
| Address field | 200 chars | Input validation |
| `hard_delete` | 3/hour | Rate limiter |
| `send_email` | 10/min | Rate limiter |
| `send_campaign` | 1/10min | Rate limiter |
| HTTP timeout | Always set | Code review |
| Template size | 100KB | Input validation |
| Max recipients/batch | 1000 | Email handler |

---

## Protected Files (.gitignore)

```gitignore
# Credentials
.env, .env.*, *.key.json, *client_secret*, *serviceAccount*.json

# PII
*KENNITALA*.md, *.audit.json, scripts/logs/*.jsonl

# Working directories
tmp/, .claude/
```

---

## Pre-Commit Hook Checks

The pre-commit hook (`git-hooks/pre-commit`) enforces 16 checks:

1. Political identity presence
2. Secret patterns (passwords, API keys, tokens)
3. PII patterns (kennitala)
4. TODO management
5. i18n consistency (string loaders)
6. Hardcoded Icelandic text (warning)
7. Naming conventions (warning)
8. CSS bundle freshness
9. AI authorship markers
10. debug() misuse
11. Browser locale formatting
12. Direct Firebase imports
13. localStorage in admin areas (warning)
14. XSS vulnerabilities (warning)
15. Custom auth rejection patterns (warning)
16. Commit message content

**Blocked** = Commit rejected. **Warning** = Commit proceeds with notice.

---

## Incident Response

### Secret Exposed
1. Rotate immediately (change/revoke)
2. Remove from git history: `git filter-repo --path FILE --invert-paths`
3. Force push after cleaning

### PII Exposed
1. Document what was exposed
2. Notify affected individuals (GDPR requirement)
3. Clean from history
4. Strengthen validation

---

## Reporting Security Issues

**Email:** xj@xj.is
**Urgent:** Include "[SECURITY]" in subject
**Response:** 48 hours
