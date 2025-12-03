# Ekklesia System Architecture

**Last Updated**: 2025-12-01
**Status**: Production
**Version**: 2.0 (Real-Time Sync Architecture)

---

## Executive Summary

Ekklesia is a member management and voting platform built on Google Cloud Platform. The system uses a **real-time bidirectional sync** architecture between Django (Linode) and Firebase/Firestore (GCP).

### Key Metrics

| Metric | Value |
|--------|-------|
| Active members | 2,113 |
| Cloud Run services | 22 |
| Monthly cost | ~$8-15 |
| Django tables | 14 (`membership_*`) |
| Firestore collections | 5 primary |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USERS                                          │
│                    (Members, Admins, Superusers)                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND (Firebase Hosting)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ Members      │  │ Admin        │  │ Superuser    │                   │
│  │ Portal       │  │ Console      │  │ Console      │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐
│   FIREBASE AUTH      │ │    FIRESTORE     │ │   CLOUD RUN (22 svcs)    │
│   (Kenni.is SSO)     │ │   /members/      │ │   - Member functions     │
│                      │ │   /users/        │ │   - Address validation   │
│                      │ │   /elections/    │ │   - Superuser functions  │
│                      │ │   /events/       │ │   - Elections service    │
│                      │ │   /_health/      │ │   - Events service       │
└──────────────────────┘ └──────────────────┘ └──────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
┌──────────────────────────────┐    ┌──────────────────────────────────┐
│   CLOUD SQL (PostgreSQL)     │    │   DJANGO (Linode)                │
│   ekklesia-db (db-f1-micro)  │    │   172.105.71.207                 │
│   - elections schema         │    │   - membership_* tables          │
│   - events schema (future)   │    │   - Source of truth for members  │
└──────────────────────────────┘    └──────────────────────────────────┘
```

---

## Data Flow: Real-Time Sync

### Django → Firestore (Member Changes)

```
Django post_save signal
        │
        ▼
HTTP POST to sync_from_django
        │
        ▼
Validate webhook token (Secret Manager)
        │
        ▼
Update Firestore /members/{kennitala}
        │
        ▼
Audit log to Cloud Logging
```

**Cloud Function**: `sync-from-django`
**URL**: `https://sync-from-django-521240388393.europe-west2.run.app`

### Firestore → Django (Profile Updates)

```
User updates profile in portal
        │
        ▼
updatememberprofile Cloud Function
        │
        ▼
Update Firestore /members/{kennitala}
        │
        ▼
POST /api/sync/address/ to Django
        │
        ▼
Django updates membership_simpleaddress
```

**Cloud Function**: `updatememberprofile`
**URL**: `https://updatememberprofile-521240388393.europe-west2.run.app`

---

## Infrastructure Components

### 1. Firebase Hosting (Frontend)

| Application | Path | Description |
|-------------|------|-------------|
| Members Portal | `/` | Member dashboard, profile, events |
| Admin Console | `/admin/` | Member management, elections |
| Superuser Console | `/superuser/` | System health, audit logs, roles |

### 2. Cloud Run Services (22 total)

#### Member Functions (6)
| Service | Purpose |
|---------|---------|
| `handlekenniauth` | Kenni.is authentication flow |
| `verifymembership` | Verify member exists in Firestore |
| `syncmembers` | Bulk sync from Django |
| `sync-from-django` | Real-time Django → Firestore webhook |
| `updatememberprofile` | Profile updates → Django |
| `auditmemberchanges` | Track member data changes |

#### Address Functions (3)
| Service | Purpose |
|---------|---------|
| `search-addresses` | Iceland address search (iceaddr) |
| `validate-address` | Validate street address |
| `validate-postal-code` | Validate postal code |

#### Superuser Functions (7)
| Service | Purpose |
|---------|---------|
| `checksystemhealth` | System health monitoring API |
| `setuserrole` | Set Firebase custom claims |
| `getuserrole` | Get Firebase custom claims |
| `getauditlogs` | Query Cloud Logging |
| `getloginaudit` | Login history from Firestore |
| `harddeletemember` | GDPR hard delete |
| `anonymizemember` | GDPR anonymization |

#### Core Services (4)
| Service | Purpose |
|---------|---------|
| `elections-service` | Election management (Cloud SQL) |
| `events-service` | Event management (Cloud SQL) |
| `healthz` | Global health check endpoint |
| `get-django-token` | Django API token retrieval |

#### Utility Functions (2)
| Service | Purpose |
|---------|---------|
| `cleanupauditlogs` | Scheduled audit log cleanup |
| `django-socialism-demo` | Demo Django on GCP (experimental) |

### 3. Databases

#### Firestore (NoSQL)

| Collection | Key | Description |
|------------|-----|-------------|
| `/members/{kennitala}` | SSN | Member profiles (synced from Django) |
| `/users/{firebaseUid}` | Firebase UID | Auth user data, login history |
| `/elections/{id}` | Auto ID | Election definitions |
| `/events/{id}` | Auto ID | Event definitions |
| `/_health/ping` | Static | Health check document |

#### Cloud SQL (PostgreSQL)

- **Instance**: `ekklesia-db`
- **Tier**: `db-f1-micro` (shared core, 25 max connections)
- **Schemas**: `elections`, `public`
- **Cost**: ~$7/month

#### Django PostgreSQL (Linode)

- **Database**: `socialism`
- **Tables**: 14 (`membership_*` prefix)
- **Key tables**:
  - `membership_comrade` - Member records (2,113)
  - `membership_contactinfo` - Phone, email
  - `membership_simpleaddress` - Addresses (829)
  - `membership_newlocaladdress` - Iceland registry addresses (1,935)

---

## Security Architecture

### Authentication Flow

```
User clicks "Innskráning"
        │
        ▼
Redirect to Kenni.is (Icelandic national SSO)
        │
        ▼
User authenticates with electronic ID
        │
        ▼
Callback to handlekenniauth
        │
        ▼
Verify kennitala in /members/{kennitala}
        │
        ▼
Create/update Firebase Auth user
        │
        ▼
Set custom claims (role, kennitala)
        │
        ▼
Return Firebase ID token
```

### Role-Based Access Control

| Role | Access |
|------|--------|
| `member` | Own profile, events, elections |
| `admin` | Member management, create elections |
| `superuser` | System health, audit logs, role management |

### Secret Management

All secrets stored in Google Secret Manager:
- `django-api-token` - Django REST API auth
- `kenni-client-secret` - Kenni.is OAuth
- `elections-s2s-api-key` - Service-to-service auth
- `django-root-password` - Django SSH access

---

## Cost Structure

### Current Monthly Costs (~$8-15)

| Service | Cost | Notes |
|---------|------|-------|
| Cloud SQL (db-f1-micro) | $7.00 | Fixed |
| Cloud Run | ~$1-3 | Pay per use |
| Cloud Logging | ~$0.10 | Audit logs |
| Firebase (free tier) | $0 | Auth, Firestore, Hosting |
| **Total** | **~$8-15** | |

### Scaling Recommendations (Future)

For meetings with >300 attendees:
- Upgrade Cloud SQL to `db-g1-small` temporarily (~$0.21/meeting)
- Pre-warm Cloud Run instances (10 min instances for 30 min)
- Total spike cost: ~$0.64 per large meeting

---

## Operational Procedures

### Health Monitoring

**System Health Dashboard**: `/superuser/system-health.html`
- All 22 Cloud Run services status
- Firestore connectivity
- Cloud SQL connectivity
- Django API status

### Deployment

```bash
# Frontend only (safe)
cd services/members
firebase deploy --only hosting

# Backend services (use scripts)
cd services/elections && ./deploy.sh
cd services/events && ./deploy.sh
```

**WARNING**: Never run `firebase deploy --only functions` directly - it resets Cloud Run secrets!

### Logging & Audit

- **Application logs**: Cloud Logging (structured JSON)
- **Audit logs**: Member changes, login events
- **Correlation IDs**: `X-Correlation-ID` header for request tracing

---

## Implementation Status

### Completed Features

- [x] Real-time Django ↔ Firestore sync
- [x] Kenni.is SSO authentication
- [x] Member portal with profile management
- [x] Admin console for member management
- [x] Superuser console (health, audit, roles)
- [x] Address validation (Iceland registry)
- [x] Elections service (Cloud SQL)
- [x] Events service (Cloud SQL)
- [x] Rate limiting on all endpoints
- [x] Structured logging with correlation IDs
- [x] GDPR compliance (delete, anonymize)

### Pending/Future

- [ ] Automated pre-meeting scale-up (Cloud Scheduler)
- [ ] Load testing scripts (k6)
- [ ] Circuit breaker pattern for S2S calls
- [ ] Idempotency keys for S2S endpoints
- [ ] OpenTelemetry tracing
- [ ] Multi-tenant support (org_id)

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [CLOUD_RUN_SERVICES.md](../infrastructure/CLOUD_RUN_SERVICES.md) | All 22 services with URLs |
| [DJANGO_DATABASE_SCHEMA.md](../integration/DJANGO_DATABASE_SCHEMA.md) | Django tables and sync |
| [FIRESTORE_SCHEMA.md](../integration/FIRESTORE_SCHEMA.md) | Firestore collections |
| [archive/ARCHITECTURE_RECOMMENDATIONS_2025-10-13.md](archive/ARCHITECTURE_RECOMMENDATIONS_2025-10-13.md) | Original recommendations |

---

## Changelog

| Date | Changes |
|------|---------|
| 2025-12-01 | Created new document reflecting real-time sync architecture |
| 2025-10-13 | Original recommendations document (now archived) |
