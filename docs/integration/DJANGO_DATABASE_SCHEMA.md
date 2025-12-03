# Django Database Schema for Epic #43 Member Sync

**Document Type**: Database Schema Reference
**Last Updated**: 2025-12-01
**Status**: ✅ COMPLETE - Epic #43 Real-Time Sync Implementation
**Purpose**: Document Django database tables and sync architecture with Firestore

---

## Overview

This document maps the Django PostgreSQL database schema to the Firestore schema for Epic #43 Member Management System. The Django system (`sfi_felagakerfi_live` on Linode) is the current source of truth with **2,200+ active members**.

**Architecture**: Real-time bidirectional sync between Django ↔ Firestore:
- **Django → Firestore**: Django signals trigger `sync_from_django` webhook (immediate)
- **Firestore → Django**: Profile updates call `/api/sync/address/` via `updatememberprofile`

---

## Database Connection

### Server Access

- **Server**: 172.105.71.207 (Linode)
- **SSH**: `ssh root@172.105.71.207`
- **Lish**: `ssh -t gudrodur@lish-eu-central.linode.com sfi_felagakerfi_live`

### PostgreSQL Database

- **Database Name**: `socialism`
- **User**: `socialism` (or `postgres` for admin access)
- **Authentication**: Peer authentication (Unix socket)
- **Access Command**: `sudo -u postgres psql socialism`

### Django Application

- **Location**: `/home/manager/socialism/`
- **Python**: Python 3.6 (virtualenv at `venv/`)
- **Django Shell**: `sudo -u manager venv/bin/python manage.py shell`

---

## Core Tables

### 1. `membership_comrade` (Member Profiles)

**Purpose**: Main member registry table - **source of truth** for all members

**Total Records**: 2,200 active members (verified Oct 26, 2025)

**Django Model**: `membership.models.Comrade`

**Schema**:

| Column | Type | Nullable | Description | Sync to Firestore? |
|--------|------|----------|-------------|-------------------|
| `id` | SERIAL (PK) | No | Auto-increment primary key | ✅ Yes (as `djangoId` in metadata) |
| `name` | VARCHAR(250) | No | Full name (e.g., "Guðrún Jónsdóttir") | ✅ Yes (`profile.name`) |
| `ssn` | VARCHAR(10) | No | Kennitala (10 digits, no hyphen) | ✅ Yes (`profile.kennitala`) |
| `birthday` | DATE | Yes | Date of birth | ✅ Yes (`profile.birthday`) |
| `date_joined` | TIMESTAMP | No | Membership start date | ✅ Yes (`membership.dateJoined`) |
| `reachable` | BOOLEAN | No | Allow contact (default true) | ✅ Yes (`membership.reachable`) |
| `groupable` | BOOLEAN | No | Allow group membership (default true) | ✅ Yes (`membership.groupable`) |
| `housing_situation` | INTEGER | Yes | Housing status enum | ✅ Yes (`profile.housingSituation`) |
| `gender` | INTEGER | Yes | Gender enum | ✅ Yes (`profile.gender`) |

**Important Notes**:
- `ssn` is stored in **10-digit format** (e.g., `0101012980`), **NOT** hyphenated (`010101-2980`)
- All records in this table are **active members** (no "inactive" flag)
- `date_joined` is when member first registered (important for voting eligibility)

**Django Model Code** (reference):
```python
class Comrade(models.Model):
    name = models.CharField(max_length=250)
    ssn = models.CharField(max_length=10)  # Kennitala (no hyphen)
    birthday = models.DateField(null=True)
    date_joined = models.DateTimeField()
    reachable = models.BooleanField(default=True)
    groupable = models.BooleanField(default=True)
    housing_situation = models.IntegerField(null=True)
    gender = models.IntegerField(null=True)

    # Many-to-Many relationships
    union_memberships = models.ManyToManyField('Union')
    titles = models.ManyToManyField('Title')
    emails = models.ManyToManyField('Email')
    groups = models.ManyToManyField('ComradeGroup')
```

---

### 2. `membership_union` (Unions/Stéttarfélög)

**Purpose**: List of labor unions members belong to

**Django Model**: `membership.models.Union`

**Schema**:

| Column | Type | Nullable | Description | Sync to Firestore? |
|--------|------|----------|-------------|-------------------|
| `id` | SERIAL (PK) | No | Union ID | ✅ Yes (as array of IDs) |
| `name` | VARCHAR(250) | No | Union name (e.g., "Verkalýðsfélag Reykjavíkur") | ✅ Yes (lookup table) |
| `abbreviation` | VARCHAR(50) | Yes | Short name (e.g., "VR") | ✅ Yes (if available) |

**Relationship**: Many-to-Many with `membership_comrade` via `membership_unionmembership`

---

### 3. `membership_unionmembership` (M2M: Member ↔ Union)

**Purpose**: Junction table linking members to their unions

**Django Model**: Implicit (Django M2M)

**Schema**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL (PK) | No | Junction ID |
| `comrade_id` | INTEGER (FK) | No | → `membership_comrade.id` |
| `union_id` | INTEGER (FK) | No | → `membership_union.id` |

**Sync Strategy**: Fetch unions per member via Django ORM, store as array in Firestore

---

### 4. `membership_title` (Job Titles/Starfsheiti)

**Purpose**: List of job titles members have

**Django Model**: `membership.models.Title`

**Schema**:

| Column | Type | Nullable | Description | Sync to Firestore? |
|--------|------|----------|-------------|-------------------|
| `id` | SERIAL (PK) | No | Title ID | ✅ Yes (as array of IDs) |
| `name` | VARCHAR(250) | No | Title name (e.g., "Hjúkrunarfræðingur") | ✅ Yes (lookup table) |

**Relationship**: Many-to-Many with `membership_comrade` via `membership_comradetitle`

---

### 5. `membership_comradetitle` (M2M: Member ↔ Title)

**Purpose**: Junction table linking members to their job titles

**Django Model**: Implicit (Django M2M)

**Schema**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL (PK) | No | Junction ID |
| `comrade_id` | INTEGER (FK) | No | → `membership_comrade.id` |
| `title_id` | INTEGER (FK) | No | → `membership_title.id` |

**Sync Strategy**: Fetch titles per member via Django ORM, store as array in Firestore

---

### 6. `membership_contactinfo` (Contact Information) ✅ CORRECTED

**Purpose**: Stores phone, email, and Facebook for each member (1:1 relationship)

**Django Model**: `membership.models.ContactInfo`

**Schema**:

| Column | Type | Nullable | Description | Sync to Firestore? |
|--------|------|----------|-------------|-------------------|
| `comrade_id` | INTEGER (PK, FK) | No | → `membership_comrade.id` | (use as join key) |
| `phone` | VARCHAR(32) | Yes | Phone number | ✅ Yes (`profile.phone`) |
| `email` | VARCHAR(124) | Yes | Email address | ✅ Yes (`profile.email`) |
| `facebook` | VARCHAR(255) | Yes | Facebook profile | ⏳ Optional |
| `foreign_phone` | VARCHAR(32) | Yes | International phone | ⏳ Optional |

**Relationship**: One-to-One with `membership_comrade`

**Sync Strategy**: Direct copy of email and phone to Firestore

**⚠️ Important Note**:
- `communication_email` model exists but is for **email campaigns** (subject, body, etc.), NOT email addresses
- Actual email addresses are stored in `ContactInfo.email`
- The `Email` model has an `identifier` field, not an `email` field

---

### 7. Address Tables (✅ Verified & Updated 2025-11-24)

**Address System**: Django uses **TWO different systems** for storing addresses:

1. **Simple System** (`membership_simpleaddress`) - Direct address storage
2. **Complex System** (`membership_newlocaladdress` + `map_address`) - Linked to Iceland national address registry

---

#### 7a. `membership_simpleaddress` (Simple Address System) ✅ NEW

**Purpose**: Direct storage of addresses (simpler than map system)

**Django Model**: `membership.models.SimpleAddress`

**Stats**: **829 addresses** stored in this table (verified 2025-11-24)

**Schema**:

| Column | Type | Nullable | Description | Sync to Firestore? |
|--------|------|----------|-------------|-------------------|
| `comrade` | OneToOneField | No | → `membership_comrade.id` | (use as join key) |
| `street_address` | VARCHAR(255) | Yes | Full street address | ✅ Yes (`address.street`) |
| `postal_code` | VARCHAR(10) | Yes | Postal code | ✅ Yes (`address.postal`) |
| `city` | VARCHAR(100) | Yes | City name | ✅ Yes (`address.city`) |
| `country` | VARCHAR(100) | Yes | Country name | ✅ Yes (`address.country`) |
| `raw_address` | VARCHAR(500) | Yes | Unprocessed address text | ⏳ Optional |
| `address_id` | INTEGER (FK) | Yes | → `map_address.id` (optional link) | ❌ No |
| `new_country_id` | INTEGER (FK) | Yes | → Country FK | ❌ No |

**Relationship**: One-to-One with `membership_comrade`

**Sync Strategy**: Direct copy to Firestore `address` object

---

#### 7b. Complex Address System (Iceland National Registry)

#### `membership_newlocaladdress` (Local/Iceland Addresses)

**Purpose**: Links members to Icelandic addresses (uses map system)

**Schema**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `newcomradeaddress_ptr_id` | INTEGER (PK) | No | Junction table ID |
| `comrade_id` | INTEGER (FK) | Yes | → `membership_comrade.id` |
| `address_id` | INTEGER (FK) | Yes | → `map_address.id` |
| `unlocated` | BOOLEAN | No | Address not found in map |

#### `map_address` (Iceland Address Database)

**Purpose**: Full Iceland address database with GIS data

**Schema**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER (PK) | No | Address ID |
| `number` | INTEGER | Yes | House number |
| `letter` | VARCHAR(16) | No | House letter (e.g., "A") |
| `extra` | VARCHAR(64) | No | Extra info (apartment #) |
| `special` | VARCHAR(128) | No | Special notes |
| `geometry` | GEOMETRY (Point) | No | GPS coordinates |
| `street_id` | INTEGER (FK) | No | → `map_street.id` |

#### `map_street` (Street Database)

**Purpose**: Street names with postal codes

**Schema**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | INTEGER (PK) | No | Street ID |
| `name` | VARCHAR(128) | No | Street name (e.g., "Túngata") |
| `postal_code_id` | INTEGER (FK) | No | → `map_postalcode.id` |
| `municipality_id` | INTEGER (FK) | No | → `map_municipality.id` |

---

#### 📍 Iceland National Address Registry (Stadfangaskra.csv)

**Source File**: `/home/gudro/Development/projects/ekklesia/data/Stadfangaskra.csv`

**Purpose**: Complete Iceland address registry used by the map_address system

**Stats**:
- **137,163 addresses** in CSV file
- Includes GPS coordinates, postal codes, municipalities
- Updated regularly from national registry

**Key Fields**:
- `LANDNR` - Unique address ID (e.g., 101860)
- `HEITI_NF` - Street name (e.g., "Njálsgata")
- `HUSNR` - House number (e.g., "8")
- `BOKST` - Letter (e.g., "C")
- `POSTNR` - Postal code (e.g., "101")
- `LM_HEIMILISFANG` - Formatted address (e.g., "Njálsgata 8C (101860)")
- `N_HNIT_WGS84`, `E_HNIT_WGS84` - GPS coordinates

**Example Entry**:
```csv
LANDNR: 101860
Address: Njálsgata 8C, 101 Reykjavík
GPS: 64.14399257, -21.92888234
```

**Usage**: The `map_address` table references addresses in this CSV file. When a member's address is validated, it's matched against this registry.

---

#### `membership_newforeignaddress` (Foreign Addresses)

**Purpose**: Addresses outside Iceland (free-text)

**Schema**: To be investigated (likely has `street`, `city`, `country` fields)

**Sync Strategy**:

For Epic #43 MVP:
1. **Contact Info**: Join `membership_contactinfo` to get phone/email
2. **Local Addresses**: Join through `membership_newlocaladdress` → `map_address` → `map_street`
3. **Foreign Addresses**: Skip for MVP (manual entry in admin UI)
4. **Address Format**: Concatenate `map_street.name` + `map_address.number` + `map_address.letter`

**SQL Query** (example):
```sql
SELECT
    c.ssn,
    c.name,
    ci.email,
    ci.phone,
    s.name || ' ' || a.number || a.letter AS full_address,
    pc.code AS postal_code,
    m.name AS city
FROM membership_comrade c
LEFT JOIN membership_contactinfo ci ON ci.comrade_id = c.id
LEFT JOIN membership_newlocaladdress nla ON nla.comrade_id = c.id
LEFT JOIN map_address a ON a.id = nla.address_id
LEFT JOIN map_street s ON s.id = a.street_id
LEFT JOIN map_postalcode pc ON pc.id = s.postal_code_id
LEFT JOIN map_municipality m ON m.id = s.municipality_id
WHERE c.ssn = '0101012980';
```

---

### 8. Payment Tables (Future - Not in MVP)

**Likely Tables**:
- `economy_payment` (or similar)
- Fields: `amount`, `payment_date`, `status`, `reference`

**MVP Decision**: **Skip payments for now**
- Too complex for initial implementation
- Payments managed in accounting system
- Can add in Phase 2

**Future Sync** (if needed):
- Fetch last payment date
- Fetch total contributions
- Store in `payments` subcollection

---

## Django API Endpoints (✅ Implemented)

The following sync API endpoints are implemented in `felagar/api_views_sync.py`:

| Endpoint | Method | Purpose | Code Location |
|----------|--------|---------|---------------|
| `/api/sync/changes/` | GET | Get pending changes for sync | `api_views_sync.py:30` |
| `/api/sync/apply/` | POST | Apply changes from Firestore to Django | `api_views_sync.py:96` |
| `/api/sync/mark-synced/` | POST | Mark changes as synced | `api_views_sync.py:261` |
| `/api/sync/status/` | GET | Get sync status | `api_views_sync.py:309` |
| `/api/sync/address/` | POST | Update member address from Firestore | `api_views_sync.py:490` |
| `/api/sync/member/<ssn>/` | GET | Get single member by SSN | `api_views_sync.py:553` |
| `/api/members/full/` | GET | Full member data (bulk sync) | See below |

### Bulk Sync Endpoint: `/api/members/full/`

**Purpose**: Return ALL member data in one request (for bulk sync)

**Authentication**: Token authentication (Django REST Framework)

**Response Format**:
```json
{
  "count": 2216,
  "results": [
    {
      "id": 123,
      "name": "Guðrún Jónsdóttir",
      "ssn": "0101012980",
      "birthday": "1998-01-01",
      "date_joined": "2023-05-15T14:30:00Z",
      "reachable": true,
      "groupable": true,
      "housing_situation": 1,
      "gender": 2,
      "email": "gudrun@example.is",
      "phone": "+3545551234",
      "address": {
        "street": "Túngata 14",
        "postal": "101",
        "city": "Reykjavík",
        "country": "IS"
      },
      "unions": [
        {"id": 5, "name": "Verkalýðsfélag Reykjavíkur", "abbreviation": "VR"}
      ],
      "titles": [
        {"id": 12, "name": "Hjúkrunarfræðingur"}
      ]
    }
  ]
}
```

**Implementation** (in Django):
```python
# membership/serializers.py
from rest_framework import serializers
from .models import Comrade, Union, Title

class UnionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Union
        fields = ['id', 'name', 'abbreviation']

class TitleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Title
        fields = ['id', 'name']

class ComradeFullSerializer(serializers.ModelSerializer):
    """Full member serializer (includes SSN - admin only!)"""
    email = serializers.SerializerMethodField()
    phone = serializers.SerializerMethodField()
    address = serializers.SerializerMethodField()
    unions = UnionSerializer(source='union_memberships', many=True)
    titles = TitleSerializer(many=True)

    class Meta:
        model = Comrade
        fields = [
            'id', 'name', 'ssn', 'birthday', 'date_joined',
            'reachable', 'groupable', 'housing_situation', 'gender',
            'email', 'phone', 'address', 'unions', 'titles'
        ]

    def get_email(self, obj):
        # Get primary email
        primary_email = obj.emails.filter(primary=True).first()
        return primary_email.email if primary_email else None

    def get_phone(self, obj):
        # Get phone from profile (if available)
        return getattr(obj, 'phone', None)

    def get_address(self, obj):
        # Get primary address
        address = obj.addresses.filter(primary=True).first()
        if address:
            return {
                'street': address.street,
                'postal': address.postal_code,
                'city': address.city,
                'country': address.country
            }
        return None

# membership/views.py
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import TokenAuthentication

class ComradeFullViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for full member data sync (admin only!)

    WARNING: This endpoint includes SSN (kennitala) - restrict access!
    """
    queryset = Comrade.objects.all().prefetch_related(
        'union_memberships',
        'titles',
        'emails',
        'addresses'
    )
    serializer_class = ComradeFullSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]  # Add admin-only permission
    pagination_class = PageNumberPagination

    def get_queryset(self):
        # Only allow staff users
        if not self.request.user.is_staff:
            raise PermissionDenied("Admin access required")
        return super().get_queryset()

# membership/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ComradeFullViewSet

router = DefaultRouter()
router.register(r'members/full', ComradeFullViewSet, basename='member-full')

urlpatterns = [
    path('api/', include(router.urls)),
]
```

---

## Firestore Mapping

### Django → Firestore Field Mapping

| Django Table | Django Field | Firestore Path | Transform |
|--------------|--------------|----------------|-----------|
| `membership_comrade` | `ssn` | `{kennitala}` (doc ID) | Use as document key |
| `membership_comrade` | `name` | `profile.name` | Direct copy |
| `membership_comrade` | `birthday` | `profile.birthday` | Convert to ISO string |
| `membership_comrade` | `date_joined` | `membership.dateJoined` | Convert to Firestore timestamp |
| `membership_comrade` | `reachable` | `membership.reachable` | Direct copy |
| `membership_comrade` | `groupable` | `membership.groupable` | Direct copy |
| `membership_comrade` | `housing_situation` | `profile.housingSituation` | Direct copy |
| `membership_comrade` | `gender` | `profile.gender` | Direct copy |
| `communication_email` | `email` (primary) | `profile.email` | Direct copy |
| Address table | `street` | `address.street` | Direct copy |
| Address table | `postal_code` | `address.postal` | Direct copy |
| Address table | `city` | `address.city` | Direct copy |
| `membership_unionmembership` | (via M2M) | `membership.unions` | Array of union names |
| `membership_comradetitle` | (via M2M) | `membership.titles` | Array of title names |
| `membership_comrade` | `id` | `metadata.djangoId` | For reverse lookup |
| (Generated) | (sync time) | `metadata.syncedAt` | Server timestamp |

---

## Data Transformation Examples

### Example 1: Basic Member

**Django Record**:
```sql
SELECT * FROM membership_comrade WHERE ssn = '0101012980';
-- id: 123
-- name: Guðrún Jónsdóttir
-- ssn: 0101012980
-- birthday: 1998-01-01
-- date_joined: 2023-05-15 14:30:00
```

**Firestore Document** (`members/0101012980`):
```json
{
  "profile": {
    "kennitala": "0101012980",
    "name": "Guðrún Jónsdóttir",
    "birthday": "1998-01-01",
    "email": "gudrun@example.is",
    "phone": "+3545551234",
    "housingSituation": 1,
    "gender": 2
  },
  "address": {
    "street": "Túngata 14",
    "postal": "101",
    "city": "Reykjavík",
    "country": "IS",
    "fromReykjavik": true
  },
  "membership": {
    "dateJoined": "2023-05-15T14:30:00Z",
    "status": "active",
    "reachable": true,
    "groupable": true,
    "unions": ["Verkalýðsfélag Reykjavíkur"],
    "titles": ["Hjúkrunarfræðingur"]
  },
  "metadata": {
    "djangoId": 123,
    "syncedAt": "2025-10-26T12:00:00Z",
    "lastModified": "2025-10-26T12:00:00Z",
    "modifiedBy": "system_sync"
  }
}
```

---

## Sync Architecture (Real-Time)

The sync system was upgraded from queue-based to **real-time bidirectional sync** in November 2025.

### Django → Firestore (Real-Time)

**Mechanism**: Django signals trigger immediate sync via webhook

```
Django post_save signal → HTTP POST to sync_from_django → Firestore update
Django post_delete signal → HTTP POST to sync_from_django → Firestore delete
```

**Cloud Function**: `sync_from_django` (`services/members/functions/sync_from_django.py`)
- URL: `https://sync-from-django-521240388393.europe-west2.run.app`
- Triggered by Django `post_save` and `post_delete` signals
- Validates webhook token from Secret Manager
- Updates Firestore `/members/{kennitala}` in real-time

### Firestore → Django (Real-Time)

**Mechanism**: Profile updates in Ekklesia call Django API

```
User updates profile → updatememberprofile → POST /api/sync/address/ → Django update
```

**Cloud Function**: `updatememberprofile` (`services/members/functions/member_functions.py`)
- URL: `https://updatememberprofile-521240388393.europe-west2.run.app`
- Called when user updates their profile (address, phone, etc.)
- Updates both Firestore and Django via `/api/sync/address/`

### Bulk Sync (Manual/Initial)

**Process** (for initial data load or recovery):
1. Fetch ALL members from Django: `GET /api/members/full/`
2. Paginate through results (100 members per page)
3. For each member:
   - Transform Django → Firestore format
   - Write to Firestore: `members/{kennitala}`
4. Log sync to Cloud Logging

**Cloud Function**: `syncmembers` (`services/members/functions/sync_functions.py`)
- URL: `https://syncmembers-521240388393.europe-west2.run.app`
- Typically used for initial sync or disaster recovery

---

## Security Considerations

### Django API Security

**CRITICAL**: `/api/members/full/` endpoint contains **SSN (kennitala)** - sensitive PII!

**Required Protections**:
1. ✅ **Token authentication** (Django REST Framework)
2. ✅ **Admin-only access** (check `is_staff` flag)
3. ✅ **HTTPS only** (Django `SECURE_SSL_REDIRECT = True`)
4. ✅ **IP whitelist** (only allow Ekklesia Cloud Function IP)
5. ✅ **Rate limiting** (prevent brute force)
6. ✅ **Audit logging** (log all API calls)

**Django Settings** (add to `socialism/settings.py`):
```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAdminUser',  # Admin only!
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '10/hour',
        'user': '100/hour',  # Cloud Function syncs once per day
    },
}

# Force HTTPS
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

### Firestore Security

**Rules** (members collection):
```javascript
match /members/{kennitala} {
  // Only authenticated users can read their own data
  allow read: if request.auth != null
    && request.auth.token.kennitala == kennitala;

  // Only admins can read all members
  allow read: if request.auth != null
    && request.auth.token.roles.hasAny(['admin', 'developer']);

  // Only admins can write
  allow write: if request.auth != null
    && request.auth.token.roles.hasAny(['admin', 'developer']);
}
```

---

## Implementation Status

### Phase 1: Schema Verification ✅ COMPLETE

- [x] Document Django database schema (this file)
- [x] SSH to Django server (via `~/django-ssh.sh`)
- [x] Verify address table schema (`map_address`, `map_street`, etc.)
- [x] Verify phone number storage (`membership_contactinfo`)
- [x] Document member count (2,200+ members)
- [x] Create helper scripts for database access

### Phase 2: Django API Development ✅ COMPLETE

- [x] Create sync API endpoints in `felagar/api_views_sync.py`
- [x] Add token authentication (Django REST Framework)
- [x] Add endpoint security (IP validation, rate limiting)
- [x] Implement `/api/sync/address/` for profile updates
- [x] Implement `/api/sync/member/<ssn>/` for single member lookup

### Phase 3: Cloud Function Sync ✅ COMPLETE

- [x] Create `sync_from_django` Cloud Function (real-time Django → Firestore)
- [x] Create `syncmembers` Cloud Function (bulk sync)
- [x] Create `updatememberprofile` Cloud Function (Firestore → Django)
- [x] Django signals integration for real-time sync
- [x] Audit logging to Cloud Logging

### Phase 4: Admin UI ✅ COMPLETE

- [x] Create admin web UI (`/superuser/`)
- [x] Member list view (read from Firestore)
- [x] System health dashboard
- [x] Audit log viewer
- [x] Role management (superuser, admin)

---

## Resolved Questions

| Question | Answer |
|----------|--------|
| Address Storage | `membership_simpleaddress` (829 records) and `membership_newlocaladdress` (complex system) |
| Phone Numbers | `membership_contactinfo.phone` |
| API Token | Stored in Secret Manager: `DJANGO_API_TOKEN` |
| IP Whitelist | Yes, Cloud Run services only access Django API |

---

## Related Documentation

- [EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md](../features/election-voting/EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md) - Main Epic #43 spec
- [CLOUD_RUN_SERVICES.md](../infrastructure/CLOUD_RUN_SERVICES.md) - Cloud Run services and URLs
- [REYKJAVIK_ADDRESS_API_RESEARCH.md](REYKJAVIK_ADDRESS_API_RESEARCH.md) - Address lookup research

---

## Changelog

| Date | Changes |
|------|---------|
| 2025-12-01 | Major update: Documented real-time sync architecture, marked all phases complete, updated API endpoints as implemented |
| 2025-11-24 | Added SimpleAddress and ContactInfo corrections |
| 2025-10-26 | Initial schema documentation |
