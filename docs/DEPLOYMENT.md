# Deployment Guide

Deployment procedures for all Ekklesia services.

---

## Quick Reference

| Service | Command | Location |
|---------|---------|----------|
| **Frontend** | `firebase deploy --only hosting` | `services/svc-members/` |
| **Single Function** | `firebase deploy --only functions:NAME` | `services/svc-members/` |
| **All Functions** | `firebase deploy --only functions` | `services/svc-members/` |
| **Elections** | `./deploy.sh` | `services/svc-elections/` |
| **Events** | `./deploy.sh` | `services/svc-events/` |
| **Django** | See Django CLAUDE.md | `~/Development/projects/django/` |

---

## Frontend Deployment

The frontend is hosted on Firebase Hosting.

```bash
cd ~/Development/projects/ekklesia/services/svc-members
firebase deploy --only hosting
```

### Before Deploying

1. Run CSS bundle build if styles changed:
   ```bash
   ./scripts/build-css-bundle.sh
   ```

2. Check CSS versions:
   ```bash
   ./scripts/check-css-versions.sh
   ```

3. Update JS version parameters (`?v=YYYYMMDD`) if JS changed

### Verify

```bash
# Check deployed version
curl -s https://felagar.sosialistaflokkurinn.is/version.json
```

---

## Firebase Functions

Functions are Python-based and run on Firebase Functions (Gen 2).

### Deploy Single Function (Preferred)

```bash
cd ~/Development/projects/ekklesia/services/svc-members
firebase deploy --only functions:FUNCTION_NAME
```

Example:
```bash
firebase deploy --only functions:register_member
firebase deploy --only functions:search_addresses
```

### Deploy All Functions

> **Warning:** Large upload (~130MB). Only use when necessary.

```bash
firebase deploy --only functions
```

### Verify Function

```bash
gcloud functions describe FUNCTION_NAME --region=europe-west2
```

---

## Cloud Run Services

### Elections Service (svc-elections)

```bash
cd ~/Development/projects/ekklesia/services/svc-elections
./deploy.sh
```

### Events Service (svc-events)

```bash
cd ~/Development/projects/ekklesia/services/svc-events
./deploy.sh
```

### Verify Cloud Run

```bash
# Check status
gcloud run services describe SERVICE_NAME --region europe-west1

# Check secrets are mounted
gcloud run services describe SERVICE_NAME --region europe-west1 \
  --format='value(spec.template.spec.containers[0].env)'

# View logs
gcloud run services logs read SERVICE_NAME --region europe-west1 --limit 50
```

---

## Django Admin (Cloud Run)

Django is deployed separately. See `~/Development/projects/django/CLAUDE.md`.

```bash
cd ~/Development/projects/django
gcloud builds submit --config cloudbuild.yaml \
  --substitutions="_REGION=europe-west2,_SERVICE_NAME=django-socialism,..."
```

---

## Secrets Management

### View Secrets

```bash
gcloud secrets list --project=ekklesia-prod-10-2025
```

### Access Secret Value

```bash
gcloud secrets versions access latest --secret=SECRET_NAME
```

### Key Secrets

| Secret | Purpose |
|--------|---------|
| `django-api-token` | Django API authentication |
| `django-socialism-db-password` | Cloud SQL password |
| `kenni-client-secret` | Kenni.is OAuth |
| `GEMINI_API_KEY` | Gemini AI |
| `kimi-api-key` | Moonshot AI (Party Wiki) |
| `brave-search-api-key` | Web search fallback |
| `sendgrid-api-key` | Email sending |

### Rotate Secret

```bash
# Create new version
gcloud secrets versions add SECRET_NAME --data-file=./new-secret.txt

# Redeploy services that use it
./deploy.sh
```

---

## Database Access

### Start Cloud SQL Proxy

```bash
cloud-sql-proxy ekklesia-prod-10-2025:europe-west1:ekklesia-db-eu1 \
  --port 5433 --gcloud-auth
```

### Connect to PostgreSQL

```bash
PGPASSWORD='...' psql -h localhost -p 5433 -U socialism -d socialism
```

---

## Rollback

### Frontend

```bash
# List hosting versions
firebase hosting:sites:list

# Rollback to previous version
firebase hosting:rollback
```

### Cloud Run

```bash
# List revisions
gcloud run revisions list --service=SERVICE_NAME --region=europe-west1

# Traffic to specific revision
gcloud run services update-traffic SERVICE_NAME \
  --to-revisions=REVISION_NAME=100 \
  --region=europe-west1
```

### Firebase Functions

```bash
# View function versions
gcloud functions list --gen2

# Redeploy previous version from git
git checkout HEAD~1 -- services/svc-members/functions/fn_NAME.py
firebase deploy --only functions:NAME
```

---

## Monitoring

### Function Logs

```bash
gcloud functions logs read FUNCTION_NAME --region=europe-west2 --limit=50
```

### Cloud Run Logs

```bash
gcloud run services logs read SERVICE_NAME --region europe-west1 --limit 50
```

### Error Alerts

Cloud Logging alerts are configured for:
- Rate limiting triggers
- Full reset operations
- Authentication failures

See `docs/guides/ADMIN_ALERTS.md` for alert configuration.

---

## Pre-Deploy Checklist

- [ ] Code changes tested locally
- [ ] CSS bundle rebuilt (if styles changed)
- [ ] CSS versions checked
- [ ] JS version parameters updated (if JS changed)
- [ ] No secrets in code
- [ ] Tests pass (if applicable)
- [ ] Git committed and pushed

## Post-Deploy Checklist

- [ ] Service responds (health check)
- [ ] Key functionality works
- [ ] No errors in logs
- [ ] Secrets mounted correctly

---

## Troubleshooting

### "Permission denied" on deploy

```bash
gcloud auth application-default login
gcloud config set project ekklesia-prod-10-2025
```

### Function deploy fails

Check you're in the right directory:
```bash
cd ~/Development/projects/ekklesia/services/svc-members
```

### Cloud Run secrets missing

Verify secrets are bound:
```bash
gcloud run services describe SERVICE_NAME --region europe-west1 \
  --format='value(spec.template.spec.containers[0].env)'
```

### CSS not updating

1. Clear browser cache
2. Check `?v=` parameter in HTML
3. Rebuild CSS bundle
