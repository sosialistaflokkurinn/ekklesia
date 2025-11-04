# Admin API Reference - Election Management

**Service**: Events Service (Elections Backend)
**Base URL**: `https://events-service-[hash]-[region].a.run.app/api/admin`
**Authentication**: Firebase ID Token with admin role claim
**Version**: 1.0.0
**Last Updated**: 2025-10-22

---

## Overview

The Admin API provides complete control over the election lifecycle, from creation through results publication. All endpoints require Firebase authentication and role-based access control.

### Authentication

All requests must include a valid Firebase ID token in the `Authorization` header:

```bash
Authorization: Bearer <firebase_id_token>
```

The token must contain one of the following roles in custom claims:
- `developer` - Full access to all endpoints
- `meeting_election_manager` - Create, manage, and publish elections
- `event_manager` - View elections and results (read-only)

### Response Format

All responses follow a consistent JSON format:

**Success Response (2xx)**:
```json
{
  "election": { /* election object */ },
  "message": "Human-readable success message",
  "correlation_id": "request-correlation-id"
}
```

**Error Response (4xx, 5xx)**:
```json
{
  "error": "ErrorType",
  "message": "Human-readable error message",
  "correlation_id": "request-correlation-id"
}
```

### Rate Limiting

- **Admin operations**: 100 requests per 10 seconds per user
- **Read operations**: 1000 requests per 10 seconds per user
- **Burst limit**: Returns 429 (Too Many Requests) when exceeded

### Roles & Permissions

| Endpoint | developer | meeting_election_manager | event_manager |
|----------|-----------|-------------------------|---------------|
| POST /elections | ✓ | ✓ | - |
| GET /elections | ✓ | ✓ | ✓ |
| GET /elections/:id | ✓ | ✓ | ✓ |
| PATCH /elections/:id/draft | ✓ | ✓ | - |
| PATCH /elections/:id/metadata | ✓ | ✓ | ✓ |
| POST /elections/:id/publish | ✓ | ✓ | - |
| POST /elections/:id/open | ✓ | ✓ | - |
| POST /elections/:id/close | ✓ | ✓ | - |
| POST /elections/:id/pause | ✓ | ✓ | - |
| POST /elections/:id/resume | ✓ | ✓ | - |
| POST /elections/:id/archive | ✓ | ✓ | - |
| DELETE /elections/:id | ✓ | - | - |
| GET /elections/:id/status | ✓ | ✓ | ✓ |
| GET /elections/:id/results | ✓ | ✓ | ✓ |
| GET /elections/:id/tokens | ✓ | ✓ | ✓ |

---

## Election Creation & Management

### POST /elections
Create a new election in draft status.

**Role Required**: `developer`, `meeting_election_manager`

**Request Body**:
```json
{
  "title": "Board Member Election 2025",
  "description": "Election for annual board member positions",
  "question": "Do you approve the proposed constitutional amendments?",
  "answers": ["Yes", "No", "Abstain"]
}
```

**Parameters**:
- `title` (string, required): Election title (max 255 characters)
- `description` (string, optional): Detailed description of the election
- `question` (string, required): The question being voted on
- `answers` (array<string>, required): Possible answers (minimum 2)

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Board Member Election 2025",
  "description": "Election for annual board member positions",
  "question": "Do you approve the proposed constitutional amendments?",
  "answers": ["Yes", "No", "Abstain"],
  "status": "draft",
  "created_by": "user-firebase-uid",
  "created_at": "2025-10-22T14:30:00Z",
  "updated_at": "2025-10-22T14:30:00Z"
}
```

**cURL Example**:
```bash
curl -X POST https://events-service.run.app/api/admin/elections \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Board Member Election 2025",
    "question": "Approve amendments?",
    "answers": ["Yes", "No", "Abstain"]
  }'
```

**Error Responses**:
- `400 Bad Request` - Missing or invalid fields
- `401 Unauthorized` - Invalid or missing Firebase token
- `403 Forbidden` - User lacks required role
- `500 Internal Server Error` - Database error

---

### GET /elections
List all elections with optional filtering.

**Role Required**: `developer`, `meeting_election_manager`, `event_manager`

**Query Parameters**:
- `status` (string, optional): Filter by status (draft, published, open, closed, paused, archived, deleted)
- `limit` (integer, default 50): Maximum results to return
- `offset` (integer, default 0): Result offset for pagination

**Response** (200 OK):
```json
{
  "elections": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Board Member Election 2025",
      "status": "draft",
      "created_at": "2025-10-22T14:30:00Z",
      "updated_at": "2025-10-22T14:30:00Z",
      "created_by": "user-uid"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "Budget Approval Vote",
      "status": "published",
      "created_at": "2025-10-20T10:15:00Z",
      "updated_at": "2025-10-22T09:45:00Z",
      "created_by": "user-uid"
    }
  ],
  "limit": 50,
  "offset": 0,
  "count": 2
}
```

**cURL Example**:
```bash
# List all draft elections
curl -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections?status=draft&limit=20"
```

---

### GET /elections/:id
Get details for a specific election.

**Role Required**: `developer`, `meeting_election_manager`, `event_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Board Member Election 2025",
  "description": "Election for annual board member positions",
  "question": "Do you approve the proposed constitutional amendments?",
  "answers": ["Yes", "No", "Abstain"],
  "status": "draft",
  "created_by": "user-firebase-uid",
  "created_at": "2025-10-22T14:30:00Z",
  "updated_at": "2025-10-22T14:30:00Z"
}
```

**cURL Example**:
```bash
curl -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections/550e8400-e29b-41d4-a716-446655440000"
```

---

### PATCH /elections/:id/draft
Edit an election in draft status (all fields).

**Role Required**: `developer`, `meeting_election_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Request Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "question": "Updated question?",
  "answers": ["Yes", "No", "Maybe"]
}
```

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Updated Title",
  "description": "Updated description",
  "question": "Updated question?",
  "answers": ["Yes", "No", "Maybe"],
  "status": "draft",
  "updated_at": "2025-10-22T14:35:00Z"
}
```

**Constraints**:
- Only draft elections can be edited via this endpoint
- Use PATCH /elections/:id/metadata for published elections

**Error Responses**:
- `400 Bad Request` - Election not in draft status
- `404 Not Found` - Election not found

---

### PATCH /elections/:id/metadata
Edit election metadata (title, description only).

**Role Required**: `developer`, `meeting_election_manager`, `event_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Request Body**:
```json
{
  "title": "Updated Title",
  "description": "Updated description"
}
```

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Updated Title",
  "description": "Updated description",
  "status": "published",
  "updated_at": "2025-10-22T14:35:00Z"
}
```

**Use Cases**:
- Fix typos in title or description
- Update description before voting opens
- Allowed on any election status

---

## Election Lifecycle

### POST /elections/:id/publish
Publish an election (draft → published).

**Role Required**: `developer`, `meeting_election_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "published",
  "published_at": "2025-10-22T15:00:00Z",
  "updated_at": "2025-10-22T15:00:00Z"
}
```

**Constraints**:
- Only draft elections can be published
- Once published, voting can be opened

**cURL Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections/550e8400-e29b-41d4-a716-446655440000/publish"
```

---

### POST /elections/:id/open
Open voting (published → open, generate voting tokens).

**Role Required**: `developer`, `meeting_election_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Request Body** (optional):
```json
{
  "member_count": 287
}
```

**Response** (200 OK):
```json
{
  "message": "Election opened for voting",
  "election": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "open",
    "voting_start_time": "2025-10-22T15:05:00Z",
    "updated_at": "2025-10-22T15:05:00Z"
  },
  "tokens_generated": 287
}
```

**Actions**:
1. Transitions election from published to open
2. Generates one-time voting tokens for eligible members
3. Records voting start time
4. Logs audit event

**cURL Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"member_count": 287}' \
  "https://events-service.run.app/api/admin/elections/550e8400-e29b-41d4-a716-446655440000/open"
```

---

### POST /elections/:id/close
Close voting (open/paused → closed).

**Role Required**: `developer`, `meeting_election_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "closed",
  "closed_at": "2025-10-22T15:20:00Z",
  "updated_at": "2025-10-22T15:20:00Z"
}
```

**Actions**:
1. Stops accepting new ballots
2. Records voting end time
3. Enables results viewing

---

### POST /elections/:id/pause
Pause voting (open → paused).

**Role Required**: `developer`, `meeting_election_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "paused",
  "updated_at": "2025-10-22T15:10:00Z"
}
```

**Use Case**: Temporarily stop voting without closing

---

### POST /elections/:id/resume
Resume voting (paused → open).

**Role Required**: `developer`, `meeting_election_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "open",
  "updated_at": "2025-10-22T15:15:00Z"
}
```

---

### POST /elections/:id/archive
Archive a closed election (closed → archived).

**Role Required**: `developer`, `meeting_election_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "archived",
  "archived_at": "2025-10-22T15:30:00Z",
  "updated_at": "2025-10-22T15:30:00Z"
}
```

**Use Case**: Move completed elections to archive for historical records

---

### DELETE /elections/:id
Soft delete a draft election (draft → deleted).

**Role Required**: `developer` (destructive operation)

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "message": "Election draft deleted successfully",
  "election": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "deleted",
    "deleted_at": "2025-10-22T15:35:00Z"
  }
}
```

**Constraints**:
- Only draft elections can be deleted
- Soft delete (not permanently removed)
- Requires developer role

---

## Statistics & Results

### GET /elections/:id/status
Get election current status and statistics.

**Role Required**: `developer`, `meeting_election_manager`, `event_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "election": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Board Member Election 2025",
    "description": "Election for annual board member positions",
    "status": "open",
    "created_at": "2025-10-22T14:30:00Z",
    "updated_at": "2025-10-22T15:10:00Z",
    "voting_period": {
      "start": "2025-10-22T15:05:00Z",
      "end": null,
      "published_at": "2025-10-22T15:00:00Z",
      "closed_at": null
    }
  },
  "token_statistics": {
    "total": 287,
    "used": 156,
    "unused": 131,
    "participation_rate": "54.36%"
  }
}
```

**Use Case**: Monitor voting progress in real-time during election

---

### GET /elections/:id/results
Get election results and vote distribution.

**Role Required**: `developer`, `meeting_election_manager`, `event_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "election": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Board Member Election 2025",
    "question": "Do you approve the proposed constitutional amendments?",
    "status": "closed"
  },
  "results": {
    "total_votes": 156,
    "eligible_voters": 287,
    "participation_rate": "54.36%",
    "answers": [
      {
        "text": "Yes",
        "votes": 120,
        "percentage": "76.92%"
      },
      {
        "text": "No",
        "votes": 28,
        "percentage": "17.95%"
      },
      {
        "text": "Abstain",
        "votes": 8,
        "percentage": "5.13%"
      }
    ]
  }
}
```

**Use Case**: View detailed results after voting closes

---

### GET /elections/:id/tokens
Get voting token distribution statistics.

**Role Required**: `developer`, `meeting_election_manager`, `event_manager`

**Path Parameters**:
- `id` (string, required): Election ID

**Response** (200 OK):
```json
{
  "election": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Board Member Election 2025",
    "status": "closed"
  },
  "token_distribution": {
    "total": 287,
    "used": 156,
    "unused": 131,
    "expired": 0,
    "usage_rate": "54.36%"
  },
  "token_timeline": {
    "first_issued": "2025-10-22T15:05:00Z",
    "last_issued": "2025-10-22T15:05:30Z",
    "avg_expiration_hours": "24.00"
  }
}
```

**Use Case**: Audit token generation and usage for security investigation

---

## Error Handling

### Common Error Codes

**400 Bad Request**
```json
{
  "error": "Bad Request",
  "message": "Election must be in draft status to edit. Current status: published",
  "correlation_id": "abc-123"
}
```

**404 Not Found**
```json
{
  "error": "Not Found",
  "message": "Election not found",
  "correlation_id": "abc-123"
}
```

**401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing Firebase authentication token",
  "correlation_id": "abc-123"
}
```

**403 Forbidden**
```json
{
  "error": "Forbidden",
  "message": "User does not have required 'meeting_election_manager' role",
  "correlation_id": "abc-123"
}
```

**429 Too Many Requests**
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please wait before retrying.",
  "retryAfter": 5,
  "correlation_id": "abc-123"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal Server Error",
  "message": "Failed to create election",
  "correlation_id": "abc-123"
}
```

---

## Complete Election Lifecycle Example

### Step 1: Create Election (Draft)
```bash
ELECTION_ID=$(curl -X POST \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Board Member Election 2025",
    "question": "Approve constitutional amendments?",
    "answers": ["Yes", "No", "Abstain"]
  }' \
  https://events-service.run.app/api/admin/elections \
  | jq -r '.id')

echo "Created election: $ELECTION_ID"
```

### Step 2: Review & Publish
```bash
# Check election details
curl -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections/$ELECTION_ID"

# Publish to members
curl -X POST \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections/$ELECTION_ID/publish"
```

### Step 3: Open Voting
```bash
# Open voting and generate tokens
curl -X POST \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"member_count": 287}' \
  "https://events-service.run.app/api/admin/elections/$ELECTION_ID/open"

# Monitor progress
curl -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections/$ELECTION_ID/status"
```

### Step 4: Close & View Results
```bash
# Close voting after 5 minutes
curl -X POST \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections/$ELECTION_ID/close"

# View results
curl -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections/$ELECTION_ID/results"

# Archive election
curl -X POST \
  -H "Authorization: Bearer $FIREBASE_TOKEN" \
  "https://events-service.run.app/api/admin/elections/$ELECTION_ID/archive"
```

---

## Audit Logging

All admin actions are logged to the `admin_audit_log` table with:
- Admin UID who performed the action
- Action type (create, update, open, close, publish, etc.)
- Election ID and title
- Changes made (before/after values)
- Timestamp and correlation ID
- IP address (masked for privacy)

This complete audit trail enables:
- Security investigation of admin actions
- Compliance audits
- Debugging of election lifecycle issues
- Accountability tracking

---

## Related Documentation

- [EPIC_24_ADMIN_LIFECYCLE.md](EPIC_24_ADMIN_LIFECYCLE.md) - Epic specification and requirements
- [PHASE_5_WEEK_1_IMPLEMENTATION.md](PHASE_5_WEEK_1_IMPLEMENTATION.md) - Week 1 implementation plan
- Elections Service (see services/elections/) - Elections service voting infrastructure
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database schema and relationships

---

**Last Updated**: 2025-10-22
**Status**: ✅ Implemented and Ready for Integration
**Version**: 1.0.0
