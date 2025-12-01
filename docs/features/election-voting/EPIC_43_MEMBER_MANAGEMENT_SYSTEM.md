# Epic #43: Member Management System með Django Sync

**Epic ID**: #43
**Status**: 🔨 In Development
**Target Release**: Phase 5 (Q4 2025 - Q1 2026)
**Priority**: HIGH (Foundation for replacing Django)
**Type**: New System (not just sync)

---

## Executive Summary

Epic #43 búr til **nýtt member management kerfi** sem synkar full member data úr Django legacy kerfinu og keyrir samhliða þar til nýja kerfið er þroskað. Þetta er EKKI bara kennitölu sync fyrir voting - þetta er fyrsta skrefið í að taka við af Django með tímanum.

### Lykilmunur frá upprunalegu plani

| Upprunalegt Plan | Nýtt Plan (núverandi) |
|------------------|----------------------|
| Kennitölu sync bara | Full member profiles |
| Auto weekly sync (Cloud Scheduler) | Manual sync (button click) |
| Firebase Storage (kennitalur.txt) | Firestore (structured NoSQL) |
| Engin admin UI | Full admin web interface |
| Voting eligibility only | Complete member management |

---

## Problem Statement

**Núverandi ástand**:
- Django legacy system (Linode) er source of truth fyrir 2,216+ meðlimi
- Engin auðveld leið til að sjá eða breyta member data nema Django admin
- Django kerfið er gamalt og erfitt að viðhalda
- Ekklesia er aðeins með kennitalur fyrir voting eligibility

**Markmið**:
- Búa til nýtt member management system í GCP
- Keyra samhliða Django þangað til nýja kerfið er þroskað
- Manual sync til að halda kerfunum í sync
- Admin UI til að sjá og breyta member data
- Með tímanum taka við af Django alveg

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│ Django Legacy System (Linode: 172.105.71.207)                │
│ - Source of truth (for now)                                  │
│ - 2,216+ members                                             │
│ - Full profiles: name, email, phone, address, payments       │
│ - Unions, titles, dates, status                              │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Manual Sync (Admin clicks button)
                     │ GET /api/members/full/
                     │ Authorization: Token <django-token>
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│ New Member Management System (GCP: ekklesia-prod-10-2025)    │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Cloud Function: syncMembers                            │  │
│  │ - Triggered by admin button (HTTP trigger)             │  │
│  │ - Fetch ALL member data from Django                    │  │
│  │ - Store in Firestore (batch write)                     │  │
│  │ - Log sync history                                     │  │
│  │ - Return success + member count                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Firestore Collections                                  │  │
│  │                                                         │  │
│  │ members/{kennitala}                                    │  │
│  │   ├── profile (name, email, phone, birthday)          │  │
│  │   ├── address (street, postal, city)                  │  │
│  │   ├── membership (joined, status, unions, titles)     │  │
│  │   ├── payments [] (history)                           │  │
│  │   └── metadata (syncedAt, djangoId, lastModified)     │  │
│  │                                                         │  │
│  │ sync_history/{id}                                      │  │
│  │   ├── timestamp                                        │  │
│  │   ├── status (success/error)                          │  │
│  │   ├── memberCount                                      │  │
│  │   ├── duration_ms                                      │  │
│  │   └── changes {added, updated, removed}               │  │
│  │                                                         │  │
│  │ addresses/{kennitala}                                  │  │
│  │   ├── fromReykjavik (true/false)                      │  │
│  │   ├── street, postal, city                            │  │
│  │   └── lastUpdated                                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Admin Web UI (Firebase Hosting)                        │  │
│  │ Path: /admin-members/                                  │  │
│  │                                                         │  │
│  │ Features:                                              │  │
│  │ - Separate authentication (not Ekklesia voting auth)   │  │
│  │ - View member list (search, filter, sort)             │  │
│  │ - Manual sync button + sync history                   │  │
│  │ - Edit member data (create/update/delete)             │  │
│  │ - Address lookup (Reykjavík API integration)          │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Goals & Non-Goals

### Primary Goals

1. **Full Member Data Sync**: Sækja ALLT úr Django (ekki bara kennitalur)
2. **Manual Sync**: Admin getur klifkað á sync takka hvenær sem er
3. **Admin Web UI**: Sjá og breyta member data í web interface
4. **Separate System**: Nýtt kerfi með eigin auth (ekki tengt Ekklesia voting)
5. **Foundation for Migration**: Fyrsta skrefið í að taka við af Django

### Secondary Goals

1. **Address Lookup**: Integration við Reykjavík address API (opinber gögnin)
2. **Sync History**: Sjá hvenær sidast var syncað, hvað breyttist
3. **Member Edit**: Create/update/delete members
4. **Payment History**: Geyma payment history (að minnsta kosti síðustu 5 ár)

### Non-Goals (Not in Epic #43)

- ❌ Two-way sync (skrifa breytingar til baka í Django) - kommer seinna
- ❌ Real-time sync - manual er nóg fyrir núna
- ❌ Payments processing - bara sýna history, ekki taka við greiðslum
- ❌ Replace Django completely - keyrum samhliða í bili

---

## Implementation Plan

### Phase 1: Research & Planning (Week 1)

**Tasks**:
1. Map Django database schema
   - Connect to Django PostgreSQL
   - Document all tables related to members
   - Identify all fields to sync
2. Research Reykjavík address API
   - Find API documentation (github.com/reykjavik?)
   - Check authentication requirements
   - Understand rate limits
3. Design Firestore schema
   - Members collection structure
   - Sync history structure
   - Address cache structure

**Deliverables**:
- `docs/integration/DJANGO_DATABASE_SCHEMA.md` - Full schema documentation
- `docs/integration/REYKJAVIK_ADDRESS_API.md` - API research findings
- Updated EPIC_43 spec with detailed Firestore schema

---

### Phase 2: Django API Endpoint (Week 2)

**Tasks**:
1. Create Django REST API endpoint
   ```python
   # /api/members/full/
   @api_view(['GET'])
   @permission_classes([IsAuthenticated])
   def export_members_full(request):
       members = Comrade.objects.all()
       data = [serialize_member(m) for m in members]
       return Response({
           'count': len(data),
           'members': data,
           'exported_at': timezone.now().isoformat()
       })
   ```

2. Create service user + API token in Django
3. Test endpoint manually
4. Store token in GCP Secret Manager

**Deliverables**:
- Django code changes deployed
- API token stored in Secret Manager (`django-members-api-token`)
- Test script: `/tmp/test_django_members_api.sh`

---

### Phase 3: Firestore Schema Setup (Week 2)

**Tasks**:
1. Create Firestore collections
2. Set up security rules (admin-only access)
3. Create indexes for queries (search, filter)

**Firestore Schema**:

```javascript
// members/{kennitala}
{
  profile: {
    kennitala: string,
    name: string,
    birthday: string (YYYY-MM-DD),
    email: string,
    phone: string
  },
  address: {
    street: string,
    postal: string,
    city: string,
    fromReykjavik: boolean
  },
  membership: {
    dateJoined: timestamp,
    status: string (active/inactive),
    unions: array<string>,
    titles: array<string>
  },
  payments: array<{
    date: timestamp,
    amount: number,
    reference: string,
    method: string
  }>,
  metadata: {
    syncedAt: timestamp,
    djangoId: number,
    lastModified: timestamp,
    modifiedBy: string (uid)
  }
}

// sync_history/{id}
{
  timestamp: timestamp,
  status: string (success/error),
  memberCount: number,
  duration_ms: number,
  triggeredBy: string (uid),
  changes: {
    added: number,
    updated: number,
    removed: number,
    addedKennitalur: array<string>,
    removedKennitalur: array<string>
  },
  error: string (if failed)
}

// addresses/{kennitala}
{
  fromReykjavik: boolean,
  street: string,
  postal: string,
  city: string,
  lastUpdated: timestamp,
  source: string (reykjavik_api/manual/django)
}
```

**Security Rules**:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin-only access
    function isAdmin() {
      return request.auth != null &&
             get(/databases/$(database)/documents/admins/$(request.auth.uid)).data.isAdmin == true;
    }

    match /members/{kennitala} {
      allow read, write: if isAdmin();
    }

    match /sync_history/{id} {
      allow read: if isAdmin();
      allow create: if isAdmin();
    }

    match /addresses/{kennitala} {
      allow read, write: if isAdmin();
    }
  }
}
```

**Deliverables**:
- Firestore collections created
- Security rules deployed
- Indexes created for search/filter

---

### Phase 4: Sync Cloud Function (Week 3)

**Tasks**:
1. Create callable Cloud Function
2. Fetch data from Django API
3. Batch write to Firestore
4. Calculate diffs (added/removed members)
5. Log to sync_history

**Implementation**:

```javascript
// services/member-management/functions/src/sync.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

exports.syncMembers = functions
  .region('europe-west2')
  .runWith({
    timeoutSeconds: 540,  // 9 minutes
    memory: '1GB',
  })
  .https.onCall(async (data, context) => {
    const startTime = Date.now();

    // 1. Verify admin auth
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const adminDoc = await admin.firestore()
      .collection('admins')
      .doc(context.auth.uid)
      .get();

    if (!adminDoc.exists || !adminDoc.data().isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User must be admin'
      );
    }

    // 2. Get Django API token from Secret Manager
    const secretClient = new SecretManagerServiceClient();
    const [version] = await secretClient.accessSecretVersion({
      name: 'projects/ekklesia-prod-10-2025/secrets/django-members-api-token/versions/latest'
    });
    const djangoToken = version.payload.data.toString('utf8');

    // 3. Fetch members from Django
    console.log('[SYNC] Fetching members from Django...');
    const response = await fetch('http://172.105.71.207/api/members/full/', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${djangoToken}`,
        'Accept': 'application/json'
      },
      timeout: 60000  // 60 second timeout
    });

    if (!response.ok) {
      throw new functions.https.HttpsError(
        'internal',
        `Django API error: ${response.status} ${response.statusText}`
      );
    }

    const djangoData = await response.json();
    const members = djangoData.members;
    const count = djangoData.count;

    console.log(`[SYNC] Received ${count} members from Django`);

    // 4. Get existing members from Firestore (for diff)
    const existingSnapshot = await admin.firestore()
      .collection('members')
      .select('profile.kennitala')
      .get();

    const existingKennitalur = new Set(
      existingSnapshot.docs.map(doc => doc.id)
    );

    // 5. Calculate changes
    const newKennitalur = new Set(members.map(m => m.kennitala));
    const added = members.filter(m => !existingKennitalur.has(m.kennitala));
    const removed = Array.from(existingKennitalur).filter(k => !newKennitalur.has(k));
    const updated = members.filter(m => existingKennitalur.has(m.kennitala));

    console.log(`[SYNC] Changes: +${added.length} -${removed.length} ~${updated.length}`);

    // 6. Batch write to Firestore (500 docs per batch max)
    const db = admin.firestore();
    const batchSize = 500;
    const batches = [];

    for (let i = 0; i < members.length; i += batchSize) {
      const batch = db.batch();
      const chunk = members.slice(i, i + batchSize);

      chunk.forEach(member => {
        const docRef = db.collection('members').doc(member.kennitala);
        batch.set(docRef, {
          profile: {
            kennitala: member.kennitala,
            name: member.name,
            birthday: member.birthday,
            email: member.email || '',
            phone: member.phone || ''
          },
          address: {
            street: member.address?.street || '',
            postal: member.address?.postal || '',
            city: member.address?.city || '',
            fromReykjavik: false
          },
          membership: {
            dateJoined: admin.firestore.Timestamp.fromDate(new Date(member.date_joined)),
            status: member.status || 'active',
            unions: member.unions || [],
            titles: member.titles || []
          },
          payments: (member.payments || []).map(p => ({
            date: admin.firestore.Timestamp.fromDate(new Date(p.date)),
            amount: p.amount,
            reference: p.reference || '',
            method: p.method || 'unknown'
          })),
          metadata: {
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            djangoId: member.id,
            lastModified: admin.firestore.FieldValue.serverTimestamp(),
            modifiedBy: 'sync-function'
          }
        }, { merge: true });
      });

      batches.push(batch.commit());
    }

    await Promise.all(batches);
    console.log(`[SYNC] Wrote ${members.length} members to Firestore`);

    // 7. Mark removed members as inactive (soft delete)
    if (removed.length > 0) {
      const removeBatch = db.batch();
      removed.forEach(kennitala => {
        const docRef = db.collection('members').doc(kennitala);
        removeBatch.update(docRef, {
          'membership.status': 'removed',
          'metadata.lastModified': admin.firestore.FieldValue.serverTimestamp(),
          'metadata.modifiedBy': 'sync-function'
        });
      });
      await removeBatch.commit();
      console.log(`[SYNC] Marked ${removed.length} members as removed`);
    }

    // 8. Log to sync_history
    const duration = Date.now() - startTime;
    await db.collection('sync_history').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: 'success',
      memberCount: count,
      duration_ms: duration,
      triggeredBy: context.auth.uid,
      changes: {
        added: added.length,
        updated: updated.length,
        removed: removed.length,
        addedKennitalur: added.map(m => m.kennitala),
        removedKennitalur: removed
      }
    });

    console.log(`[SYNC] ✅ Sync completed (${duration}ms)`);

    return {
      success: true,
      memberCount: count,
      changes: {
        added: added.length,
        updated: updated.length,
        removed: removed.length
      },
      duration_ms: duration
    };
  });
```

**Deliverables**:
- Cloud Function deployed: `syncMembers`
- Test script: `/tmp/test_sync_members.sh`
- Error handling for all edge cases

---

### Phase 5: Admin Web UI (Weeks 4-5)

**Structure**:
```
apps/admin-members/
├── index.html                 (redirect to login if not authed)
├── login.html                 (admin authentication)
├── members-list.html          (view all members)
├── member-detail.html         (view/edit single member)
├── sync.html                  (manual sync + history)
├── js/
│   ├── auth.js                (admin authentication logic)
│   ├── members.js             (list/search/filter members)
│   ├── memberDetail.js        (view/edit single member)
│   ├── sync.js                (trigger sync, show history)
│   ├── addressLookup.js       (Reykjavík API integration)
│   └── firestore.js           (Firestore queries)
├── styles/
│   ├── global.css
│   ├── members.css
│   └── sync.css
└── firebase.json              (hosting config)
```

**Key Features**:

1. **Authentication** (`login.html`)
   - Separate from Ekklesia voting auth
   - Email/password for simplicity (Firebase Auth)
   - Admin users stored in `admins` collection
   - Redirect to members list after login

2. **Member List** (`members-list.html`)
   - Table view of all members
   - Search by name, kennitala, email
   - Filter by status, union, date joined
   - Sort by name, date joined, status
   - Pagination (50 per page)
   - Click row to view detail

3. **Member Detail** (`member-detail.html`)
   - View full profile
   - Edit fields (inline or form)
   - Address lookup button (Reykjavík API)
   - Payment history timeline
   - Audit trail (who edited, when)

4. **Sync** (`sync.html`)
   - Big "Sync Now" button
   - Progress indicator during sync
   - Sync history table (last 50 syncs)
   - Show changes: +X -Y ~Z members

**Deliverables**:
- Admin UI deployed to Firebase Hosting (`/admin-members/`)
- Working authentication
- All CRUD operations functional
- Reykjavík address lookup working

---

### Phase 6: Testing & Documentation (Week 6)

**Testing**:
1. Manual testing of all UI flows
2. Test sync with different scenarios (new members, removed, updated)
3. Test address lookup
4. Test error handling
5. Performance testing (sync 2000+ members)

**Documentation**:
1. Admin user guide
2. Django API documentation
3. Troubleshooting guide
4. Architecture diagrams

**Deliverables**:
- `docs/guides/ADMIN_MEMBERS_USER_GUIDE.md`
- `docs/integration/DJANGO_MEMBERS_API.md`
- `docs/troubleshooting/MEMBER_SYNC_ISSUES.md`

---

## Success Criteria

- [ ] Django API returns full member data (not just kennitalur)
- [ ] Sync function successfully syncs 2,216+ members
- [ ] Admin UI displays member list with search/filter
- [ ] Manual sync button triggers sync and shows progress
- [ ] Sync history shows all past syncs
- [ ] Member detail page shows all data
- [ ] Address lookup from Reykjavík API works
- [ ] Separate authentication works (not Ekklesia voting auth)
- [ ] All syncs logged to `sync_history`
- [ ] Performance: Sync completes in <5 minutes

---

## Timeline & Resources

**Total Timeline**: 6-7 weeks

| Phase | Duration | Notes |
|-------|----------|-------|
| 1. Research & Planning | 1 week | Django schema, Reykjavík API, Firestore design |
| 2. Django API | 1 week | Endpoint + token setup |
| 3. Firestore Setup | 3 days | Schema + security rules |
| 4. Sync Function | 1 week | Cloud Function with full logic |
| 5. Admin UI | 2-3 weeks | Authentication + all features |
| 6. Testing & Docs | 1 week | Manual testing + documentation |

**Infrastructure Costs**:
- Cloud Function: ~$1-2/month (manual sync, not scheduled)
- Firestore: ~$5-10/month (2000+ member documents)
- Secret Manager: $0.06/month (1 secret)
- Firebase Hosting: $0 (free tier)
- **Total**: ~$6-13/month

---

## Risks & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Django API slow/fails | Medium | High | Timeout handling, retry logic, error logging |
| Firestore write limits | Low | Medium | Batch writes (500 per batch), monitor quotas |
| Data loss during sync | Very Low | Critical | Always use merge: true, never delete |
| Address API unavailable | Medium | Low | Cache addresses, graceful degradation |
| Authentication bypass | Low | Critical | Firestore security rules, admin verification |

---

## Future Enhancements (Post Epic #43)

1. **Two-Way Sync**: Write changes back to Django
2. **Real-Time Sync**: Webhook from Django on member changes
3. **Payment Processing**: Accept payments, not just view history
4. **Email Campaigns**: Send emails to filtered member lists
5. **Reports & Analytics**: Member growth, payment trends
6. **Django Decommissioning**: Full migration, shut down Django

---

## Related Documentation

- [DJANGO_TO_EKKLESIA_MIGRATION.md](../../integration/DJANGO_TO_EKKLESIA_MIGRATION.md) - Long-term migration plan
- [DJANGO_SYNC_IMPLEMENTATION.md](../../integration/DJANGO_SYNC_IMPLEMENTATION.md) - Original kennitölu sync plan (obsolete)
- [CURRENT_DEVELOPMENT_STATUS.md](../../status/CURRENT_DEVELOPMENT_STATUS.md) - Overall Ekklesia status

---

**Last Updated**: 2025-10-26
**Author**: Jón Jónsson
**Status**: 🔨 In Development - Epic #43 Active
**Next Review**: After Phase 1 completion
