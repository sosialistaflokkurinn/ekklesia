# Django API Upgrade - Epic #116, Issue #138

**Date**: 2025-10-28
**Status**: ✅ Complete (Address Sync Bug Fixed 2025-10-31)
**Epic**: #116 - Members Admin UI
**Issue**: #138 - Django API Update Endpoint
**Bug Report**: [Epic #116 Address Sync Bug](#epic-116-address-sync-bug) - ✅ RESOLVED

---

## Summary

Upgraded Django REST API from **ReadOnlyModelViewSet** to **ModelViewSet** to support PUT/PATCH operations for updating member data from the Ekklesia admin UI.

⚠️ **CRITICAL BUG**: This implementation broke address synchronization for Epic #43. See [Bug Report](#epic-116-address-sync-bug) below.

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
- **Address System Deep Dive**: `docs/integration/DJANGO_ADDRESS_SYSTEM_DEEP_DIVE.md`
- Database Schema: `docs/integration/DJANGO_DATABASE_SCHEMA.md`
- System Overview: `docs/systems/DJANGO_BACKEND_SYSTEM.md`
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

## Epic #116 Address Sync Bug

✅ **BUG RESOLVED**: 2025-10-31 16:38 UTC

**Original Issue Discovered**: 2025-10-31

### Problem

Epic #116 implementation **broke address synchronization** from Django → Firestore. All members now return `"local_address": null` from API despite 1,975 members having valid addresses in Django database.

### Root Cause

During implementation, the `local_address` serializer field was changed from `SerializerMethodField()` to `DictField()` to support write operations. This broke read functionality.

**Original Code** (Epic #43 - Working):
```python
class ComradeFullSerializer(serializers.ModelSerializer):
    local_address = serializers.SerializerMethodField()

    def get_local_address(self, obj):
        local_addr = obj.local_addresses.filter(current=True).first()
        if local_addr:
            return AddressSerializer(local_addr).data
        return None
```

**Changed Code** (Epic #116 - Broken):
```python
class ComradeFullSerializer(serializers.ModelSerializer):
    # Epic #116: Allow updates via custom update method
    local_address = serializers.DictField(required=False, allow_null=True)
    # ❌ BUG: get_local_address() no longer called!
```

### Why It Failed

1. `DictField` expects model to have `local_address` attribute (doesn't exist)
2. Model has `local_addresses` (plural, relationship to NewLocalAddress table)
3. `get_local_address()` method is never called (not a SerializerMethodField)
4. Django REST Framework returns `null` for non-existent model attributes
5. API sync returns null → Firestore members have empty addresses

### Impact

- ❌ **1,975 member addresses NOT synced** to Firestore
- ❌ Members see **no address** in member portal
- ❌ Admins see **no address** in admin UI
- ✅ Database **intact** (no data loss)
- ✅ Epic #116 **updates work** for other fields (name, email, phone)

### The Fix

**File**: `/home/manager/socialism/membership/serializers.py`
**Line**: ~127 (in `ComradeFullSerializer` class)

**Change ONE line**:
```python
# BEFORE (Broken):
local_address = serializers.DictField(required=False, allow_null=True)

# AFTER (Fixed):
local_address = serializers.SerializerMethodField()
```

**Why this works**:
- ✅ Restores read functionality (calls `get_local_address()`)
- ✅ Write functionality preserved (handled in `update()` method)
- ✅ No breaking changes to Epic #116 features

### Deployment

**Automated Fix**:
```bash
/tmp/apply_django_fix.sh
```

**Manual Fix**:
```bash
ssh root@172.105.71.207
nano /home/manager/socialism/membership/serializers.py
# Find line ~127, change DictField to SerializerMethodField
sudo systemctl restart socialism
```

**Verification**:
```bash
DJANGO_API_TOKEN=$(gcloud secrets versions access latest --secret=django-api-token --project=ekklesia-prod-10-2025)

curl -s -H "Authorization: Token $DJANGO_API_TOKEN" \
  "https://starf.sosialistaflokkurinn.is/felagar/api/full/813/" \
  | python3 -c "import json, sys; print(json.load(sys.stdin)['local_address'])"

# Expected: {"street": "Gullengi", "number": 37, "postal_code": 112, "city": "Reykjavík"}
# Broken:   None
```

### Post-Fix Actions

After deploying fix:

1. **Re-sync members**: Visit https://ekklesia-prod-10-2025.web.app/admin/sync-members.html
2. **Verify Firestore**: Check that members now have addresses
3. **Test member portal**: Login and verify address displays
4. **Update documentation**: Mark bug as resolved

### Documentation

**Comprehensive Bug Analysis**: `/tmp/ADDRESS_SYNC_BUG_ANALYSIS.md`
**Deep Dive Documentation**: `docs/integration/DJANGO_ADDRESS_SYSTEM_DEEP_DIVE.md`

### Lessons Learned

1. **Never change SerializerMethodField to DictField** without verifying model has the attribute
2. **Test both READ and WRITE** after serializer changes
3. **Check Firestore sync** after Django API changes
4. **Document breaking changes** explicitly in commit messages

---

**Status**: ✅ Django API upgrade complete with address sync bug RESOLVED
**Date Completed**: 2025-10-28
**Bug Discovered**: 2025-10-31
**Fix Deployed**: 2025-10-31 16:38 UTC
**Fix Verified**: 2025-10-31 16:40 UTC (tested 100 members, 96 have addresses)
**Next Task**: Re-sync members to Firestore, then Member Detail Page (Issue #136)
