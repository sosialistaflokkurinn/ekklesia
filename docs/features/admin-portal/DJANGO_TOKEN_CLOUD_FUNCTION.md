# Django Token Cloud Function - Epic #116

**Function Name**: `get_django_token`
**Type**: HTTP Cloud Function (Gen 2)
**Created**: 2025-10-28 (Commit d519da0b)
**Status**: ✅ Active - Required for Member Edit functionality
**Epic**: #116 - Members Admin UI
**Issue**: #137 - Member Edit Page

---

## Purpose

**WHY THIS EXISTS**: The admin portal needs to update member data in the Django backend, but the Django API token is a **SECRET** that cannot be exposed to the frontend JavaScript.

This Cloud Function acts as a **secure proxy** that:
1. Verifies the user is an admin/developer (checks Firebase custom claims)
2. Retrieves the Django API token from Secret Manager
3. Returns the token to the authenticated admin user

**Without this function**: Admin users cannot edit members because they have no way to authenticate with Django API.

---

## Security Model

### Problem Being Solved

```
❌ BAD: Exposing token in frontend
┌─────────────┐
│  Frontend   │
│   (public)  │ → Has Django token hardcoded → ❌ Anyone can steal it
└─────────────┘

✅ GOOD: Token in Cloud Function
┌─────────────┐      ┌──────────────────┐      ┌────────────────┐
│  Frontend   │  →   │  Cloud Function  │  →   │ Secret Manager │
│   (public)  │      │  (server-side)   │      │  (Django token)│
└─────────────┘      └──────────────────┘      └────────────────┘
                              ↑
                     Checks: Is user admin?
```

### Security Features

1. **Firebase Authentication Required**
   - Function checks `Authorization: Bearer <firebase-token>` header
   - Verifies token with Firebase Admin SDK
   - Returns 401 if token missing or invalid

2. **Role-Based Access Control (RBAC)**
   - Only users with `admin` or `developer` role can access
   - Roles stored in Firebase custom claims
   - Returns 403 if user lacks required role

3. **Secret Manager Integration**
   - Django token stored in `projects/ekklesia-prod-10-2025/secrets/django-api-token/versions/latest`
   - Token never exposed to frontend
   - Function retrieves token at request time

4. **CORS Protection**
   - Only allows requests from `https://ekklesia-prod-10-2025.web.app`
   - Blocks all other origins
   - Prevents CSRF attacks

5. **Audit Logging**
   - Logs every token access with user ID and email
   - Tracks who accessed Django API
   - Available in Cloud Logging

---

## How It Works

### Request Flow

```
1. Admin visits member-edit.html page
2. JavaScript calls getDjangoToken() in django-api.js
3. Function receives request with Firebase auth token
4. Function verifies Firebase token → Gets user ID
5. Function checks custom claims → Verifies admin/developer role
6. Function queries Secret Manager → Gets Django token
7. Function returns Django token to frontend
8. Frontend uses token to call Django API
9. Django API updates member data
```

### Code Example (Frontend)

```javascript
// apps/members-portal/admin/js/django-api.js

async function getDjangoToken() {
  const user = firebase.auth().currentUser;
  const idToken = await user.getIdToken(); // Firebase auth token

  const response = await fetch(
    'https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/get_django_token',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();
  return data.token; // Django API token
}
```

### Code Example (Function)

```python
# services/members/functions/get_django_token.py

def get_django_token(request):
    # 1. Check Firebase auth token
    id_token = request.headers.get('Authorization', '').split('Bearer ')[1]
    decoded_token = auth.verify_id_token(id_token)

    # 2. Check user roles
    roles = decoded_token.get('roles', [])
    if 'admin' not in roles and 'developer' not in roles:
        return jsonify({'error': 'Forbidden'}), 403

    # 3. Get Django token from Secret Manager
    secret_name = 'projects/ekklesia-prod-10-2025/secrets/django-api-token/versions/latest'
    response = secret_client.access_secret_version(request={'name': secret_name})
    django_token = response.payload.data.decode('utf-8')

    # 4. Return token
    return jsonify({'token': django_token}), 200
```

---

## Deployment

### Initial Deployment (Oct 28, 2025)

Created as part of Epic #116 member edit functionality.

**Deployment Command**:
```bash
cd services/members/functions
gcloud functions deploy get_django_token \
  --gen2 \
  --runtime=python312 \
  --region=europe-west2 \
  --source=. \
  --entry-point=get_django_token \
  --trigger-http \
  --allow-unauthenticated \
  --project=ekklesia-prod-10-2025
```

**Note**: `--allow-unauthenticated` is required because Firebase authentication is handled **inside** the function code (not by IAM). The function itself enforces authentication.

### Re-deployment (Oct 31, 2025)

Function was re-deployed to fix CORS issues after admin CSS refactoring deployment.

**Why re-deployment was needed**:
- `firebase deploy --only hosting` does **NOT** deploy cloud functions
- Old version of function had outdated CORS headers
- Frontend was getting CORS errors

**Lesson**: Always deploy functions separately or use `firebase deploy` without `--only` flag.

---

## Function URLs

**Cloud Functions URL**: https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/get_django_token
**Cloud Run URL**: https://get-django-token-ymzrguoifa-nw.a.run.app
**Console**: https://console.cloud.google.com/functions/details/europe-west2/get_django_token?project=ekklesia-prod-10-2025

---

## Testing

### Test with curl (requires Firebase token)

```bash
# 1. Get Firebase ID token (from browser console)
# Navigate to https://ekklesia-prod-10-2025.web.app
# Open console and run:
# firebase.auth().currentUser.getIdToken().then(token => console.log(token))

# 2. Test function
curl -X POST \
  https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/get_django_token \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "token": "your-django-token-here",
#   "expiresAt": null,
#   "message": "Token retrieved successfully"
# }
```

### Test Scenarios

| Test Case | Expected Result |
|-----------|----------------|
| No Authorization header | 401 Unauthorized |
| Invalid Firebase token | 401 Unauthorized |
| Valid token, but user is not admin | 403 Forbidden |
| Valid token, user is admin | 200 OK with Django token |
| Valid token, user is developer | 200 OK with Django token |
| CORS preflight (OPTIONS) | 204 No Content with CORS headers |

---

## Monitoring

### Cloud Logging

**Filter**:
```
resource.type="cloud_function"
resource.labels.function_name="get_django_token"
severity>=WARNING
```

**Log Events**:
- `getDjangoToken: Token provided to user {uid}` (INFO) - Success
- `getDjangoToken: Missing or invalid Authorization header` (WARNING) - Auth failure
- `getDjangoToken: Access denied for user {uid}` (WARNING) - RBAC failure
- `getDjangoToken: Token verification failed: {error}` (ERROR) - Firebase error
- `getDjangoToken: Error: {error}` (ERROR) - Unexpected error

### Metrics to Monitor

1. **Request count** - Should be low (admins only, occasional edits)
2. **Error rate** - Should be <1% (mostly auth failures from testing)
3. **Latency** - Should be <500ms (Secret Manager call)
4. **403 errors** - Non-admin users trying to access (security event)

**Alert if**:
- Error rate >10% for >5 minutes (function broken)
- Request rate >100/minute (potential abuse)
- Many 403s from same user (unauthorized access attempt)

---

## Troubleshooting

### Issue: CORS Error in Frontend

**Symptoms**:
```
Access to fetch at 'https://...get_django_token' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Cause**: Function not deployed or has old CORS headers

**Fix**:
```bash
cd services/members/functions
gcloud functions deploy get_django_token \
  --gen2 \
  --runtime=python312 \
  --region=europe-west2 \
  --source=. \
  --entry-point=get_django_token \
  --trigger-http \
  --allow-unauthenticated \
  --project=ekklesia-prod-10-2025
```

### Issue: 403 Forbidden Error

**Symptoms**: User gets 403 error when accessing function

**Cause**: User does not have `admin` or `developer` role

**Fix**:
```bash
# Check user roles
firebase auth:get 111111-1111 --project=ekklesia-prod-10-2025

# Set admin role
firebase auth:set-claims 111111-1111 '{"roles":["admin"]}' --project=ekklesia-prod-10-2025
```

### Issue: Function Returns 500 Error

**Symptoms**: Function returns "Internal Server Error"

**Possible Causes**:
1. Secret Manager API not enabled
2. Django token secret doesn't exist
3. Function service account lacks Secret Manager access

**Fix**:
```bash
# 1. Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com --project=ekklesia-prod-10-2025

# 2. Check secret exists
gcloud secrets versions access latest --secret=django-api-token --project=ekklesia-prod-10-2025

# 3. Grant access to service account
gcloud secrets add-iam-policy-binding django-api-token \
  --member="serviceAccount:521240388393-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=ekklesia-prod-10-2025
```

---

## Related Documentation

- **Epic #116**: [EPIC_116_MEMBER_DETAIL_EDIT_PLAN.md](EPIC_116_MEMBER_DETAIL_EDIT_PLAN.md)
- **Django API Upgrade**: [docs/integration/DJANGO_API_UPGRADE_EPIC_116.md](../../integration/DJANGO_API_UPGRADE_EPIC_116.md)
- **Secret Manager Setup**: Secret Manager setup (see GCP documentation)
- **Roles & Permissions**: [docs/development/guides/admin/ROLES_AND_PERMISSIONS.md](../../development/guides/admin/ROLES_AND_PERMISSIONS.md)

---

## Future Improvements

### Token Caching (Optional)

Currently, function fetches token from Secret Manager on **every request**. Could cache token in memory:

**Pros**:
- Faster response time (<50ms vs ~200ms)
- Reduced Secret Manager API calls

**Cons**:
- Token rotation requires redeploying function
- Slightly more complex code

**Recommendation**: Not needed now (low request volume), revisit if latency becomes issue.

### Token Expiration (Optional)

Django tokens don't expire by default. Could add expiration logic:

```python
return jsonify({
    'token': django_token,
    'expiresAt': int(time.time()) + 3600,  # 1 hour from now
    'message': 'Token retrieved successfully'
})
```

Frontend would need to refresh token when expired.

**Recommendation**: Not needed now (function already enforces auth on every call).

---

## Summary

**What**: Cloud Function that provides Django API token to authorized admins
**Why**: Keeps Django token secret, enables secure member editing
**Who**: Only users with `admin` or `developer` role
**Where**: https://europe-west2-ekklesia-prod-10-2025.cloudfunctions.net/get_django_token
**When**: Called by member-edit.html when admin needs to update member data

**Critical**: Without this function, admin member editing **DOES NOT WORK**. Do not delete!

---

**Created**: 2025-10-28 (d519da0b)
**Last Deployed**: 2025-10-31
**Status**: ✅ Active and Required
