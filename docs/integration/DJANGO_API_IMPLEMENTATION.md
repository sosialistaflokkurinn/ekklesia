# Django API Implementation for Epic #43

**Document Type**: Implementation Guide
**Last Updated**: 2025-10-26
**Status**: 🔧 In Progress
**Purpose**: Step-by-step guide to implement `/api/members/full/` endpoint in Django

---

## Overview

We need to create a new Django REST Framework API endpoint that returns **full member data including SSN (kennitala)** for syncing to Ekklesia Firestore.

**Endpoint**: `/api/members/full/`
**Method**: GET (read-only)
**Authentication**: Token (staff/admin only)
**Response**: Paginated JSON with all member data

---

## Implementation Steps

### Step 1: Add New Serializer (serializers.py)

**File**: `/home/manager/socialism/membership/serializers.py`

**Action**: Append the following to the END of the file:

```python
# =============================================================================
# Epic #43: Full Member Data Serializer (includes SSN - ADMIN ONLY!)
# =============================================================================

class AddressSerializer(serializers.Serializer):
    """Serialize address from map_address + map_street"""
    street = serializers.SerializerMethodField()
    number = serializers.SerializerMethodField()
    letter = serializers.SerializerMethodField()
    postal_code = serializers.SerializerMethodField()
    city = serializers.SerializerMethodField()

    def get_street(self, obj):
        try:
            if hasattr(obj, 'address') and obj.address:
                return obj.address.street.name
        except:
            pass
        return None

    def get_number(self, obj):
        try:
            if hasattr(obj, 'address') and obj.address:
                return obj.address.number
        except:
            pass
        return None

    def get_letter(self, obj):
        try:
            if hasattr(obj, 'address') and obj.address:
                return obj.address.letter if obj.address.letter else ''
        except:
            pass
        return ''

    def get_postal_code(self, obj):
        try:
            if hasattr(obj, 'address') and obj.address and obj.address.street:
                return obj.address.street.postal_code.code
        except:
            pass
        return None

    def get_city(self, obj):
        try:
            if hasattr(obj, 'address') and obj.address and obj.address.street:
                return obj.address.street.municipality.name
        except:
            pass
        return None


class ComradeFullSerializer(serializers.ModelSerializer):
    """
    Full member serializer for Epic #43 sync

    WARNING: Includes SSN (kennitala) - ADMIN/STAFF ONLY!
    This serializer should ONLY be used for the sync API endpoint.
    """
    unions = UnionSerializer(source='union_memberships', many=True, read_only=True)
    titles = TitleSerializer(many=True, read_only=True)
    contact_info = ContactInfoSerializer(read_only=True)
    local_address = serializers.SerializerMethodField()
    foreign_addresses = NewForeignAddressSerializer(many=True, read_only=True)

    class Meta:
        model = Comrade
        fields = (
            'id',
            'name',
            'ssn',  # ⚠️ SENSITIVE - kennitala included!
            'birthday',
            'date_joined',
            'reachable',
            'groupable',
            'housing_situation',
            'gender',
            'contact_info',
            'unions',
            'titles',
            'local_address',
            'foreign_addresses',
        )

    def get_local_address(self, obj):
        """Get primary local address (Iceland)"""
        try:
            local_addr = obj.local_addresses.filter(current=True).first()
            if local_addr:
                return AddressSerializer(local_addr).data
        except:
            pass
        return None
```

---

### Step 2: Create API ViewSet (views.py)

**File**: `/home/manager/socialism/membership/views.py`

**Action**: Append the following to the END of the file:

```python
# =============================================================================
# Epic #43: Full Member Data API (includes SSN - ADMIN ONLY!)
# =============================================================================

from rest_framework import viewsets, permissions
from rest_framework.authentication import TokenAuthentication
from rest_framework.pagination import PageNumberPagination


class IsStaffUser(permissions.BasePermission):
    """
    Custom permission: Only allow staff/admin users
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class MemberFullPagination(PageNumberPagination):
    """Pagination for member sync (100 per page)"""
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 500


class ComradeFullViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for full member data sync (Epic #43)

    ⚠️  WARNING: This endpoint includes SSN (kennitala) - SENSITIVE DATA!

    Authentication: Token authentication required
    Permission: Staff/admin users only

    Usage:
        GET /api/members/full/          - List all members (paginated)
        GET /api/members/full/{id}/     - Get single member by ID
        GET /api/members/full/?page=2   - Get page 2

    Example:
        curl -H "Authorization: Token YOUR_TOKEN_HERE" \\
             https://your-domain.com/api/members/full/
    """
    queryset = Comrade.objects.all().select_related(
        'contact_info',
    ).prefetch_related(
        'union_memberships',
        'titles',
        'local_addresses__address__street__postal_code',
        'local_addresses__address__street__municipality',
        'foreign_addresses',
    ).order_by('id')

    serializer_class = ComradeFullSerializer
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsStaffUser]
    pagination_class = MemberFullPagination

    def get_queryset(self):
        """
        Optionally filter by date_joined to get only recent changes
        """
        queryset = super().get_queryset()

        # Optional filter: ?since=2025-01-01
        since = self.request.query_params.get('since', None)
        if since:
            queryset = queryset.filter(date_joined__gte=since)

        return queryset
```

---

### Step 3: Add URL Route (urls.py)

**File**: `/home/manager/socialism/membership/urls.py`

**Action**: Update the file to add the new route.

**Current content** (check first):
```bash
ssh root@172.105.71.207 "cat /home/manager/socialism/membership/urls.py"
```

**New content** (replace entire file):
```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

# Django REST Framework router
router = DefaultRouter()
router.register(r'full', views.ComradeFullViewSet, basename='comrade-full')

urlpatterns = [
    # Existing membership URLs (keep these)
    path('skraning/', views.registration, name='registration'),
    path('api_skraning/', views.api_registration, name='api_registration'),
    path('stillingar/', views.settings, name='settings'),
    path('api_stillingar/', views.api_settings, name='api_settings'),

    # NEW: Epic #43 API endpoint
    path('api/', include(router.urls)),
]
```

---

### Step 4: Update Main URLs (socialism/urls.py)

**File**: `/home/manager/socialism/socialism/urls.py`

**Action**: Verify that membership URLs are included. If not present, add:

```python
path('membership/', include('membership.urls')),
```

**Full endpoint will be**: `https://your-domain.com/membership/api/full/`

---

### Step 5: Create API Token for Ekklesia Sync

**Via Django Shell**:

```bash
cd /home/manager/socialism
sudo -u manager venv/bin/python manage.py shell
```

```python
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

# Option 1: Use existing superuser
user = User.objects.filter(is_staff=True, is_superuser=True).first()

# Option 2: Create new user for Ekklesia sync
# user = User.objects.create_user(
#     username='ekklesia_sync',
#     email='tech@example.is',
#     is_staff=True,
#     is_active=True
# )
# user.set_unusable_password()  # No password login, token only
# user.save()

# Create token
token, created = Token.objects.get_or_create(user=user)
print(f"Token for {user.username}: {token.key}")
print(f"User is_staff: {user.is_staff}")
print(f"User is_active: {user.is_active}")
```

**Save the token** - you'll need it for Ekklesia Cloud Function!

---

### Step 6: Test the API Endpoint

**Local Test** (from Django server):

```bash
# Get the token from Step 5
export TOKEN="your-token-here"

# Test API endpoint
curl -H "Authorization: Token $TOKEN" \\
     http://localhost:8000/membership/api/full/ \\
     | python -m json.tool | head -50

# Test single member
curl -H "Authorization: Token $TOKEN" \\
     http://localhost:8000/membership/api/full/1/ \\
     | python -m json.tool
```

**Remote Test** (from your machine):

```bash
export TOKEN="your-token-here"

curl -H "Authorization: Token $TOKEN" \\
     http://172.105.71.207/membership/api/full/ \\
     | jq '.' | head -50
```

**Expected Response**:
```json
{
  "count": 2200,
  "next": "http://172.105.71.207/membership/api/full/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "name": "Guðrún Jónsdóttir",
      "ssn": "0101012980",
      "birthday": "1998-01-01",
      "date_joined": "2023-05-15T14:30:00Z",
      "reachable": true,
      "groupable": true,
      "housing_situation": 1,
      "gender": 2,
      "contact_info": {
        "pk": 1,
        "phone": "+3547758493",
        "email": "gudrun@example.is",
        "facebook": ""
      },
      "unions": [
        {
          "id": 5,
          "name": "Verkalýðsfélag Reykjavíkur",
          "abbreviation": "VR",
          "logo": null
        }
      ],
      "titles": [
        {
          "id": 12,
          "name": "Hjúkrunarfræðingur"
        }
      ],
      "local_address": {
        "street": "Túngata",
        "number": 14,
        "letter": "",
        "postal_code": "101",
        "city": "Reykjavík"
      },
      "foreign_addresses": []
    }
  ]
}
```

---

## Security Checklist

Before deploying to production:

- [ ] ✅ Token authentication enabled
- [ ] ✅ `IsStaffUser` permission enforced (only admins can access)
- [ ] ✅ HTTPS enforced (Django `SECURE_SSL_REDIRECT = True`)
- [ ] ⚠️ **Rate limiting** (add `rest_framework.throttling`)
- [ ] ⚠️ **IP whitelist** (only allow Ekklesia Cloud Function IP)
- [ ] ⚠️ **Audit logging** (log all API calls with user + timestamp)

**Recommended settings.py additions**:

```python
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'user': '100/hour',  # Sync once per hour max
    },
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
}

# Force HTTPS
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
```

---

## Troubleshooting

### Error: "Authentication credentials were not provided"

**Cause**: Missing or invalid token

**Fix**: Check token format:
```bash
curl -H "Authorization: Token YOUR_TOKEN" ...
```

### Error: "You do not have permission to perform this action"

**Cause**: User is not staff

**Fix**: Make user staff:
```python
user = User.objects.get(username='your-username')
user.is_staff = True
user.save()
```

### Error: "Unable to import 'rest_framework'"

**Cause**: Django REST Framework not installed

**Fix**:
```bash
cd /home/manager/socialism
sudo -u manager venv/bin/pip install djangorestframework
sudo -u manager venv/bin/pip install djangorestframework-simplejwt
```

### Error: 500 Internal Server Error

**Check Django logs**:
```bash
sudo tail -f /var/log/nginx/error.log
# or wherever Django logs are located
```

---

## Rollback Plan

If something breaks:

1. **Revert serializers.py**:
```bash
cd /home/manager/socialism/membership
git diff serializers.py  # Check changes
git checkout serializers.py  # Revert if needed
```

2. **Revert views.py**:
```bash
git checkout views.py
```

3. **Revert urls.py**:
```bash
git checkout urls.py
```

4. **Restart Django**:
```bash
sudo systemctl restart gunicorn  # or whatever service manager
```

---

## Next Steps

After Django API is working:

1. **Phase 3**: Create Ekklesia Cloud Function to fetch from this API
2. **Phase 4**: Transform Django data → Firestore format
3. **Phase 5**: Create admin UI in Ekklesia
4. **Phase 6**: Test end-to-end sync

---

## Related Documentation

- [DJANGO_DATABASE_SCHEMA.md](DJANGO_DATABASE_SCHEMA.md) - Database structure
- [EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md](../features/election-voting/EPIC_43_MEMBER_MANAGEMENT_SYSTEM.md) - Epic specification

---

**Last Updated**: 2025-10-26
**Status**: ✅ Deployed Successfully
**Endpoint**: https://starf.sosialistaflokkurinn.is/felagar/api/full/
**Next Action**: Build sync Cloud Function (Epic #43 Phase 3)

---

## Deployment Summary (2025-10-26)

### ✅ Successfully Deployed

**API Endpoint**: `https://starf.sosialistaflokkurinn.is/felagar/api/full/`

**Changes Applied**:
1. Added `ComradeFullSerializer` to `/home/manager/socialism/membership/serializers.py`
   - Includes SSN (kennitala) field - SENSITIVE DATA
   - Nested serializers for unions, titles, contact_info, addresses

2. Added API views to `/home/manager/socialism/membership/views.py`
   - `ComradeFullViewSet` (ReadOnlyModelViewSet)
   - `IsStaffUser` permission (staff/admin only)
   - `MemberFullPagination` (100 per page)
   - Token authentication required

3. Updated `/home/manager/socialism/membership/urls.py`
   - Added REST framework router for `/api/full/` endpoint
   - Preserved all existing URL patterns

4. Created API token: `<REDACTED - stored in Secret Manager>`
   - User: superuser (ID 25)
   - Permissions: staff=True, superuser=True

**Test Results**:
```bash
curl -H "Authorization: Token <DJANGO_API_TOKEN>" \
     https://starf.sosialistaflokkurinn.is/felagar/api/full/
```

Response:
- ✅ 200 OK
- ✅ 2,200 members total
- ✅ Pagination working (100 per page)
- ✅ SSN included in response
- ✅ All nested data correctly serialized
- ✅ Token authentication working

**Backups Created**:
- `/home/manager/socialism/membership/serializers.py.backup`
- `/home/manager/socialism/membership/views.py.backup`
- `/home/manager/socialism/membership/urls.py.backup`

**Next Steps**:
1. Store API token in Google Secret Manager for Cloud Function access
2. Build Cloud Function to fetch data from this endpoint (Epic #43 Phase 3)
3. Transform Django data to Firestore format
4. Implement sync logic with delta detection
