# Security Rules

## Quick Rules

| Never | Always |
|-------|--------|
| Commit `.env` files | Store secrets in GCP Secret Manager |
| Commit `*.key.json` | Use environment variables |
| Commit PII (kennitala) | Mask sensitive data in logs |
| Use `git push --no-verify` | Let pre-commit hooks run |
| Log actual passwords | Use `***` for passwords in output |
| `firebase deploy --only functions` | `firebase deploy --only hosting` |
| Skip rate limiting on handlers | Add rate limiting to write operations |
| Accept unvalidated input | Validate length, format, and type |
| Use sentinel values for bans | Use random fake IDs (prevents enumeration) |

---

## Protected Files

### .gitignore Blocks

```gitignore
# Credentials
.env, .env.*, *.key.json, *client_secret*, *serviceAccount*.json

# PII
*KENNITALA*.md, *.audit.json, scripts/logs/*.jsonl

# Working directories
tmp/, .claude/
```

### Verify Before Commit
```bash
# Check if file is ignored
git check-ignore -v FILENAME

# Should show nothing sensitive
git status
```

---

## Rate Limiting

### Implementation Patterns

```python
# UID-based (authenticated endpoints)
from shared.rate_limit import check_uid_rate_limit

if not check_uid_rate_limit(req.auth.uid, "action_name", max_attempts=10, window_minutes=10):
    raise https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.RESOURCE_EXHAUSTED,
        message="Rate limit exceeded"
    )

# IP-based (public endpoints)
from shared.rate_limit import check_rate_limit

if not check_rate_limit(client_ip, max_attempts=5, window_minutes=10):
    return {"error": "Rate limit exceeded"}
```

### Current Limits (Dec 2025)

| Handler | Limit | Window |
|---------|-------|--------|
| `hard_delete` | 3 | 60 min |
| `anonymize` | 5 | 60 min |
| `purge_deleted` | 1 | 60 min |
| `set_role` | 10 | 10 min |
| `send_email` | 10 | 1 min |
| `send_campaign` | 1 | 10 min |
| `profile_update` | 5 | 10 min |
| `member_sync` | 1 | 5 min |
| `register_member` (IP) | 5 | 10 min |

---

## Input Validation

### Required Checks

```python
# Length validation
MAX_NAME_LENGTH = 100
MAX_EMAIL_LENGTH = 254
MAX_ADDRESS_FIELD_LENGTH = 200

# Format validation
email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

# List limits
MAX_ADDRESSES = 5
MAX_RECIPIENTS_PER_BATCH = 1000
MAX_TEMPLATE_SIZE = 100000  # 100KB
```

### Template Security (SSTI Prevention)

```python
# Whitelist allowed template variables
ALLOWED_VARS = {'member', 'cell', 'organization', 'date', 'unsubscribe_url', 'subject'}

# Only allow alphanumeric variable names
if parts[0] not in ALLOWED_VARS:
    return ''  # Reject unknown variables
```

---

## HTTP Request Security

### Timeout Requirements

All external HTTP calls MUST have explicit timeouts:

```python
# GOOD
response = requests.post(url, timeout=30)

# BAD - will hang indefinitely
response = requests.post(url)
```

### Header Sanitization

Prevent CRLF injection in correlation IDs:

```javascript
const correlationId = rawId
    ? rawId.replace(/[\r\n\t]/g, '').substring(0, 64)
    : crypto.randomUUID();
```

---

## Secrets Management

### GCP Secret Manager

All production secrets stored here:
- Database credentials
- API keys
- OAuth secrets

**Access in code:**
```python
# Python
token = os.environ.get('DJANGO_API_TOKEN')
```

```javascript
// JavaScript
const token = process.env.DJANGO_API_TOKEN;
```

**Access via CLI:**
```bash
gcloud secrets versions access latest --secret="secret-name"
```

### Cloud Run Secrets

**Attach:**
```bash
gcloud run services update SERVICE \
  --region=europe-west2 \
  --set-secrets="DJANGO_API_TOKEN=django-api-token:latest"
```

**Verify:**
```bash
gcloud run services describe SERVICE \
  --region=europe-west2 \
  --format="json" | jq '.spec.template.spec.containers[0].env'
```

---

## Pre-commit Hooks

### Location
```
git-hooks/pre-commit
```

### Install
```bash
cp git-hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Checks
- Secrets scanning
- PII detection (kennitala patterns)
- .gitignore validation

---

## Password Handling

```bash
# GOOD
log "Password retrieved (***********)"
echo "$PASSWORD" | sudo -S command 2>/dev/null
unset PASSWORD

# BAD
echo "Password: $PASSWORD"     # Exposes password
set -x                         # Debug shows all values
```

---

## Incident Response

### Secret Exposed

1. **Rotate immediately** - Change/revoke the secret
2. **Remove from history** - Use `git filter-repo`
3. **Force push** - After cleaning

```bash
git filter-repo --path SECRET_FILE --invert-paths
git push --force
```

### PII Exposed

1. Document what was exposed
2. Notify affected individuals (GDPR)
3. Clean from history
4. Strengthen pre-commit hooks

---

## Reporting

**Email:** xj@xj.is
**Urgent:** Include "[SECURITY]" in subject
**Response:** 48 hours
