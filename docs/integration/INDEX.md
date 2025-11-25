# Ekklesia Integration Documentation

**Date**: November 25, 2025
**Status**: Production - Active System

> ⚠️ **Architecture Update (2025-11-25)**: Sync is now real-time via webhooks, not scheduled.
> - Deleted: `bidirectional_sync`, `track_member_changes`, `sync_queue`
> - New: `sync_from_django` (instant Django → Firestore webhook)
> See [CLOUD_RUN_SERVICES.md](../infrastructure/CLOUD_RUN_SERVICES.md) for current architecture.

## 📋 Overview

This is the main documentation for the Ekklesia membership system, consisting of two main systems working together through bi-directional sync:

1. **Django Backend** - Legacy membership system (starf.sosialistaflokkurinn.is)
2. **Ekklesia** - Modern web portal with Firebase/GCP (ekklesia-prod-10-2025.web.app)

## 🏗️ System Architecture

```
┌─────────────────┐         Bi-Directional Sync (3:30 AM)        ┌──────────────────┐
│  Django Backend │ ◄──────────────────────────────────────────► │  Cloud Functions │
│   (Linode)      │         HTTP REST API + Firestore            │      (GCP)       │
│                 │                                               │                  │
│  • PostgreSQL   │                                               │  • Firestore DB  │
│  • REST API     │                                               │  • Pub/Sub       │
│  • Admin Panel  │                                               │  • Scheduler     │
└─────────────────┘                                               └──────────────────┘
                                                                           │
                                                                           ▼
                                                                  ┌──────────────────┐
                                                                  │  Ekklesia Portal │
                                                                  │ (Firebase Host)  │
                                                                  │                  │
                                                                  │  • Member Login  │
                                                                  │  • Profile Edit  │
                                                                  │  • Admin UI      │
                                                                  └──────────────────┘
```

## 📚 Documentation Structure

### Core Documentation

1. **[ARCHITECTURE.md](./ARCHITECTURE.md)**
   - Complete system overview
   - Components and interactions
   - Data flow
   - Infrastructure

2. **[BIDIRECTIONAL_SYNC.md](./BIDIRECTIONAL_SYNC.md)** ⚠️ *DEPRECATED*
   - ~~Sync queue mechanism~~ (replaced by real-time)
   - See CLOUD_RUN_SERVICES.md for current architecture

### Component Documentation

3. **[DJANGO_BACKEND.md](./DJANGO_BACKEND.md)**
   - Django models and database
   - REST API endpoints
   - Signal handlers
   - Admin interface

4. **[CLOUD_FUNCTIONS.md](./CLOUD_FUNCTIONS.md)**
   - All Cloud Functions
   - Triggers and events
   - Environment variables
   - Deployment

5. **[FIRESTORE_SCHEMA.md](./FIRESTORE_SCHEMA.md)**
   - Firestore collections
   - Document structure
   - Indexes
   - Security rules

### Technical References

6. **[API_REFERENCE.md](./API_REFERENCE.md)**
   - Django REST API endpoints
   - Request/response formats
   - Authentication
   - Error handling

7. **[DEPLOYMENT.md](./DEPLOYMENT.md)**
   - Deployment procedures
   - Environment configuration
   - Rollback strategies
   - Testing checklist

## 🚀 Quick Start

### For Developers

```bash
# Clone repository
git clone git@github.com:sosialistaflokkurinn/ekklesia.git
cd ekklesia

# Setup Django environment (requires SSH access)
./scripts/django-ssh.sh "cd /home/manager/socialism && source venv/bin/activate"

# Deploy Cloud Functions
cd services/members/functions
gcloud functions deploy bidirectional_sync --gen2 --runtime=python311 --region=europe-west2

# Deploy Frontend
cd ../../
firebase deploy --only hosting
```

### For Admins

- **Django Admin**: https://starf.sosialistaflokkurinn.is/felagar/admin/
- **Ekklesia Portal**: https://ekklesia-prod-10-2025.web.app
- **GCP Console**: https://console.cloud.google.com/functions?project=ekklesia-prod-10-2025

## 🔧 Current System Status (Nov 5, 2025)

### Production Services

| Component | Status | URL/Location |
|-----------|--------|--------------|
| Django Backend | ✅ Active | starf.sosialistaflokkurinn.is |
| PostgreSQL | ✅ Active | Linode 172.105.71.207 |
| Cloud Functions | ✅ Deployed | GCP europe-west2 |
| Firestore | ✅ Active | ekklesia-prod-10-2025 |
| Frontend | ✅ Deployed | ekklesia-prod-10-2025.web.app |
| Sync Scheduler | ✅ Running | Daily 3:30 AM Atlantic/Reykjavik |

### Recent Changes

- **2025-11-05**: Bi-directional sync implemented
  - Django signals auto-track changes
  - MemberSyncQueue table created
  - Cloud Functions deployed
  - Daily scheduler configured

## 🔐 Access & Credentials

### Django Server (Linode)
- **Host**: 172.105.71.207
- **User**: manager
- **SSH**: Use `~/django-ssh.sh` wrapper
- **Service**: gunicorn.service

### GCP Project
- **Project ID**: ekklesia-prod-10-2025
- **Region**: europe-west2
- **Service Account**: [GCP Default Compute Service Account]

### Django API Token
- Stored in GCP Secret Manager
- Secret name: `django-api-token`
- Used by Cloud Functions for authentication

## 📊 Data Flow

### Member Update Flow (Django → Ekklesia)

1. Admin updates member in Django admin
2. Django signal creates entry in `MemberSyncQueue`
3. Cloud Scheduler triggers sync (3:30 AM) or manual trigger
4. `bidirectional_sync` function fetches pending changes
5. Updates applied to Firestore `/members/` collection
6. Sync queue entry marked as `synced`

### Member Update Flow (Ekklesia → Django)

1. Member edits profile in Ekklesia portal
2. Frontend updates Firestore and creates `/sync_queue/` entry
3. `track_member_changes` trigger fires on Firestore write
4. Scheduled sync fetches pending Firestore changes
5. `bidirectional_sync` POSTs to Django `/api/sync/apply/`
6. Django updates PostgreSQL
7. Sync queue entry marked as `synced`

## 🛠️ Common Tasks

### Trigger Manual Sync

```bash
curl -X POST https://bidirectional-sync-ymzrguoifa-nw.a.run.app
```

### Check Sync Status

```bash
# Django sync queue
curl -H "Authorization: Token <token>" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/

# Response: {"pending": 4, "synced": 0, "failed": 0}
```

### View Django Logs

```bash
~/django-ssh.sh "tail -f /home/manager/log/gunicorn/error.log"
```

### View Cloud Function Logs

```bash
gcloud functions logs read bidirectional_sync --region=europe-west2 --limit=50
```

## 🐛 Troubleshooting

### Sync Not Working

1. **Check Django service**: `~/django-ssh.sh "systemctl status gunicorn"`
2. **Check sync queue**: See pending entries in Django admin
3. **Check Cloud Function logs**: Look for errors in GCP logs
4. **Verify API token**: Ensure Secret Manager has valid token

### Database Issues

1. **Django migrations**: `python manage.py showmigrations membership`
2. **Firestore indexes**: Check GCP Console for missing indexes
3. **Connection issues**: Verify ALLOWED_HOSTS includes correct domains

## 📞 Support

- **Technical Issues**: Check GitHub issues
- **Deployment Questions**: Review [DEPLOYMENT.md](./DEPLOYMENT.md)
- **API Questions**: Review [API_REFERENCE.md](./API_REFERENCE.md)

## 📈 Roadmap

### Completed (Nov 2025)
- ✅ Bi-directional sync infrastructure
- ✅ Django REST API endpoints
- ✅ Cloud Functions deployment
- ✅ Automatic change tracking

### In Progress
- 🔄 Field mapping completion (birthday, address, etc.)
- 🔄 Conflict resolution strategy
- 🔄 Comprehensive testing

### Planned
- 📋 Real-time sync (webhook-based)
- 📋 Sync monitoring dashboard
- 📋 Automated rollback on errors
- 📋 Performance optimization

---

**Last Updated**: 2025-11-05  
**Maintained by**: Ekklesia Development Team
