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
