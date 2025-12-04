# Ekklesia Project - AI Assistant Guidelines

## Project Overview

Ekklesia is a membership management system with:
- **Frontend:** Firebase Hosting (members-portal)
- **Backend Services:** Cloud Run (elections, events, members)
- **Database:** Cloud SQL PostgreSQL
- **Django Backend:** Linode server (legacy sync API)

## Key Documentation

Start every session by reading:
1. `docs/SESSION_START_REMINDER.md` - Security rules, deployment warnings
2. `docs/CURRENT_DEVELOPMENT_STATUS.md` - System state overview
3. `docs/operations/CLOUD_RUN_SERVICES.md` - Backend services reference

## Django Backend (Linode)

The Django backend runs on a separate Linode server and handles:
- Member registration API
- Sync API for Firestore ” Django synchronization

### Local Mirror Location
```
/home/gudro/Development/projects/django/
```

### Deployment Workflow

**ALWAYS follow this workflow when deploying to Linode:**

1. **Test locally first:**
   ```bash
   python3 -m py_compile membership/FILE.py && echo "Syntax OK"
   ```

2. **Show scope of changes:**
   ```bash
   git diff --stat HEAD~1
   ```

3. **Connection details:**
   - Script: `~/django-ssh.sh` (uses sshpass + GCP secret)
   - Host: `172.105.71.207`
   - Path: `/home/manager/socialism/membership/`

4. **Sync and restart:**
   ```bash
   # See full instructions in /home/gudro/Development/projects/django/CLAUDE.md
   ~/django-ssh.sh "systemctl restart gunicorn"
   ```

### Important Notes
- Do NOT sync entire git repo to Linode
- Do NOT upgrade Django/packages on Linode (runs Django 2.2/Python 3.6)
- Do NOT overwrite Linode settings.py

## Git Strategy

This project uses "Track All, Push Selectively":
- All files tracked locally (AI can see them)
- Pre-push hook blocks sensitive files (see `.git-local-only`)
- NEVER use `--no-verify` to bypass hooks

## Common Tasks

### Frontend Deployment
```bash
cd services/svc-members
firebase deploy --only hosting
```

### Backend Deployment
```bash
cd services/svc-elections && ./deploy.sh
cd services/svc-events && ./deploy.sh
```

### Database Access
```bash
# Cloud SQL Proxy
cloud-sql-proxy ekklesia-prod-10-2025:europe-west2:ekklesia-db --port 5433 --gcloud-auth
```
