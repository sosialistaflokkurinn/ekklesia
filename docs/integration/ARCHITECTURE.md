# System Architecture

**Status**: Production  
**Last Updated**: 2025-11-05

## 🎯 Overview

The Ekklesia system consists of two separate systems working together:

1. **Django Backend** - Legacy membership system with PostgreSQL
2. **Ekklesia Portal** - Modern Firebase/GCP application

The systems are integrated via **bi-directional sync** that keeps data synchronized between them.

## 🏛️ System Components

### 1. Django Backend (Linode Server)

**Location**: 172.105.71.207  
**Domain**: starf.sosialistaflokkurinn.is

```
┌─────────────────────────────────────────┐
│         Django Application              │
│  (Python 3.6, Django 2.2.3)            │
├─────────────────────────────────────────┤
│  • Membership Models (Comrade)          │
│  • MemberSyncQueue (new)                │
│  • REST API Endpoints                   │
│  • Signal Handlers                      │
│  • Admin Interface                      │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│        PostgreSQL Database              │
│  • membership_comrade                   │
│  • membership_membersyncqueue (new)     │
│  • communication_email                  │
│  • auth_user                            │
└─────────────────────────────────────────┘
```

**Key Features:**
- Legacy membership management
- Email communication system
- Admin panel for staff
- REST API for external access

**Technology Stack:**
- Python 3.6
- Django 2.2.3
- PostgreSQL 10
- Gunicorn (WSGI server)
- Nginx (reverse proxy)

### 2. GCP Cloud Platform

**Project**: ekklesia-prod-10-2025  
**Region**: europe-west2

```
┌─────────────────────────────────────────┐
│       Cloud Functions (Gen 2)           │
├─────────────────────────────────────────┤
│  • bidirectional_sync (HTTP)            │
│  • track_member_changes (Firestore)     │
│  • syncmembers                          │
│  • updatememberprofile                  │
│  • handleKenniAuth                      │
│  • verifyMembership                     │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│         Firestore Database              │
├─────────────────────────────────────────┤
│  Collections:                           │
│  • /members/{kennitala}                 │
│  • /sync_queue/{id}                     │
│  • /sync_logs/{id}                      │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│        Cloud Scheduler                  │
│  Job: bidirectional-member-sync         │
│  Schedule: 30 3 * * * (3:30 AM)         │
│  Timezone: Atlantic/Reykjavik           │
└─────────────────────────────────────────┘
```

**Key Features:**
- Serverless functions
- NoSQL document database
- Automatic scaling
- Built-in authentication

**Technology Stack:**
- Python 3.11
- Firebase Admin SDK
- Google Cloud Functions Gen2
- Firestore Native Mode

### 3. Frontend Application

**Hosting**: Firebase Hosting  
**URL**: https://ekklesia-prod-10-2025.web.app

```
┌─────────────────────────────────────────┐
│      Firebase Hosting (CDN)             │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│      Single Page Application            │
├─────────────────────────────────────────┤
│  • Member Portal (login with Kenni.is)  │
│  • Profile Editing                      │
│  • Admin Interface                      │
│  • Membership Verification              │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│      Firebase SDK (Client)              │
│  • Authentication                       │
│  • Firestore access                     │
│  • Cloud Functions calls                │
└─────────────────────────────────────────┘
```

**Key Features:**
- OAuth2 authentication via Kenni.is
- Real-time profile updates
- Admin member management
- Responsive design

**Technology Stack:**
- Vanilla JavaScript (ES6+)
- Firebase SDK v10
- HTML5/CSS3
- No framework (intentional choice)

## 🔄 Data Synchronization

### Bi-Directional Sync Architecture

```
┌──────────────┐                          ┌──────────────┐
│   Django     │   1. Change detected     │  Firestore   │
│              │   2. Add to sync_queue   │              │
│  Comrade     ├─────────────────────────►│  sync_queue  │
│  (update)    │                          │              │
└──────────────┘                          └──────────────┘
                                                 │
                                                 │ 3. Scheduled trigger
                                                 ▼
                                          ┌──────────────┐
                                          │ Cloud        │
                                          │ Scheduler    │
                                          │ (3:30 AM)    │
                                          └──────────────┘
                                                 │
                                                 │ 4. HTTP POST
                                                 ▼
┌──────────────┐                          ┌──────────────┐
│   Django     │   6. Apply changes       │ bidirectional│
│              │◄─────────────────────────┤ _sync()      │
│  REST API    │   POST /api/sync/apply/  │              │
│              │                          │              │
└──────────────┘                          └──────────────┘
       │                                         │
       │ 7. Mark synced                          │ 5. Fetch changes
       ▼                                         ▼
┌──────────────┐                          ┌──────────────┐
│ MemberSync   │                          │  Firestore   │
│ Queue        │                          │  /members/   │
│ (synced)     │                          │  (updated)   │
└──────────────┘                          └──────────────┘
```

### Sync Flow Details

**Django → Firestore:**
1. Django admin updates member
2. `post_save` signal creates `MemberSyncQueue` entry
3. Cloud Scheduler triggers `bidirectional_sync` function
4. Function calls `GET /api/sync/changes/` to fetch pending
5. Updates applied to Firestore `/members/` collection
6. Function calls `POST /api/sync/mark-synced/` to confirm

**Firestore → Django:**
1. Member updates profile in Ekklesia portal
2. Frontend updates Firestore document
3. Frontend creates `/sync_queue/` entry with `target: 'django'`
4. `track_member_changes` trigger fires (optional)
5. Scheduled sync fetches pending Firestore changes
6. Function calls `POST /api/sync/apply/` with changes
7. Django updates PostgreSQL database

## 🔐 Security Architecture

### Authentication Flow

```
User (Browser)
     │
     │ 1. Login with Kenni.is
     ▼
┌──────────────┐
│   Kenni.is   │
│   OAuth2     │
└──────────────┘
     │
     │ 2. ID Token (JWT)
     ▼
┌──────────────┐
│  Frontend    │
│  JavaScript  │
└──────────────┘
     │
     │ 3. Verify token
     ▼
┌──────────────┐
│  Cloud       │
│  Function    │
│  (verify)    │
└──────────────┘
     │
     │ 4. Custom token
     ▼
┌──────────────┐
│  Firebase    │
│  Auth        │
└──────────────┘
     │
     │ 5. Access token
     ▼
┌──────────────┐
│  Firestore   │
│  (secure)    │
└──────────────┘
```

### API Security

**Django REST API:**
- Token authentication (DRF TokenAuthentication)
- Admin-only endpoints (IsAdminUser permission)
- ALLOWED_HOSTS validation
- CSRF protection

**Cloud Functions:**
- Service account authentication
- Secret Manager for sensitive data
- CORS configuration
- Environment-based configuration

**Firestore:**
- Security rules based on authentication
- Field-level access control
- Kennitala-based document access

## 🌐 Network Architecture

```
Internet
   │
   ├─────────────────────┐
   │                     │
   ▼                     ▼
┌────────────────┐  ┌────────────────┐
│  Squarespace   │  │  Firebase      │
│  (proxy to     │  │  Hosting       │
│   Linode)      │  │  (web app DNS) │
└────────────────┘  └────────────────┘
   │                     │
   ▼                     ▼
┌────────────────┐  ┌────────────────┐
│  Nginx         │  │  Static Files  │
│  (Linode)      │  │  (index.html)  │
└────────────────┘  └────────────────┘
   │
   ▼
┌────────────────┐
│  Gunicorn      │
│  (Django)      │
└────────────────┘
```

**Domain Routing:**
- `starf.sosialistaflokkurinn.is` → Linode (Django)
- `felagakerfi.piratar.is` → Linode (Django) via Squarespace proxy
- `ekklesia-prod-10-2025.web.app` → Firebase Hosting

## 📊 Data Models

### Django (PostgreSQL)

**Comrade** (Main member model)
```python
{
    "id": 12345,
    "ssn": "0101701234",
    "name": "Jón Jónsson",
    "birthday": "1970-01-01",
    "date_joined": "2019-01-06T16:43:47Z",
    "reachable": true,
    "groupable": true,
    "gender": 0,
    "housing_situation": 6
}
```

**MemberSyncQueue** (Sync tracking)
```python
{
    "id": 1,
    "member_id": 12345,
    "ssn": "0101701234",
    "action": "update",
    "fields_changed": {"name": "New Name"},
    "sync_status": "pending",
    "created_at": "2025-11-05T16:18:46Z",
    "synced_at": null,
    "retry_count": 0,
    "error_message": null
}
```

### Firestore (NoSQL)

**Member Document** (`/members/{kennitala}`)
```javascript
{
  "kennitala": "0101701234",
  "name": "Jón Jónsson",
  "verified": true,
  "profile": {
    "email": "jon@example.is",
    "phone": "5551234",
    "address": {
      "street": "Dæmigata 1",
      "postalcode": "101",
      "city": "Reykjavík"
    }
  },
  "membership": {
    "status": "active",
    "joined": "2019-01-06T16:43:47Z"
  },
  "updatedAt": "2025-11-05T16:30:28Z"
}
```

**Sync Queue** (`/sync_queue/{id}`)
```javascript
{
  "kennitala": "0101701234",
  "target": "django",
  "action": "update",
  "changes": {
    "profile.email": "newemail@example.is"
  },
  "status": "pending",
  "createdAt": "2025-11-05T16:30:00Z",
  "syncedAt": null
}
```

## 🚀 Deployment Architecture

### Django Deployment

```
Developer Machine
     │
     │ 1. SSH deploy
     ▼
┌────────────────┐
│  Linode Server │
│  172.105.71.207│
├────────────────┤
│  1. Backup     │
│  2. Upload     │
│  3. Migrate    │
│  4. Restart    │
└────────────────┘
```

**Deployment Steps:**
1. Backup current state
2. Upload new code via SSH/SCP
3. Run Django migrations
4. Clear Python bytecode cache
5. Restart gunicorn service
6. Verify service status

### Cloud Functions Deployment

```
Developer Machine
     │
     │ gcloud deploy
     ▼
┌────────────────┐
│  GCP Build     │
│  Service       │
├────────────────┤
│  1. Build      │
│  2. Container  │
│  3. Deploy     │
└────────────────┘
     │
     ▼
┌────────────────┐
│  Cloud Run     │
│  (Functions)   │
└────────────────┘
```

**Deployment Steps:**
1. Source code uploaded to Cloud Storage
2. Container built with Python 3.11
3. New revision deployed to Cloud Run
4. Traffic shifted to new revision
5. Old revision kept for rollback

### Frontend Deployment

```
Developer Machine
     │
     │ firebase deploy
     ▼
┌────────────────┐
│  Firebase CLI  │
├────────────────┤
│  1. Build      │
│  2. Upload     │
│  3. Release    │
└────────────────┘
     │
     ▼
┌────────────────┐
│  Firebase      │
│  Hosting CDN   │
└────────────────┘
```

## 📈 Scalability

### Current Limits

| Component | Current | Max Tested | Notes |
|-----------|---------|------------|-------|
| Django Workers | 3 | 10 | Gunicorn workers |
| Cloud Function Instances | 1-5 | 100 | Auto-scaling |
| Firestore Reads | ~1000/day | 50K/day | Well within quota |
| Firestore Writes | ~500/day | 20K/day | Well within quota |

### Bottlenecks

1. **Django**: Single Linode server, no load balancing
2. **PostgreSQL**: Single database, no replication
3. **Sync**: Sequential processing, not parallel

### Future Improvements

- Load balancer for Django
- PostgreSQL read replicas
- Parallel sync processing
- Redis caching layer

---

**Næsta skjal**: [BIDIRECTIONAL_SYNC.md](./BIDIRECTIONAL_SYNC.md)  
**Til baka**: [INDEX.md](./INDEX.md)
