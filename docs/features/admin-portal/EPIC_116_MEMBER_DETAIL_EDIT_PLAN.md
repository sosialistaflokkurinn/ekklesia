# Epic #116: Member Detail & Edit Pages Implementation Plan

**Document Type**: Implementation Plan
**Created**: 2025-10-28
**Status**: 📋 Planning
**Epic**: #116 - Members Admin UI
**Related Issues**: #122 (Detail), #123 (Edit), #124 (Create)

---

## Overview

This plan outlines how to implement the "Skoða" (View/Detail) and "Breyta" (Edit) buttons on the members list page. These pages will:

1. **Member Detail Page** (`member-detail.html`): Read-only view of member information
2. **Member Edit Page** (`member-edit.html`): Form to update member information via Django API

---

## Current State Analysis

### ✅ What We Have

1. **Members List Page** (`apps/members-portal/admin/members.html`):
   - Shows 2,118 members from Firestore
   - Search functionality (loads all members)
   - Filter by status (active/inactive)
   - Pagination
   - "Skoða" and "Breyta" buttons (not functional yet)

2. **Firestore Members Collection**:
   - Document ID: kennitala (e.g., `3009805039`)
   - Structure (from Django sync):
     ```json
     {
       "profile": {
         "kennitala": "3009805039",
         "name": "Andri Sigurðsson",
         "email": "email@example.com",
         "phone": "1234567",
         "birthday": "1980-09-30"
       },
       "membership": {
         "status": "active",
         "joined": "2020-01-15",
         "membership_type": "regular"
       },
       "address": {
         "street": "Laugavegur",
         "number": "123",
         "postal_code": "101",
         "city": "Reykjavík"
       },
       "metadata": {
         "synced_at": "2025-10-28T10:00:00Z",
         "django_id": 3445
       }
     }
     ```

3. **Django API** (at `http://172.105.71.207/felagar/api/full/`):
   - **GET /felagar/api/full/**: List all members (paginated)
   - **GET /felagar/api/full/{id}/**: Get single member by Django ID
   - **Authentication**: Token-based (`DJANGO_API_TOKEN`)
   - **Permissions**: Staff/admin only

4. **Django Data Model** (from `membership/models.py`):
   ```python
   class Comrade:
       id (integer, primary key)
       name (string)
       ssn (kennitala, string)
       birthday (date)
       # ... other fields
   ```

### ❌ What We Don't Have

1. **PUT/PATCH endpoint** in Django for updating members
2. **Member detail page** HTML/JS
3. **Member edit page** HTML/JS with form
4. **Validation** for edit form (client-side and server-side)
5. **Error handling** for failed updates
6. **Audit logging** for member changes (Firestore trigger exists, but Django needs it too)

---

## Architecture Decision: Where to Store Data?

### Option A: Firestore as Source of Truth (Read from Firestore, Write to Django)

**Flow:**
```
User clicks "Breyta"
→ Load member from Firestore (fast, already synced)
→ User edits form
→ Submit changes to Django API (PUT /api/members/{id})
→ Django updates database
→ Next hourly sync updates Firestore
```

**Pros:**
- Fast page load (Firestore is already loaded)
- Consistent with members list (same data source)
- Works offline-ish (can view even if Django is down)

**Cons:**
- Stale data risk (Firestore syncs hourly)
- Two sources of truth during sync window
- Complex conflict resolution if user edits during sync

### Option B: Django as Source of Truth (Always Fetch from Django)

**Flow:**
```
User clicks "Breyta"
→ Fetch member from Django API (GET /api/members/{django_id})
→ User edits form
→ Submit changes to Django API (PUT /api/members/{id})
→ Django updates database
→ Return success
→ Next hourly sync updates Firestore
```

**Pros:**
- Always fresh data (no stale data)
- Single source of truth (Django)
- Simpler conflict resolution

**Cons:**
- Slower page load (network request to Django)
- Requires Django to be available
- Additional API call

### 🎯 Recommended: **Option B (Django as Source of Truth)**

**Reasoning:**
1. **Data accuracy**: When editing, we want the freshest data
2. **Audit trail**: Django needs to know about edits for compliance
3. **Single source of truth**: Django is the master database
4. **Firestore is a cache**: Hourly sync makes Firestore a read-optimized cache

**Implementation:**
- Member detail page: Fetch from Firestore (fast, good UX)
- Member edit page: Fetch from Django (accurate, prevents stale edits)

---

## Implementation Plan

### Phase 1: Member Detail Page (Issue #122) - 4 hours

**Objective**: Read-only view of member information

#### Files to Create:
1. `apps/members-portal/admin/member-detail.html`
2. `apps/members-portal/admin/js/member-detail.js`
3. `apps/members-portal/admin/styles/member-detail.css`

#### Data Source:
- **Firestore** (fast, already synced)
- URL: `/admin/member-detail.html?id={kennitala}`
- Load from Firestore: `doc(db, 'members', kennitala)`

#### UI Layout:
```
┌─────────────────────────────────────────┐
│ ← Til baka til félaga                   │
├─────────────────────────────────────────┤
│ Félagsupplýsingar                       │
│                                         │
│ [Breyta félaga]                         │
├─────────────────────────────────────────┤
│ Grunnupplýsingar                        │
│ ├─ Nafn: Andri Sigurðsson              │
│ ├─ Kennitala: 300980-****              │
│ ├─ Netfang: email@example.com          │
│ ├─ Sími: 1234567                       │
│ └─ Fæðingardagur: 30. september 1980   │
│                                         │
│ Heimilisfang                            │
│ ├─ Gata: Laugavegur 123                │
│ ├─ Póstnúmer: 101                       │
│ └─ Staður: Reykjavík                    │
│                                         │
│ Félagsaðild                             │
│ ├─ Staða: Virkur                        │
│ ├─ Gerð: Venjulegur félagi              │
│ └─ Skráður: 15. janúar 2020            │
│                                         │
│ Kerfisgögn                              │
│ ├─ Django ID: 3445                      │
│ └─ Síðast samstillt: 28. okt 2025      │
└─────────────────────────────────────────┘
```

#### Implementation Steps:
1. Create HTML structure with BEM CSS
2. Add navigation back to members list
3. Fetch member from Firestore by kennitala (from URL param)
4. Display all fields in read-only format
5. Add "Breyta félaga" button → redirects to edit page
6. Add loading/error/not-found states
7. Add i18n strings to `admin/i18n/values-is/strings.xml`

#### Error Handling:
- Member not found: Show "Félagi fannst ekki" message
- Firestore error: Show retry button
- Invalid kennitala in URL: Redirect to members list

---

### Phase 2: Django API Update Endpoint - 6 hours

**Objective**: Create PUT/PATCH endpoint in Django to update member data

#### Django Files to Modify:
1. `/home/manager/socialism/membership/views.py`
2. `/home/manager/socialism/membership/serializers.py` (if needed)
3. `/home/manager/socialism/membership/urls.py` (if needed)

#### Current Django API:
```python
# membership/views.py (Epic #43)
class ComradeFullViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Comrade.objects.all()
    serializer_class = ComradeFullSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
```

**Problem**: This is **ReadOnlyModelViewSet** - no PUT/PATCH support!

#### Solution: Upgrade to Full ModelViewSet

**Change in `membership/views.py`:**
```python
class ComradeFullViewSet(viewsets.ModelViewSet):  # Changed from ReadOnlyModelViewSet
    """
    API endpoint for full member CRUD operations

    Epic #43: Sync (GET list, GET detail)
    Epic #116: Admin UI (PUT/PATCH update)

    PERMISSIONS: Staff/admin only (includes SSN)
    """
    queryset = Comrade.objects.all()
    serializer_class = ComradeFullSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def update(self, request, *args, **kwargs):
        """Update member (PUT/PATCH)"""
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Audit log (before update)
        old_data = ComradeFullSerializer(instance).data

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # Audit log (after update)
        new_data = serializer.data
        self._log_member_update(request.user, instance, old_data, new_data)

        return Response(serializer.data)

    def _log_member_update(self, user, member, old_data, new_data):
        """Log member update to django_admin_log"""
        from django.contrib.admin.models import LogEntry, CHANGE
        from django.contrib.contenttypes.models import ContentType

        # Calculate changed fields
        changes = []
        for field in ['name', 'email', 'phone', 'birthday', 'status']:
            if old_data.get(field) != new_data.get(field):
                changes.append(f"{field}: {old_data.get(field)} → {new_data.get(field)}")

        change_message = f"Updated via Epic #116 Admin UI: {', '.join(changes)}"

        LogEntry.objects.log_action(
            user_id=user.id,
            content_type_id=ContentType.objects.get_for_model(member).pk,
            object_id=member.id,
            object_repr=str(member),
            action_flag=CHANGE,
            change_message=change_message
        )
```

#### Testing the Endpoint:
```bash
# Test PUT (full update)
curl -X PUT http://172.105.71.207/felagar/api/full/3445/ \
  -H "Authorization: Token ${DJANGO_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Andri Sigurðsson",
    "ssn": "3009805039",
    "email": "newemail@example.com",
    "phone": "9876543"
  }'

# Test PATCH (partial update)
curl -X PATCH http://172.105.71.207/felagar/api/full/3445/ \
  -H "Authorization: Token ${DJANGO_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newemail@example.com"
  }'
```

#### Validation Rules:
- **SSN**: Cannot be changed (read-only field)
- **Name**: Required, max 100 chars
- **Email**: Optional, must be valid email format
- **Phone**: Optional, 7-8 digits
- **Birthday**: Optional, valid date format (YYYY-MM-DD)

#### Error Responses:
- **400 Bad Request**: Validation error (e.g., invalid email)
- **401 Unauthorized**: Missing or invalid token
- **403 Forbidden**: User is not staff/admin
- **404 Not Found**: Member ID doesn't exist
- **500 Internal Server Error**: Database error

---

### Phase 3: Member Edit Page (Issue #123) - 8 hours

**Objective**: Form to edit member information

#### Files to Create:
1. `apps/members-portal/admin/member-edit.html`
2. `apps/members-portal/admin/js/member-edit.js`
3. `apps/members-portal/admin/js/api/django-api.js` (Django API client)

#### Data Flow:
```
1. Page loads → Fetch member from Django API
   GET http://172.105.71.207/felagar/api/full/{django_id}/

2. Display form with current values

3. User edits fields → Validate client-side

4. User clicks "Vista" → Submit to Django API
   PATCH http://172.105.71.207/felagar/api/full/{django_id}/

5. Success → Redirect to member detail page
   Error → Show error message, keep form data
```

#### UI Layout:
```
┌─────────────────────────────────────────┐
│ ← Til baka                              │
├─────────────────────────────────────────┤
│ Breyta félaga                           │
│                                         │
│ Grunnupplýsingar                        │
│ ├─ Nafn: [___________________]          │
│ ├─ Kennitala: 300980-**** (læst)       │
│ ├─ Netfang: [___________________]      │
│ ├─ Sími: [___________________]         │
│ └─ Fæðingardagur: [__________]         │
│                                         │
│ Heimilisfang                            │
│ ├─ Gata: [___________________]         │
│ ├─ Húsnúmer: [____]                    │
│ ├─ Póstnúmer: [____]                   │
│ └─ Staður: [___________________]       │
│                                         │
│ Félagsaðild                             │
│ ├─ Staða: [Dropdown: Virkur/Óvirkur]   │
│ └─ Gerð: [Dropdown: Venjulegur/...]    │
│                                         │
│ [Hætta við]  [Vista breytingar]        │
└─────────────────────────────────────────┘
```

#### Form Fields:

| Field | Type | Required | Validation | Editable |
|-------|------|----------|------------|----------|
| Nafn | text | Yes | Max 100 chars | ✅ |
| Kennitala | text | Yes | 10 digits | ❌ (locked) |
| Netfang | email | No | Valid email | ✅ |
| Sími | tel | No | 7-8 digits | ✅ |
| Fæðingardagur | date | No | Valid date | ✅ |
| Gata | text | No | Max 100 chars | ✅ |
| Húsnúmer | text | No | Max 10 chars | ✅ |
| Póstnúmer | text | No | 3 digits | ✅ |
| Staður | text | No | Max 50 chars | ✅ |
| Staða | select | Yes | active/inactive | ✅ |
| Gerð | select | Yes | regular/honorary/... | ✅ |

#### Client-Side Validation:
```javascript
function validateMemberForm(formData) {
  const errors = {};

  // Name (required)
  if (!formData.name || formData.name.trim().length === 0) {
    errors.name = 'Nafn er nauðsynlegt';
  } else if (formData.name.length > 100) {
    errors.name = 'Nafn má ekki vera lengra en 100 stafir';
  }

  // Email (optional, but must be valid if provided)
  if (formData.email && !isValidEmail(formData.email)) {
    errors.email = 'Ógilt netfang';
  }

  // Phone (optional, but must be 7-8 digits if provided)
  if (formData.phone && !/^[0-9]{7,8}$/.test(formData.phone)) {
    errors.phone = 'Símanúmer verður að vera 7-8 tölustafir';
  }

  // Postal code (optional, but must be 3 digits if provided)
  if (formData.postal_code && !/^[0-9]{3}$/.test(formData.postal_code)) {
    errors.postal_code = 'Póstnúmer verður að vera 3 tölustafir';
  }

  return Object.keys(errors).length === 0 ? null : errors;
}
```

#### Django API Client (`js/api/django-api.js`):
```javascript
/**
 * Django API Client - Epic #116
 *
 * Handles communication with Django backend for member CRUD operations.
 */

const DJANGO_API_BASE = 'http://172.105.71.207/felagar/api/full';

const DjangoAPI = {
  /**
   * Get single member by Django ID
   */
  async getMember(djangoId) {
    const response = await fetch(`${DJANGO_API_BASE}/${djangoId}/`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${await getDjangoToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch member: ${response.status}`);
    }

    return await response.json();
  },

  /**
   * Update member (PATCH - partial update)
   */
  async updateMember(djangoId, data) {
    const response = await fetch(`${DJANGO_API_BASE}/${djangoId}/`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Token ${await getDjangoToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || `Failed to update member: ${response.status}`);
    }

    return await response.json();
  }
};

/**
 * Get Django API token from Firebase Cloud Function
 * (Token is stored in Secret Manager, accessed via Cloud Function)
 */
async function getDjangoToken() {
  // Option A: Store in Firebase Cloud Function secret
  const response = await fetch('https://us-central1-ekklesia-prod-10-2025.cloudfunctions.net/getDjangoToken');
  const data = await response.json();
  return data.token;

  // Option B: Pass through Firebase user custom claims (if stored there)
  // const user = firebase.auth().currentUser;
  // const token = await user.getIdTokenResult();
  // return token.claims.django_token;
}

export default DjangoAPI;
```

#### Error Handling:
```javascript
async function handleMemberUpdate(djangoId, formData) {
  try {
    // Show loading
    showLoading('Vista breytingar...');

    // Validate client-side
    const validationErrors = validateMemberForm(formData);
    if (validationErrors) {
      showValidationErrors(validationErrors);
      return;
    }

    // Submit to Django API
    const result = await DjangoAPI.updateMember(djangoId, formData);

    // Success - redirect to detail page
    window.location.href = `/admin/member-detail.html?id=${result.ssn}`;

  } catch (error) {
    console.error('Failed to update member:', error);

    // Parse error response
    if (error.message.includes('400')) {
      showError('Ógilt form - athugaðu innslátt');
    } else if (error.message.includes('401')) {
      showError('Þú ert ekki innskráð/ur');
    } else if (error.message.includes('403')) {
      showError('Þú hefur ekki réttindi til að breyta þessum félaga');
    } else if (error.message.includes('404')) {
      showError('Félagi fannst ekki');
    } else {
      showError('Villa kom upp - reyndu aftur síðar');
    }
  } finally {
    hideLoading();
  }
}
```

---

### Phase 4: Security & Authentication - 2 hours

**Objective**: Secure Django API token access

#### Problem:
The Django API token (`DJANGO_API_TOKEN`) is currently stored in Secret Manager and used by Cloud Functions. We need to give the admin UI access to this token **without exposing it in client-side JavaScript**.

#### Solution A: Cloud Function Proxy (Recommended)

**Create new Cloud Function**: `getDjangoToken`

```javascript
// functions/get-django-token.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.getDjangoToken = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  // Check admin role
  const user = await admin.auth().getUser(context.auth.uid);
  const roles = user.customClaims?.roles || [];
  const hasAdminAccess = roles.includes('admin') || roles.includes('developer');

  if (!hasAdminAccess) {
    throw new functions.https.HttpsError('permission-denied', 'Must be admin or developer');
  }

  // Get token from Secret Manager
  const {SecretManagerServiceClient} = require('@google-cloud/secret-manager');
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: 'projects/ekklesia-prod-10-2025/secrets/django-api-token/versions/latest'
  });

  const token = version.payload.data.toString('utf8');

  return { token };
});
```

**Client-side usage:**
```javascript
// js/api/django-api.js
import { getFunctions, httpsCallable } from 'firebase/functions';

async function getDjangoToken() {
  const functions = getFunctions();
  const getDjangoTokenFn = httpsCallable(functions, 'getDjangoToken');
  const result = await getDjangoTokenFn();
  return result.data.token;
}
```

**Pros:**
- ✅ Token never exposed to client
- ✅ Role-based access control enforced
- ✅ Audit trail (Cloud Function logs)

**Cons:**
- ❌ Extra network request (adds ~200ms latency)
- ❌ Requires deploying new Cloud Function

#### Solution B: Pass Token via Firebase Custom Claims (Less Secure)

**Not recommended** - would expose Django token in JWT claims visible in client.

#### 🎯 Recommended: **Solution A (Cloud Function Proxy)**

---

### Phase 5: Testing & Validation - 4 hours

**Test Scenarios:**

#### 1. Member Detail Page Tests
- ✅ Load member that exists → Shows correct data
- ✅ Load member that doesn't exist → Shows "Félagi fannst ekki"
- ✅ Invalid kennitala in URL → Redirects to members list
- ✅ Click "Breyta félaga" → Redirects to edit page
- ✅ Kennitala is masked (300980-****)

#### 2. Member Edit Page Tests
- ✅ Load member from Django → Shows correct data in form
- ✅ Submit valid data → Saves and redirects
- ✅ Submit invalid email → Shows validation error
- ✅ Submit invalid phone → Shows validation error
- ✅ Try to edit kennitala → Field is disabled
- ✅ Django API returns 400 → Shows error message
- ✅ Django API returns 403 → Shows permission error
- ✅ Network error → Shows retry button

#### 3. Django API Tests
- ✅ GET /api/full/{id}/ → Returns member data
- ✅ PATCH /api/full/{id}/ with valid data → Updates member
- ✅ PATCH /api/full/{id}/ with invalid email → Returns 400
- ✅ PATCH /api/full/{id}/ without auth → Returns 401
- ✅ PATCH /api/full/{id}/ as non-admin → Returns 403
- ✅ Audit log created after update → Check django_admin_log table

#### 4. Security Tests
- ✅ Non-admin user cannot access edit page → 403 error
- ✅ Django token not visible in client JS → Check Network tab
- ✅ Django token requested only when needed → Check logs
- ✅ CORS allows Ekklesia domain → Check preflight requests

---

## Timeline & Effort Estimate

| Phase | Description | Estimated Time | Priority |
|-------|-------------|----------------|----------|
| 1 | Member Detail Page | 4 hours | High |
| 2 | Django API Update Endpoint | 6 hours | High |
| 3 | Member Edit Page | 8 hours | High |
| 4 | Security & Auth (Cloud Function) | 2 hours | High |
| 5 | Testing & Validation | 4 hours | Medium |
| **Total** | | **24 hours** (~3 days) | |

---

## Dependencies

### External Dependencies:
1. **Django backend must be available** (http://172.105.71.207)
2. **DJANGO_API_TOKEN must be in Secret Manager** (already done ✅)
3. **Django API must support PUT/PATCH** (needs implementation)

### Internal Dependencies:
1. **Issue #120 complete** (Members List Page) ✅
2. **Issue #117 complete** (Firestore rules) ✅
3. **Issue #118 complete** (Firestore indexes) ✅

---

## Related Issues & Documents

- **Epic #116**: Members Admin UI (parent epic)
- **Issue #120**: Members List Page (completed)
- **Issue #122**: Member Detail Page (this plan)
- **Issue #123**: Member Edit Page (this plan)
- **Issue #124**: Member Create Page (future)
- **Epic #43**: Membership Sync (Django → Firestore hourly sync)
- **Document**: `docs/integration/DJANGO_API_IMPLEMENTATION.md`

---

## Open Questions

1. **Q**: Should we update Firestore immediately after Django update, or wait for hourly sync?
   - **A**: Wait for hourly sync (simpler, Firestore is a cache)

2. **Q**: What if user edits member at same time as hourly sync runs?
   - **A**: Last write wins (Django API update overwrites, next sync overwrites Firestore)

3. **Q**: Should we allow deleting members?
   - **A**: No - soft delete only (set status to "inactive")

4. **Q**: Should we track edit history in Firestore?
   - **A**: No - use Django's django_admin_log table (already exists)

5. **Q**: What about address autocomplete (Icelandic postal codes)?
   - **A**: Phase 2 feature - manual entry for now

---

## Next Steps

1. ✅ Review this plan with stakeholders
2. Create GitHub issues:
   - Issue #122: Member Detail Page
   - Issue #123: Member Edit Page
   - Issue #124: Django API Update Endpoint
3. Implement Django API changes first (blocks frontend work)
4. Implement member detail page (read-only, low risk)
5. Implement member edit page (high value, needs testing)

---

**Last Updated**: 2025-10-28
**Status**: 📋 Ready for implementation
**Next Action**: Create GitHub issues and start Django API work
