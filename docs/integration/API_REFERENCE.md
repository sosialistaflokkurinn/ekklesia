# API Reference Documentation

**Base URL**: https://starf.sosialistaflokkurinn.is/felagar  
**Version**: 1.0  
**Authentication**: Token-based  
**Last Updated**: November 5, 2025

## 🎯 Overview

The Ekklesia API provides RESTful endpoints for bi-directional synchronization between Django and Firestore. All endpoints require authentication via API token.

**Available Endpoints:**
1. `GET /api/sync/pending/` - Get pending Django changes
2. `POST /api/sync/apply/` - Apply Firestore changes to Django
3. `POST /api/sync/mark-synced/` - Mark changes as synced
4. `GET /api/sync/status/` - Get sync statistics
5. `GET /api/sync/member/<ssn>/` - Get member by SSN

## 🔐 Authentication

### Token Authentication

All API requests must include an authentication token in the `Authorization` header.

**Header Format:**
```
Authorization: Token <your-token-here>
```

**Example:**
```bash
curl -H "Authorization: Token abc123def456" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/
```

### Getting a Token

**Django Admin:**
1. Login to Django admin
2. Navigate to Auth Tokens
3. Create or retrieve token for sync user

**Django Shell:**
```python
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User

user = User.objects.get(username='sync_user')
token, created = Token.objects.get_or_create(user=user)
print(f"Token: {token.key}")
```

### Token Storage

**GCP Secret Manager:**
```bash
# Store token
echo -n "your-token-here" | gcloud secrets create django-api-token --data-file=-

# Retrieve token
gcloud secrets versions access latest --secret=django-api-token
```

## 📡 Endpoints

### 1. GET /api/sync/pending/

Get pending changes from Django that need to sync to Firestore.

**Authentication**: Required

**Query Parameters:**
- `since` (optional) - ISO 8601 timestamp to get changes since this time

**Request:**
```bash
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/pending/?since=2025-11-04T00:00:00Z" \
  -H "Authorization: Token abc123def456"
```

**Response (200 OK):**
```json
{
  "changes": [
    {
      "id": 123,
      "ssn": "010190-3456",
      "action": "update",
      "fields_changed": {
        "email": "newemail@example.com",
        "phone": "+3545552222"
      },
      "timestamp": "2025-11-05T10:15:23Z"
    },
    {
      "id": 124,
      "ssn": "020290-1234",
      "action": "create",
      "fields_changed": {},
      "timestamp": "2025-11-05T11:20:00Z"
    },
    {
      "id": 125,
      "ssn": "030390-5678",
      "action": "delete",
      "fields_changed": {},
      "timestamp": "2025-11-05T12:30:00Z"
    }
  ],
  "count": 3,
  "since": "2025-11-04T00:00:00Z"
}
```

**Response Fields:**
- `changes` - Array of change objects
- `id` - Sync queue entry ID
- `ssn` - Member kennitala (with hyphen)
- `action` - Type of change: `create`, `update`, or `delete`
- `fields_changed` - Object with changed field values (for updates)
- `timestamp` - When change occurred
- `count` - Total number of changes
- `since` - Timestamp filter used

**Error Responses:**

**401 Unauthorized:**
```json
{
  "detail": "Invalid token."
}
```

**400 Bad Request:**
```json
{
  "error": "Invalid timestamp format. Use ISO 8601."
}
```

### 2. POST /api/sync/apply/

Apply changes from Firestore to Django database.

**Authentication**: Required

**Request Body:**
```json
{
  "changes": [
    {
      "kennitala": "010190-3456",
      "action": "update",
      "fields": {
        "email": "updated@example.com",
        "phone": "+3545553333"
      }
    },
    {
      "kennitala": "020290-1234",
      "action": "update",
      "fields": {
        "housing_situation": "rental",
        "address": {
          "street": "New Street 10",
          "postalcode": "200",
          "city": "Kópavogur"
        }
      }
    }
  ]
}
```

**Request:**
```bash
curl -X POST \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/apply/" \
  -H "Authorization: Token abc123def456" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [
      {
        "kennitala": "010190-3456",
        "action": "update",
        "fields": {
          "email": "updated@example.com"
        }
      }
    ]
  }'
```

**Response (200 OK):**
```json
{
  "results": [
    {
      "kennitala": "010190-3456",
      "status": "success",
      "message": "Member updated successfully"
    }
  ],
  "summary": {
    "total": 1,
    "success": 1,
    "failed": 0
  }
}
```

**Response with Failures:**
```json
{
  "results": [
    {
      "kennitala": "010190-3456",
      "status": "success",
      "message": "Member updated successfully"
    },
    {
      "kennitala": "999999-9999",
      "status": "failed",
      "message": "Member not found",
      "error": "DoesNotExist"
    }
  ],
  "summary": {
    "total": 2,
    "success": 1,
    "failed": 1
  }
}
```

**Field Mapping (Firestore → Django):**
```javascript
{
  // Direct mappings
  "name": "name",
  "email": "email",
  "phone": "phone",
  "birthday": "birthday",  // ISO date string
  
  // Enum mappings (string → integer)
  "gender": "gender",      // "male"→1, "female"→2, "other"→3
  "housing_situation": "housing_situation",  // See enum table
  
  // Address mappings
  "address.street": "street_address",
  "address.postalcode": "postal_code",
  "address.city": "city",
  
  // Boolean mappings
  "reachable": "reachable",
  "groupable": "groupable"
}
```

**Supported Actions:**
- `update` - Update existing member fields

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Missing required field: changes"
}
```

**401 Unauthorized:**
```json
{
  "detail": "Invalid token."
}
```

### 3. POST /api/sync/mark-synced/

Mark Django sync queue entries as successfully synced.

**Authentication**: Required

**Request Body:**
```json
{
  "ids": [123, 124, 125]
}
```

**Request:**
```bash
curl -X POST \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/mark-synced/" \
  -H "Authorization: Token abc123def456" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": [123, 124]
  }'
```

**Response (200 OK):**
```json
{
  "marked": 2,
  "ids": [123, 124]
}
```

**Response Fields:**
- `marked` - Number of entries marked as synced
- `ids` - Array of sync queue IDs that were updated

**Side Effects:**
- Sets `sync_status` to `"synced"`
- Sets `synced_at` to current timestamp

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Missing required field: ids"
}
```

**404 Not Found:**
```json
{
  "error": "No sync queue entries found with provided IDs"
}
```

### 4. GET /api/sync/status/

Get current synchronization statistics.

**Authentication**: Required

**Request:**
```bash
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/" \
  -H "Authorization: Token abc123def456"
```

**Response (200 OK):**
```json
{
  "sync_queue": {
    "pending": 1,
    "synced": 4,
    "failed": 0,
    "total": 5
  },
  "success_rate": 100.0,
  "last_sync": "2025-11-05T03:30:16Z",
  "oldest_pending": "2025-11-05T12:45:00Z"
}
```

**Response Fields:**
- `sync_queue.pending` - Number of pending changes
- `sync_queue.synced` - Number of synced changes
- `sync_queue.failed` - Number of failed changes
- `sync_queue.total` - Total entries in queue
- `success_rate` - Percentage of successful syncs
- `last_sync` - Timestamp of most recent sync
- `oldest_pending` - Timestamp of oldest unsynced change (null if none)

**Error Responses:**

**401 Unauthorized:**
```json
{
  "detail": "Invalid token."
}
```

### 5. GET /api/sync/member/<ssn>/

Get complete member data by SSN (kennitala).

**Authentication**: Required

**URL Parameters:**
- `ssn` - Member kennitala (with or without hyphen)

**Request:**
```bash
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/member/010190-3456/" \
  -H "Authorization: Token abc123def456"
```

**Response (200 OK):**
```json
{
  "ssn": "010190-3456",
  "name": "Jón Jónsson",
  "email": "jon@example.com",
  "phone": "+3545551234",
  "birthday": "1990-01-01",
  "gender": 1,
  "housing_situation": 2,
  "street_address": "Laugavegur 1",
  "postal_code": "101",
  "city": "Reykjavík",
  "reachable": true,
  "groupable": true,
  "membership_status": "active",
  "joined_date": "2020-01-15",
  "member_number": "M2020-001"
}
```

**Response Fields:**
- `ssn` - Kennitala with hyphen
- `name` - Full name
- `email` - Primary email
- `phone` - Phone number
- `birthday` - Birth date (ISO format: YYYY-MM-DD)
- `gender` - Integer: 0=unknown, 1=male, 2=female, 3=other
- `housing_situation` - Integer: 0=unknown, 1=owner, 2=rental, 3=cooperative, 4=family, 5=other, 6=homeless
- `street_address` - Street address
- `postal_code` - Postal code
- `city` - City name
- `reachable` - Boolean: can be contacted
- `groupable` - Boolean: can join working groups
- `membership_status` - String: "active", "inactive", "pending"
- `joined_date` - Date joined (ISO format)
- `member_number` - Unique member identifier

**Error Responses:**

**404 Not Found:**
```json
{
  "error": "Member not found",
  "ssn": "010190-3456"
}
```

**401 Unauthorized:**
```json
{
  "detail": "Invalid token."
}
```

## 📋 Data Types & Enums

### Gender Enum

**Django → Firestore:**
```python
GENDER_MAP = {
    0: 'unknown',
    1: 'male',
    2: 'female',
    3: 'other'
}
```

**Firestore → Django:**
```python
GENDER_REVERSE_MAP = {
    'unknown': 0,
    'male': 1,
    'female': 2,
    'other': 3
}
```

### Housing Situation Enum

**Django → Firestore:**
```python
HOUSING_MAP = {
    0: 'unknown',
    1: 'owner',
    2: 'rental',
    3: 'cooperative',
    4: 'family',
    5: 'other',
    6: 'homeless'
}
```

**Firestore → Django:**
```python
HOUSING_REVERSE_MAP = {
    'unknown': 0,
    'owner': 1,
    'rental': 2,
    'cooperative': 3,
    'family': 4,
    'other': 5,
    'homeless': 6
}
```

### Action Types

**Sync Queue Actions:**
- `create` - New member created
- `update` - Existing member updated
- `delete` - Member deleted/deactivated

### Sync Status

**Queue Status Values:**
- `pending` - Waiting to be synced
- `synced` - Successfully synced
- `failed` - Sync failed

## 🔄 Complete Sync Flow

### Firestore → Django (Push)

```bash
# 1. Cloud Function calls Django API to apply changes
curl -X POST \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/apply/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [
      {
        "kennitala": "010190-3456",
        "action": "update",
        "fields": {
          "email": "newemail@example.com"
        }
      }
    ]
  }'

# Response includes sync_queue_id for each change
# {
#   "results": [
#     {
#       "kennitala": "010190-3456",
#       "status": "success",
#       "sync_queue_id": 123
#     }
#   ]
# }

# 2. Mark as synced in Firestore
# Cloud Function updates /sync_queue/{docId}:
# {
#   "sync_status": "synced",
#   "synced_at": Timestamp
# }
```

### Django → Firestore (Pull)

```bash
# 1. Get pending changes from Django
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/pending/" \
  -H "Authorization: Token $TOKEN"

# Response:
# {
#   "changes": [
#     {
#       "id": 124,
#       "ssn": "020290-1234",
#       "action": "update",
#       "fields_changed": {"email": "new@example.com"}
#     }
#   ]
# }

# 2. For 'create' action, get full member data
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/member/020290-1234/" \
  -H "Authorization: Token $TOKEN"

# 3. Apply to Firestore
# Cloud Function updates /members/0202901234

# 4. Mark as synced in Django
curl -X POST \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/mark-synced/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": [124]}'
```

## 🧪 Testing

### Test Authentication

```bash
# Test with valid token
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/" \
  -H "Authorization: Token $TOKEN"

# Expected: 200 OK with status data

# Test with invalid token
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/" \
  -H "Authorization: Token invalid-token"

# Expected: 401 Unauthorized
```

### Test Pending Changes

```bash
# Get all pending changes
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/pending/" \
  -H "Authorization: Token $TOKEN"

# Get changes since specific time
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/pending/?since=2025-11-05T00:00:00Z" \
  -H "Authorization: Token $TOKEN"
```

### Test Apply Changes

```bash
# Create test member first in Django admin
# SSN: 010190-0000, Name: Test Member

# Update via API
curl -X POST \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/apply/" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [
      {
        "kennitala": "010190-0000",
        "action": "update",
        "fields": {
          "email": "test.updated@example.com"
        }
      }
    ]
  }'

# Verify in Django admin
```

### Test Member Retrieval

```bash
# Get member by SSN
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/member/010190-0000/" \
  -H "Authorization: Token $TOKEN"

# Test non-existent member
curl -X GET \
  "https://starf.sosialistaflokkurinn.is/felagar/api/sync/member/999999-9999/" \
  -H "Authorization: Token $TOKEN"

# Expected: 404 Not Found
```

## 🐛 Error Handling

### Common Errors

#### 401 Unauthorized

**Cause**: Invalid or missing API token

**Solution**:
```bash
# Get valid token from Secret Manager
TOKEN=$(gcloud secrets versions access latest --secret=django-api-token)

# Use in request
curl -H "Authorization: Token $TOKEN" ...
```

#### 404 Not Found

**Cause**: Member with given SSN doesn't exist

**Solution**:
- Verify SSN format (with hyphen: "010190-3456")
- Check if member exists in Django admin
- Ensure member wasn't soft-deleted

#### 400 Bad Request

**Cause**: Invalid request format or missing fields

**Common Issues**:
```bash
# ❌ Missing Authorization header
curl https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/

# ✅ With Authorization
curl -H "Authorization: Token $TOKEN" \
  https://starf.sosialistaflokkurinn.is/felagar/api/sync/status/

# ❌ Invalid timestamp format
curl "...?since=2025-11-05"

# ✅ Proper ISO 8601 format
curl "...?since=2025-11-05T00:00:00Z"

# ❌ Missing Content-Type for POST
curl -X POST -d '...' ...

# ✅ With Content-Type
curl -X POST \
  -H "Content-Type: application/json" \
  -d '...' ...
```

#### 500 Internal Server Error

**Cause**: Server error in Django

**Debugging**:
```bash
# Check Django logs
~/django-ssh.sh "sudo journalctl -u gunicorn -n 50"

# Check for Python errors
~/django-ssh.sh "tail -f /home/manager/socialism/logs/django.log"
```

## 📊 Rate Limiting

**Current Limits**: None

**Recommendations**:
- Batch operations when possible
- Use pagination for large result sets
- Implement exponential backoff for retries

**Future Implementation**:
```python
# Suggested rate limiting
THROTTLE_RATES = {
    'anon': '100/hour',
    'user': '1000/hour',
    'sync': '10000/hour'  # Higher limit for sync operations
}
```

## 🔒 Security Best Practices

### Token Management

**DO**:
- Store tokens in Secret Manager
- Rotate tokens periodically
- Use separate tokens for different services
- Revoke compromised tokens immediately

**DON'T**:
- Commit tokens to git
- Share tokens via email/Slack
- Use same token for dev and prod
- Log tokens in plaintext

### Request Validation

All endpoints validate:
- Authentication token
- Request format (JSON)
- Required fields
- Data types
- SSN format

### HTTPS Only

All API requests must use HTTPS. HTTP requests are rejected.

## 📈 Performance

### Response Times

| Endpoint | Avg Response | Max Response |
|----------|--------------|--------------|
| GET /status/ | 50ms | 200ms |
| GET /pending/ | 100ms | 500ms |
| POST /apply/ | 200ms | 1000ms |
| POST /mark-synced/ | 75ms | 300ms |
| GET /member/<ssn>/ | 80ms | 400ms |

### Optimization Tips

**Batch Operations**:
```bash
# ❌ Multiple single-change requests (slow)
for change in changes:
  curl -X POST .../apply/ -d "{\"changes\": [$change]}"

# ✅ Single batch request (fast)
curl -X POST .../apply/ -d "{\"changes\": $all_changes}"
```

**Efficient Queries**:
```bash
# ✅ Use 'since' parameter to limit results
curl "...?since=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)"
```

---

**Next**: [DEPLOYMENT.md](./DEPLOYMENT.md)  
**Back**: [INDEX.md](./INDEX.md)
