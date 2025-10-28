# Django API Upgrade - Epic #116, Issue #138

**Date**: 2025-10-28
**Status**: ✅ Complete
**Epic**: #116 - Members Admin UI
**Issue**: #138 - Django API Update Endpoint

---

## Summary

Upgraded Django REST API from **ReadOnlyModelViewSet** to **ModelViewSet** to support PUT/PATCH operations for updating member data from the Ekklesia admin UI.

---

## Changes Made

### 1. ViewSet Upgrade (`membership/views.py`)

**Before:**
```python
class ComradeFullViewSet(viewsets.ReadOnlyModelViewSet):
    # Only GET endpoints supported
```

**After:**
```python
class ComradeFullViewSet(viewsets.ModelViewSet):  # Epic #116
    # Supports GET, PUT, PATCH (DELETE disabled)

    def update(self, request, *args, **kwargs):
        # Custom update with audit logging

    def destroy(self, request, *args, **kwargs):
        # Returns 405 Method Not Allowed
```

### 2. Serializer Update (`membership/serializers.py`)

Added read-only protection for sensitive fields:

```python
class Meta:
    model = Comrade
    fields = (...)
    # Epic #116: Lock SSN and ID from updates
    read_only_fields = ('id', 'ssn')
```

### 3. Audit Logging

All updates are logged to `django_admin_log` table:

```sql
SELECT action_time, user_id, object_repr, change_message
FROM django_admin_log
WHERE object_id = '813'
ORDER BY action_time DESC;

-- Example output:
-- 2025-10-28 17:22:44 | 3 | 813: Guðröður | Updated via Epic #116 Admin UI
```

---

## API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| GET | `/felagar/api/full/` | List members (paginated) | 200 OK |
| GET | `/felagar/api/full/{id}/` | Get single member | 200 OK |
| **PATCH** | `/felagar/api/full/{id}/` | **Partial update** | **200 OK** |
| **PUT** | `/felagar/api/full/{id}/` | **Full update** | **200 OK** |
| DELETE | `/felagar/api/full/{id}/` | **Not allowed** | **405 Method Not Allowed** |

---

## Authentication

**Token-based** (Django REST Framework TokenAuthentication):

```bash
curl -X PATCH https://starf.sosialistaflokkurinn.is/felagar/api/full/813/ \
  -H "Authorization: Token YOUR_DJANGO_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Name"}'
```

**Token Location**: Google Cloud Secret Manager
- Secret: `django-api-token`
- Project: `ekklesia-prod-10-2025`

---

## Testing Results

### ✅ GET Request (Read)
```bash
curl -s https://starf.sosialistaflokkurinn.is/felagar/api/full/813/ \
  -H "Authorization: Token $TOKEN" | python3 -m json.tool

# Response: 200 OK
{
  "id": 813,
  "name": "Guðröður Atli Jónsson",
  "ssn": "2009783589",
  "contact_info": { ... },
  ...
}
```

### ✅ PATCH Request (Update)
```bash
curl -s -X PATCH https://starf.sosialistaflokkurinn.is/felagar/api/full/813/ \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Guðröður Atli Jónsson - Epic 116 Test"}'

# Response: 200 OK (name updated)
{
  "id": 813,
  "name": "Guðröður Atli Jónsson - Epic 116 Test",
  ...
}
```

### ✅ Audit Log Verification
```sql
SELECT * FROM django_admin_log WHERE object_id = '813' ORDER BY action_time DESC LIMIT 1;

-- Result:
-- action_time: 2025-10-28 17:22:44
-- user_id: 3
-- change_message: "Updated via Epic #116 Admin UI"
```

### ✅ Read-Only Field Protection (SSN)
```bash
curl -s -X PATCH .../813/ \
  -d '{"ssn": "0000000000"}'  # Attempt to change SSN

# Response: SSN field is ignored (read-only protection works)
```

---

## File Backups

Original files backed up before changes:
```bash
/home/manager/socialism/membership/views.py.backup-20251028-165411
/home/manager/socialism/membership/serializers.py.backup-20251028-165411
```

---

## Nginx Configuration (Important!)

Django API is accessible via **domain name**, not IP address:

```
✅ WORKS:  https://starf.sosialistaflokkurinn.is/felagar/api/full/
❌ FAILS:  http://172.105.71.207/felagar/api/full/
```

**Reason**: Nginx virtual host configuration uses `server_name` directive.

---

## Next Steps

1. ✅ Django API upgraded and tested
2. ⏳ Create Cloud Function for Django token access (Issue #137 prerequisite)
3. ⏳ Implement Member Detail Page (Issue #136)
4. ⏳ Implement Member Edit Page (Issue #137)

---

## Related Documents

- Implementation Plan: `docs/features/admin-portal/EPIC_116_MEMBER_DETAIL_EDIT_PLAN.md`
- GitHub Issue #138: Django API Update Endpoint
- GitHub Issue #136: Member Detail Page
- GitHub Issue #137: Member Edit Page

---

## Deployment Checklist

- [x] Backup original files
- [x] Update `views.py` (ViewSet upgrade)
- [x] Update `serializers.py` (read_only_fields)
- [x] Run `manage.py check` (no errors)
- [x] Restart Gunicorn
- [x] Test GET endpoint
- [x] Test PATCH endpoint
- [x] Verify audit logging
- [x] Verify read-only field protection
- [ ] Update firestore.rules to allow frontend access (pending)
- [ ] Deploy Cloud Function for token access (pending)

---

**Status**: ✅ Django API upgrade complete and tested
**Date Completed**: 2025-10-28
**Next Task**: Member Detail Page (Issue #136)
