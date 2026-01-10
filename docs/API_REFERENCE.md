# API Reference - Ekklesia

Yfirlit yfir öll API endpoints í Ekklesia kerfinu.

---

## Firebase Functions (svc-members)

Cloud Functions keyra á `europe-west2`. Kallaðu á þau með Firebase SDK.

### Membership

| Function | Auth | Description |
|----------|------|-------------|
| `register_member` | Public | Skrá nýjan félaga |
| `verifyMembership` | JWT | Staðfesta félagsaðild |
| `updatememberprofile` | JWT | Uppfæra prófíl |
| `softDeleteSelf` | JWT | Soft delete eigin aðgang |
| `reactivateSelf` | JWT | Endurvirkja aðgang |
| `getMemberSelf` | JWT | Sækja eigin upplýsingar |

### Address

| Function | Auth | Description |
|----------|------|-------------|
| `search_addresses` | Public | Leita að heimilisföngum (autocomplete) |
| `validate_address` | Public | Staðfesta heimilisfang |
| `validate_postal_code` | Public | Staðfesta póstnúmer |
| `get_cells_by_postal_code` | JWT | Fá sellur eftir póstnúmeri |

### Admin

| Function | Auth | Description |
|----------|------|-------------|
| `listMembers` | Admin | Lista félaga |
| `getMember` | Admin | Sækja félaga |
| `getMemberStats` | Admin | Tölfræði félaga |
| `setUserRole` | Superuser | Setja hlutverk notanda |
| `getUserRole` | Admin | Sækja hlutverk notanda |
| `hardDeleteMember` | Superuser | Eyða félaga |
| `anonymizeMember` | Superuser | Nafnleysa félaga |

### Lookups

| Function | Auth | Description |
|----------|------|-------------|
| `list_unions` | Public | Lista stéttarfélög |
| `list_job_titles` | Public | Lista starfsheiti |
| `list_countries` | Public | Lista lönd |
| `list_postal_codes` | Public | Lista póstnúmer |

---

## Django Sync API

Base URL: `https://starf.sosialistaflokkurinn.is/felagar`

Authentication: `Authorization: Token <django-api-token>`

### Member Management

#### POST /api/sync/create-member/

Búa til nýjan félaga.

**Request:**
```json
{
  "kennitala": "0000000000",
  "name": "Jón Jónsson",
  "email": "jon@example.is",
  "phone": "5551234",
  "birthday": "1980-01-01",
  "address": {
    "type": "iceland",
    "hnitnum": 2000507,
    "street": "Laugavegur",
    "number": "1",
    "postal_code": "101"
  }
}
```

**Response:**
```json
{
  "success": true,
  "django_id": 1234,
  "message": "Member created successfully"
}
```

**address.type values:**
- `iceland` - Íslenskt heimilisfang (krefst `hnitnum`)
- `foreign` - Erlent heimilisfang
- `unlocated` - Staðsetningarlaus (krefst `cell_id`)

#### POST /api/sync/soft-delete/

Soft delete félaga.

**Request:**
```json
{
  "kennitala": "0000000000",
  "deleted_at": "2025-12-15T12:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Member soft deleted",
  "deleted_at": "2025-12-15T12:00:00Z"
}
```

#### POST /api/sync/reactivate/

Endurvirkja soft-deleted félaga.

**Request:**
```json
{
  "kennitala": "0000000000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Member reactivated",
  "was_deleted": true
}
```

#### POST /api/sync/address/

Uppfæra íslenskt heimilisfang.

**Request:**
```json
{
  "kennitala": "0000000000",
  "hnitnum": 2000507
}
```

#### POST /api/sync/foreign-address/

Uppfæra erlent heimilisfang.

**Request:**
```json
{
  "kennitala": "0000000000",
  "country_id": 45,
  "street": "123 Main Street",
  "postal_code": "SW1A 1AA",
  "city": "London"
}
```

---

## Elections Service (svc-elections)

Base URL: `https://elections-service-ymzrguoifa-nw.a.run.app`

### Public Endpoints (Token-based)

#### POST /api/vote

Greiða atkvæði.

**Headers:**
```
Authorization: Bearer <voting-token>
```

**Request:**
```json
{
  "answer": "yes"
}
```

**Response:**
```json
{
  "success": true,
  "ballot_id": "uuid",
  "message": "Vote recorded successfully"
}
```

**answer values:** `yes`, `no`, `abstain`

**Errors:**
- 401: Missing/invalid token
- 404: Token not registered
- 409: Token already used
- 503: Service unavailable (retry)

#### GET /api/token-status

Athuga hvort token sé gilt.

**Headers:**
```
Authorization: Bearer <voting-token>
```

**Response:**
```json
{
  "valid": true,
  "used": false,
  "registered_at": "2025-10-09T12:00:00Z",
  "election_title": "Prófunarkosning 2025"
}
```

### S2S Endpoints (X-API-Key required)

#### POST /api/s2s/register-token

Skrá voting token (kallað af Events).

**Headers:**
```
X-API-Key: <shared-secret>
```

**Request:**
```json
{
  "token_hash": "a1b2c3d4..."
}
```

#### GET /api/s2s/results

Sækja niðurstöður kosninga.

**Response:**
```json
{
  "total_ballots": 287,
  "results": {
    "yes": 145,
    "no": 92,
    "abstain": 50
  }
}
```

---

## Events Service (svc-events)

Base URL: `https://events-service-ymzrguoifa-nw.a.run.app`

Authentication: `Authorization: Bearer <firebase-id-token>`

### Election Endpoints

#### GET /api/election

Sækja núverandi kosningar.

**Response:**
```json
{
  "id": "uuid",
  "title": "Prófunarkosning 2025",
  "status": "published",
  "voting_starts_at": "2025-10-09T11:44:22Z",
  "voting_ends_at": "2025-11-08T11:44:22Z"
}
```

#### POST /api/request-token

Óska eftir voting token.

**Response:**
```json
{
  "success": true,
  "token": "64-character-hex-string",
  "expires_at": "2025-10-10T11:44:22Z"
}
```

#### GET /api/my-status

Athuga þátttökustöðu.

**Response:**
```json
{
  "token_issued": true,
  "token_issued_at": "2025-10-09T12:00:00Z",
  "voted": false
}
```

### AI Assistant Endpoints

#### POST /api/member-assistant/chat

Spjalla við Member Assistant (RAG + web search).

**Request:**
```json
{
  "message": "Hver er stefna flokksins í húsnæðismálum?"
}
```

**Response:**
```json
{
  "response": "Stefna flokksins...",
  "sources": [
    {"title": "Húsnæðismál", "source_type": "stefna"}
  ]
}
```

#### POST /api/kimi/chat

Spjalla við Kimi sysadmin (superuser only).

---

## Health Endpoints

Allir þjónustur hafa `/health` endpoint:

```bash
curl https://events-service-ymzrguoifa-nw.a.run.app/health
curl https://elections-service-ymzrguoifa-nw.a.run.app/health
```

---

## Error Responses

Standard error format:

```json
{
  "error": "Error Type",
  "message": "Human-readable description"
}
```

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing/invalid auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Already exists/used |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable - Retry later |

---

## Rate Limiting

| Service | Limit | Window |
|---------|-------|--------|
| register_member | 5 requests | 10 minutes (per IP) |
| updatememberprofile | 5 requests | 10 minutes (per user) |

---

## Related Documentation

- [ADDRESSES.md](ADDRESSES.md) - Heimilisfangakerfi og hnitnum
- [ARCHITECTURE.md](ARCHITECTURE.md) - Kerfisarkitektúr
- [ELECTIONS.md](ELECTIONS.md) - Elections patterns
- [svc-elections README](../services/svc-elections/README.md) - Elections þjónusta
- [svc-events README](../services/svc-events/README.md) - Events þjónusta
