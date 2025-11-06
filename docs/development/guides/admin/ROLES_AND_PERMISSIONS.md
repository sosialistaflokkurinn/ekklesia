# Roles and Permissions (RBAC)

**Classification**: Public - Architecture  
**Last Updated**: 2025-11-01  
**Status**: ✅ Active - Django Integration Complete

This document defines the roles for the Ekklesia platform. The goal is to follow the principle of least privilege, keep operational actions auditable, and make it easy to reason about who can do what.

## Role Definitions

Roles are synchronized from Django User model to Firebase custom claims:

### superuser
- **Source**: Django `User.is_superuser = True`
- **Permissions**: Full administrative capabilities including destructive operations
- **Use Cases**:
  - Platform developers and SREs
  - Destructive reset operations during testing (e.g., election data resets)
  - System configuration and maintenance scripts
  - Database migrations and schema changes

### admin  
- **Source**: Django `User.is_staff = True`
- **Permissions**: Administrative operations (non-destructive)
- **Use Cases**:
  - Election lifecycle management (create, publish, close)
  - Event metadata management
  - Member data administration
  - Results dashboards and monitoring

### member
- **Source**: All authenticated party members (automatic)
- **Permissions**: Basic authenticated access
- **Use Cases**:
  - Authenticate via Kenni.is
  - Request voting tokens (when eligible)
  - Cast votes in open elections
  - View permitted results

**Notes**:
- Role names are lowercase identifiers used in Firebase custom claims (e.g., `roles: ["superuser", "admin", "member"]`)
- The `member` role is automatically assigned to all authenticated party members
- A user can have multiple roles (e.g., both `admin` and `superuser`)

---

## Permission Matrix

Legend:
- ✅ allowed
- ❌ forbidden

### Admin Actions

| Action | Endpoint | superuser | admin | member |
|--------|----------|-----------|-------|--------|
| **Election Lifecycle** | | | | |
| Create election (draft) | POST /api/admin/elections | ✅ | ✅ | ❌ |
| Edit draft election | PATCH /api/admin/elections/:id/draft | ✅ | ✅ | ❌ |
| Publish election | POST /api/admin/elections/:id/publish | ✅ | ✅ | ❌ |
| Pause election | POST /api/admin/elections/:id/pause | ✅ | ✅ | ❌ |
| Resume election | POST /api/admin/elections/:id/resume | ✅ | ✅ | ❌ |
| Close election | POST /api/admin/elections/:id/close | ✅ | ✅ | ❌ |
| Archive election | POST /api/admin/elections/:id/archive | ✅ | ✅ | ❌ |
| **Destructive Operations** | | | | |
| Delete draft (soft) | DELETE /api/admin/elections/:id | ✅ | ❌ | ❌ |
| Reset election data | POST /api/admin/reset-election | ✅ | ❌ | ❌ |
| **Metadata Management** | | | | |
| Edit election metadata | PATCH /api/admin/elections/:id/metadata | ✅ | ✅ | ❌ |
| **Viewing & Monitoring** | | | | |
| List elections (admin) | GET /api/admin/elections | ✅ | ✅ | ❌ |
| Preview election detail | GET /api/admin/elections/:id | ✅ | ✅ | ❌ |

**Notes**:
- **superuser**: Full access including destructive operations
- **admin**: Can manage elections but cannot delete or reset
- **member**: No admin access (public endpoints only)

---

## Storage and Propagation

### Source of Truth: Django Database

```python
# Django User model
class User(models.Model):
    username = models.CharField(max_length=150, unique=True)
    is_staff = models.BooleanField(default=False)      # → admin role
    is_superuser = models.BooleanField(default=False)  # → superuser role
```

### Synchronization Flow

```
Django User Model
    ↓ (member sync)
Firestore /users/{uid}
    roles: ["member", "admin", "superuser"]
    ↓ (on login)
Firebase Custom Claims
    ↓ (ID token)
Frontend + Backend Services
```

**Implementation Details**:

1. **Django API** (`/felagar/api/full/`) includes `is_staff` and `is_superuser` fields
2. **Member Sync** (`sync_members.py`) reads these fields and writes to Firestore
3. **Firebase Auth** (`handleKenniAuth`) reads from Firestore and sets custom claims
4. **Frontend** reads roles from ID token and gates UI
5. **Backend** verifies ID token and checks roles for authorization

---

## How to Assign Roles

Roles are managed in Django admin interface or Django shell:

### Via Django Admin

1. Login to Django admin: https://starf.sosialistaflokkurinn.is/admin/
2. Navigate to Users
3. Edit user
4. Check "Staff status" for admin role
5. Check "Superuser status" for superuser role
6. Save

### Via Django Shell

```bash
ssh root@172.105.71.207
cd /home/manager/socialism
sudo -u manager venv/bin/python manage.py shell
```

```python
from django.contrib.auth.models import User

# Get user (username is Comrade.id as string)
user = User.objects.get(username='813')

# Assign admin role
user.is_staff = True
user.save()

# Assign superuser role
user.is_superuser = True
user.save()
```

### Propagation

After changing roles in Django:

1. **Manual Sync**: Admin portal → Sync Members page → "Sync All Members"
2. **Automatic Sync**: Runs hourly (when implemented)
3. **Next Login**: User gets updated custom claims

---

## Enforcement Patterns

### Backend (Node.js)

```javascript
const { requireRole, requireAnyRoles } = require('../middleware/roles');

// Require specific role
router.post('/reset-election', requireRole('superuser'), handler);

// Allow any of multiple roles
router.post('/elections', requireAnyRoles(['superuser', 'admin']), handler);
```

### Frontend

```javascript
// Check user roles
const userData = await getUserData();
const roles = userData.roles || [];

// Gate UI elements
if (roles.includes('admin') || roles.includes('superuser')) {
  showAdminPanel();
}

// Gate destructive operations
if (roles.includes('superuser')) {
  showResetButton();
}
```

---

## Auditing and Safety

All admin routes:
- Log structured events with `performed_by` (UID) and correlation IDs
- Require confirmation for destructive actions
- Return before/after counters for transparency

Example audit log entry:
```json
{
  "action": "reset_election",
  "performed_by": "wElbKqQ8mLfYmxhpiUGAnv0vx2g1",
  "roles": ["superuser", "admin", "member"],
  "timestamp": "2025-11-01T12:00:00Z",
  "scope": "mine",
  "result": "success"
}
```

---

## Migration Notes

**Previous System** (deprecated):
- `developer` → Now `superuser`
- `meeting_election_manager` → Now `admin`
- `event_manager` → Now `admin`

**Migration Date**: 2025-11-01  
**Breaking Changes**: None (roles auto-synced from Django)

---

## Related Documentation

- **Django Integration**: `docs/integration/DJANGO_DATABASE_SCHEMA.md`
- **Member Sync**: `docs/features/election-voting/EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md`
- **Admin API**: `docs/features/election-voting/ADMIN_API_REFERENCE.md`
